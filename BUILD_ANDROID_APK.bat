@echo off
title STACK QUEUE - Build Android APK
echo ========================================================
echo   STACK QUEUE - Generate Standalone Android APK (100%% Free)
echo ========================================================
echo.
cd /d "%~dp0mobile-app"
echo Checking Expo Login...
call npx eas-cli whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [Step 1] Please log in to your free Expo account.
    echo If you do not have one, create it for free at: https://expo.dev/signup
    echo.
    call npx eas-cli login
)

echo.
echo [Step 2] Starting Standalone Android APK Build on Expo Cloud...
echo (Expo cloud will build the .apk and provide a direct download link and QR code)
echo.
call npx eas-cli build -p android --profile preview
echo.
echo ========================================================
echo Build process completed! Scan the QR code or click the download link.
echo ========================================================
pause
