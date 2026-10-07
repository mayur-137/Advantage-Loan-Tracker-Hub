@echo off
rem Connects the Firebase deploy tool to your Google account (one time only).
set "PATH=%LOCALAPPDATA%\node-portable\node-v24.19.0-win-x64;%PATH%"
cd /d "%~dp0"
echo.
echo Browser khulega. mayursavaliya150@gmail.com chuno aur "Allow" dabao.
echo.
call npx firebase login
echo.
pause
