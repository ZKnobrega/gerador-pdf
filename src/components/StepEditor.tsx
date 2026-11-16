import React, { useState } from 'react';
import {
  TutorialStep,
  StepCallout,
  StepImage,
  FocusMode,
  getStepImages,
  getEffectiveFocus,
  hasFocusAnchors,
} from '../types/tutorial';
import { FocusedImage } from './FocusedImage';
import {
  Image as ImageIcon,
  Edit3,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Info,
  CheckCircle2,
  FileCheck2,
  Upload,
  ClipboardPaste,
  SlidersHorizontal,
  ScanSearch,
  Bookmark,
  Layers,
  Loader2
} from 'lucide-react';

interface StepEditorProps {
  step: TutorialStep;
  totalSteps: number;
  onUpdate: (updatedStep: TutorialStep) => void;
  onDelete: () => void;
  onOpenImageEditor: (imageId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  procedureContext?: string;
}

export const StepEditor: React.FC<StepEditorProps> = ({
  step,
  totalSteps,
  onUpdate,
  onDelete,
  onOpenImageEditor,
  onMoveUp,
  onMoveDown,
  procedureContext,
}) => {
  const [newInstruction, setNewInstruction] = useState('');
  const [isEnhancingWithAI, setIsEnhancingWithAI] = useState(false);
  const stepImages = getStepImages(step);

  const handleEnhanceWithAI = async () => {
    const key = localStorage.getItem('guia_maker_gemini_api_key') || '';
    const images = getStepImages(step);
    const targetImage = images[0]?.url || step.image || '';

    setIsEnhancingWithAI(true);
    try {
      const res = await fetch('/api/ai/analyze-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: targetImage,
          windowTitle: step.caption || step.title,
          elementText: step.objective,
          stepNumber: step.order,
          totalSteps,
          procedureContext: procedureContext || undefined,
          actionType: step.actionType,
          typedText: step.typedText,
          hotkey: step.hotkey,
          apiKey: key || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error && data.error.includes('Chave API')) {
          alert('Chave API do Gemini não configurada!\n\nPara usar o recurso de IA, configure sua chave no menu de Configurações (ícone de engrenagem) ou na tela do Gravador de Passos.');
        } else {
          alert('Falha ao aprimorar passo com IA: ' + (data.error || 'Erro desconhecido'));
        }
        return;
      }

      const analyzed = data.step;
      onUpdate({
        ...step,
        title: analyzed.title || step.title,
        objective: analyzed.objective || step.objective,
        instructions: Array.isArray(analyzed.instructions) && analyzed.instructions.length > 0
          ? analyzed.instructions
          : step.instructions,
        callout: analyzed.callout ? {
          enabled: analyzed.callout.enabled !== false,
          type: analyzed.callout.type || 'tip',
          title: analyzed.callout.title || 'Dica da IA:',
          content: analyzed.callout.content || '',
        } : step.callout,
      });
    } catch (err: any) {
      alert('Erro ao conectar ao serviço de IA: ' + err.message);
    } finally {
      setIsEnhancingWithAI(false);
    }
  };

  // Update step field helper
  const updateField = <K extends keyof TutorialStep>(field: K, value: TutorialStep[K]) => {
    onUpdate({
      ...step,
      [field]: value,
    });
  };

  // Add instruction (adds typed text or a new blank/placeholder instruction)
  const handleAddInstruction = (customText?: string) => {
    const textToAdd = (typeof customText === 'string' ? customText : newInstruction).trim() || 'Nova instrução...';
    const current = Array.isArray(step.instructions) ? step.instructions : [];
    const updated = [...current, textToAdd];
    updateField('instructions', updated);
    setNewInstruction('');
  };

  // Remove instruction
  const handleRemoveInstruction = (index: number) => {
    const updated = step.instructions.filter((_, i) => i !== index);
    updateField('instructions', updated);
  };

