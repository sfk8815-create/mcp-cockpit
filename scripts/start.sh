#!/usr/bin/env bash
# ============================================================
#  MCP Cockpit 一键启动（Linux / macOS）
#  网关后台运行 + 管理台前台；Ctrl+C 停止全部。
# ============================================================
set -e

CFG="$HOME/.config/mcp-hub/servers.json"
GW_PORT=8811

command -v node >/dev/null 2>&1 || { echo "[错误] 未找到 Node.js。请先运行: bash scripts/install.sh"; exit 1; }
command -v mcp-hub >/dev/null 2>&1 || { echo "[错误] 未安装 mcp-hub。请先运行: bash scripts/install.sh"; exit 1; }
[ -f "$CFG" ] || { echo "[错误] 未找到配置: $CFG（请先运行: bash scripts/install.sh）"; exit 1; }

GW_PID=""
if curl -sf "http://127.0.0.1:$GW_PORT/api/health" >/dev/null 2>&1; then
  echo "==> 网关已在运行（端口 $GW_PORT），直接复用"
else
  echo "==> 启动网关 mcp-hub（端口 $GW_PORT）..."
  mcp-hub --port "$GW_PORT" --config "$CFG" &
  GW_PID=$!
fi

cleanup() {
  [ -n "$GW_PID" ] && kill "$GW_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 等待网关就绪（最多 ~10s）
for _ in $(seq 1 20); do
  curl -sf "http://127.0.0.1:$GW_PORT/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done

echo "==> 启动管理台（端口 8899，前台；Ctrl+C 停止全部）..."
cd "$(dirname "$0")/.."
node server.js
