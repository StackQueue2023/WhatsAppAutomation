@echo off
title STACK QUEUE - Free Cloud Hosting (Cloudflare Tunnel)
echo ========================================================
echo   STACK QUEUE - Free Cloudflare Public Hosting
echo ========================================================
echo.
cd /d "%~dp0"
echo Starting Cloudflare Tunnel for WhatsApp Server on Port 5000...
echo.
.\tools\cloudflared.exe tunnel --url http://localhost:5000
pause
