@echo off
echo ========================================
echo  CloudVault - Release Completo
echo  (Build + Publicar + Enviar codigo)
echo ========================================
echo.
set /p TOKEN="Cole seu token do GitHub e pressione Enter: "
if "%TOKEN%"=="" (
    echo Erro: Token vazio.
    pause
    exit /b 1
)
echo.

echo [1/4] Gerando build...
cd desktop
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Erro no build.
    pause
    exit /b 1
)
echo.

echo [2/4] Publicando no GitHub Releases...
set GH_TOKEN=%TOKEN%
call npx electron-builder --win --publish always
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao publicar. Verifique o token.
    pause
    exit /b 1
)
cd ..
echo.

echo [3/4] Preparando commit...
git add latest.yml desktop/ web/
git diff --cached --quiet
if %ERRORLEVEL% EQU 0 (
    echo Nenhuma alteracao para commit.
) else (
    git commit -m "Release: atualizacao latest.yml"
)
echo.

echo [4/4] Enviando codigo para o GitHub...
"C:\Program Files\Git\bin\git.exe" push https://mohamedayoub1212:%TOKEN%@github.com/mohamedayoub1212/CloudVault-.git main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  Sucesso! Release publicado.
    echo  https://github.com/mohamedayoub1212/CloudVault-/releases
    echo ========================================
) else (
    echo.
    echo Aviso: Build e publicacao OK, mas o push falhou.
    echo Execute push-para-github.bat para enviar o latest.yml.
)
echo.
pause
