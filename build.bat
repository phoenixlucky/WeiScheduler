@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "ROOT=%CD%"
set "CARGO_BUILD_JOBS=1"
set "BUNDLE_DIR=%ROOT%\src-tauri\target\release\bundle"
set "RELEASE_DIR=%ROOT%\release"

echo [1/6] Checking build tools...
where npm >nul 2>&1
if errorlevel 1 goto :npm_missing
where powershell >nul 2>&1
if errorlevel 1 goto :powershell_missing

if not exist "%ROOT%\node_modules\.bin\tauri.cmd" (
    echo [2/6] Installing npm dependencies...
    call npm install
    if errorlevel 1 goto :npm_failed
) else (
    echo [2/6] npm dependencies already installed.
)

echo [3/6] Synchronizing application version...
call npm run version:sync
if errorlevel 1 goto :build_failed

echo [4/6] Building the frontend...
call npm run build
if errorlevel 1 goto :build_failed

echo [4/6] Synchronizing Windows application icon...
if not exist "%ROOT%\public\assets\icons\wj-super-scheduler-icon.png" goto :icon_missing
call npx tauri icon "%ROOT%\public\assets\icons\wj-super-scheduler-icon.png" --output "%ROOT%\build"
if errorlevel 1 goto :icon_failed
for %%F in (32x32.png 64x64.png 128x128.png 128x128@2x.png StoreLogo.png Square30x30Logo.png Square44x44Logo.png Square71x71Logo.png Square89x89Logo.png Square107x107Logo.png Square142x142Logo.png Square150x150Logo.png Square284x284Logo.png Square310x310Logo.png icon.icns) do if exist "%ROOT%\build\%%F" del /q "%ROOT%\build\%%F"
if exist "%ROOT%\build\android" rmdir /s /q "%ROOT%\build\android"
if exist "%ROOT%\build\ios" rmdir /s /q "%ROOT%\build\ios"

echo [5/6] Packaging the Windows application...
call npx tauri build --bundles nsis --ci --config "{\"build\":{\"beforeBuildCommand\":\"\"}}"
if errorlevel 1 goto :build_failed

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content -Raw package.json | ConvertFrom-Json).version"`) do set "VERSION=%%V"
if not defined VERSION goto :version_failed

set "PACKAGE_NAME=WJ_Super_Scheduler_%VERSION%"
set "PORTABLE_DIR=%RELEASE_DIR%\%PACKAGE_NAME%_portable"
set "PORTABLE_ZIP=%RELEASE_DIR%\%PACKAGE_NAME%_portable.zip"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%PORTABLE_ZIP%" del /q "%PORTABLE_ZIP%"
mkdir "%PORTABLE_DIR%"
if errorlevel 1 goto :release_failed

echo [6/6] Preparing the portable package...
set "APP_EXE=%ROOT%\src-tauri\target\release\weischeduler.exe"
if not exist "%APP_EXE%" goto :exe_failed
copy /y "%APP_EXE%" "%PORTABLE_DIR%\WJ_Super_Scheduler.exe" >nul
if errorlevel 1 goto :copy_failed
>"%PORTABLE_DIR%\portable.mode" echo WJ Super Scheduler portable mode
>"%PORTABLE_DIR%\start-portable.bat" echo @echo off
>>"%PORTABLE_DIR%\start-portable.bat" echo cd /d "%%~dp0"
>>"%PORTABLE_DIR%\start-portable.bat" echo start "" "%%~dp0WJ_Super_Scheduler.exe"
>"%PORTABLE_DIR%\README.txt" echo WJ Super Scheduler portable package
>>"%PORTABLE_DIR%\README.txt" echo Double-click start-portable.bat to launch.
>>"%PORTABLE_DIR%\README.txt" echo Task data is stored in the data folder beside the executable.

echo [post] Creating the convenient ZIP package...
powershell -NoProfile -Command "Compress-Archive -Path '%PORTABLE_DIR%\*' -DestinationPath '%PORTABLE_ZIP%' -CompressionLevel Optimal"
if errorlevel 1 goto :zip_failed

set "NSIS_FILE="
for /f "delims=" %%F in ('dir /b /o-d "%BUNDLE_DIR%\nsis\*_x64-setup.exe" 2^>nul') do if not defined NSIS_FILE set "NSIS_FILE=%%F"
if defined NSIS_FILE copy /y "%BUNDLE_DIR%\nsis\%NSIS_FILE%" "%RELEASE_DIR%\%PACKAGE_NAME%_setup.exe" >nul

echo.
echo Build completed successfully.
echo Portable ZIP: %PORTABLE_ZIP%
if defined NSIS_FILE echo Setup EXE:    %RELEASE_DIR%\%PACKAGE_NAME%_setup.exe
echo.
pause
exit /b 0

:npm_missing
echo [ERROR] npm was not found. Install Node.js first.
goto :fail
:powershell_missing
echo [ERROR] Windows PowerShell was not found.
goto :fail
:npm_failed
echo [ERROR] npm install failed.
goto :fail
:build_failed
echo [ERROR] Tauri build failed.
goto :fail
:icon_missing
echo [ERROR] Source application icon was not found.
goto :fail
:icon_failed
echo [ERROR] Windows application icon generation failed.
goto :fail
:version_failed
echo [ERROR] Could not read the application version.
goto :fail
:release_failed
echo [ERROR] Could not create the release directory.
goto :fail
:exe_failed
echo [ERROR] Built executable was not found.
goto :fail
:copy_failed
echo [ERROR] Could not copy the built executable.
goto :fail
:zip_failed
echo [ERROR] Portable ZIP creation failed.
goto :fail

:fail
echo.
echo Build failed. Press any key to close this window.
pause >nul
exit /b 1
