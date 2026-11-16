import React, { useState, useEffect } from 'react';
import {
  TutorialProject,
  TutorialStep,
  StepImage,
  ShapeAnnotation,
  FocusRegion,
  getStepImages,
} from './types/tutorial';
import { defaultProject, normalizeProject } from './data/defaultProject';
import { PdfDocument } from './components/PdfDocument';
import { StepEditor } from './components/StepEditor';
import { ImageEditorModal } from './components/ImageEditorModal';
import { applyAutomaticFocusRegions } from './utils/focusRegion';
import { SettingsModal } from './components/SettingsModal';
import { ScreenRecorderModal } from './components/ScreenRecorderModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { HomeScreen } from './components/HomeScreen';
import {
  getRecentProjects,
  saveProjectToRecent,
  fetchSharedProjects,
  saveProjectShared,
} from './utils/recentProjects';
import { exportPdfDirectly } from './utils/pdfExporter';
import { publishProjectPdf } from './utils/publishedPdfs';
import {
  FileText,
  Printer,
  Download,
  FolderOpen,
  Plus,
  Palette,
  Eye,
  Columns,
  Sparkles,
  ChevronRight,
  Settings,
  ArrowLeft,
  Loader2,
  FileDown,
  Globe,
  Camera
} from 'lucide-react';

