@echo off
rem Builds the page from ..\index.html and publishes it to https://advantage-loan-tracker.web.app
set "PATH=%LOCALAPPDATA%\node-portable\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0"
python build.py || goto :fail
call npx firebase deploy --only hosting,firestore:rules || goto :fail
echo.
echo Live: https://advantage-loan-tracker.web.app
pause
exit /b 0
:fail
echo.
echo Deploy nahi hua. Upar ka error dekho.
pause
exit /b 1
