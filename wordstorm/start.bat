@echo off
echo Starting ARC x Tech Word-Storm...

REM Start node server in its own terminal window
start "WordStorm Server" cmd /k "cd /d %~dp0 && node server.js"

REM Wait for server to initialize
timeout /t 2 /nobreak > nul

REM Generate QR code
start "WordStorm QR" cmd /k "cd /d %~dp0 && python generate_qr.py"

REM Wait for QR to generate
timeout /t 2 /nobreak > nul

REM Open projector and mod browser tabs
start http://172.31.3.109:4521/projector/
start http://172.31.3.109:4521/mod/

echo All systems started!
