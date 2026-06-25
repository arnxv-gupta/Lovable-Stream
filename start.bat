@echo off
echo.
echo  ============================================
echo   Lovable - Watch Party App
echo  ============================================
echo.

echo [1/2] Starting backend server on port 5000...
start "Lovable Backend" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 2 >nul

echo [2/2] Starting frontend on port 5174...
start "Lovable Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 >nul

echo.
echo  Backend : http://localhost:5000
echo  Frontend: http://localhost:5174
echo.
echo  Open http://localhost:5174 in your browser!
echo.
pause
