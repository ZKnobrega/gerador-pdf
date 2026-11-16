@echo off
title GuiaMaker Pro - Liberar Acesso de Rede para o Docker
chcp 65001 > nul
cls

echo ========================================================
echo   CONFIGURAR ACESSO DE OUTROS COMPUTADORES (REDE LOCAL)
echo ========================================================
echo.
echo No Windows com WSL2/Docker, para que outros computadores
echo da rede consigam acessar o container, sao necessarias duas
echo liberacoes no sistema:
echo.
echo   1. Regra de Entrada no Firewall do Windows (Porta 8090)
echo   2. Redirecionamento de Rede do Windows para o Docker (Portproxy)
echo.
echo Solicitando autorizacao de Administrador do Windows...
echo (Clique em "SIM" na janela que ira aparecer na tela)
echo.

powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command \"netsh interface portproxy add v4tov4 listenport=8090 listenaddress=0.0.0.0 connectport=8090 connectaddress=127.0.0.1; New-NetFirewallRule -DisplayName ''GuiaMaker Pro Docker (Porta 8090)'' -Direction Inbound -LocalPort 8090 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue; Write-Host ''======================================================'' -ForegroundColor Green; Write-Host ''   REDE LOCAL E FIREWALL CONFIGURADOS COM SUCESSO!    '' -ForegroundColor Green; Write-Host ''======================================================'' -ForegroundColor Green; Write-Host ''''; Write-Host ''A porta 8090 e o redirecionamento de rede estao ativos.''; Write-Host ''Outros computadores da rede agora podem acessar:''; Write-Host ''   http://IP-DESTA-MAQUINA:8090'' -ForegroundColor Cyan; Write-Host ''''; Start-Sleep -Seconds 6\"'"

echo.
echo Se você clicou em "Sim" na janela de autorizacao:
echo A configuracao foi aplicada com sucesso!
echo.
echo Outros computadores da rede agora podem abrir no navegador:
echo   -> http://IP-DESTA-MAQUINA:8090
echo.
echo ========================================================
pause
