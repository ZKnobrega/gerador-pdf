@echo off
title GuiaMaker Pro - Iniciando Aplicativo Desktop Windows
chcp 65001 > nul
cls

echo ========================================================
echo    GuiaMaker Pro - Gerador de Manuais e Tutoriais PDF
echo ========================================================
echo.
echo Iniciando aplicativo desktop Windows...
echo.

if not exist "dist\index.html" (
    echo Compilando aplicacao pela primeira vez...
    call npm.cmd run build
)

start "" npx.cmd electron .
exit
