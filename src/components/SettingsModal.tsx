import React, { useState } from 'react';
import { TutorialProject, DocumentTheme } from '../types/tutorial';
import { defaultProject } from '../data/defaultProject';
import {
  X,
  Palette,
  FileText,
  HelpCircle,
  Check,
  Plus,
  Trash2,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  Upload,
  RotateCcw,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Cpu,
  ShieldCheck
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  project: TutorialProject;
  onClose: () => void;
  onUpdate: (updatedProject: TutorialProject) => void;
}

const themePresets = [
  {
    name: 'Azul Padrão',
    primaryColor: '#0a335c',
    secondaryColor: '#0284c7',
    badgeBgColor: '#0a335c',
    badgeTextColor: '#ffffff',
  },
  {
    name: 'Verde Institucional',
    primaryColor: '#065f46',
    secondaryColor: '#059669',
    badgeBgColor: '#065f46',
    badgeTextColor: '#ffffff',
  },
  {
    name: 'Azul Corporativo / Tech',
    primaryColor: '#1e3a8a',
    secondaryColor: '#3b82f6',
    badgeBgColor: '#1e3a8a',
    badgeTextColor: '#ffffff',
  },
  {
    name: 'Vinho / Bordô Tribunal',
    primaryColor: '#881337',
    secondaryColor: '#be123c',
    badgeBgColor: '#881337',
    badgeTextColor: '#ffffff',
  },
  {
    name: 'Grafite Elegante / Slate',
    primaryColor: '#1e293b',
    secondaryColor: '#475569',
    badgeBgColor: '#1e293b',
    badgeTextColor: '#ffffff',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  project,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'metadata' | 'support' | 'ai'>('theme');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('guia_maker_gemini_api_key') || '';
  });
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/ai/status')
        .then((r) => r.json())
        .then((d) => setHasServerKey(d.hasServerKey))
        .catch(() => setHasServerKey(false));
    }
  }, [isOpen]);

  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('guia_maker_gemini_api_key', key);
    setKeyTestResult(null);
  };

  const handleTestKey = async () => {
    if (!geminiApiKey || !geminiApiKey.trim()) {
      setKeyTestResult({ success: false, message: 'Digite ou cole uma chave de API antes de testar.' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeyTestResult({ success: true, message: data.message || `Conexão bem-sucedida (${data.model})!` });
      } else {
        setKeyTestResult({ success: false, message: data.error || 'Falha ao conectar com a API Gemini.' });
      }
    } catch (err: any) {
      setKeyTestResult({ success: false, message: `Erro de conexão: ${err.message}` });
    } finally {
      setIsTestingKey(false);
    }
  };

  if (!isOpen) return null;

  const metadata = project.metadata || defaultProject.metadata;
  const theme = project.theme || defaultProject.theme;
  const support = project.support || defaultProject.support;

  const updateMetadata = (key: keyof typeof metadata, value: any) => {
    onUpdate({
      ...project,
      metadata: {
        ...metadata,
        [key]: value,
      },
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onUpdate({
          ...project,
          metadata: {
            ...metadata,
            logoUrl: base64,
          },
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateTheme = (key: keyof DocumentTheme, value: any) => {
    onUpdate({
      ...project,
      theme: {
        ...theme,
        [key]: value,
      },
    });
  };

  const applyPreset = (preset: typeof themePresets[0]) => {
    onUpdate({
      ...project,
      theme: {
        ...theme,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        badgeBgColor: preset.badgeBgColor,
        badgeTextColor: preset.badgeTextColor,
      },
    });
  };

  const updateSupportField = (key: keyof typeof support, value: any) => {
    onUpdate({
      ...project,
      support: {
        ...support,
        [key]: value,
      },
    });
  };

  const handleAddChannel = () => {
    const newChan = {
      id: `c-${Date.now()}`,
      type: 'phone' as const,
      label: 'NOVO CANAL',
      value: 'Contato',
    };
    updateSupportField('channels', [...support.channels, newChan]);
  };

  const handleUpdateChannel = (idx: number, field: string, val: string) => {
    const updated = [...support.channels];
    updated[idx] = { ...updated[idx], [field]: val };
    updateSupportField('channels', updated);
  };

  const handleRemoveChannel = (idx: number) => {
    const updated = support.channels.filter((_, i) => i !== idx);
    updateSupportField('channels', updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 modal-overlay">
      <div className="flex flex-col h-[85vh] w-[90vw] max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold">Personalização do Documento</h2>
              <p className="text-xs text-slate-400">
                Ajuste a identidade visual, dados do cabeçalho institucional e rodapé de suporte
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-6">
          <button
            onClick={() => setActiveTab('theme')}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'theme'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            Cores & Tipografia
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'metadata'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Cabeçalho & Sistema
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'support'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Suporte de TI & Rodapé
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
              activeTab === 'ai'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Inteligência Artificial (Gemini)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CORES E TEMA */}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              {/* Presets */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Temas e Paletas Prontas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {themePresets.map((preset) => {
                    const isSelected = theme.primaryColor === preset.primaryColor;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg shadow-xs flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: preset.primaryColor }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {preset.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.primaryColor }}
                            />
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.secondaryColor }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Pickers */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Cores Personalizadas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Cor Primária (Títulos e Badges)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.primaryColor}
                        onChange={(e) => updateTheme('primaryColor', e.target.value)}
                        className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={theme.primaryColor}
                        onChange={(e) => updateTheme('primaryColor', e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Cor do Badge do Sistema
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.badgeBgColor || theme.primaryColor}
                        onChange={(e) => updateTheme('badgeBgColor', e.target.value)}
                        className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={theme.badgeBgColor || theme.primaryColor}
                        onChange={(e) => updateTheme('badgeBgColor', e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Cor Secundária / Destaques
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.secondaryColor}
                        onChange={(e) => updateTheme('secondaryColor', e.target.value)}
                        className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={theme.secondaryColor}
                        onChange={(e) => updateTheme('secondaryColor', e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Font Family */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Tipografia do Manual
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['Inter', 'Segoe UI', 'Roboto', 'Arial'] as const).map((font) => (
                    <button
                      key={font}
                      onClick={() => updateTheme('fontFamily', font)}
                      className={`p-3 rounded-xl border text-center transition ${
                        theme.fontFamily === font
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                      style={{ fontFamily: font }}
                    >
                      <span className="text-sm">{font}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">Exemplo Texto</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CABEÇALHO & SISTEMA */}
          {activeTab === 'metadata' && (
            <div className="space-y-4">
              {/* Logotipo (Personalizado) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Logotipo Personalizado
                    </label>
                  </div>
                  {metadata.logoUrl && (
                    <button
                      type="button"
                      onClick={() => updateMetadata('logoUrl', null)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold transition"
                    >
                      Remover Logo (Usar Badge)
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  A logo é exibida no canto superior direito da página 1 (no lugar do badge de texto) e também como mini logo no cabeçalho das páginas seguintes.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  {/* Logo Preview */}
                  <div className="w-48 h-20 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 overflow-hidden flex-shrink-0">
                    {metadata.logoUrl ? (
                      <img
                        src={metadata.logoUrl}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Sem logotipo ativo</span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-2.5 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar Outra Imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => updateMetadata('logoUrl', null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                        title="Remover o logotipo do documento"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                        <span>Remover Logotipo</span>
                      </button>
                    </div>

                    {metadata.logoUrl && (
                      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Altura no Cabeçalho:
                        </span>
                        <input
                          type="range"
                          min="40"
                          max="96"
                          step="2"
                          value={metadata.logoHeight || 64}
                          onChange={(e) => updateMetadata('logoHeight', Number(e.target.value))}
                          className="w-28 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {metadata.logoHeight || 64}px
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Nome da Instituição / Empresa
                </label>
                <input
                  type="text"
                  value={metadata.organization}
                  onChange={(e) => updateMetadata('organization', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: NOME DA ORGANIZAÇÃO"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Nome do Sistema
                  </label>
                  <input
                    type="text"
                    value={metadata.systemName}
                    onChange={(e) => updateMetadata('systemName', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: SISTEMA EXEMPLO"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Etiqueta / Badge
                  </label>
                  <input
                    type="text"
                    value={metadata.badgeText}
                    onChange={(e) => updateMetadata('badgeText', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Guia do Usuário"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Título Principal do Manual
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => updateMetadata('title', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Gerenciamento de Unidades"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Subtítulo / Descritivo
                </label>
                <input
                  type="text"
                  value={metadata.subtitle}
                  onChange={(e) => updateMetadata('subtitle', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Manual Prático: Vinculação de Usuários, Titularidades e Gestão de Equipe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Texto de Finalidade do Manual (Caixa de Introdução)
                </label>
                <textarea
                  value={metadata.purpose}
                  onChange={(e) => updateMetadata('purpose', e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  placeholder="Finalidade deste Manual: Orientar os responsáveis pelas unidades..."
                />
              </div>
            </div>
          )}

          {/* TAB 3: SUPORTE & RODAPÉ */}
          {activeTab === 'support' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-xs text-slate-800 block">
                    Exibir Seção de Suporte na Última Página
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Inclui o cartão oficial com canais de telefone, ramal, chat e e-mail
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={support.enabled}
                  onChange={(e) => updateSupportField('enabled', e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                />
              </div>

              {support.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Título do Card de Atendimento
                    </label>
                    <input
                      type="text"
                      value={support.title}
                      onChange={(e) => updateSupportField('title', e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Mensagem de Suporte
                    </label>
                    <textarea
                      value={support.description}
                      onChange={(e) => updateSupportField('description', e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Canais de Contato
                      </label>
                      <button
                        onClick={handleAddChannel}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Canal
                      </button>
                    </div>

                    <div className="space-y-2">
                      {support.channels.map((chan, idx) => (
                        <div
                          key={chan.id}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <select
                            value={chan.type}
                            onChange={(e) =>
                              handleUpdateChannel(idx, 'type', e.target.value)
                            }
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="phone">Telefone / Ramal</option>
                            <option value="chat">Chat / Intranet</option>
                            <option value="email">E-mail</option>
                            <option value="custom">Outro</option>
                          </select>
                          <input
                            type="text"
                            value={chan.label}
                            onChange={(e) =>
                              handleUpdateChannel(idx, 'label', e.target.value)
                            }
                            placeholder="Etiqueta (ex: RAMAL 1000)"
                            className="w-1/3 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={chan.value}
                            onChange={(e) =>
                              handleUpdateChannel(idx, 'value', e.target.value)
                            }
                            placeholder="Valor (ex: suporte@exemplo.com)"
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleRemoveChannel(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Departamento Institucional (Rodapé)
                    </label>
                    <input
                      type="text"
                      value={support.department}
                      onChange={(e) => updateSupportField('department', e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Linha de Rodapé Final
                    </label>
                    <input
                      type="text"
                      value={support.footerNote}
                      onChange={(e) => updateSupportField('footerNote', e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: INTELIGÊNCIA ARTIFICIAL (GEMINI) */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Status Header */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-xl flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Integração com Google Gemini AI
                    </h3>
                    {hasServerKey ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Servidor Conectado (.env)
                      </span>
                    ) : geminiApiKey ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Chave no Navegador
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-300">
                        Modo Offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A IA analisa suas capturas de tela e redige títulos em modo imperativo, objetivos claros e instruções detalhadas no padrão de manuais de sistemas.
                  </p>
                </div>
              </div>

              {/* API Key Configuration Card */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      Chave de API do Google Gemini
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline font-normal"
                    >
                      Obter chave no Google AI Studio ↗
                    </a>
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => handleSaveApiKey(e.target.value)}
                      placeholder="Cole aqui sua chave AIzaSy..."
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={isTestingKey || !geminiApiKey.trim()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0"
                    >
                      {isTestingKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Testar Conexão
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Sua chave é salva com segurança no seu navegador e utilizada nas requisições de geração e aprimoramento de tutoriais.
                  </p>
                </div>

                {/* Key Test Feedback Banner */}
                {keyTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2.5 border ${
                      keyTestResult.success
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    {keyTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-medium leading-relaxed">{keyTestResult.message}</span>
                  </div>
                )}

                {/* Procedure Context Editor */}
                <div className="pt-3 border-t border-slate-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Explicação Geral do Procedimento para a IA
                  </label>
                  <textarea
                    value={metadata.aiContext || ''}
                    onChange={(e) => updateMetadata('aiContext', e.target.value)}
                    rows={3}
                    placeholder="Ex: Este manual ensina os servidores a cadastrar um novo processo no SEI, preencher o formulário, anexar minuta e despachar..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    A IA utiliza este contexto geral sempre que você solicitar aprimoramentos de passos ou reorganização de títulos e textos do manual.
                  </p>
                </div>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    Modelos Compatíveis (com Fallback)
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    O sistema utiliza <strong>gemini-2.5-flash</strong> com failover automático para <strong>gemini-2.0-flash</strong> e <strong>gemini-1.5-flash</strong> garantindo disponibilidade e respostas em menos de 2 segundos.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Configuração Global via Docker (.env)
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Para que todos os computadores da rede usem a IA sem digitar a chave, adicione <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">GEMINI_API_KEY=sua_chave</code> no arquivo <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">.env</code> na raiz do projeto.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-slate-100 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            Concluir e Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
