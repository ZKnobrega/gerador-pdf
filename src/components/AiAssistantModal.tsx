import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ListOrdered,
  Layers,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { TutorialProject } from '../types/tutorial';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TutorialProject;
  onUpdateProject: (updatedProject: TutorialProject) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
}) => {
  const [procedureContext, setProcedureContext] = useState<string>(() => {
    return project.metadata?.aiContext || '';
  });
  const [systemName, setSystemName] = useState<string>(() => {
    return project.metadata?.systemName || '';
  });
  const [updateMetadata, setUpdateMetadata] = useState<boolean>(true);
  const [updateSteps, setUpdateSteps] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const apiKey = localStorage.getItem('guia_maker_gemini_api_key') || '';

  const handleApplyAI = async () => {
    if (!procedureContext.trim()) {
      setErrorMessage('Por favor, informe a explicação do procedimento antes de aplicar a IA.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setStatusMessage('Enviando contexto para o Google Gemini...');

    try {
      const res = await fetch('/api/ai/enhance-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          project,
          procedureContext: procedureContext.trim(),
          systemName: systemName.trim() || undefined,
          apiKey: apiKey || undefined,
          updateMetadata,
          updateSteps,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error && data.error.includes('Chave API')) {
          throw new Error('Chave de API do Gemini não configurada. Configure sua chave no menu de Configurações ⚙️ ou no Gravador.');
        }
        throw new Error(data.error || 'Falha ao processar manual com IA.');
      }

      onUpdateProject(data.project);
      setSuccessMessage('Manual reorganizado e aprimorado com sucesso pela IA!');
      setStatusMessage('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro inesperado ao consultar a IA.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 modal-overlay">
      <div className="flex flex-col max-h-[92vh] w-[95vw] max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Assistente de IA: Contexto e Organização
              </h2>
              <p className="text-xs text-slate-400">
                Explique o procedimento para a IA nomear, organizar e reescrever os passos com precisão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Context Input */}
          <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Explicação do Procedimento para a IA:</span>
              <span className="text-[11px] font-normal text-indigo-700">Objetivo Geral do Manual</span>
            </label>
            <textarea
              value={procedureContext}
              onChange={(e) => setProcedureContext(e.target.value)}
              rows={4}
              placeholder="Ex: Este manual ensina os usuários a cadastrar um novo processo no SEI, preencher os interessados, anexar a minuta em PDF e tramitar para a assessoria jurídica."
              className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed font-normal"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Quanto mais claro você for sobre o que o procedimento realiza, mais precisos serão os nomes dos botões, os objetivos de cada passo e as recomendações geradas.
            </p>
          </div>

          {/* System Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Sistema ou Módulo (Opcional):
            </label>
            <input
              type="text"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="Ex: SEI, Sistema Exemplo, Intranet, SIGA"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Enhancement Options */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              O que a IA deve atualizar com base nesta explicação:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  updateSteps
                    ? 'bg-blue-50/60 border-blue-300 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={updateSteps}
                  onChange={(e) => setUpdateSteps(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <div className="space-y-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                    Reorganizar Todos os Passos ({project.steps.length})
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Reescreve títulos em ordem lógica, alinha os objetivos e padroniza as instruções com botões em negrito.
                  </p>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  updateMetadata
                    ? 'bg-blue-50/60 border-blue-300 text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={updateMetadata}
                  onChange={(e) => setUpdateMetadata(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <div className="space-y-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Atualizar Título e Apresentação
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Gera um título institucional atrativo, subtítulo operacional e o parágrafo de finalidade do manual.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Aviso de Execução</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="font-medium">{successMessage}</p>
            </div>
          )}

          {isLoading && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>{statusMessage || 'Processando com Inteligência Artificial Gemini...'}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>As imagens e anotações originais são 100% preservadas.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleApplyAI}
              disabled={isLoading || (!updateMetadata && !updateSteps)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aprimorando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Aplicar Melhorias com IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
