@echo off
rem ============================================================
rem  MCP Cockpit - Windows one-click start (gateway + console)
rem  Usage: double-click this file, or put a shortcut to it in
rem         shell:startup (Win+R) for auto-start at logon.
rem ============================================================
setlocal
cd /d "%~dp0.."

if not exist "%USERPROFILE%\.config\mcp-hub\servers.json" (
  echo [ERROR] Config not found: %USERPROFILE%\.config\mcp-hub\servers.json
  echo Run the one-click installer first: scripts\install.bat
  pause
  exit /b 1
)

where mcp-hub >nul 2>&1
if errorlevel 1 (
  echo [ERROR] mcp-hub not found. Run first: npm install -g mcp-hub
  pause
  exit /b 1
)

start "MCP-HUB-Gateway" cmd /k mcp-hub --port 8811 --config "%USERPROFILE%\.config\mcp-hub\servers.json"
timeout /t 3 >nul
start "MCP-Cockpit-Console" cmd /k node server.js

echo.
echo Gateway + console started. Open http://127.0.0.1:8899 in your browser.
pause