export const App: React.FC = () => {
  // Screen state: 'home' (Tela Inicial) | 'editor' (Área de Trabalho)
  const [currentScreen, setCurrentScreen] = useState<'home' | 'editor'>('home');

  // Recent projects list (shared across all devices)
  const [recentProjects, setRecentProjects] = useState<TutorialProject[]>(() => {
    return getRecentProjects();
  });

  // Current active project in editor
  const [project, setProject] = useState<TutorialProject>(() => {
    const saved = localStorage.getItem('tutorial_generator_project');
    if (saved) {
      try {
        return normalizeProject(JSON.parse(saved));
      } catch {
        return defaultProject;
      }
    }
    return defaultProject;
  });

  const [activeStepId, setActiveStepId] = useState<string>(() => {
    return project.steps[0]?.id || 'step-1';
  });

  // View Mode inside editor: 'split' | 'editor' | 'preview'
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  // Modal states
  const [isImageEditorOpen, setIsImageEditorOpen] = useState<boolean>(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);

  // Direct PDF export progress state
  const [isExportingDirect, setIsExportingDirect] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');

  // Publishing the final PDF into the shared "Tutoriais do Sistema" library
  const [isPublishingPdf, setIsPublishingPdf] = useState<boolean>(false);

  /**
   * RF-17 — Automatic focus on the click.
   * Any screenshot that already carries click / action annotations (including the
   * ones produced by the screen recorder) gets its focus region derived from
   * those clicks, without the user having to open the image editor.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updated = await applyAutomaticFocusRegions(project);
      if (!cancelled && updated) {
        setProject(updated);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, project.steps]);

  // Initial load: fetch shared projects from server for all desktops or load from ?id=
  useEffect(() => {
    refreshRecents();

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    if (targetId) {
      fetch(`/api/projects/${encodeURIComponent(targetId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((loadedProject) => {
          if (loadedProject) {
            handleOpenProject(loadedProject);
          }
        })
        .catch((err) => console.warn('Não foi possível carregar projeto pela URL:', err));
    }
  }, []);

  // Auto-save active project to LocalStorage AND central server (debounced)
  useEffect(() => {
    try {
      localStorage.setItem('tutorial_generator_project', JSON.stringify(project));
      saveProjectToRecent(project);
    } catch {
      // ignore storage quota issues
    }

    const timer = setTimeout(() => {
      saveProjectShared(project);
    }, 600);

    return () => clearTimeout(timer);
  }, [project]);

  // Refresh recent projects from server or local storage
  const refreshRecents = async () => {
    try {
      const list = await fetchSharedProjects();
      setRecentProjects(list);
    } catch {
      setRecentProjects(getRecentProjects());
    }
  };

  // Open a project (from HomeScreen, open button, or recents)
  const handleOpenProject = (selectedProject: any) => {
    const safeProject = normalizeProject(selectedProject);
    setProject(safeProject);
    setActiveStepId(safeProject.steps[0]?.id || '');
    saveProjectShared(safeProject);
    refreshRecents();
    setCurrentScreen('editor');
  };

  // Global Paste listener (Ctrl+V) for screenshots
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (currentScreen !== 'editor') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                if (activeStep) {
                  const currentImgs = getStepImages(activeStep);
                  const newImg: StepImage = {
                    id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    url: base64,
                    originalUrl: base64,
                    caption: `Figura ${activeStep.order}.${currentImgs.length + 1}: Detalhe da etapa`,
                    widthPercent: 100,
                  };
                  const updatedList = [...currentImgs, newImg];
                  updateActiveStep({
                    ...activeStep,
                    images: updatedList,
                    image: updatedList[0]?.url || null,
                    caption: updatedList[0]?.caption || '',
                    imageWidthPercent: updatedList[0]?.widthPercent || 100,
                  });
                }
              };
              reader.readAsDataURL(blob);
              e.preventDefault();
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  });

  // Active step finder
  const activeStepIndex = project.steps.findIndex((s) => s.id === activeStepId);
  const activeStep = project.steps[activeStepIndex] || project.steps[0];

  // Step operations
  const updateActiveStep = (updated: TutorialStep) => {
    setProject((prev) => {
      const idx = prev.steps.findIndex((s) => s.id === updated.id);
      const targetIdx = idx >= 0 ? idx : (activeStepIndex >= 0 ? activeStepIndex : 0);
      const updatedSteps = [...prev.steps];
      updatedSteps[targetIdx] = updated;
      return {
        ...prev,
        steps: updatedSteps,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleBatchBlur = (blurAnnotation: ShapeAnnotation) => {
    setProject((prev) => {
      const updatedSteps = prev.steps.map((st) => {
        const images = getStepImages(st);
        if (images.length === 0) return st;

        const updatedImages = images.map((img) => {
          const existing = img.annotations || [];
          const newBlur: ShapeAnnotation = {
            ...blurAnnotation,
            id: `batch-blur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          };
          return {
            ...img,
            annotations: [...existing, newBlur],
          };
        });

        return {
          ...st,
          images: updatedImages,
        };
      });

      return {
        ...prev,
        steps: updatedSteps,
        updatedAt: new Date().toISOString(),
      };
    });
  };


  const handleAddNewStep = () => {
    setProject((prev) => {
      const nextOrder = prev.steps.length + 1;
      const newStepId = `step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newStep: TutorialStep = {
        id: newStepId,
        order: nextOrder,
        title: `Passo ${nextOrder}: Nova Instrução`,
        objective: 'Descreva aqui o objetivo desta etapa.',
        instructions: ['Clique no botão correspondente para prosseguir.'],
        image: null,
        caption: `Figura ${nextOrder}: Detalhe da ação`,
        imageWidthPercent: 100,
        callout: null,
        forcePageBreakAfter: false,
      };

      // Set as active step
      setActiveStepId(newStepId);

      return {
        ...prev,
        steps: [...prev.steps, newStep],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleDeleteStep = (stepId: string) => {
    if (project.steps.length <= 1) {
      alert('O manual precisa ter pelo menos um passo.');
      return;
    }

    if (window.confirm('Tem certeza que deseja remover este passo?')) {
      const filtered = project.steps
        .filter((s) => s.id !== stepId)
        .map((s, idx) => ({ ...s, order: idx + 1 }));

      setProject({
        ...project,
        steps: filtered,
        updatedAt: new Date().toISOString(),
      });

      if (activeStepId === stepId) {
        setActiveStepId(filtered[0]?.id || '');
      }
    }
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= project.steps.length) return;

    const list = [...project.steps];
    const item = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = item;

    const reordered = list.map((s, idx) => ({ ...s, order: idx + 1 }));
    setProject({
      ...project,
      steps: reordered,
      updatedAt: new Date().toISOString(),
    });
  };

  // Direct PDF Download (.pdf file generator)
  const handleDownloadDirectPdf = async () => {
    setIsExportingDirect(true);
    setExportProgressText('Iniciando processamento das páginas...');
    try {
      await exportPdfDirectly(project.metadata.title, (current, total, status) => {
        setExportProgressText(status);
      });
    } finally {
      setIsExportingDirect(false);
      setExportProgressText('');
    }
  };

  /**
   * Publishes the final PDF into the shared library shown on the home screen
   * ("Tutoriais do Sistema"), building a public history of the manuals.
   * The editable project is untouched: this only adds a read-only snapshot.
   */
  const handlePublishPdf = async () => {
    const confirmed = window.confirm(
      `Publicar o PDF final de "${project.metadata.title}" em Tutoriais do Sistema?\n\n` +
        'O arquivo ficará visível e disponível para download em todos os computadores que acessam o sistema.'
    );
    if (!confirmed) return;

    setIsPublishingPdf(true);
    setIsExportingDirect(true);
    setExportProgressText('Gerando o PDF final para publicação...');

    try {
      const result = await publishProjectPdf(project, (_current, _total, status) => {
        setExportProgressText(status);
      });

      if (result.success && result.pdf) {
        await refreshRecents();
        alert(
          `PDF publicado com sucesso em Tutoriais do Sistema!\n\n` +
            `Documento: ${result.pdf.title}\n` +
            `Páginas: ${result.pdf.pages}\n\n` +
            'Ele já aparece no histórico da tela inicial para todos os usuários da rede.'
        );
      } else {
        alert(`Não foi possível publicar o PDF.\n\n${result.error || 'Erro desconhecido.'}`);
      }
    } finally {
      setIsPublishingPdf(false);
      setIsExportingDirect(false);
      setExportProgressText('');
    }
  };

  // Native Print / Browser Print Dialog
  const handlePrint = async () => {
    if (window.electronAPI?.savePdfDialog) {
      const defaultName = `manual-${project.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'tutorial'}.pdf`;
      try {
        const result = await window.electronAPI.savePdfDialog(defaultName);
        if (result.success) {
          alert(`PDF exportado com sucesso!\nSalvo em: ${result.filePath}`);
          return;
        }
        if (result.cancelled) return;
      } catch (err) {
        console.error('Erro no salvamento nativo do PDF:', err);
      }
    }
    // Browser mode: trigger print preview
    window.print();
  };

  // Save Project JSON to file
  const handleSaveProject = () => {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutorial-${project.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'manual'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open / Load Project JSON directly from topbar
  const handleOpenProjectFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.steps && parsed.metadata) {
            handleOpenProject(parsed);
          } else {
            alert('Formato de arquivo inválido.');
          }
        } catch {
          alert('Erro ao carregar o arquivo do projeto.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="app-root relative min-h-screen bg-slate-100">
      {/* Always-mounted container for native system print */}
      <div
        id="pdf-export-container"
        className="absolute -left-[9999px] top-0 pointer-events-none print:static print:left-0 print:block print:w-full print:m-0 print:p-0 print-only-container"
        style={{ width: '210mm' }}
      >
        <PdfDocument project={project} printMode={true} />
      </div>

      {/* Dedicated high-fidelity stage for direct PDF generation (scale 2, full A4 formatting, no clipping) */}
      <div
        id="pdf-direct-export-stage"
        className="fixed -left-[99999px] top-0 pointer-events-none bg-white"
        style={{
          width: '210mm',
        }}
      >
        <PdfDocument project={project} printMode={false} />
      </div>

      {/* Screen 1: Home Dashboard Screen */}
      <div className="no-print flex flex-col h-screen w-screen overflow-hidden bg-slate-100">
        {currentScreen === 'home' && (
          <HomeScreen
            recentProjects={recentProjects}
            onOpenProject={handleOpenProject}
            onRefreshRecents={refreshRecents}
            onOpenRecorder={() => setIsRecorderOpen(true)}
          />
        )}

        {/* Screen 2: Tutorial Editor & Preview Workspace */}
        {currentScreen === 'editor' && (
          <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100">
            {/* Main Top Header Bar */}
            <header className="app-header flex items-center justify-between px-6 py-3 bg-slate-900 text-white border-b border-slate-800 z-30 flex-shrink-0">
              <div className="flex items-center gap-4">
                {/* Return to Home Button */}
                <button
                  onClick={() => {
                    refreshRecents();
                    setCurrentScreen('home');
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
                  title="Voltar para a Tela Inicial e Lista de Tutoriais"
                >
                  <ArrowLeft className="w-4 h-4 text-blue-400" />
                  <span>Início</span>
                </button>

                <div className="h-5 w-px bg-slate-700 hidden sm:block" />

                {/* Active Document Info Badge with Logo */}
                <div className="hidden md:flex items-center gap-2.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  {project.metadata.logoUrl ? (
                    <img
                      src={project.metadata.logoUrl}
                      alt="Logotipo"
                      className="h-4.5 w-auto object-contain block"
                    />
                  ) : (
                    <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                      {project.metadata.systemName || 'SISTEMA'}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-200 truncate max-w-xs">
                    {project.metadata.title}
                  </span>
                </div>
              </div>

              {/* Center Mode Switcher */}
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setViewMode('editor')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewMode === 'editor'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Editor
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewMode === 'split'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  Lado a Lado
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    viewMode === 'preview'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Visualizar PDF
                </button>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsAiAssistantOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Explicar procedimento para a IA, reorganizar passos, editar títulos e textos"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Organizar com IA</span>
                </button>

                <button
                  onClick={() => setIsRecorderOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  title="Abrir Gravador de Passos Inteligente"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gravar Passos</span>
                </button>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                  title="Personalizar Cores, Cabeçalho e Suporte"
                >
                  <Palette className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Design & Cores</span>
                </button>

                {/* Project File Actions */}
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer transition">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Abrir</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleOpenProjectFromFile}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleSaveProject}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
                  title="Salvar Arquivo JSON do Projeto no Computador"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Salvar</span>
                </button>

                {/* Direct PDF Download Button (Primary) */}
                <button
                  onClick={handleDownloadDirectPdf}
                  disabled={isExportingDirect}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/30 transition disabled:opacity-50"
                  title="Baixar arquivo PDF de todas as páginas diretamente no seu computador"
                >
                  {isExportingDirect ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>Baixar PDF (.pdf)</span>
                </button>

                {/* Publish final PDF to the shared library */}
                <button
                  onClick={handlePublishPdf}
                  disabled={isExportingDirect}
                  className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-950/30 transition disabled:opacity-50"
                  title="Publicar o PDF final em Tutoriais do Sistema (histórico público da rede)"
                >
                  {isPublishingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Publicar PDF</span>
                </button>

                {/* Print Dialog Button */}
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700 transition"
                  title="Abrir tela de impressão do sistema"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Imprimir</span>
                </button>
              </div>
            </header>

            {/* Main Workspace Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar: Steps List */}
              <aside className="app-sidebar w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Passos do Tutorial ({project.steps.length})
                  </span>
                  <button
                    onClick={handleAddNewStep}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Novo Passo
                  </button>
                </div>

                {/* AI Briefing Banner in Sidebar */}
                {project.metadata?.aiContext ? (
                  <div className="px-3 pt-3 pb-1 border-b border-slate-100">
                    <button
                      onClick={() => setIsAiAssistantOpen(true)}
                      className="w-full text-left p-2.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/80 hover:from-indigo-100/90 hover:to-blue-100/80 border border-indigo-200/90 rounded-xl transition flex items-center justify-between group shadow-2xs cursor-pointer"
                      title="Clique para ver ou editar a explicação do procedimento para a IA"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <div className="truncate">
                          <span className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Contexto da IA</span>
                          <span className="block text-[11px] text-slate-700 truncate italic">
                            "{project.metadata.aiContext}"
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 shrink-0 ml-1" />
                    </button>
                  </div>
                ) : (
                  <div className="px-3 pt-3 pb-1 border-b border-slate-100">
                    <button
                      onClick={() => setIsAiAssistantOpen(true)}
                      className="w-full text-left px-2.5 py-2 bg-slate-50 hover:bg-indigo-50/70 border border-dashed border-slate-300 hover:border-indigo-300 rounded-xl transition flex items-center justify-between text-slate-600 hover:text-indigo-700 group cursor-pointer"
                      title="Explique o que é este procedimento para a IA organizar e aprimorar os passos"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        + Explicar procedimento para a IA
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-500 font-medium">Briefing</span>
                    </button>
                  </div>
                )}

                {/* Steps List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {project.steps.map((step) => {
                    const isActive = step.id === activeStepId;
                    return (
                      <div
                        key={step.id}
                        onClick={() => setActiveStepId(step.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-start gap-3 group relative ${
                          isActive
                            ? 'bg-blue-50/70 border-blue-500/80 shadow-xs ring-1 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {step.order}
                        </div>

                        <div className="flex-1 overflow-hidden pr-2">
                          <p
                            className={`text-xs font-bold truncate leading-tight ${
                              isActive ? 'text-blue-950' : 'text-slate-800'
                            }`}
                          >
                            {step.title || `Passo ${step.order}`}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {step.objective || `${step.instructions.length} instruções`}
                          </p>

                          <div className="flex items-center gap-2 mt-2">
                            {(() => {
                              const imgs = getStepImages(step);
                              if (imgs.length === 0) {
                                return (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                    Sem imagem
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
                                  {imgs.length} {imgs.length === 1 ? 'imagem' : 'imagens'}
                                </span>
                              );
                            })()}

                            {step.callout && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-1.5 py-0.5 rounded border border-amber-200">
                                Alerta
                              </span>
                            )}

                            {step.forcePageBreakAfter && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.5 rounded">
                                Quebra pág.
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 mt-1 transition ${
                            isActive ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Quick info at bottom of sidebar */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{project.steps.length} passos configurados</span>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" /> Configurar
                  </button>
                </div>
              </aside>

              {/* Center / Right Area: Editor and/or PDF Preview */}
              <main className="flex-1 flex overflow-hidden bg-slate-100">
                {/* Step Editor Panel */}
                {(viewMode === 'editor' || viewMode === 'split') && activeStep && (
                  <div
                    className={`overflow-y-auto p-6 transition-all bg-slate-100 ${
                      viewMode === 'split' ? 'w-1/2 border-r border-slate-200' : 'w-full'
                    }`}
                  >
                    <div className="max-w-3xl mx-auto pb-16">
                      <StepEditor
                        step={activeStep}
                        totalSteps={project.steps.length}
                        onUpdate={updateActiveStep}
                        onDelete={() => handleDeleteStep(activeStep.id)}
                        onOpenImageEditor={(imgId) => {
                          setEditingImageId(imgId);
                          setIsImageEditorOpen(true);
                        }}
                        onMoveUp={() => handleMoveStep(activeStepIndex, 'up')}
                        onMoveDown={() => handleMoveStep(activeStepIndex, 'down')}
                        procedureContext={project.metadata?.aiContext}
                      />
                    </div>
                  </div>
                )}

                {/* Live Document Preview Panel */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div
                    className={`flex-1 overflow-y-auto overflow-x-auto p-8 bg-slate-200/90 flex flex-col items-center ${
                      viewMode === 'split' ? 'w-1/2' : 'w-full'
                    }`}
                  >
                    {/* Preview Notice Bar */}
                    <div className="mb-4 bg-white/95 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-slate-300 shadow-xs flex items-center justify-between w-full max-w-[210mm] text-xs text-slate-600">
                      <span className="font-semibold flex items-center gap-2 text-slate-800">
                        <Eye className="w-4 h-4 text-blue-600" />
                        Visualização A4 do Documento em Tempo Real
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleDownloadDirectPdf}
                          disabled={isExportingDirect}
                          className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs transition"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Baixar PDF (.pdf)
                        </button>
                        <button
                          onClick={handlePublishPdf}
                          disabled={isExportingDirect}
                          className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 shadow-2xs transition disabled:opacity-50"
                          title="Publicar o PDF final em Tutoriais do Sistema"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Publicar PDF
                        </button>
                        <button
                          onClick={handlePrint}
                          className="font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir
                        </button>
                      </div>
                    </div>

                    {/* Document Rendering */}
                    <div className="w-full flex justify-center pb-20">
                      <PdfDocument project={project} />
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        )}
      </div>

      {/* Direct PDF Export Progress Modal */}
      {isExportingDirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-w-sm w-full text-center flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Gerando Arquivo PDF
            </h3>
            <p className="text-xs text-slate-500 mb-2">
              {exportProgressText || 'Renderizando páginas com alta resolução...'}
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-blue-600 h-full w-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal (Edits specific selected image) */}
      {isImageEditorOpen && activeStep && (() => {
        const stepImages = getStepImages(activeStep);
        const targetImg = stepImages.find((img) => img.id === editingImageId) || stepImages[0];
        if (!targetImg || !targetImg.url) return null;

        return (
          <ImageEditorModal
            isOpen={isImageEditorOpen}
            imageSrc={targetImg.originalUrl || targetImg.url}
            originalImageSrc={targetImg.originalUrl || targetImg.url}
            initialAnnotations={targetImg.annotations || []}
            initialAltText={targetImg.altText || ''}
            initialFocusRegion={targetImg.focusRegion || null}
            activeStepAction={{
              actionType: activeStep.actionType,
              typedText: activeStep.typedText,
              hotkey: activeStep.hotkey,
            }}
            onClose={() => {
              setIsImageEditorOpen(false);
              setEditingImageId(null);
            }}
            onBatchBlur={handleBatchBlur}
            onSave={(newImg, savedAnnotations, altText, focusRegion) => {
              const updatedImages = stepImages.map((img) =>
                img.id === targetImg.id
                  ? {
                      ...img,
                      url: newImg,
                      originalUrl: img.originalUrl || targetImg.url,
                      annotations: savedAnnotations || [],
                      altText: altText || img.altText,
                      // RF-17: non-destructive focus (undefined = complete image in the PDF)
                      focusRegion: focusRegion || undefined,
                    }
                  : img
              );
              updateActiveStep({
                ...activeStep,
                images: updatedImages,
                image: updatedImages[0]?.url || null,
                caption: updatedImages[0]?.caption || '',
                imageWidthPercent: updatedImages[0]?.widthPercent || 100,
              });
              setIsImageEditorOpen(false);
              setEditingImageId(null);
            }}
          />
        );
      })()}

      {/* Document Settings & Themes Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          project={project}
          onClose={() => setIsSettingsOpen(false)}
          onUpdate={(updated) => setProject(updated)}
        />
      )}

      {/* Screen & Step Recorder Modal */}
      <ScreenRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onTutorialCreated={(newProj) => handleOpenProject(newProj)}
      />

      {/* AI Assistant Modal for Procedure Context & Reorganizing */}
      {isAiAssistantOpen && (
        <AiAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          project={project}
          onUpdateProject={(updatedProj) => {
            setProject(updatedProj);
          }}
        />
      )}
    </div>
  );
};
