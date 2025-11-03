@echo off
REM Bundle ES6 modules into a single file
REM This allows the modular code to work with file:// protocol

echo.
echo ================================
echo  Skelly Ultra Module Bundler
echo ================================
echo.

python3 bundle.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================
    echo  Build Complete!
    echo ================================
    echo.
) else (
    echo.
    echo ================================
    echo  Build Failed!
    echo ================================
    echo.
    pause
)
