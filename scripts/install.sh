#!/usr/bin/env bash
# ============================================================
#  MCP Cockpit 一键安装（Linux / macOS）
#  做三件事：检查/安装 Node.js >= 18 → 安装 mcp-hub 网关
#           → 生成配置模板（绝不覆盖已有配置）
# ============================================================
set -e

MIN_NODE=18
CFG_DIR="$HOME/.config/mcp-hub"
CFG="$CFG_DIR/servers.json"

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m[警告] %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m[错误] %s\033[0m\n' "$*"; exit 1; }

say "步骤 1/3：检查 Node.js（>= $MIN_NODE）"
if command -v node >/dev/null 2>&1; then
  V=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$V" -ge "$MIN_NODE" ]; then
    echo "Node $(node -v) 已就绪"
  else
    die "当前 Node 版本过旧（$(node -v)）。请升级到 >= $MIN_NODE（例如 nvm install 22），然后重新运行本脚本"
  fi
else
  warn "未检测到 Node.js，尝试用 nvm 自动安装..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 22 || die "nvm 安装失败。请手动安装 Node.js >= $MIN_NODE（https://nodejs.org），然后重新运行本脚本"
    echo "已通过 nvm 安装 Node $(node -v)（今后新终端会自动加载）"
  else
    die "未找到 Node.js 且无 curl。请手动安装：https://nodejs.org（>= $MIN_NODE），然后重新运行本脚本"
  fi
fi

say "步骤 2/3：安装 mcp-hub 网关（npm -g）"
if command -v mcp-hub >/dev/null 2>&1; then
  echo "mcp-hub 已安装（$(command -v mcp-hub)），跳过"
else
  npm install -g mcp-hub || die "npm install -g mcp-hub 失败。请检查网络或 npm 权限后重试"
  echo "mcp-hub 已安装：$(command -v mcp-hub)"
fi

say "步骤 3/3：准备配置文件"
mkdir -p "$CFG_DIR"
if [ -f "$CFG" ]; then
  echo "配置已存在，不覆盖：$CFG"
else
  cp "$(dirname "$0")/servers.json.example" "$CFG"
  echo "已生成模板配置：$CFG（可把其中的 /tmp 改成你想授权的目录）"
fi
chmod 600 "$CFG"

printf '\n\033[1;32m============================================\033[0m\n'
printf '\033[1;32m  ✅ 安装完成！下一步启动 MCP Cockpit：\033[0m\n'
printf '\033[1;32m      bash scripts/start.sh\033[0m\n'
printf '\033[1;32m  然后浏览器打开 http://127.0.0.1:8899\033[0m\n'
printf '\033[1;32m============================================\033[0m\n'
