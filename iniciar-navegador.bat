@echo off
title GuiaMaker Pro - Servidor Web / Rede Local
chcp 65001 > nul
cls

echo ========================================================
echo    GuiaMaker Pro - Gerador de Manuais e Tutoriais PDF
echo ========================================================
echo.
echo  Servidor configurado para aceitar conexoes de rede!
echo.
echo  Acesso NESTE COMPUTADOR:
echo    - http://localhost:5173
echo.
echo  Acesso de OUTROS COMPUTADORES da mesma rede:
echo    - http://IP-DESTA-MAQUINA:5173
echo.
echo ========================================================
echo.

start "" "http://localhost:5173"
call npm.cmd run dev
