#!/usr/bin/env node
// MCP Cockpit（驾驶舱）管理台后端 —— 零依赖 Node 服务
// 端口 8899（仅回环），代理网关 REST API + 读写 servers.json
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = '127.0.0.1';
const PORT = 8899;
const GATEWAY = process.env.MCP_HUB_GATEWAY || 'http://127.0.0.1:8811';
const CONFIG = path.join(os.homedir(), '.config', 'mcp-hub', 'servers.json');
const HTML = path.join(__dirname, 'index.html');

// ---------- 自动恢复（auto-recover）----------
// mcp-hub 的 SSE/stdio 上游失败后不会自动重连（maxRetries=2），
// 这里定时轮询 /api/servers，对“曾连接、持续断开且非环境性下线”的服务器
// 自动执行 systemctl --user restart mcp-hub（网关重启会重建全部连接）。
const AR = {
  pollMs: 15000,            // 轮询间隔
  threshold: 4,             // 连续 N 次断开才触发（≈60s，防抖）
  cooldownMs: 5 * 60 * 1000,// 两次自动重启的最小间隔（防抖）
  maxRestartsPerServer: 2,  // 单服务器累计触发上限，超过则放弃（防永久坏节点导致循环重启）
  fetchTimeoutMs: 10000,
};
// 已知环境性下线：错误匹配这些模式时不自动重启（如本机 Zotero 未运行、上游服务本身宕机）
const ENV_OFFLINE_PATTERNS = [/ECONNREFUSED/i];

// 维护暂停开关：MCP_HUB_AUTO_RECOVER 默认启用；设为 off/0 时不再自动重启网关
const MCP_HUB_AUTO_RECOVER = (process.env.MCP_HUB_AUTO_RECOVER || 'on').toLowerCase();

const arState = {
  enabled: !(MCP_HUB_AUTO_RECOVER === 'off' || MCP_HUB_AUTO_RECOVER === '0'),
  lastCheckAt: null,
  lastResult: 'pending',      // ok | triggered | skipped-cooldown | gateway-unreachable
  lastRestartAt: null,
  lastReason: null,
  unreachableStreak: 0,
  counters: new Map(),        // name -> { wasConnected, streak, restarts, exhausted }
};

