@echo off
title GuiaMaker Pro - Parar Docker
chcp 65001 > nul
cls

echo ========================================================
echo    Parando container do Gerador de Tutoriais PDF...
echo ========================================================
echo.

docker compose down

echo.
echo Container finalizado com sucesso!
pause
