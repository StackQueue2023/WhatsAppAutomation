@echo off
title Stack Queue - WhatsApp Automation React Native Mobile App
echo ==============================================================
echo    STACK QUEUE - WHATSAPP AUTOMATION REACT NATIVE APP
echo ==============================================================
echo.

for /f "tokens=*" %%i in ('powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*').IPAddress"') do set WIFI_IP=%%i

if "%WIFI_IP%"=="" (
  set WIFI_IP=172.22.135.21
)

echo Starting Backend Server & React Native Metro Bundler...
echo.
echo [1] Backend & Web Dashboard: http://%WIFI_IP%:5000
echo [2] React Native Mobile:      Metro will display QR code below
echo.
echo * How to run on your phone:
echo   1. Make sure your phone is connected to the same Wi-Fi.
echo   2. Scan the Expo QR Code shown in this window!
echo.
echo ==============================================================
npm start
pause
