@echo off
rem ============================================================
rem  MCP Cockpit - one-click install (Windows)
rem  Checks Node.js, installs mcp-hub gateway, creates config
rem  template (never overwrites an existing servers.json).
rem ============================================================
setlocal EnableExtensions

echo.
echo == Step 1/3: Checking Node.js (>= 18)
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it first, then REOPEN the terminal and rerun this script:
  echo     winget install OpenJS.NodeJS.LTS
  echo   or download from https://nodejs.org (v18 or newer)
  pause
  exit /b 1
)
node -e "if (+process.versions.node.split('.')[0] < 18) process.exit(1)"
if errorlevel 1 (
  echo [ERROR] Node version too old:
  node -v
  echo Please upgrade to v18+ (e.g. winget install OpenJS.NodeJS.LTS), then REOPEN the terminal and rerun.
  pause
  exit /b 1
)
echo Node OK: & node -v

echo.
echo == Step 2/3: Installing mcp-hub gateway (npm -g)
where mcp-hub >nul 2>&1
if not errorlevel 1 (
  echo mcp-hub already installed, skipping.
) else (
  call npm install -g mcp-hub
  if errorlevel 1 (
    echo [ERROR] npm install -g mcp-hub failed. Check network / npm permissions, then rerun.
    pause
    exit /b 1
  )
  where mcp-hub >nul 2>&1
  if errorlevel 1 (
    echo [NOTE] Installed, but mcp-hub is not on PATH yet. REOPEN the terminal and rerun this script.
    pause
    exit /b 1
  )
  echo mcp-hub installed: & where mcp-hub
)

echo.
echo == Step 3/3: Preparing config file
set "CFG_DIR=%USERPROFILE%\.config\mcp-hub"
if exist "%CFG_DIR%\servers.json" (
  echo Config already exists, NOT overwriting: %CFG_DIR%\servers.json
) else (
  if not exist "%CFG_DIR%" mkdir "%CFG_DIR%"
  copy /y "%~dp0servers.json.example" "%CFG_DIR%\servers.json" >nul
  echo Created template config: %CFG_DIR%\servers.json (you may change /tmp to a directory you want to expose)
)

echo.
echo ============================================
echo  Install complete! Next, start MCP Cockpit:
echo      double-click scripts\start-windows.bat   (or run it in PowerShell)
echo  Then open http://127.0.0.1:8899 in your browser
echo ============================================
pause
