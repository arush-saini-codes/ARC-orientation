@echo off
echo Starting ARC x Tech Word-Storm...

REM Start node server in its own terminal window
start "WordStorm Server" cmd /k "cd /d %~dp0 && node server.js"

REM Wait for server to initialize
timeout /t 2 /nobreak > nul

REM Start ngrok tunnel in its own terminal window
start "WordStorm Ngrok" cmd /k "cd /d %~dp0 && ngrok http 4521"

REM Wait for ngrok to establish tunnel
timeout /t 4 /nobreak > nul

REM Generate QR code from ngrok URL
start "WordStorm QR" cmd /k "cd /d %~dp0 && python generate_qr.py"

REM Wait for QR to generate
timeout /t 2 /nobreak > nul

REM Open projector and mod browser tabs
start http://localhost:4521/projector/
start http://localhost:4521/mod/

echo All systems started!
