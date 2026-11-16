import React, { useState, useRef } from 'react';
import {
  X,
  Play,
  Square,
  Sparkles,
  Monitor,
  Laptop,
  Check,
  Download,
  AlertCircle,
  HelpCircle,
  Camera,
  Layers,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { TutorialProject } from '../types/tutorial';

interface ScreenRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTutorialCreated: (project: TutorialProject) => void;
}

interface CapturedStep {
  id: string;
  imageBase64: string;
  originalImageBase64: string;
  clickX?: number;
  clickY?: number;
  windowTitle?: string;
  elementText?: string;
}

export const ScreenRecorderModal: React.FC<ScreenRecorderModalProps> = ({
  isOpen,
  onClose,
  onTutorialCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'desktop' | 'browser'>('desktop');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('guia_maker_gemini_api_key') || '';
  });
  const [systemName, setSystemName] = useState<string>('Sistema Exemplo');
  const [tutorialTitle, setTutorialTitle] = useState<string>('');
  const [procedureContext, setProcedureContext] = useState<string>('');

  // In-Browser Recording State
  const [isCapturingBrowser, setIsCapturingBrowser] = useState<boolean>(false);
  const [isLiveBlurEnabled, setIsLiveBlurEnabled] = useState<boolean>(false);
  const [capturedSteps, setCapturedSteps] = useState<CapturedStep[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  if (!isOpen) return null;

  const currentHost = window.location.origin;

  // Save API key
  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('guia_maker_gemini_api_key', key);
    setKeyTestStatus(null);
  };

  // Test Gemini API key connectivity
  const handleTestKey = async () => {
    if (!geminiApiKey || !geminiApiKey.trim()) {
      setKeyTestStatus({ success: false, message: 'Insira sua chave de API antes de testar.' });
      return;
    }

    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeyTestStatus({ success: true, message: data.message || `Conexão bem-sucedida (${data.model})!` });
      } else {
        setKeyTestStatus({ success: false, message: data.error || 'Falha ao conectar com a API Gemini.' });
      }
    } catch (err: any) {
      setKeyTestStatus({ success: false, message: `Erro de conexão: ${err.message}` });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Start Browser Screen Share
  const handleStartBrowserCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCapturingBrowser(true);
      setCapturedSteps([]);

      // If user stops sharing from browser banner
      stream.getVideoTracks()[0].onended = () => {
        handleStopBrowserCapture();
      };
    } catch (err: any) {
      console.warn('Captura cancelada ou bloqueada:', err);
    }
  };

  // Capture single frame from browser video stream
  const handleCaptureFrame = (e?: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/png');

    // RF-13: Live Blur mode (protects sensitive address bar and user profile header)
    if (isLiveBlurEnabled) {
      const barH = Math.max(34, Math.round(canvas.height * 0.065));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(0, 0, canvas.width, barH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️ [Live Blur Ativo: URLs, abas e credenciais protegidas]', 18, barH / 2);
    }

    // Calculate click coordinates if clicked on video preview
    let clickX: number | undefined;
    let clickY: number | undefined;

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      clickX = Math.round((e.clientX - rect.left) * scaleX);
      clickY = Math.round((e.clientY - rect.top) * scaleY);

      // Draw red highlight circle for initial display
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(clickX, clickY, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const annotatedDataUrl = canvas.toDataURL('image/png');

    const newStep: CapturedStep = {
      id: `step-${Date.now()}`,
      imageBase64: annotatedDataUrl,
      originalImageBase64: rawDataUrl,
      clickX,
      clickY,
      windowTitle: `${systemName} - Tela ${capturedSteps.length + 1}`,
    };

    setCapturedSteps((prev) => [...prev, newStep]);
  };

  const handleStopBrowserCapture = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCapturingBrowser(false);
  };

  // Submit captured browser steps to server
  const handleFinalizeBrowserRecording = async () => {
    if (capturedSteps.length === 0) return;

    handleStopBrowserCapture();
    setIsProcessing(true);
    setStatusMessage('Enviando passos e organizando manual...');

    try {
      const res = await fetch('/api/recorder/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tutorialTitle.trim() || undefined,
          systemName: systemName.trim() || undefined,
          author: 'Gravador GuiaMaker Pro',
          geminiApiKey: geminiApiKey || undefined,
          procedureContext: procedureContext.trim() || undefined,
          steps: capturedSteps,
        }),
      });

      if (!res.ok) throw new Error('Erro ao processar tutorial no servidor');
      const data = await res.json();

      if (data.project) {
        onTutorialCreated(data.project);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      alert('Falha ao processar tutorial: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download launcher .bat for Desktop Recorder
  const handleDownloadBatch = () => {
    const safeSystem = (systemName || 'Sistema Corporativo').replace(/"/g, ' ');
    const safeContext = (procedureContext || '').replace(/"/g, ' ').replace(/[\r\n]+/g, ' ');
    const safeTitle = (tutorialTitle || '').replace(/"/g, ' ');

    const batContent = `@echo off
chcp 65001 >nul
title GuiaMaker Pro - Gravador de Passos Inteligente
cd /d "%~dp0"

echo ==============================================================
echo   GuiaMaker Pro - Gravador de Passos para Windows
echo ==============================================================
echo Conectando ao servidor: ${currentHost}

echo Atualizando modulo recorder.ps1 do servidor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${currentHost}/recorder/recorder.ps1' -OutFile '%~dp0recorder.ps1' -TimeoutSec 4 } catch { Write-Host 'Utilizando versao local do recorder.ps1...' }"

if not exist "%~dp0recorder.ps1" (
    echo.
    echo ERRO: Nao foi possivel baixar o arquivo recorder.ps1.
    echo Verifique sua conexao com o servidor em ${currentHost}
    pause
    exit /b 1
)

echo Iniciando barra de controle flutuante...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0recorder.ps1" -ServerUrl "${currentHost}" -GeminiApiKey "${geminiApiKey}" -SystemName "${safeSystem}" -ProcedureContext "${safeContext}" -TutorialTitle "${safeTitle}"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Ocorreu um erro ao executar o Gravador.
    pause
)
`;
    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iniciar-gravador.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 modal-overlay">
      <div className="flex flex-col max-h-[92vh] w-[95vw] max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 rounded-xl shadow-sm text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Gravador de Passos Inteligente
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                  Estilo Tango / PSR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Grave cliques em sistemas Web e aplicativos legados com destaques interativos
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleStopBrowserCapture();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-t-2 border-x ${
              activeTab === 'desktop'
                ? 'bg-white border-slate-200 border-t-rose-600 text-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-4 h-4 text-rose-600" />
            Gravador Desktop para Windows (Web + Apps Legados)
            <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold">
              Recomendado
            </span>
          </button>

          <button
            onClick={() => setActiveTab('browser')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-t-2 border-x ${
              activeTab === 'browser'
                ? 'bg-white border-slate-200 border-t-blue-600 text-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            Gravação Direta no Navegador
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Procedure Context & Briefing */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-white p-4 rounded-xl border border-indigo-200/90 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    Briefing e Contexto Prévia para a IA
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      Recomendado
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Explique com antecedência o que este tutorial vai demonstrar para a IA já se preparar e organizar os passos.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Explique para a IA sobre o que é este procedimento:
              </label>
              <textarea
                value={procedureContext}
                onChange={(e) => setProcedureContext(e.target.value)}
                rows={2}
                placeholder="Ex: Este passo a passo ensina o servidor a cadastrar um novo processo no SEI, preencher os interessados, anexar a minuta em PDF e tramitar para a assessoria jurídica..."
                className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
              />
              <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1 font-medium">
                💡 A IA usará essa explicação para nomear o manual, prever o fluxo lógico das telas e gerar instruções institucionais precisas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-indigo-100/60">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nome do Sistema / Módulo
                </label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  placeholder="Ex: SEI, Sistema Exemplo, Intranet"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Título Previsto</span>
                  <span className="text-[10px] text-slate-400 font-normal">IA gera se vazio</span>
                </label>
                <input
                  type="text"
                  value={tutorialTitle}
                  onChange={(e) => setTutorialTitle(e.target.value)}
                  placeholder="Deixe vazio para a IA intitular"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Chave API Gemini
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="Cole sua chave AIza..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTestingKey || !geminiApiKey.trim()}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0 cursor-pointer"
                    title="Testar conexão com a Gemini API"
                  >
                    {isTestingKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    )}
                    <span>Testar</span>
                  </button>
                </div>
              </div>
            </div>

            {keyTestStatus && (
              <div
                className={`p-2 rounded-lg text-[11px] flex items-center gap-2 border ${
                  keyTestStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {keyTestStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="leading-tight">{keyTestStatus.message}</span>
              </div>
            )}
          </div>

          {/* TAB 1: DESKTOP WINDOWS RECORDER */}
          {activeTab === 'desktop' && (
            <div className="space-y-5">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3.5">
                <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                  <p className="font-bold text-rose-900 text-sm">
                    Como funciona o Gravador de Passos no Windows:
                  </p>
                  <p>
                    O aplicativo abre uma barra de controle flutuante (
                    <strong className="text-slate-900">🔴 Iniciar | ⏸️ Pausar | ⏹️ Concluir</strong>) no topo da tela.
                    Você pode navegar normalmente em <strong>qualquer site, sistema ou aplicativo legado do Windows</strong>.
                  </p>
                  <p>
                    A cada clique do mouse, a tela é capturada automaticamente e a coordenada é convertida em um 
                    <strong className="text-rose-700"> círculo destacador 100% interativo</strong> que você poderá mover ou editar depois no GuiaMaker Pro.
                  </p>
                </div>
              </div>

              {/* Execution steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Inicie o Gravador</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Na pasta do projeto, execute o script <code>recorder/iniciar-gravador.bat</code> com dois cliques.
                  </p>
                  <button
                    onClick={handleDownloadBatch}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Atalho .bat
                  </button>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Clique e Navegue</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Clique em <strong>🔴 Iniciar</strong> e faça o fluxo normal no seu sistema. Cada clique registra a tela e o ponto exato da ação.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Conclua e Edite</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ao clicar em <strong>⏹️ Concluir</strong>, o GuiaMaker Pro abre no navegador com todas as etapas pré-preenchidas e prontas para polimento.
                  </p>
                </div>
              </div>

              {/* Server URL helper */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-slate-300">
                    Servidor ativo em: <strong className="text-white">{currentHost}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Compatível com Docker e Rede Local
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: IN-BROWSER SCREEN RECORDING */}
          {activeTab === 'browser' && (
            <div className="space-y-4">
              {!isCapturingBrowser ? (
                <div className="text-center py-8 px-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-4">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <Monitor className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-sm font-bold text-slate-800">
                      Compartilhe a tela para gravação rápida no navegador
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Selecione uma janela ou guia do navegador. Você poderá capturar os passos clicando diretamente na visualização.
                    </p>
                  </div>
                  <button
                    onClick={handleStartBrowserCapture}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Iniciar Compartilhamento de Tela
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Live Stream Viewport */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col items-center">
                    <div className="w-full bg-slate-900 px-4 py-2 flex items-center justify-between text-xs text-slate-300 border-b border-slate-800">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        Gravação em tempo real ativa • Clique na imagem abaixo no botão exato para registrar o passo
                      </span>
                      <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                        {capturedSteps.length} passos capturados
                      </span>
                    </div>

                    <video
                      ref={videoRef}
                      onClick={handleCaptureFrame}
                      className="max-h-80 w-auto cursor-crosshair object-contain"
                      title="Clique no elemento desejado para capturar o passo com destaque"
                    />

                    {/* Bottom toolbar */}
                    <div className="w-full bg-slate-900/90 backdrop-blur px-4 py-2.5 flex items-center justify-between border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCaptureFrame()}
                          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Capturar Tela Inteira
                        </button>

                        {/* RF-13: Live Blur toggle button */}
                        <button
                          type="button"
                          onClick={() => setIsLiveBlurEnabled(!isLiveBlurEnabled)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            isLiveBlurEnabled
                              ? 'bg-amber-600 text-white shadow ring-2 ring-amber-400/40'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                          title="Desfoque e proteção de privacidade em tempo real"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Live Blur: {isLiveBlurEnabled ? 'Ativado' : 'Desativado'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFinalizeBrowserRecording}
                          disabled={capturedSteps.length === 0 || isProcessing}
                          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Concluir e Abrir Tutorial ({capturedSteps.length})
                        </button>
                        <button
                          onClick={handleStopBrowserCapture}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
                        >
                          Interromper
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Thumbnails of captured steps */}
                  {capturedSteps.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700">
                        Passos Capturados Nesta Sessão:
                      </span>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {capturedSteps.map((step, idx) => (
                          <div
                            key={step.id}
                            className="w-32 bg-white rounded-lg border border-slate-200 p-1.5 shadow-2xs shrink-0 space-y-1"
                          >
                            <img
                              src={step.imageBase64}
                              alt={`Passo ${idx + 1}`}
                              className="w-full h-16 object-cover rounded bg-slate-100"
                            />
                            <p className="text-[10px] font-bold text-slate-700 truncate">
                              {idx + 1}. Passo {idx + 1}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {activeTab === 'desktop'
              ? 'Todos os cliques são registrados com camadas de destaque ajustáveis no editor.'
              : 'O tutorial gerado será aberto automaticamente no GuiaMaker Pro para edição.'}
          </p>

          <button
            onClick={() => {
              handleStopBrowserCapture();
              onClose();
            }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
