@echo off
setlocal
cd /d "%~dp0"

:menu
cls
echo WeiScheduler
echo.
echo 1. npm install
echo 2. npm start              - Electron desktop app
echo 3. npm run start:web      - Web server
echo 4. clean release/dist and npm run dist
echo 5. npm run dist
echo 0. exit
echo.
set /p choice=Choose mode: 

if "%choice%"=="" exit /b 0
if "%choice%"=="1" goto install
if "%choice%"=="2" goto start
if "%choice%"=="3" goto startweb
if "%choice%"=="4" goto cleandist
if "%choice%"=="5" goto dist
if "%choice%"=="0" exit /b 0
goto menu

:install
call npm install
goto done

:start
call npm start
goto done

:startweb
call npm run start:web
goto done

:cleandist
if exist release rmdir /s /q release
if exist dist rmdir /s /q dist
call npm run dist
goto done

:dist
call npm run dist
goto done

:done
echo.
pause
goto menu
