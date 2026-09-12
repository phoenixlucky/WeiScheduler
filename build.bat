@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "ROOT=%CD%"
rem Keep release builds reliable on machines with limited page-file size.
set "CARGO_BUILD_JOBS=1"

echo [1/4] Checking build tools...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Install Node.js first.
    exit /b 1
)
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Windows PowerShell was not found.
    exit /b 1
)

if not exist "%ROOT%node_modules\.bin\tauri.cmd" (
    echo [2/4] Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        exit /b 1
    )
) else (
    echo [2/4] npm dependencies already installed.
)

echo [3/4] Building Windows installer and application...
call npm run tauri:build
if errorlevel 1 (
    echo [ERROR] Tauri build failed.
    exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content -Raw package.json | ConvertFrom-Json).version"`) do set "VERSION=%%V"
if not defined VERSION (
    echo [ERROR] Could not read the application version.
    exit /b 1
)

set "PORTABLE_DIR=%ROOT%release\WeiScheduler_%VERSION%_portable"
set "PORTABLE_ZIP=%ROOT%release\WeiScheduler_%VERSION%_portable.zip"
if not exist "%ROOT%release" mkdir "%ROOT%release"
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%PORTABLE_ZIP%" del /q "%PORTABLE_ZIP%"
mkdir "%PORTABLE_DIR%"
if errorlevel 1 (
    echo [ERROR] Could not create the portable output directory.
    exit /b 1
)

if not exist "%ROOT%src-tauri\target\release\WeiScheduler.exe" (
    echo [ERROR] Built executable was not found.
    exit /b 1
)
copy /y "%ROOT%src-tauri\target\release\WeiScheduler.exe" "%PORTABLE_DIR%\WeiScheduler.exe" >nul
if errorlevel 1 (
    echo [ERROR] Could not copy the built executable.
    exit /b 1
)
>"%PORTABLE_DIR%\portable.mode" echo This file enables portable data storage. Do not delete it.
>"%PORTABLE_DIR%\start-portable.bat" echo @echo off
>>"%PORTABLE_DIR%\start-portable.bat" echo cd /d "%%~dp0"
>>"%PORTABLE_DIR%\start-portable.bat" echo start "WeiScheduler" "%%~dp0WeiScheduler.exe"
>"%PORTABLE_DIR%\README.txt" echo WeiScheduler 便携版
>>"%PORTABLE_DIR%\README.txt" echo 双击 start-portable.bat 或直接运行 WeiScheduler.exe。
>>"%PORTABLE_DIR%\README.txt" echo 任务数据保存在本目录的 data 文件夹中。

powershell -NoProfile -Command "Compress-Archive -Path '%PORTABLE_DIR%\*' -DestinationPath '%PORTABLE_ZIP%' -CompressionLevel Optimal"
if errorlevel 1 (
    echo [ERROR] Portable ZIP creation failed.
    exit /b 1
)

echo.
echo Build completed.
echo Installer: src-tauri\target\release\bundle\
echo Portable:  %PORTABLE_ZIP%
echo.
pause
exit /b 0
