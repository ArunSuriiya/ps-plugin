@echo off
setlocal

:: TITLE
title Asset Library - Windows Installer
echo ==========================================
echo    Photoshop Asset Library Installer
echo ==========================================
echo.

:: DEFINE TARGET PATH (must use plugin ID as folder name for UXP discovery)
set "TARGET_DIR=%AppData%\Adobe\UXP\Plugins\External\com.antigravity.asset-library"

:: CREATE FOLDER
echo 1. Creating plugin directory...
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

:: COPY FILES (Excluding git and installation scripts)
echo 2. Copying plugin files...
xcopy /S /Y /Q /I * "%TARGET_DIR%" /EXCLUDE:exclude_list.txt

:: SUCCESS MESSAGE
echo.
echo ==========================================
echo    INSTALLATION SUCCESSFUL!
echo ==========================================
echo.
echo IMPORTANT - Next steps:
echo  1. Fully QUIT and RESTART Photoshop
echo  2. Go to: Edit ^> Preferences ^> Plugins
echo     (or Photoshop menu on Mac)
echo  3. Enable "Allow Unknown Third Party Plugins"
echo  4. Restart Photoshop AGAIN
echo  5. Go to: Plugins ^> Asset Library
echo.
echo If still not visible, open the UXP Developer Tool
echo and load the plugin manually from:
echo %TARGET_DIR%
echo.
pause
