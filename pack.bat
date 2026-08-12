@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title WeiScheduler 一键打包

:menu
cls
echo ============================================
echo   WeiScheduler 一键打包
echo ============================================
echo.

rem 读取当前版本号（package.json 的 version 字段）
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "CURRENT_VERSION=%%v"
if not defined CURRENT_VERSION (
    echo [错误] 无法读取 package.json 版本号，请确认已安装 Node.js 且当前目录正确。
    pause
    exit /b 1
)

echo 当前版本号: %CURRENT_VERSION%
echo.
set /p "NEW_VERSION=请输入新版本号（直接回车保持不变，格式如 1.7.1）: "
if "%NEW_VERSION%"=="" set "NEW_VERSION=%CURRENT_VERSION%"

rem 校验版本号格式 x.y.z
echo %NEW_VERSION%| findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo [错误] 版本号格式不正确: %NEW_VERSION% （应为 x.y.z 格式，如 1.7.1）
    pause
    goto menu
)

rem 若输入了不同版本号，则更新 package.json
if not "%NEW_VERSION%"=="%CURRENT_VERSION%" (
    echo.
    echo 正在更新版本号: %CURRENT_VERSION% --^> %NEW_VERSION%
    node -e "const fs=require('fs');const f='package.json';const p=JSON.parse(fs.readFileSync(f,'utf8'));p.version='%NEW_VERSION%';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');"
    if errorlevel 1 (
        echo [错误] 版本号更新失败
        pause
        exit /b 1
    )
    echo 版本号已更新。
)

echo.
echo 开始打包（npm run dist）...
echo.

rem 清理旧安装包，避免与新版本产物混淆
if exist release rmdir /s /q release
call npm run dist
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ============================================
echo   打包完成！安装包位于: %cd%\release
echo ============================================
echo.
dir /b release\*.exe 2>nul
echo.
pause
exit /b 0
