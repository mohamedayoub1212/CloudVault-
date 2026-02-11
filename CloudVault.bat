@echo off
title CloudVault
cd /d "%~dp0desktop"

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

echo Iniciando CloudVault...
call npm start
