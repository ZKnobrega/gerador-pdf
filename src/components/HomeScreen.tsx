import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TutorialProject } from '../types/tutorial';
import { defaultProject, normalizeProject } from '../data/defaultProject';
import { createBlankProject, deleteProjectShared } from '../utils/recentProjects';
import {
  PublishedPdf,
  fetchPublishedPdfs,
  deletePublishedPdf,
  getPdfViewUrl,
  getPdfDownloadUrl,
  formatPdfSize,
} from '../utils/publishedPdfs';
import {
  FileText,
  Plus,
  FolderOpen,
  Sparkles,
  Printer,
  Trash2,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  Building2,
  FileCode2,
  Search,
  ExternalLink,
  Share2,
  Globe,
  Camera,
  FileDown,
  History,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface HomeScreenProps {
  recentProjects: TutorialProject[];
  onOpenProject: (project: TutorialProject) => void;
  onRefreshRecents: () => void;
  onOpenRecorder?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  recentProjects,
  onOpenProject,
  onRefreshRecents,
  onOpenRecorder,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSystem, setNewSystem] = useState('');
  const [newOrg, setNewOrg] = useState('NOME DA ORGANIZAÇÃO');

  // Public library of published PDFs (read-only history shared on the network)
  const [publishedPdfs, setPublishedPdfs] = useState<PublishedPdf[]>([]);
  const [isLoadingPdfs, setIsLoadingPdfs] = useState<boolean>(true);

  const loadPublishedPdfs = useCallback(async () => {
    setIsLoadingPdfs(true);
    try {
      setPublishedPdfs(await fetchPublishedPdfs());
    } finally {
      setIsLoadingPdfs(false);
    }
  }, []);

  useEffect(() => {
    loadPublishedPdfs();
  }, [loadPublishedPdfs]);

  const handleDeletePublishedPdf = async (pdf: PublishedPdf) => {
    const confirmed = window.confirm(
      `Remover definitivamente o PDF "${pdf.title}" do histórico público?\n\n` +
        'O arquivo deixará de estar disponível para todos os computadores da rede e esta ação não pode ser desfeita. O tutorial editável não será afetado.'
    );
    if (!confirmed) return;

    const ok = await deletePublishedPdf(pdf.id);
    if (ok) {
      setPublishedPdfs((prev) => prev.filter((item) => item.id !== pdf.id));
    } else {
      alert('Não foi possível remover o PDF publicado. Verifique a conexão com o servidor.');
    }
  };

  // Handle open from computer
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && (parsed.steps || parsed.id)) {
            onOpenProject(normalizeProject(parsed));
          } else {
            alert('Formato de arquivo inválido. Selecione um arquivo .json gerado pelo aplicativo.');
          }
        } catch {
          alert('Erro ao ler o arquivo do projeto.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Create new project with modal
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const blank = createBlankProject(newTitle.trim() || 'Novo Manual do Sistema');
    if (newSystem.trim()) {
      blank.metadata.systemName = newSystem.trim();
    }
    if (newOrg.trim()) {
      blank.metadata.organization = newOrg.trim();
    }
    setIsCreatingNew(false);
    onOpenProject(blank);
  };

  // Delete project from recents and server
  const handleDeleteRecent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Deseja remover este tutorial da lista de tutoriais compartilhados?')) {
      await deleteProjectShared(id);
      onRefreshRecents();
    }
  };

  // Download project JSON directly
  const handleDownloadJson = (e: React.MouseEvent, project: TutorialProject) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutorial-${project.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'manual'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter projects by search term
  const filteredProjects = recentProjects.filter((p) => {
    const query = searchTerm.toLowerCase();
    return (
      p.metadata.title.toLowerCase().includes(query) ||
      p.metadata.systemName.toLowerCase().includes(query) ||
      p.metadata.organization.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 flex flex-col min-h-screen">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleOpenFile}
        className="hidden"
      />

      {/* Top Banner & Hero */}
      <div className="bg-slate-900 text-white pt-12 pb-16 px-6 sm:px-12 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/40">
                  <FileCode2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    GuiaMaker <span className="text-blue-400 font-semibold">Pro</span>
                  </h1>
                  <span className="text-xs text-slate-400 font-medium">
                    Gerador de Manuais & Tutoriais em PDF com Padrão Visual Institucional
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed mt-2">
                Monte tutoriais de sistemas passo a passo, insira capturas de tela com cortes, setas, caixas de destaque e censura por desfoque forte para proteger dados sigilosos.
              </p>
            </div>
          </div>

          {/* Main Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {/* Card 1: Gravador de Passos (Tango / PSR com IA) */}
            <div
              onClick={onOpenRecorder}
              className="group bg-gradient-to-br from-rose-700 to-rose-950 hover:from-rose-600 hover:to-rose-900 p-6 rounded-2xl border border-rose-500/50 shadow-xl cursor-pointer transition-all transform hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                Novo • IA
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition shadow-inner">
                <Camera className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5 flex items-center gap-1.5">
                Gravar Passos
                <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition" />
              </h2>
              <p className="text-xs text-rose-100/80 leading-relaxed">
                Capture cliques em sistemas Web e aplicativos do Windows. Destaques automáticos em círculos interativos.
              </p>
            </div>

            {/* Card 2: Criar Novo */}
            <div
              onClick={() => setIsCreatingNew(true)}
              className="group bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 p-6 rounded-2xl border border-blue-500/40 shadow-xl cursor-pointer transition-all transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition">
                <Plus className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5 flex items-center gap-1.5">
                Criar Novo Tutorial
                <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition" />
              </h2>
              <p className="text-xs text-blue-100/80 leading-relaxed">
                Inicie um novo documento do zero com título, sistema e passos personalizados.
              </p>
            </div>

            {/* Card 3: Editar Tutorial Existente */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group bg-slate-800/90 hover:bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl cursor-pointer transition-all transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5 flex items-center gap-1.5">
                Editar Existente
                <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition" />
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Carregue um arquivo <code className="text-sky-300">.json</code> salvo no seu computador para continuar.
              </p>
            </div>

            {/* Card 4: Modelo de Exemplo */}
            <div
              onClick={() => onOpenProject(defaultProject)}
              className="group bg-slate-800/90 hover:bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl cursor-pointer transition-all transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5 flex items-center gap-1.5">
                Modelo de Exemplo
                <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition" />
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Abra o modelo completo de 6 passos de exemplo para referência e edição imediata.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tutorials Section */}
      <div className="max-w-6xl mx-auto px-6 sm:px-12 py-10 w-full flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-blue-600" />
                Tutoriais do Sistema
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {recentProjects.length}
                </span>
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <Globe className="w-3 h-3 text-emerald-600" />
                Compartilhado na Rede
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tutoriais salvos e sincronizados para todos os computadores que acessam o sistema
            </p>
          </div>

          {/* Search bar */}
          {recentProjects.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar tutorial..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Project Cards Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((proj) => {
              const formattedDate = proj.updatedAt
                ? new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(proj.updatedAt))
                : 'Recente';

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: System Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg text-white shadow-2xs"
                        style={{ backgroundColor: proj.theme?.primaryColor || '#0a335c' }}
                      >
                        {proj.metadata.systemName || 'SISTEMA'}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleDownloadJson(e, proj)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Baixar Arquivo JSON do Projeto"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteRecent(e, proj.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remover dos Recentes"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug mb-1">
                      {proj.metadata.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                      {proj.metadata.subtitle || proj.metadata.purpose}
                    </p>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-4">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{proj.metadata.organization}</span>
                    </div>
                  </div>

                  {/* Bottom Meta & Button */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        {proj.steps.length} passos
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {formattedDate}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition flex items-center gap-1">
                      Editar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Nenhum tutorial encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              Comece agora criando um novo manual ou abra o modelo padrão de referência.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsCreatingNew(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                Criar Primeiro Tutorial
              </button>
              <button
                onClick={() => onOpenProject(defaultProject)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Carregar Modelo de Exemplo
              </button>
            </div>
          </div>
        )}

        {/* ======= Published PDF history (public library) ======= */}
        <div className="mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                  <History className="w-5 h-5 text-rose-600" />
                  Histórico de PDFs Publicados
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {publishedPdfs.length}
                  </span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <Globe className="w-3 h-3 text-emerald-600" />
                  Público na Rede
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                PDFs finalizados e publicados pelo botão <strong>Publicar PDF</strong> do editor — abertos
                para leitura e download por qualquer usuário, sem precisar editar o tutorial
              </p>
            </div>

            <button
              onClick={loadPublishedPdfs}
              disabled={isLoadingPdfs}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-rose-400 text-slate-600 rounded-xl text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              title="Atualizar a lista de PDFs publicados"
            >
              {isLoadingPdfs ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Atualizar
            </button>
          </div>

          {publishedPdfs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {publishedPdfs.map((pdf) => {
                const publishedDate = pdf.publishedAt
                  ? new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(pdf.publishedAt))
                  : 'Recente';

                return (
                  <div
                    key={pdf.id}
                    className="group bg-white rounded-2xl border border-slate-200 hover:border-rose-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-600 text-white shadow-2xs flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          PDF
                          {pdf.systemName ? ` • ${pdf.systemName}` : ''}
                        </span>

                        <button
                          onClick={() => handleDeletePublishedPdf(pdf)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remover do histórico público"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug mb-1">
                        {pdf.title}
                      </h3>
                      {pdf.subtitle && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{pdf.subtitle}</p>
                      )}

                      {pdf.organization && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-4">
                          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{pdf.organization}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 font-medium">
                          <Layers className="w-3.5 h-3.5 text-rose-500" />
                          {pdf.pages || '—'} pág.
                        </span>
                        <span className="font-medium">{formatPdfSize(pdf.sizeBytes)}</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {publishedDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={getPdfViewUrl(pdf)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir PDF
                        </a>
                        <a
                          href={getPdfDownloadUrl(pdf)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                          title="Baixar o arquivo PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Baixar
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {isLoadingPdfs ? 'Carregando histórico...' : 'Nenhum PDF publicado ainda'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Abra um tutorial no editor e use o botão <strong>Publicar PDF</strong> para deixar a
                versão final salva aqui, disponível publicamente para todos os computadores da rede.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Criar Novo Tutorial */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold">Criar Novo Tutorial</h3>
              </div>
              <button
                onClick={() => setIsCreatingNew(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Título Principal do Tutorial / Manual
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Gerenciamento de Processos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nome do Sistema
                </label>
                <input
                  type="text"
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  placeholder="Ex: SEI, PJE, Intranet"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Instituição / Órgão
                </label>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="Ex: NOME DA ORGANIZAÇÃO"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Criar e Abrir Editor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
