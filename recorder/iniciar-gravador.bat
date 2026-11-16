@echo off
chcp 65001 >nul
title GuiaMaker Pro - Gravador de Passos Inteligente
cd /d "%~dp0"

echo ==============================================================
echo   GuiaMaker Pro - Gravador de Passos para Windows
echo   Captura de cliques em sistemas WEB e aplicativos legados
echo ==============================================================
echo.

set SERVER_URL=http://localhost:8090

if not "%1"=="" (
    set SERVER_URL=%1
)

echo Servidor: %SERVER_URL%

echo Atualizando modulo recorder.ps1 do servidor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%SERVER_URL%/recorder/recorder.ps1' -OutFile '%~dp0recorder.ps1' -TimeoutSec 4 } catch { Write-Host 'Utilizando versao local do recorder.ps1...' }"


if not exist "%~dp0recorder.ps1" (
    echo.
    echo ==============================================================
    echo ERRO: Nao foi possivel localizar nem baixar o recorder.ps1.
    echo Certifique-se de que o GuiaMaker Pro esta ativo em: %SERVER_URL%
    echo ==============================================================
    echo.
    pause
    exit /b 1
)

echo Iniciando barra de controle flutuante...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0recorder.ps1" -ServerUrl "%SERVER_URL%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==============================================================
    echo Ocorreu uma interrupcao no Gravador de Passos.
    echo Codigo de saida: %ERRORLEVEL%
    echo ==============================================================
    pause
)
