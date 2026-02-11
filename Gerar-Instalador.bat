@echo off
title Gerar Instalador CloudVault
cd /d "%~dp0desktop"

echo.
echo Gerando instalador CloudVault...
echo.

call npm run build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   BUILD CONCLUIDO COM SUCESSO!
    echo ========================================
    echo.
    echo Os arquivos .exe estao em:
    echo   %~dp0desktop\release\
    echo.
    echo - CloudVault Setup 1.0.0.exe (instalador)
    echo - CloudVault 1.0.0.exe (portatil)
    echo.
    echo Abrindo pasta...
    start "" "%~dp0desktop\release"
) else (
    echo.
    echo Erro ao gerar instalador.
    pause
)