function logAr(msg) {
  const line = `[auto-recover ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const f = path.join(__dirname, 'auto-recover.log');
    try {
      if (fs.statSync(f).size > 1e6) fs.renameSync(f, f + '.old');
    } catch { /* 首次写入 */ }
    fs.appendFileSync(f, line + '\n');
  } catch { /* 日志失败不影响主流程 */ }
}

function inCooldown() {
  return arState.lastRestartAt != null && (Date.now() - arState.lastRestartAt) < AR.cooldownMs;
}

async function fetchGatewayServers() {
  if (SELFTEST) {
    if (global.__fakeDown) throw new Error('fetch failed (selftest: gateway down)');
    return JSON.parse(JSON.stringify(global.__fakeServers || []));
  }
  const r = await fetch(GATEWAY + '/api/servers', { signal: AbortSignal.timeout(AR.fetchTimeoutMs) });
  if (!r.ok) throw new Error('gateway /api/servers HTTP ' + r.status);
  const d = await r.json();
  return d.servers || [];
}

function runRestart(reason) {
  if (SELFTEST) {
    (global.__restartCalls = global.__restartCalls || []).push({ reason, at: Date.now() });
    return Promise.resolve({ ok: true, code: 0, output: 'selftest' });
  }
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const p = spawn('systemctl', ['--user', 'restart', 'mcp-hub'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.on('error', (e) => resolve({ ok: false, error: e.message }));
    p.on('close', (code) => resolve({ ok: code === 0, code, output: (out + err).trim() }));
    setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 30000);
    void reason;
  });
}

function triggerRestart(qualifying, why) {
  arState.lastRestartAt = Date.now();
  arState.lastReason = qualifying.map((s) => `${s.name}×${arState.counters.get(s.name).streak}`).join(', ') + '（' + why + '）';
  arState.lastResult = 'triggered';
  logAr(`TRIGGER: systemctl --user restart mcp-hub —— ${arState.lastReason}`);
  for (const s of qualifying) {
    const c = arState.counters.get(s.name);
    c.restarts += 1;
    if (c.restarts >= AR.maxRestartsPerServer) {
      c.exhausted = true;
      logAr(`GIVE-UP: ${s.name} 单次故障期内已触发 ${c.restarts}/${AR.maxRestartsPerServer} 次仍未恢复，暂停自动重启（重新连接后复位）`);
    }
    c.streak = 0;
  }
  runRestart(arState.lastReason).then((r) => {
    if (r.ok) logAr('RESTART OK: mcp-hub 已重启，等待上游重连');
    else logAr(`RESTART FAILED: code=${r.code} ${r.output || r.error || ''}`);
  });
}

async function autoRecoverTick() {
  if (!arState.enabled) return;
  arState.lastCheckAt = new Date().toISOString();

  let servers;
  try {
    servers = await fetchGatewayServers();
  } catch (e) {
    // 网关整体不可达：systemd Restart=always 是兼底；连续 N 次仍不可达则主动重启（受冷却限制）
    arState.unreachableStreak += 1;
    if (arState.unreachableStreak >= AR.threshold) {
      if (inCooldown()) {
        arState.lastResult = 'skipped-cooldown';
        logAr(`SKIP: 网关不可达 ×${arState.unreachableStreak}，冷却期内不重启`);
      } else {
        arState.lastResult = 'triggered';
        logAr(`TRIGGER: 网关不可达 ×${arState.unreachableStreak}（${e.message}），systemctl --user restart mcp-hub`);
        arState.lastRestartAt = Date.now();
        arState.unreachableStreak = 0;
        runRestart('gateway unreachable').then((r) => {
          if (r.ok) logAr('RESTART OK: mcp-hub 已重启');
          else logAr(`RESTART FAILED: code=${r.code} ${r.output || r.error || ''}`);
        });
      }
    } else {
      arState.lastResult = 'gateway-unreachable';
    }
    return;
  }

  arState.unreachableStreak = 0;

  // 更新每台服务器计数；清理已删除的服务器
  const seen = new Set();
  for (const s of servers) {
    seen.add(s.name);
    const c = arState.counters.get(s.name) || { wasConnected: false, streak: 0, restarts: 0, exhausted: false };
    if (s.status === 'connected') {
      c.wasConnected = true;
      c.streak = 0;
      if (c.exhausted || c.restarts > 0) {
        logAr(`RESET: ${s.name} 重新连接，恢复自动重启资格（之前触发 ${c.restarts} 次）`);
        c.exhausted = false;
      }
      c.restarts = 0;
    } else if (c.wasConnected) {
      c.streak += 1;
    }
    arState.counters.set(s.name, c);
  }
  for (const name of [...arState.counters.keys()]) if (!seen.has(name)) arState.counters.delete(name);

  // 筛选触发对象：曾连接 + 连续断开达阈 + 非环境性下线 + 未放弃
  const qualifying = servers.filter((s) => {
    if (s.status === 'connected') return false;
    const c = arState.counters.get(s.name);
    if (!c || !c.wasConnected || c.exhausted) return false;
    if (c.streak < AR.threshold) return false;
    const err = String(s.error || '');
    if (ENV_OFFLINE_PATTERNS.some((p) => p.test(err))) return false;
    return true;
  });

  if (qualifying.length) {
    if (inCooldown()) {
      arState.lastResult = 'skipped-cooldown';
      logAr(`SKIP: [${qualifying.map((s) => s.name).join(', ')}] 达阈但冷却期内，不重启`);
    } else {
      triggerRestart(qualifying, '持续断开达阈');
    }
  } else {
    arState.lastResult = 'ok';
  }
}

const SELFTEST = process.argv.includes('--selftest');

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function proxy(pathname, opts = {}) {
  try {
    const r = await fetch(GATEWAY + pathname, opts);
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, body };
  } catch (e) {
    return { status: 502, body: { error: 'gateway unreachable: ' + e.message } };
  }
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function writeConfig(cfg) {
  const tmp = CONFIG + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, CONFIG);
}

function buildEntry(body) {
  const e = {};
  const type = body.type || 'stdio';
  if (type === 'stdio') {
    if (!body.command) throw new Error('stdio 服务器需要 command');
    e.command = body.command;
    if (Array.isArray(body.args) && body.args.length) e.args = body.args;
    if (body.env && Object.keys(body.env).length) e.env = body.env;
  } else {
    if (!body.url) throw new Error('远程服务器需要 url');
    e.url = body.url;
    if (body.headers && Object.keys(body.headers).length) e.headers = body.headers;
  }
  return e;
}

function parseKV(text) {
  const out = {};
  String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return out;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = u.pathname;

  if (req.method === 'GET' && p === '/') {
    fs.readFile(HTML, (err, data) => {
      if (err) return json(res, 500, { error: 'index.html missing' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && p === '/api/health') {
    const r = await proxy('/api/health');
    return json(res, r.status, r.body);
  }

  if (req.method === 'GET' && p === '/api/servers') {
    const r = await proxy('/api/servers');
    return json(res, r.status, r.body);
  }

  // 全局刷新：mcp-hub 4.2.1 实际路由为 GET /api/refresh（POST 会 404）
  if ((req.method === 'GET' || req.method === 'POST') && p === '/api/refresh') {
    const r = await proxy('/api/refresh', { method: 'GET' });
    return json(res, r.status, r.body);
  }

  // 单服务器刷新：mcp-hub 路由为 POST /api/servers/refresh {server_name}
  if (req.method === 'POST' && p === '/api/servers/refresh') {
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    const name = String(body.server_name || '').trim();
    if (!name) return json(res, 400, { error: 'server_name required' });
    const r = await proxy('/api/servers/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_name: name })
    });
    return json(res, r.status, r.body);
  }

  if (req.method === 'POST' && p === '/api/tools/call') {
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    if (!body.server_name || !body.tool) return json(res, 400, { error: 'server_name and tool required' });
    const r = await proxy('/api/servers/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_name: body.server_name, tool: body.tool, arguments: body.arguments || {} })
    });
    return json(res, r.status, r.body);
  }

  if (req.method === 'GET' && p === '/api/config') {
    try {
      return json(res, 200, readConfig().mcpServers || {});
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'PUT' && p === '/api/servers') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const name = String(body.name || '').trim();
      if (!name) return json(res, 400, { error: '服务器名称不能为空' });
      if (!/^[\w.-]+$/.test(name)) return json(res, 400, { error: '名称只能包含字母、数字、_、-、.' });
      const entry = buildEntry(body);
      const cfg = readConfig();
      cfg.mcpServers = cfg.mcpServers || {};
      cfg.mcpServers[name] = entry;
      writeConfig(cfg);
      return json(res, 200, { ok: true, name, entry, note: '配置已写入，网关将热加载' });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  if (req.method === 'DELETE' && p.startsWith('/api/servers/')) {
    try {
      const name = decodeURIComponent(p.slice('/api/servers/'.length));
      const cfg = readConfig();
      if (!cfg.mcpServers || !(name in cfg.mcpServers)) return json(res, 404, { error: '服务器不存在' });
      delete cfg.mcpServers[name];
      writeConfig(cfg);
      return json(res, 200, { ok: true, name, note: '已删除，网关将热加载' });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && p === '/api/auto-recover') {
    const counters = {};
    for (const [name, c] of arState.counters) counters[name] = { ...c };
    return json(res, 200, {
      enabled: arState.enabled,
      pollMs: AR.pollMs,
      threshold: AR.threshold,
      cooldownMs: AR.cooldownMs,
      maxRestartsPerServer: AR.maxRestartsPerServer,
      envOfflinePatterns: ENV_OFFLINE_PATTERNS.map((p) => p.source),
      lastCheckAt: arState.lastCheckAt,
      lastResult: arState.lastResult,
      lastRestartAt: arState.lastRestartAt ? new Date(arState.lastRestartAt).toISOString() : null,
      lastReason: arState.lastReason,
      unreachableStreak: arState.unreachableStreak,
      counters
    });
  }

  json(res, 404, { error: 'not found' });
});

// ---------- 启动 ----------
if (SELFTEST) {
  // --selftest：不起 HTTP 服务，直接对 GATEWAY（可用 MCP_HUB_GATEWAY 指向假网关）跑决策逻辑
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let failures = 0;
    const check = (label, cond) => {
      console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
      if (!cond) failures += 1;
    };

    const st = (name, status, error) => ({ name, transportType: 'sse', status, error, capabilities: { tools: [] } });
    const setFake = (servers) => { global.__fakeServers = servers; };

    // 场景 1：全部连接 → ok，不重启
    setFake([st('a', 'connected'), st('b', 'connected')]);
    await autoRecoverTick(); await sleep(20); await autoRecoverTick();
    check('S1 all connected -> lastResult=ok, no restart', arState.lastResult === 'ok' && arState.lastRestartAt == null);

    // 场景 2：曾连接的 a 持续断开（DNS 类瞬时错误）→ 达阈触发重启
    arState.lastRestartAt = null; // 重置冷却（测试隔离）
    setFake([st('a', 'disconnected', 'SSE error: TypeError: fetch failed: getaddrinfo EAI_AGAIN a.example.com'), st('b', 'connected')]);
    for (let i = 0; i < AR.threshold - 1; i++) { await autoRecoverTick(); }
    check('S2 below threshold -> no restart', arState.lastRestartAt == null);
    await autoRecoverTick();
    check('S2 at threshold -> triggered', arState.lastResult === 'triggered' && arState.lastRestartAt != null);

    // 场景 3：触发后重启未生效、冷却期内仍断开 → skipped-cooldown（防抖）
    let s3 = null;
    for (let i = 0; i < AR.threshold + 2 && s3 !== 'skipped-cooldown'; i++) {
      await autoRecoverTick();
      s3 = arState.lastResult;
    }
    check('S3 in cooldown -> skipped-cooldown', s3 === 'skipped-cooldown');

    // 场景 4：环境性下线（ECONNREFUSED，如 Zotero 未运行）→ 永不触发
    arState.lastRestartAt = null;
    setFake([st('a', 'connected'), st('zotero', 'disconnected', 'SSE error: TypeError: fetch failed: connect ECONNREFUSED 127.0.0.1:23120')]);
    await autoRecoverTick(); // zotero 首次出现，未连接过
    setFake([st('a', 'connected'), st('zotero', 'disconnected', 'SSE error: TypeError: fetch failed: connect ECONNREFUSED 127.0.0.1:23120')]);
    for (let i = 0; i < AR.threshold + 2; i++) { await autoRecoverTick(); }
    check('S4 ECONNREFUSED env-offline -> never triggers', arState.lastRestartAt == null && arState.lastResult === 'ok');

    // 场景 5：从未连接过的服务器 → 不触发
    arState.lastRestartAt = null;
    setFake([st('a', 'connected'), st('new', 'disconnected', 'SSE error: timeout')]);
    for (let i = 0; i < AR.threshold + 2; i++) { await autoRecoverTick(); }
    check('S5 never-connected -> no trigger', arState.lastRestartAt == null);

    // 场景 6：网关不可达 → 连续 N 次触发重启（受冷却限制）
    arState.lastRestartAt = null; global.__fakeDown = true;
    for (let i = 0; i < AR.threshold - 1; i++) { await autoRecoverTick(); }
    check('S6 unreachable below threshold', arState.lastRestartAt == null && arState.lastResult === 'gateway-unreachable');
    await autoRecoverTick();
    check('S6 unreachable at threshold -> triggered', arState.lastResult === 'triggered' && arState.lastRestartAt != null);
    global.__fakeDown = false;

    // 场景 7：永久坏节点 → 超过 maxRestartsPerServer 后放弃（防循环重启）
    AR.cooldownMs = 10; // 缩短冷却以加速测试
    arState.lastRestartAt = null;
    setFake([st('a', 'disconnected', 'SSE error: timeout')]);
    let triggers = 0;
    for (let i = 0; i < AR.threshold + 1; i++) { await autoRecoverTick(); if (arState.lastResult === 'triggered') triggers++; }
    check('S7 first trigger for permanently-broken a', triggers === 1 && arState.counters.get('a').restarts === 1);
    // 冷却过后仍断开 → 第二次触发
    await sleep(30); arState.counters.get('a').streak = 0;
    for (let i = 0; i < AR.threshold + 1; i++) { await autoRecoverTick(); if (arState.lastResult === 'triggered') triggers++; }
    check('S7 second trigger allowed', arState.counters.get('a').restarts === 2);
    await sleep(30); arState.counters.get('a').streak = 0;
    for (let i = 0; i < AR.threshold + 1; i++) { await autoRecoverTick(); if (arState.lastResult === 'triggered') triggers++; }
    check('S7 exhausted after maxRestartsPerServer', arState.counters.get('a').exhausted === true && triggers === 2);
    // 重新连接后复位
    setFake([st('a', 'connected')]);
    await autoRecoverTick();
    check('S7 reconnected -> exhausted reset', arState.counters.get('a').exhausted === false);

    console.log(failures === 0 ? 'SELFTEST: ALL PASS' : `SELFTEST: ${failures} FAILED`);
    process.exit(failures === 0 ? 0 : 1);
  })();
} else {
  server.listen(PORT, HOST, () => {
    console.log(`MCP Cockpit: http://${HOST}:${PORT} (config: ${CONFIG})`);
    console.log(`auto-recover: poll=${AR.pollMs}ms threshold=${AR.threshold} cooldown=${Math.round(AR.cooldownMs / 1000)}s maxRestarts/server=${AR.maxRestartsPerServer}`);
    setInterval(() => { autoRecoverTick().catch((e) => logAr('tick error: ' + e.message)); }, AR.pollMs);
    setTimeout(() => { autoRecoverTick().catch(() => {}); }, 3000); // 启动后先跑一轮
  });
}
