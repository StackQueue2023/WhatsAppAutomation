@echo off
title Stack Queue - WhatsApp Automation Backend Server (Port 5000)
echo ==============================================================
echo    STACK QUEUE - WHATSAPP AUTOMATION BACKEND SERVER
echo ==============================================================
echo.
for /f "tokens=*" %%i in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*').IPAddress"') do set WIFI_IP=%%i
if "%WIFI_IP%"=="" set WIFI_IP=172.22.135.21

echo Starting Backend Server on Port 5000...
echo * Local URL:   http://localhost:5000
echo * Wi-Fi URL:   http://%WIFI_IP%:5000
echo.
echo ==============================================================
npm run server
pause
