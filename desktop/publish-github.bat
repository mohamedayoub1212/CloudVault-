@echo off
cd /d "%~dp0"
echo ========================================
echo  CloudVault - Build e Publicar
echo ========================================
echo.

echo [1/2] Gerando build...
call npm run build:nsis
if %ERRORLEVEL% NEQ 0 (
    echo Erro no build.
    pause
    exit /b 1
)
call node scripts\update-latest-yml.js
echo.

echo [2/2] Publicando no GitHub...
echo Token: https://github.com/settings/tokens (marque "repo")
echo.
set /p TOKEN="Cole seu token e pressione Enter: "
if "%TOKEN%"=="" (
    echo Erro: Token vazio.
    pause
    exit /b 1
)
set GH_TOKEN=%TOKEN%
call npm run publish
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Sucesso! https://github.com/mohamedayoub1212/CloudVault-/releases
) else (
    echo.
    echo Erro ao publicar. Verifique o token e a conexao.
)
echo.
pause
