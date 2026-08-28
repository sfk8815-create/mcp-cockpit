# MCP Cockpit（驾驶舱）

[mcp-hub](https://github.com/ravitemer/mcp-hub) 网关的**零依赖 Web 管理台 + 自动恢复看门狗**。
单文件 Node 后端（`server.js`）+ 单页前端（`index.html`），无 package.json、无需安装任何依赖。

A **zero-dependency web cockpit & auto-recovery watchdog** for the [mcp-hub](https://github.com/ravitemer/mcp-hub) gateway. One Node file (`server.js`) + one HTML page (`index.html`) — no package.json, nothing to install.

**[🇨🇳 中文文档（含部署向导）](#-中文文档)** · **[🇬🇧 English docs (deployment guide)](#-english-docs)**

---

## 🇨🇳 中文文档

### 这是什么？

> **一份 MCP 配置，服务你所有的 AI 客户端——看得见、管得了、会自愈。**

你的电脑上装着 Codex、Claude Code、Cursor、Trae、Windsurf、Cline、Zed……只要支持 MCP 的 AI 客户端，理论上都能用上同一批 MCP 服务器——但现实是：每个客户端都有自己的配置格式和设置入口，加一个工具就要挨个改 N 遍。

MCP Cockpit 把这一切收拢成**一个统一端点 + 一个浏览器驾驶舱**：所有 MCP 服务器在这里集中增删、刷新、测试，每个客户端只需连上这一个端点；加一个新工具，全部客户端立刻生效。它同时带一个**自愈看门狗**——某台服务器持续掉线时自动重启网关恢复，不用半夜爬起来巡检。

### 核心优势

- **一份配置，全端共享**：所有客户端连同一个统一端点；新增服务器一处生效，无需逐个客户端设置
- **可视化管控，零 API 知识**：添加 / 删除 / 刷新服务器全是一键操作——不用编辑配置文件，不用记端点
- **一键调用测试**：参数、环境变量、超时直接在页面里填，当场看结果——不用写一行客户端代码
- **自愈看门狗**：持续掉线自动触发重启，带防抖 / 冷却 / 单服务器上限制防止失控；维护时一键暂停（`MCP_HUB_AUTO_RECOVER=off`）
- **配置备份/恢复**：一键导出、单文件恢复——再也不怕改坏配置
- **本地优先，零依赖**：只听 `127.0.0.1`，数据不出本机；无 package.json，Node 直接跑

### 📖 部署向导

> 全程只需终端（Windows 用 PowerShell）+ 浏览器。**三步跑起来：取代码 → 一键安装 → 一键启动**。

#### 第 0 步：你需要准备什么

| 需要 | 说明 |
|---|---|
| Linux / macOS / Windows 任一 | 网关和管理台都跑在你自己的电脑上，数据不出本机 |
| 一个终端（Terminal） | Ubuntu: `Ctrl+Alt+T`；macOS: Spotlight 搜 "Terminal"；Windows: PowerShell |

> Node.js 不用自己装——第 2 步的一键脚本会检查并自动安装。

#### 第 1 步：获取项目代码

**方式 A：git clone（推荐）**
```bash
git clone https://github.com/<你的用户名>/mcp-cockpit.git
cd mcp-cockpit
```

**方式 B：不会用 git？** 打开 GitHub 仓库页面 → 绿色 **Code** 按钮 → **Download ZIP** → 解压，然后：
```bash
cd <解压出的 mcp-cockpit 目录>
```

#### 第 2 步：一键安装（依赖 + 配置模板）

**Linux / macOS：**
```bash
bash scripts/install.sh
```

**Windows（PowerShell 运行，或在文件管理器里双击 `scripts\install.bat`）：**
```powershell
.\scripts\install.bat
```

脚本自动做三件事：

1. **检查 Node.js ≥ 18** —— 缺失时自动用 nvm 安装（Windows：提示你用 `winget` / 官网安装后重跑）
2. **安装 mcp-hub 网关**（`npm install -g`）—— 已装则跳过
3. **生成配置模板** `~/.config/mcp-hub/servers.json`（一个本地 filesystem 服务器 + 一个远程 Context7）—— **绝不覆盖已有配置**

预期输出：`✅ 安装完成！`。任何一步失败，脚本都会明确告诉你该做什么。

#### 第 3 步：一键启动

**Linux / macOS：**
```bash
bash scripts/start.sh    # 网关后台 + 管理台前台；Ctrl+C 停止全部
```

**Windows：** 双击 `scripts\start-windows.bat`（网关与管理台各开一个窗口）

浏览器打开 [http://127.0.0.1:8899](http://127.0.0.1:8899)，你应该看到：服务器列表（filesystem / context7）、每台的工具数量、"自动恢复: 已启用"徽章。点进某台服务器可以浏览工具、测试调用。**到这里，核心功能已经跑通了！**

#### 第 4 步：（可选）设置自启，不再手动敲命令

按你的系统选择：**Linux → 4a（systemd）** / **Windows → 4b** / **macOS → 4c**

##### 4a. Linux（systemd）

```bash
# 1) 复制单元模板到 user systemd 目录
cp docs/systemd/mcp-hub.service docs/systemd/mcp-hub-web.service ~/.config/systemd/user/

# 2) 修改网关单元的 ExecStart 路径（改成 which mcp-hub 的输出）
nano ~/.config/systemd/user/mcp-hub.service

# 3) 修改管理台单元的项目路径（改成第 1 步的目录）
nano ~/.config/systemd/user/mcp-hub-web.service

# 4) 让 systemd 重新读取配置，并启用 + 立即启动
systemctl --user daemon-reload
systemctl --user enable --now mcp-hub mcp-hub-web

# 5)（可选）注销后仍保持运行：
loginctl enable-linger $USER
```

> 💡 说明：`enable` = 登录时自动启动；`--now` = 现在就启动。user service 默认跟随你的登录会话，第 5 条 `enable-linger` 让它在未登录时也运行（真正意义的"开机自启"）。

##### 4b. Windows（一键脚本 + 登录自启）

按 `Win+R`，输入 `shell:startup` 回车 → 在打开的文件夹里**新建快捷方式**，指向 `scripts\start-windows.bat`。以后每次登录自动启动。

停止：关闭那两个窗口即可（或在任务管理器结束 `mcp-hub` 与 `node server.js` 进程）。

##### 4c. macOS（简略）

macOS 没有 systemd，`docs/systemd/` 的单元模板不适用。日常使用：在终端跑第 3 步的一键脚本；需要开机自启可用"系统设置 → 通用 → 登录项"添加 `scripts/start.sh`（或写两个 launchd plist，进阶）。

#### 第 5 步：验证一切正常

```bash
systemctl --user status mcp-hub mcp-hub-web   # Linux：两个都应是 active (running)
curl -s http://127.0.0.1:8899/api/health     # 网关健康
curl -s http://127.0.0.1:8899/api/auto-recover | head   # 看门狗状态
journalctl --user -u mcp-hub-web -f          # Linux：实时日志（Ctrl+C 退出）
```

浏览器再开一次 [http://127.0.0.1:8899](http://127.0.0.1:8899) 确认页面正常。🎉

<details>
<summary><b>手动模式：逐步安装（想理解细节的人看这里）</b></summary>

不想用一键脚本的话，可以手动四步完成：

**① 安装 Node.js（≥ 18）** —— 先 `node -v` 检查，≥18 可跳过；否则按系统四选一：

**方式 A：nvm（最通用，推荐新手）**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 关闭终端重新打开，然后：
nvm install 22
node -v    # 应显示 v22.x
```

**方式 B：系统包管理器（Debian/Ubuntu）**
```bash
sudo apt update && sudo apt install -y nodejs npm
node -v    # 若 <18，请改用方式 A 或 C
```

**方式 C：mise（多版本管理，进阶）**
```bash
curl https://mise.run | sh
mise use -g node@22
node -v    # 应显示 v22.x
```

**方式 D：Windows（PowerShell）**
```powershell
winget install OpenJS.NodeJS.LTS    # 或从 https://nodejs.org 下载 .msi 安装包
# 关闭并重新打开 PowerShell，然后：
node -v    # 应显示 v20.x 或更高
```

**② 安装 mcp-hub 网关**
```bash
npm install -g mcp-hub
which mcp-hub     # 记下输出的完整路径（Windows: where mcp-hub）
mcp-hub --version # 应显示 4.x
```

**③ 手动创建网关配置**
```bash
mkdir -p ~/.config/mcp-hub
nano ~/.config/mcp-hub/servers.json    # 不熟悉 nano？换成 vim / code；Windows 用 notepad
```

粘贴最小示例（一个本地 stdio 服务器 + 一个远程 http 服务器），保存退出（nano: `Ctrl+O` 回车 `Ctrl+X`）：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {}
    }
  }
}
```

- `filesystem`：stdio 类型——网关会帮你启动这个命令（把 `/tmp` 换成你想授权的目录）
- `context7`：http(SSE) 类型——直连远程服务，无需本地进程
- ⚠️ 如果某个服务器需要 API key，写在它的 `env` / `headers` 里，然后收紧权限：

```bash
chmod 600 ~/.config/mcp-hub/servers.json   # 只允许你自己读写（Linux/macOS；Windows 可跳过）
```

**④ 手动启动（替代方案）**：开两个终端，一个运行 `mcp-hub --port 8811 --config ~/.config/mcp-hub/servers.json`，另一个 `cd` 到项目目录运行 `node server.js`。

</details>

### 常见问题（FAQ）

**Q: 端口被占用 / 想换端口？**
```bash
ss -ltnp | grep -E '8899|8811'        # 看谁占着（Linux/macOS）
MCP_HUB_PORT=9000 node server.js      # 管理台换端口（网关同理用 --port）
```
Windows：`netstat -ano | findstr ":8899"` 看占用。

**Q: 页面打开但显示"网关不可达"？**
先确认网关活着：`systemctl --user status mcp-hub`（Linux）；再看它的日志 `journalctl --user -u mcp-hub -n 50`。常见原因是 servers.json 里某台服务器配置有误导致网关启动失败。

**Q: 维护期间想停网关，又怕看门狗把它拉起来？**
把 `~/.config/systemd/user/mcp-hub-web.service` 里的 `Environment=MCP_HUB_AUTO_RECOVER=on` 改成 `off`，然后：
```bash
systemctl --user daemon-reload && systemctl --user restart mcp-hub-web
systemctl --user stop mcp-hub        # 现在停掉后不会被自动拉起
```
Windows：启动前在 PowerShell 执行 `set MCP_HUB_AUTO_RECOVER=off`（或 `setx MCP_HUB_AUTO_RECOVER off` 持久生效）。

**Q: 看门狗的动作记录在哪？**
项目目录下的 `auto-recover.log`（1MB 自动轮转）+ `journalctl --user -u mcp-hub-web`（Linux）。

**Q: 看门狗的触发规则？**
每 15s 轮询一次；某服务器**连续 4 次**（≈60s）断开才触发重启（防抖）；两次自动重启间隔 ≥5min；单服务器累计 2 次后放弃（防循环）且恢复连接后重置；错误为 `ECONNREFUSED` 视为环境性下线（如依赖的桌面应用没开），不重启。

### 环境变量 / 配置参考

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MCP_HUB_PORT` | `8899` | 管理台端口 |
| `MCP_HUB_HOST` | `127.0.0.1` | 管理台监听地址（保持 localhost） |
| `MCP_HUB_GATEWAY` | `http://127.0.0.1:8811` | 网关地址 |
| `MCP_HUB_CONFIG` | `~/.config/mcp-hub/servers.json` | 配置文件路径（管理台直接读写） |
| `MCP_HUB_AUTO_RECOVER` | `on` | 看门狗开关：`off`/`0` = 暂停自动重启（维护模式） |

### API 一览（管理台，均代理到网关或直接操作配置）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 网关健康 |
| GET | `/api/servers` | 服务器列表 |
| GET / POST | `/api/refresh` | 全局刷新（mcp-hub 4.2.x 实际路由为 GET） |
| POST | `/api/servers/refresh` | 单台刷新 `{server_name}`（4.2.x） |
| POST | `/api/servers` | 添加服务器 `{name, type: stdio\|http, ...}` |
| PUT / DELETE | `/api/servers/:name` | 修改 / 删除（写 servers.json + reload） |
| POST | `/api/call` | 调用工具 `{server_name, tool_name, arguments, env?, timeout?}` |
| POST | `/api/config/backup` / `/api/config/export` | 备份 / 导出配置 JSON |
| GET | `/api/auto-recover` | 看门狗状态（含 `enabled`） |

### 目录结构

```
mcp-cockpit/
├── server.js                  # 后端：HTTP 路由 + 网关代理 + 自动恢复引擎（零依赖）
├── index.html                 # 前端：单页管理台 UI
├── scripts/
│   ├── install.sh             # 一键安装（Linux/macOS）：Node + mcp-hub + 配置模板
│   ├── install.bat            # 一键安装（Windows）
│   ├── start.sh               # 一键启动（Linux/macOS）：网关后台 + 管理台前台
│   ├── start-windows.bat      # 一键启动（Windows）：两个窗口
│   └── servers.json.example   # 配置模板（安装脚本复制用）
└── docs/systemd/              # systemd user service 模板（仅 Linux；mcp-hub + mcp-hub-web）
```

### 已知限制

- 面向单机 localhost 管理场景，无鉴权（依赖 `127.0.0.1` + `IPAddressAllow` 隔离，**不要直接暴露公网**）
- 依赖 mcp-hub ≥ 4.2.x 的 API（`GET /api/refresh`、`POST /api/servers/refresh`）
- 自动恢复通过重启整个网关实现（mcp-hub 无单服务器 stdio 重连 API）
- 看门狗的自动重启仅在 Linux（systemctl）生效；其他平台降级为只监控

### 许可证

MIT © Sovena contributors、西南大学·艺术人类学研究所、西南大学·中国音乐心理健康研究所
作者：石丰恺（sfklc@hotmail.com）。完整条款见 [LICENSE](LICENSE)。

### 致谢（Acknowledgments）

本项目构建于以下开源项目之上：

- [mcp-hub](https://github.com/ravitemer/mcp-hub)（MIT）—— 被管理的 MCP 网关本体；本项目仅通过其 HTTP API 交互，未复制其代码
- [Model Context Protocol（MCP）](https://github.com/modelcontextprotocol/modelcontextprotocol) —— 本项目所管理的服务器遵循的协议规范
- [MCP 官方参考实现](https://github.com/modelcontextprotocol/servers) —— README 示例中的 `@modelcontextprotocol/server-filesystem` 即出自此仓库
- [Context7](https://context7.com) —— README 示例中使用的远程 MCP 服务
- [Node.js](https://nodejs.org)（MIT）—— 运行时；本项目零第三方依赖，仅使用 Node 内置模块

---

## 🇬🇧 English docs

### What is this?

> **One MCP config, serving every AI client you run — visible, manageable, self-healing.**

Your machine has Codex, Claude Code, Cursor, Trae, Windsurf, Cline, Zed… — any MCP-capable AI client could in theory use the same set of MCP servers. In practice, though: every client has its own config format and settings UI, so adding one tool means editing N clients by hand.

MCP Cockpit pulls all of that into **one unified endpoint + one browser cockpit**: every MCP server is added, refreshed and tested in a single place; each client just connects to that one endpoint. Add a new tool once — every client gets it instantly. And it ships with a **self-healing watchdog**: when a server stays down, the gateway is restarted automatically so your stack recovers on its own.

### Core advantages

- **One config, every client**: all clients share a single unified endpoint; add a server once and it's live everywhere — no per-client setup
- **Visual management, zero API knowledge**: add / remove / refresh servers with clicks — no config files to edit, no endpoints to memorize
- **One-click call testing**: fill arguments / env / timeout right in the page and see results — no client code to write
- **Self-healing watchdog**: sustained outages trigger an automatic restart, with debounce / cooldown / per-server caps so it can't run away; one-key pause for maintenance (`MCP_HUB_AUTO_RECOVER=off`)
- **Config backup & restore**: export with one click, recover from a single file — never fear breaking your config
- **Local-first, zero dependencies**: binds to `127.0.0.1` only — data never leaves your machine; no package.json, just Node

### 📖 Deployment guide

> Terminal (PowerShell on Windows) + browser only. **Three steps to get running: get the code → one-click install → one-click start.**

#### Step 0: What you need

| Item | Notes |
|---|---|
| Linux / macOS / Windows, any of them | Everything runs on your own box; data never leaves it |
| A terminal | Ubuntu: `Ctrl+Alt+T`; macOS: Spotlight → "Terminal"; Windows: PowerShell |

> You don't need to install Node.js yourself — the step-2 script checks and installs it for you.

#### Step 1: Get the project code

**Option A: git clone (recommended)**
```bash
git clone https://github.com/<your-username>/mcp-cockpit.git
cd mcp-cockpit
```

**Option B: no git?** On the GitHub repo page → green **Code** button → **Download ZIP** → unzip, then:
```bash
cd <unzipped mcp-cockpit dir>
```

#### Step 2: One-click install (dependencies + config template)

**Linux / macOS:**
```bash
bash scripts/install.sh
```

**Windows (run in PowerShell, or double-click `scripts\install.bat` in Explorer):**
```powershell
.\scripts\install.bat
```

The script does three things automatically:

1. **Check Node.js ≥ 18** — installs via nvm if missing (Windows: tells you to use `winget` / the official site, then rerun)
2. **Install the mcp-hub gateway** (`npm install -g`) — skipped if already present
3. **Create the config template** `~/.config/mcp-hub/servers.json` (one local filesystem server + one remote Context7) — **never overwrites an existing config**

Expected output: `✅ Install complete!` If any step fails, the script tells you exactly what to do.

#### Step 3: One-click start

**Linux / macOS:**
```bash
bash scripts/start.sh    # gateway in background + console in foreground; Ctrl+C stops everything
```

**Windows:** double-click `scripts\start-windows.bat` (gateway and console in separate windows)

Open [http://127.0.0.1:8899](http://127.0.0.1:8899) in your browser — you should see the server list (filesystem / context7), tool counts, and an "auto-recovery: enabled" badge. Click a server to browse tools and test calls. **Core functionality is working now!**

#### Step 4: (Optional) Auto-start — no more manual commands

Pick by your OS: **Linux → 4a (systemd)** / **Windows → 4b** / **macOS → 4c**

##### 4a. Linux (systemd)

```bash
# 1) copy unit templates into your user systemd dir
cp docs/systemd/mcp-hub.service docs/systemd/mcp-hub-web.service ~/.config/systemd/user/

# 2) edit the gateway unit: point ExecStart at your mcp-hub (output of `which mcp-hub`)
nano ~/.config/systemd/user/mcp-hub.service

# 3) edit the console unit: point ExecStart at your project dir (from step 1)
nano ~/.config/systemd/user/mcp-hub-web.service

# 4) reload systemd, enable + start now
systemctl --user daemon-reload
systemctl --user enable --now mcp-hub mcp-hub-web

# 5) (optional) keep running even when logged out:
loginctl enable-linger $USER
```

> 💡 `enable` = start automatically at login; `--now` = start right now. User services follow your login session by default; step 5 (`enable-linger`) makes them survive logout — true boot-time autostart.

##### 4b. Windows (one-click script + logon auto-start)

Press `Win+R`, type `shell:startup`, Enter → in the folder that opens, **create a shortcut** pointing to `scripts\start-windows.bat`. It now starts at every logon.

To stop: just close those two windows (or end the `mcp-hub` and `node server.js` processes in Task Manager).

##### 4c. macOS (brief)

macOS has no systemd, so the `docs/systemd/` unit templates don't apply. Day-to-day: run the step-3 script in a terminal; for boot-time autostart, add `scripts/start.sh` via "System Settings → General → Login Items" (or write two launchd plists, advanced).

#### Step 5: Verify everything works

```bash
systemctl --user status mcp-hub mcp-hub-web   # Linux: both should be active (running)
curl -s http://127.0.0.1:8899/api/health     # gateway health
curl -s http://127.0.0.1:8899/api/auto-recover | head   # watchdog state
journalctl --user -u mcp-hub-web -f          # Linux: live logs (Ctrl+C to quit)
```

Reopen [http://127.0.0.1:8899](http://127.0.0.1:8899) to confirm the page is fine. 🎉

<details>
<summary><b>Manual mode: step-by-step install (for the curious)</b></summary>

Prefer to do it by hand? Four steps:

**① Install Node.js (≥ 18)** — check `node -v` first; if ≥18 skip, otherwise pick one:

**Option A: nvm (most portable, recommended for beginners)**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close & reopen the terminal, then:
nvm install 22
node -v    # should print v22.x
```

**Option B: distro package manager (Debian/Ubuntu)**
```bash
sudo apt update && sudo apt install -y nodejs npm
node -v    # if <18, use option A or C instead
```

**Option C: mise (multi-version manager, advanced)**
```bash
curl https://mise.run | sh
mise use -g node@22
node -v    # should print v22.x
```

**Option D: Windows (PowerShell)**
```powershell
winget install OpenJS.NodeJS.LTS    # or download the .msi installer from https://nodejs.org
# close & reopen PowerShell, then:
node -v    # should print v20.x or higher
```

**② Install the mcp-hub gateway**
```bash
npm install -g mcp-hub
which mcp-hub     # note the full path (Windows: where mcp-hub)
mcp-hub --version # should print 4.x
```

**③ Create the gateway config manually**
```bash
mkdir -p ~/.config/mcp-hub
nano ~/.config/mcp-hub/servers.json    # nano? swap for vim / code; on Windows use notepad
```

Paste a minimal example (one local stdio server + one remote http server), save & exit (nano: `Ctrl+O` Enter, `Ctrl+X`):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {}
    }
  }
}
```

- `filesystem`: stdio type — the gateway spawns this command for you (replace `/tmp` with a directory you want to expose)
- `context7`: http(SSE) type — talks directly to a remote service, no local process
- ⚠️ If any server needs an API key, put it in its `env`/`headers`, then lock the file down:

```bash
chmod 600 ~/.config/mcp-hub/servers.json   # readable/writable only by you (Linux/macOS; skip on Windows)
```

**④ Manual start (alternative)**: open two terminals — one runs `mcp-hub --port 8811 --config ~/.config/mcp-hub/servers.json`, the other `cd`s into the project dir and runs `node server.js`.

</details>

### FAQ

**Q: Port already in use / want a different port?**
```bash
ss -ltnp | grep -E '8899|8811'        # see who holds it (Linux/macOS)
MCP_HUB_PORT=9000 node server.js      # console on another port (gateway: --port)
```
Windows: `netstat -ano | findstr ":8899"` to see the holder.

**Q: Page loads but says "gateway unreachable"?**
Check the gateway is alive: `systemctl --user status mcp-hub` (Linux); then its logs: `journalctl --user -u mcp-hub -n 50`. Usually a bad server entry in servers.json makes the gateway fail to start.

**Q: I want to stop the gateway for maintenance, but fear the watchdog will resurrect it?**
In `~/.config/systemd/user/mcp-hub-web.service` change `Environment=MCP_HUB_AUTO_RECOVER=on` to `off`, then:
```bash
systemctl --user daemon-reload && systemctl --user restart mcp-hub-web
systemctl --user stop mcp-hub        # now it stays down
```
Windows: in PowerShell run `set MCP_HUB_AUTO_RECOVER=off` before starting (or `setx MCP_HUB_AUTO_RECOVER off` to persist).

**Q: Where are watchdog actions logged?**
`auto-recover.log` in the project dir (1 MB rotation) + `journalctl --user -u mcp-hub-web` (Linux).

**Q: Watchdog trigger rules?**
Polls every 15 s; a server must be down **4 polls in a row** (≈60 s) before a restart fires (debounce); ≥5 min between auto-restarts; per-server cap of 2, then GIVE-UP (counter resets on reconnect); `ECONNREFUSED` errors are treated as environmental offline (e.g. a desktop app you depend on isn't running) and never trigger a restart.

### Environment variables / config reference

| Var | Default | Meaning |
|---|---|---|
| `MCP_HUB_PORT` | `8899` | Console port |
| `MCP_HUB_HOST` | `127.0.0.1` | Console bind address (keep localhost) |
| `MCP_HUB_GATEWAY` | `http://127.0.0.1:8811` | Gateway URL |
| `MCP_HUB_CONFIG` | `~/.config/mcp-hub/servers.json` | Config file path (read/written by the console) |
| `MCP_HUB_AUTO_RECOVER` | `on` | Watchdog switch: `off`/`0` = pause auto-restart (maintenance mode) |

### API overview (console; proxies to the gateway or edits config directly)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Gateway health |
| GET | `/api/servers` | Server list |
| GET / POST | `/api/refresh` | Refresh all (mcp-hub 4.2.x route is GET) |
| POST | `/api/servers/refresh` | Refresh one `{server_name}` (4.2.x) |
| POST | `/api/servers` | Add server `{name, type: stdio\|http, ...}` |
| PUT / DELETE | `/api/servers/:name` | Modify / delete (writes servers.json + reload) |
| POST | `/api/call` | Invoke tool `{server_name, tool_name, arguments, env?, timeout?}` |
| POST | `/api/config/backup` / `/api/config/export` | Backup / export config JSON |
| GET | `/api/auto-recover` | Watchdog state (incl. `enabled`) |

### Directory layout

```
mcp-cockpit/
├── server.js                  # backend: HTTP routes + gateway proxy + auto-recovery engine (zero-dep)
├── index.html                 # frontend: single-page admin UI
├── scripts/
│   ├── install.sh             # one-click install (Linux/macOS): Node + mcp-hub + config template
│   ├── install.bat            # one-click install (Windows)
│   ├── start.sh               # one-click start (Linux/macOS): gateway bg + console fg
│   ├── start-windows.bat      # one-click start (Windows): two windows
│   └── servers.json.example   # config template (copied by the installer)
└── docs/systemd/              # systemd user service templates (Linux only; mcp-hub + mcp-hub-web)
```

### Known limitations

- For single-machine localhost administration; no auth (relies on `127.0.0.1` + `IPAddressAllow` — **never expose to the public internet**)
- Depends on mcp-hub ≥ 4.2.x APIs (`GET /api/refresh`, `POST /api/servers/refresh`)
- Auto-recovery restarts the whole gateway (mcp-hub has no per-server stdio reconnect API)
- Watchdog auto-restart only works on Linux (systemctl); other platforms degrade to monitoring-only

### License

MIT © Sovena contributors, 西南大学·艺术人类学研究所 (Institute of Art Anthropology, Southwest University), 西南大学·中国音乐心理健康研究所 (China Music Mental Health Research Institute, Southwest University)
Author: 石丰恺 (sfklc@hotmail.com). Full text in [LICENSE](LICENSE).

### Acknowledgments

This project is built on top of the following open-source work:

- [mcp-hub](https://github.com/ravitemer/mcp-hub) (MIT) — the MCP gateway being managed; this project talks to it over its HTTP API and copies none of its code
- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/modelcontextprotocol) — the protocol specification followed by the managed servers
- [MCP official reference servers](https://github.com/modelcontextprotocol/servers) — source of `@modelcontextprotocol/server-filesystem` used in the README example
- [Context7](https://context7.com) — remote MCP service used in the README example
- [Node.js](https://nodejs.org) (MIT) — runtime; this project has zero third-party dependencies and uses only Node built-ins
