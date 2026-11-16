@echo off
title GuiaMaker Pro - Docker Compose
chcp 65001 > nul
cls

echo ========================================================
echo    GuiaMaker Pro - Gerador de Manuais e Tutoriais PDF
echo    Ambiente de Producao em Container Docker
echo ========================================================
echo.
echo Iniciando container Docker com acesso a rede local...
echo.

docker compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Ocorreu uma falha ao iniciar o Docker.
    echo Verifique se o Docker Desktop esta aberto e tente novamente.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo    Container iniciado com sucesso!
echo ========================================================
echo.
echo  Acesso NESTE COMPUTADOR:
echo    -> http://localhost:8090
echo.
echo  Acesso de OUTROS COMPUTADORES da mesma rede:
echo    -> http://IP-DESTA-MAQUINA:8090
echo.
echo ========================================================
echo.
echo [IMPORTANTE PARA OUTROS COMPUTADORES DA REDE]:
echo Se outro computador nao conseguir carregar a pagina,
echo execute o arquivo "liberar-rede-docker.bat" uma unica vez
echo para liberar o Firewall do Windows e o redirecionamento.
echo.
echo ========================================================
echo.

start "" "http://localhost:8090"
pause
