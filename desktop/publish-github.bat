@echo off
echo ========================================
echo  Publicar CloudVault no GitHub Releases
echo ========================================
echo.
echo Voce precisa de um token do GitHub:
echo 1. Acesse: https://github.com/settings/tokens
echo 2. Generate new token (classic)
echo 3. Marque a opcao "repo"
echo 4. Copie o token
echo.
set /p TOKEN="Cole seu token aqui e pressione Enter: "
if "%TOKEN%"=="" (
    echo Erro: Token vazio. Tente novamente.
    pause
    exit /b 1
)
echo.
echo Publicando no GitHub...
set GH_TOKEN=%TOKEN%
call npx electron-builder --win --publish always
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Sucesso! Publicado em https://github.com/mohamedayoub1212/CloudVault-/releases
) else (
    echo.
    echo Erro ao publicar. Verifique o token e tente novamente.
)
echo.
pause