  // Move instruction up/down
  const handleMoveInstruction = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= step.instructions.length) return;
    const updated = [...step.instructions];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    updateField('instructions', updated);
  };

  // Update single instruction line
  const handleEditInstruction = (index: number, value: string) => {
    const updated = [...step.instructions];
    updated[index] = value;
    updateField('instructions', updated);
  };

  // Add a new image to step
  const handleAddImage = (base64: string) => {
    const newImgId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newStepImage: StepImage = {
      id: newImgId,
      url: base64,
      originalUrl: base64,
      caption: `Figura ${step.order}.${stepImages.length + 1}: Detalhe da etapa`,
      widthPercent: 100,
    };
    const updatedImages = [...stepImages, newStepImage];
    onUpdate({
      ...step,
      images: updatedImages,
      image: updatedImages[0]?.url || null,
      caption: updatedImages[0]?.caption || '',
      imageWidthPercent: updatedImages[0]?.widthPercent || 100,
    });
  };

  // Update specific image properties
  const handleUpdateImage = (id: string, updates: Partial<StepImage>) => {
    const updatedImages = stepImages.map((img) =>
      img.id === id ? { ...img, ...updates } : img
    );
    onUpdate({
      ...step,
      images: updatedImages,
      image: updatedImages[0]?.url || null,
      caption: updatedImages[0]?.caption || '',
      imageWidthPercent: updatedImages[0]?.widthPercent || 100,
    });
  };

  // Delete specific image
  const handleDeleteImage = (id: string) => {
    const updatedImages = stepImages.filter((img) => img.id !== id);
    onUpdate({
      ...step,
      images: updatedImages,
      image: updatedImages[0]?.url || null,
      caption: updatedImages[0]?.caption || '',
      imageWidthPercent: updatedImages[0]?.widthPercent || 100,
    });
  };

  // Reorder images within step
  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= stepImages.length) return;
    const list = [...stepImages];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdate({
      ...step,
      images: list,
      image: list[0]?.url || null,
      caption: list[0]?.caption || '',
      imageWidthPercent: list[0]?.widthPercent || 100,
    });
  };

  // Multiple File Upload handler
  const handleMultipleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleAddImage(base64);
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle paste from clipboard
  const handlePasteImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              handleAddImage(base64);
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      alert('Nenhuma imagem encontrada na área de transferência. Tire um print (Win + Shift + S) e tente novamente.');
    } catch {
      alert('Para colar screenshots com facilidade, pressione Ctrl + V enquanto edita este passo.');
    }
  };

  // Toggle Callout
  const toggleCallout = () => {
    if (step.callout) {
      updateField('callout', null);
    } else {
      const newCallout: StepCallout = {
        enabled: true,
        type: 'tip',
        title: '💡 Dica Importante:',
        content: 'Insira aqui observações relevantes, boas práticas ou esclarecimentos para o usuário.',
      };
      updateField('callout', newCallout);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
            {step.order}
          </span>
          <span className="font-bold text-slate-800 text-sm">
            Editando Passo {step.order} de {totalSteps}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Enhancement Button */}
          <button
            type="button"
            onClick={handleEnhanceWithAI}
            disabled={isEnhancingWithAI}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Aprimorar título, objetivo e instruções deste passo com Inteligência Artificial Gemini"
          >
            {isEnhancingWithAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analisando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                <span className="hidden sm:inline">Aprimorar com IA</span>
              </>
            )}
          </button>

          <button
            onClick={onMoveUp}
            disabled={step.order === 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 disabled:opacity-30 transition"
            title="Mover Passo para Cima"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={step.order === totalSteps}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 disabled:opacity-30 transition"
            title="Mover Passo para Baixo"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
            title="Excluir este Passo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {procedureContext && (
        <div className="mx-6 mt-3 px-3 py-1.5 bg-indigo-50/70 border border-indigo-200/80 rounded-lg flex items-center justify-between text-[11px] text-indigo-900">
          <div className="flex items-center gap-1.5 truncate">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-semibold shrink-0">Contexto Geral da IA:</span>
            <span className="truncate text-slate-700 italic">"{procedureContext}"</span>
          </div>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium shrink-0">
            Ativo
          </span>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Step Title & Objective */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Título do Passo
            </label>
            <input
              type="text"
              value={step.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Ex: Acessar a opção 'Gerenciar unidade'"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Objetivo / Descrição Curta (Opcional)
            </label>
            <input
              type="text"
              value={step.objective}
              onChange={(e) => updateField('objective', e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Ex: Localizar o módulo de gestão da unidade ativa no sistema."
            />
          </div>
        </div>

        {/* Instructions List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Instruções e Ações do Passo
            </label>
            <span className="text-[11px] text-slate-400">
              Dica: use <strong className="text-slate-600 font-semibold">**palavra**</strong> para destacar em negrito
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {step.instructions.map((inst, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 group bg-slate-50 p-2 rounded-xl border border-slate-200"
              >
                <span className="text-xs font-bold text-slate-400 w-6 text-center select-none">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={inst}
                  onChange={(e) => handleEditInstruction(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const current = Array.isArray(step.instructions) ? [...step.instructions] : [];
                      current.splice(idx + 1, 0, '');
                      updateField('instructions', current);
                    }
                  }}
                  className="flex-1 bg-white px-3 py-1.5 text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Descreva a ação a ser realizada..."
                />
                <button
                  type="button"
                  onClick={() => handleMoveInstruction(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                  title="Mover item para cima"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveInstruction(idx, 'down')}
                  disabled={idx === step.instructions.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 cursor-pointer"
                  title="Mover item para baixo"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveInstruction(idx)}
                  className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                  title="Remover linha"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add New Line */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddInstruction();
                }
              }}
              placeholder="Digite a próxima instrução (ou clique em Adicionar)..."
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              type="button"
              onClick={() => handleAddInstruction()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer flex-shrink-0"
              title="Adicionar instrução a este passo"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* Capturas de Tela / Imagens do Passo (Suporta múltiplas imagens) */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Imagens e Capturas de Tela deste Passo ({stepImages.length})
              </span>
            </div>

            {stepImages.length > 0 && (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5" /> {stepImages.length} {stepImages.length === 1 ? 'imagem' : 'imagens'}
              </span>
            )}
          </div>

          {/* List of Attached Images */}
          {stepImages.length > 0 && (
            <div className="space-y-4">
              {stepImages.map((img, imgIdx) => (
                <div
                  key={img.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  {/* Image Card Topbar */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">
                        {imgIdx + 1}
                      </span>
                      Imagem {imgIdx + 1} de {stepImages.length}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveImage(imgIdx, 'up')}
                        disabled={imgIdx === 0}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 rounded"
                        title="Mover imagem para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveImage(imgIdx, 'down')}
                        disabled={imgIdx === stepImages.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20 rounded"
                        title="Mover imagem para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded transition"
                        title="Remover esta imagem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Image Preview & Editor Button */}
                  <div className="relative group rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                    <div className="max-h-56 overflow-hidden bg-slate-900/5">
                      <FocusedImage
                        image={img}
                        alt={img.caption || 'Captura de tela'}
                        compact
                      />
                    </div>

                    {/* Quick overlay button */}
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-xs">
                      <button
                        onClick={() => onOpenImageEditor(img.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                      >
                        <Edit3 className="w-4 h-4" />
                        Abrir Editor (Destaques, Blur, Setas, Recorte)
                      </button>
                    </div>
                  </div>

                  {/* Image Properties (Edit button, replace button, width, caption, alt text) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenImageEditor(img.id)}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                        Editar Esta Imagem (Censura, Caixas, Setas)
                      </button>

                      {/* RF-16: Substituir Imagem */}
                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium cursor-pointer transition"
                        title="Substituir por outra imagem do computador"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Substituir
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                if (base64) {
                                  handleUpdateImage(img.id, { url: base64, originalUrl: base64 });
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Largura no PDF:</span>
                      <select
                        value={img.widthPercent || 100}
                        onChange={(e) =>
                          handleUpdateImage(img.id, { widthPercent: Number(e.target.value) })
                        }
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium"
                      >
                        <option value={100}>100% (Largura Total)</option>
                        <option value={85}>85% (Médio-Grande)</option>
                        <option value={70}>70% (Médio)</option>
                        <option value={50}>50% (Pequeno)</option>
                      </select>
                    </div>
                  </div>

                  {/* RF-17: Focus on the click (non-destructive) */}
                  {(() => {
                    const focus = img.focusRegion;
                    const active = !!getEffectiveFocus(img);
                    const anchors = hasFocusAnchors(img);

                    const setFocus = (updates: Partial<NonNullable<StepImage['focusRegion']>>) => {
                      if (!focus) return;
                      handleUpdateImage(img.id, { focusRegion: { ...focus, ...updates } });
                    };

                    if (!focus) {
                      return (
                        <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                          <ScanSearch className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-slate-500 leading-snug">
                            {anchors
                              ? 'Calculando o foco automático sobre os cliques desta captura...'
                              : 'Marque o clique no editor de imagem para o PDF focar automaticamente na área da ação. A captura completa é sempre preservada.'}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        className={`rounded-xl border px-3 py-2.5 space-y-2 transition ${
                          active ? 'border-cyan-300 bg-cyan-50/70' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <ScanSearch
                              className={`w-3.5 h-3.5 ${active ? 'text-cyan-600' : 'text-slate-400'}`}
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              Foco no Clique
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                focus.auto === false
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-cyan-100 text-cyan-700'
                              }`}
                            >
                              {focus.auto === false ? 'Manual' : 'Automático'}
                            </span>
                          </div>

                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={focus.enabled !== false}
                              onChange={(e) => setFocus({ enabled: e.target.checked })}
                              className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-medium text-slate-600">
                              {focus.enabled !== false ? 'Aplicado no PDF' : 'Imagem completa'}
                            </span>
                          </label>
                        </div>

                        {focus.enabled !== false && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              {([
                                { id: 'crop' as FocusMode, label: 'Recorte' },
                                { id: 'spotlight' as FocusMode, label: 'Holofote' },
                                { id: 'inset' as FocusMode, label: 'Lupa' },
                              ]).map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setFocus({ mode: m.id })}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                                    focus.mode === m.id
                                      ? 'bg-cyan-600 text-white shadow-xs'
                                      : 'bg-white border border-slate-300 text-slate-600 hover:border-cyan-400'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>

                            {focus.mode === 'crop' && (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!focus.showFull}
                                  onChange={(e) => setFocus({ showFull: e.target.checked })}
                                  className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="text-[10px] text-slate-600">
                                  Mostrar tela completa abaixo
                                </span>
                              </label>
                            )}

                            <button
                              onClick={() => onOpenImageEditor(img.id)}
                              className="ml-auto text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 underline decoration-dotted"
                            >
                              Ajustar área
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Caption & Alt Text Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Legenda da Imagem
                      </label>
                      <input
                        type="text"
                        value={img.caption}
                        onChange={(e) =>
                          handleUpdateImage(img.id, { caption: e.target.value })
                        }
                        placeholder={`Ex: Figura ${step.order}.${imgIdx + 1}: Detalhe da ação`}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* RF-15: Alt Text for Accessibility */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
                        <span>Texto Alternativo (Alt Text)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Acessibilidade</span>
                      </label>
                      <input
                        type="text"
                        value={img.altText || ''}
                        onChange={(e) =>
                          handleUpdateImage(img.id, { altText: e.target.value })
                        }
                        placeholder="Descrição para leitores de tela..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Another Image Zone */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:border-blue-400 transition bg-white">
            <div className="flex flex-col items-center gap-2">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                {stepImages.length === 0
                  ? 'Adicione uma imagem a este passo:'
                  : 'Adicionar mais uma imagem a este passo:'}
              </p>

              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition">
                  <Upload className="w-3.5 h-3.5" />
                  Carregar Imagem(ns)
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleMultipleFilesUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePasteImage}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300 transition"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Colar Print (Ctrl + V)
                </button>
              </div>
              <span className="text-[10px] text-slate-400">
                Você pode adicionar 1, 2, 3 ou mais capturas por passo
              </span>
            </div>
          </div>
        </div>

        {/* Callout / Box de Destaque */}
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={toggleCallout}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-blue-600 transition"
            >
              <Bookmark className="w-4 h-4 text-amber-500" />
              <span>Caixa de Destaque / Alerta</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                step.callout ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {step.callout ? 'Ativado' : 'Desativado'}
              </span>
            </button>
          </div>

          {step.callout && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Tipo de Alerta:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateField('callout', {
                        ...step.callout!,
                        type: 'tip',
                        title: '💡 Dica / Informação:',
                      })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      step.callout.type === 'tip'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" /> Dica
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('callout', {
                        ...step.callout!,
                        type: 'critical',
                        title: '⚠️ ATENÇÃO CRÍTICA:',
                      })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      step.callout.type === 'critical'
                        ? 'bg-rose-100 border-rose-400 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Atenção / Alerta
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('callout', {
                        ...step.callout!,
                        type: 'info',
                        title: 'ℹ️ Nota:',
                      })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      step.callout.type === 'info'
                        ? 'bg-sky-100 border-sky-400 text-sky-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" /> Informação
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Título do Alerta
                </label>
                <input
                  type="text"
                  value={step.callout.title}
                  onChange={(e) =>
                    updateField('callout', { ...step.callout!, title: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Conteúdo do Alerta
                </label>
                <textarea
                  value={step.callout.content}
                  onChange={(e) =>
                    updateField('callout', { ...step.callout!, content: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Page Break Control */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={step.forcePageBreakAfter || false}
              onChange={(e) => updateField('forcePageBreakAfter', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-700">
              Forçar quebra de página após este passo (iniciar próxima página)
            </span>
          </label>
          <span className="text-[11px] text-slate-400">
            Útil para organizar exatamente quais passos ficam em cada página
          </span>
        </div>
      </div>
    </div>
  );
};
