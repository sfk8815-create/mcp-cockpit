# MCP Cockpit（驾驶舱）

[mcp-hub](https://github.com/ravitemer/mcp-hub) 网关的**零依赖 Web 管理台 + 自动恢复看门狗**。
单文件 Node 后端（`server.js`）+ 单页前端（`index.html`），无 package.json、无需安装任何依赖。

A **zero-dependency web cockpit & auto-recovery watchdog** for the [mcp-hub](https://github.com/ravitemer/mcp-hub) gateway. One Node file (`server.js`) + one HTML page (`index.html`) — no package.json, nothing to install.

**[🇨🇳 中文文档（含部署向导）](#-中文文档)** · **[🇬🇧 English docs (deployment guide)](#-english-docs)**

---

## 🇨🇳 中文文档

### 这是什么？

你在本机跑了一个 [mcp-hub](https://github.com/ravitemer/mcp-hub) 网关，把多个 MCP 服务器（文件系统、数据库、搜索……）聚合成一个统一端点。但 mcp-hub 本身**没有图形界面**——想增删服务器、看工具列表、测试调用，只能敲 API。

MCP Cockpit 补上这块：一个浏览器里的管理台，加上一个会在上游服务器挂掉时自动重启网关的看门狗。

### 功能一览

- **服务器管理**：添加 stdio / http(SSE) 类型的 MCP 服务器，删除、全局或单台刷新
- **工具浏览**：列出各上游服务器的全部工具（schema 可折叠）
- **调用测试**：在页面里直接填参数、环境变量、超时，一键调用看结果
- **配置备份/恢复**：导出 `servers.json` 下载，或上传文件恢复
- **自动恢复看门狗**（可选）：上游断开达阈值时自动 `systemctl --user restart mcp-hub`；带冷却、单服务器上限制与"环境性下线"豁免，可用 `MCP_HUB_AUTO_RECOVER=off` 一键暂停
- **安全**：默认只听 `127.0.0.1`（各平台均足够隔离）；Linux systemd 部署再加 `IPAddressAllow=localhost`；配置含密钥时保持 `chmod 600`（Linux/macOS）

### 📖 部署向导

> 全程只需终端（Windows 用 PowerShell）+ 浏览器。每一步都给出"复制即可执行"的命令和"你应该看到什么"。

#### 第 0 步：你需要准备什么

| 需要 | 说明 |
|---|---|
| Linux / macOS / Windows 任一 | 网关和管理台都跑在你自己的电脑上，数据不出本机 |
| 一个终端（Terminal） | Ubuntu: `Ctrl+Alt+T`；macOS: Spotlight 搜 "Terminal"；Windows: PowerShell |
| Node.js ≥ 18 | 第 1 步安装 |

#### 第 1 步：安装 Node.js（≥ 18）

先检查是否已有：

```bash
node -v
```

- 显示 `v18.x` / `v20.x` / `v22.x` 等 ≥18 的版本 → **跳过本步**
- 显示 `command not found` 或版本 <18 → 按你的系统四选一安装：

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

#### 第 2 步：安装 mcp-hub 网关

```bash
npm install -g mcp-hub
which mcp-hub     # 记下输出的完整路径，第 6 步要用（Windows: where mcp-hub）
mcp-hub --version # 应显示 4.x
```

#### 第 3 步：获取本项目代码

**方式 A：git clone（推荐）**
```bash
git clone https://github.com/<你的用户名>/mcp-cockpit.git
cd mcp-cockpit
```

**方式 B：不会用 git？** 打开 GitHub 仓库页面 → 绿色 **Code** 按钮 → **Download ZIP** → 解压到你喜欢的位置，然后：
```bash
cd <解压出的 mcp-cockpit 目录>
```

#### 第 4 步：创建网关配置

```bash
mkdir -p ~/.config/mcp-hub
nano ~/.config/mcp-hub/servers.json    # 不熟悉 nano？换成 vim / code；Windows 用 notepad
```

粘贴一个最小示例（一个本地 stdio 服务器 + 一个远程 http 服务器），保存退出（nano: `Ctrl+O` 回车 `Ctrl+X`）：

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

#### 第 5 步：先跑起来试试（不用 systemd）

开**两个终端**（Windows：打开两个 PowerShell 窗口）：

```bash
# 终端 1：启动网关
mcp-hub --port 8811 --config ~/.config/mcp-hub/servers.json
```

```bash
# 终端 2：启动管理台（先 cd 到第 3 步的项目目录）
node server.js
```

浏览器打开 [http://127.0.0.1:8899](http://127.0.0.1:8899)，你应该看到：服务器列表（filesystem / context7）、每台的工具数量、"自动恢复: 已启用"徽章。点进某台服务器可以浏览工具、测试调用。**到这里，核心功能已经跑通了！** 两个终端 `Ctrl+C` 停掉，进入第 6 步做正式部署。

#### 第 6 步：（推荐）设置自启，不再手动敲命令

按你的系统选择：**Linux → 6a（systemd）** / **Windows → 6b** / **macOS → 6c**

##### 6a. Linux（systemd）

```bash
# 1) 复制单元模板到 user systemd 目录
cp docs/systemd/mcp-hub.service docs/systemd/mcp-hub-web.service ~/.config/systemd/user/

# 2) 修改网关单元里的可执行文件路径（改成第 2 步 which mcp-hub 的输出）
nano ~/.config/systemd/user/mcp-hub.service

# 3) 修改管理台单元里的项目路径（改成第 3 步 cd 进去的那个目录）
nano ~/.config/systemd/user/mcp-hub-web.service

# 4) 让 systemd 重新读取配置，并启用 + 立即启动
systemctl --user daemon-reload
systemctl --user enable --now mcp-hub mcp-hub-web

# 5)（可选）注销后仍保持运行：
loginctl enable-linger $USER
```

> 💡 说明：`enable` = 登录时自动启动；`--now` = 现在就启动。user service 默认跟随你的登录会话，第 5 条 `enable-linger` 让它在未登录时也运行（真正意义的"开机自启"）。

##### 6b. Windows（一键脚本 + 登录自启）

```powershell
# 1) cd 到项目目录，运行一键启动脚本（网关 + 管理台各开一个窗口）
.\scripts\start-windows.bat

# 2)（可选）登录自启：按 Win+R，输入 shell:startup 回车
#    → 在打开的文件夹里，新建指向 scripts\start-windows.bat 的快捷方式
```

停止：关闭那两个窗口即可（或在任务管理器结束 `mcp-hub` 与 `node server.js` 进程）。

##### 6c. macOS（简略）

macOS 没有 systemd，`docs/systemd/` 的单元模板不适用。日常使用：直接在终端跑第 5 步的两条命令；需要开机自启可用"系统设置 → 通用 → 登录项"添加一个简单脚本（或写两个 launchd plist，进阶）。

#### 第 7 步：验证一切正常

```bash
systemctl --user status mcp-hub mcp-hub-web   # 两个都应是 active (running)
curl -s http://127.0.0.1:8899/api/health     # 网关健康
curl -s http://127.0.0.1:8899/api/auto-recover | head   # 看门狗状态
journalctl --user -u mcp-hub-web -f          # 实时日志（Ctrl+C 退出）
```

浏览器再开一次 http://127.0.0.1:8899 确认页面正常。🎉

### 常见问题（FAQ）

**Q: 端口被占用 / 想换端口？**
```bash
ss -ltnp | grep -E '8899|8811'        # 看谁占着（Linux/macOS）
MCP_HUB_PORT=9000 node server.js      # 管理台换端口（网关同理用 --port）
```
Windows：`netstat -ano | findstr ":8899"` 看占用。

**Q: 页面打开但显示"网关不可达"？**
先确认网关活着：`systemctl --user status mcp-hub`；再看它的日志 `journalctl --user -u mcp-hub -n 50`。常见原因是 servers.json 里某台服务器配置有误导致网关启动失败。

**Q: 维护期间想停网关，又怕看门狗把它拉起来？**
把 `~/.config/systemd/user/mcp-hub-web.service` 里的 `Environment=MCP_HUB_AUTO_RECOVER=on` 改成 `off`，然后：
```bash
systemctl --user daemon-reload && systemctl --user restart mcp-hub-web
systemctl --user stop mcp-hub        # 现在停掉后不会被自动拉起
```

**Q: 看门狗的动作记录在哪？**
项目目录下的 `auto-recover.log`（1MB 自动轮转）+ `journalctl --user -u mcp-hub-web`。

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
├── scripts/start-windows.bat  # Windows 一键启动脚本（网关 + 管理台）
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

You run a local [mcp-hub](https://github.com/ravitemer/mcp-hub) gateway that aggregates many MCP servers (filesystem, databases, search…) into one endpoint. But mcp-hub ships **no GUI** — managing servers means poking at raw APIs.

MCP Cockpit fills that gap: a browser-based admin console, plus an auto-recovery watchdog that restarts the gateway when upstream servers die.

### Features

- **Server management**: add stdio / http(SSE) MCP servers, delete, refresh all or one
- **Tool browser**: list every tool of each upstream (collapsible schemas)
- **Call tester**: fill arguments / env / timeout in the page, invoke, see results
- **Config backup & restore**: download `servers.json`, or upload a file to restore
- **Auto-recovery watchdog** (optional): auto `systemctl --user restart mcp-hub` when an upstream stays down; with cooldown, per-server cap and "environmental offline" exemption; pausable via `MCP_HUB_AUTO_RECOVER=off`
- **Security**: binds to `127.0.0.1` by default (sufficient on all platforms); Linux systemd adds `IPAddressAllow=localhost`; keep config `chmod 600` when it holds keys (Linux/macOS)

### 📖 Deployment guide

> Terminal (PowerShell on Windows) + browser only. Every step has copy-paste commands and "what you should see".

#### Step 0: What you need

| Item | Notes |
|---|---|
| Linux / macOS / Windows, any of them | Everything runs on your own box; data never leaves it |
| A terminal | Ubuntu: `Ctrl+Alt+T`; macOS: Spotlight → "Terminal"; Windows: PowerShell |
| Node.js ≥ 18 | Installed in step 1 |

#### Step 1: Install Node.js (≥ 18)

Check first:
```bash
node -v
```
- Prints `v18.x`/`v20.x`/`v22.x` (≥18) → **skip this step**
- `command not found` or <18 → pick one (by your OS):

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

#### Step 2: Install the mcp-hub gateway

```bash
npm install -g mcp-hub
which mcp-hub     # note the full path — needed in step 6 (Windows: where mcp-hub)
mcp-hub --version # should print 4.x
```

#### Step 3: Get the project code

**Option A: git clone (recommended)**
```bash
git clone https://github.com/<your-username>/mcp-cockpit.git
cd mcp-cockpit
```

**Option B: no git?** On the GitHub repo page → green **Code** button → **Download ZIP** → unzip, then:
```bash
cd <unzipped mcp-cockpit dir>
```

#### Step 4: Create the gateway config

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

#### Step 5: Try it (no systemd yet)

Open **two terminals** (Windows: two PowerShell windows):
```bash
# Terminal 1: start the gateway
mcp-hub --port 8811 --config ~/.config/mcp-hub/servers.json
```
```bash
# Terminal 2: start the console (cd into the project dir from step 3 first)
node server.js
```

Open [http://127.0.0.1:8899](http://127.0.0.1:8899) in your browser — you should see the server list (filesystem / context7), tool counts, and an "auto-recovery: enabled" badge. Click a server to browse tools and test calls. **Core functionality is working now!** `Ctrl+C` both terminals, then do the real deployment in step 6.

#### Step 6: (Recommended) Auto-start — no more manual commands

Pick by your OS: **Linux → 6a (systemd)** / **Windows → 6b** / **macOS → 6c**

##### 6a. Linux (systemd)

```bash
# 1) copy unit templates into your user systemd dir
cp docs/systemd/mcp-hub.service docs/systemd/mcp-hub-web.service ~/.config/systemd/user/

# 2) edit the gateway unit: point ExecStart at your mcp-hub (output of `which mcp-hub` in step 2)
nano ~/.config/systemd/user/mcp-hub.service

# 3) edit the console unit: point ExecStart at your project dir (from step 3)
nano ~/.config/systemd/user/mcp-hub-web.service

# 4) reload systemd, enable + start now
systemctl --user daemon-reload
systemctl --user enable --now mcp-hub mcp-hub-web

# 5) (optional) keep running even when logged out:
loginctl enable-linger $USER
```

> 💡 `enable` = start automatically at login; `--now` = start right now. User services follow your login session by default; step 5 (`enable-linger`) makes them survive logout — true boot-time autostart.

##### 6b. Windows (one-click script + logon auto-start)

```powershell
# 1) cd into the project dir, run the one-click start script (gateway + console in separate windows)
.\scripts\start-windows.bat

# 2) (optional) auto-start at logon: press Win+R, type shell:startup, Enter
#    → in the folder that opens, create a shortcut pointing to scripts\start-windows.bat
```

To stop: just close those two windows (or end the `mcp-hub` and `node server.js` processes in Task Manager).

##### 6c. macOS (brief)

macOS has no systemd, so the `docs/systemd/` unit templates don't apply. Day-to-day: just run the two step-5 commands in a terminal; for boot-time autostart, add a simple script via "System Settings → General → Login Items" (or write two launchd plists, advanced).

#### Step 7: Verify everything works

```bash
systemctl --user status mcp-hub mcp-hub-web   # both should be active (running)
curl -s http://127.0.0.1:8899/api/health     # gateway health
curl -s http://127.0.0.1:8899/api/auto-recover | head   # watchdog state
journalctl --user -u mcp-hub-web -f          # live logs (Ctrl+C to quit)
```

Reopen http://127.0.0.1:8899 to confirm the page is fine. 🎉

### FAQ

**Q: Port already in use / want a different port?**
```bash
ss -ltnp | grep -E '8899|8811'        # see who holds it (Linux/macOS)
MCP_HUB_PORT=9000 node server.js      # console on another port (gateway: --port)
```
Windows: `netstat -ano | findstr ":8899"` to see the holder.

**Q: Page loads but says "gateway unreachable"?**
Check the gateway is alive: `systemctl --user status mcp-hub`; then its logs: `journalctl --user -u mcp-hub -n 50`. Usually a bad server entry in servers.json makes the gateway fail to start.

**Q: I want to stop the gateway for maintenance, but fear the watchdog will resurrect it?**
In `~/.config/systemd/user/mcp-hub-web.service` change `Environment=MCP_HUB_AUTO_RECOVER=on` to `off`, then:
```bash
systemctl --user daemon-reload && systemctl --user restart mcp-hub-web
systemctl --user stop mcp-hub        # now it stays down
```

**Q: Where are watchdog actions logged?**
`auto-recover.log` in the project dir (1 MB rotation) + `journalctl --user -u mcp-hub-web`.

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
├── scripts/start-windows.bat  # Windows one-click start script (gateway + console)
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
