@echo off
setlocal

:: TITLE
title Asset Library - Windows Installer
echo ==========================================
echo    Photoshop Asset Library Installer
echo ==========================================
echo.

:: DEFINE TARGET PATH
set "TARGET_DIR=%AppData%\Adobe\UXP\Plugins\AssetLibrary"

:: CREATE FOLDER
echo 1. Creating plugin directory...
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

:: COPY FILES (Excluding git and installation scripts)
echo 2. Copying files to Adobe AppData...
xcopy /S /Y /Q /I * "%TARGET_DIR%" /EXCLUDE:exclude_list.txt

:: SUCCESS MESSAGE
echo.
echo ==========================================
echo    INSTALLATION SUCCESSFUL!
echo ==========================================
echo.
echo Please RESTART Photoshop to see your plugin.
echo You can find it under: Plugins -> Asset Library
echo.
pause
