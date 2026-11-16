import { TutorialProject, TutorialStep } from '../types/tutorial';

// High-fidelity SVG illustration mockups for the sample project so user sees immediate visual appeal
const createMockSvg = (title: string, subtitle: string, highlightText?: string, hasArrow?: boolean) => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 480" width="1000" height="480" style="background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Window Frame -->
      <rect x="2" y="2" width="996" height="476" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <!-- App Topbar -->
      <rect x="2" y="2" width="996" height="44" rx="8" fill="#0284c7"/>
      <rect x="2" y="36" width="996" height="10" fill="#0284c7"/>
      <circle cx="25" cy="22" r="6" fill="#ef4444"/>
      <circle cx="45" cy="22" r="6" fill="#f59e0b"/>
      <circle cx="65" cy="22" r="6" fill="#10b981"/>
      <text x="95" y="27" fill="#ffffff" font-size="14" font-weight="bold">SISTEMA EXEMPLO</text>
      <text x="850" y="27" fill="#e0f2fe" font-size="12">contato@exemplo.com</text>

      <!-- Sidebar -->
      <rect x="2" y="46" width="180" height="432" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
      <text x="20" y="80" fill="#64748b" font-size="11" font-weight="bold">MENU DO SISTEMA</text>
      <text x="20" y="115" fill="#334155" font-size="13">📊 Dashboard</text>
      <text x="20" y="150" fill="#334155" font-size="13">📁 Consultar Processo</text>
      <text x="20" y="185" fill="#334155" font-size="13">✉️ Expedientes</text>
      
      <!-- Highlighted Menu or Action -->
      <rect x="10" y="210" width="160" height="34" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>
      <text x="20" y="232" fill="#0369a1" font-size="13" font-weight="bold">⚙️ Gerenciar unidade</text>
      
      <text x="20" y="275" fill="#334155" font-size="13">📋 Relatórios</text>
      <text x="20" y="310" fill="#334155" font-size="13">🏛️ Cartório Judicial</text>

      <!-- Main Content Area -->
      <rect x="200" y="65" width="775" height="395" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="225" y="105" fill="#0f172a" font-size="18" font-weight="bold">${title}</text>
      <text x="225" y="130" fill="#64748b" font-size="13">${subtitle}</text>

      <!-- Mock UI Cards & Content -->
      <rect x="225" y="150" width="725" height="60" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
      <text x="245" y="175" fill="#64748b" font-size="11">INFORMAÇÕES DA UNIDADE</text>
      <text x="245" y="195" fill="#0f172a" font-size="13" font-weight="bold">1ª Promotoria de Justiça Cível • Titular: Dr. Promotor de Justiça</text>

      <!-- Table header -->
      <rect x="225" y="230" width="725" height="36" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
      <text x="245" y="253" fill="#475569" font-size="11" font-weight="bold">NOME DO USUÁRIO</text>
      <text x="450" y="253" fill="#475569" font-size="11" font-weight="bold">CARGO / PERFIL</text>
      <text x="620" y="253" fill="#475569" font-size="11" font-weight="bold">PERÍODO VIGÊNCIA</text>
      <text x="830" y="253" fill="#475569" font-size="11" font-weight="bold">AÇÕES</text>

      <!-- Row 1 -->
      <rect x="225" y="266" width="725" height="42" fill="#ffffff" stroke="#f1f5f9" stroke-width="1"/>
      <text x="245" y="292" fill="#1e293b" font-size="12">João Carlos da Silva</text>
      <text x="450" y="292" fill="#475569" font-size="12">Promotor Titular</text>
      <text x="620" y="292" fill="#16a34a" font-size="12" font-weight="bold">Indefinido (Ativo)</text>
      <text x="835" y="292" fill="#3b82f6" font-size="14">✏️</text>
      <text x="865" y="292" fill="#ef4444" font-size="14">🗑️</text>

      <!-- Row 2 -->
      <rect x="225" y="308" width="725" height="42" fill="#ffffff" stroke="#f1f5f9" stroke-width="1"/>
      <text x="245" y="334" fill="#1e293b" font-size="12">Maria Eduarda Santos</text>
      <text x="450" y="334" fill="#475569" font-size="12">Assessora Jurídica</text>
      <text x="620" y="334" fill="#64748b" font-size="12">Vinculação Permanente</text>
      <text x="835" y="334" fill="#3b82f6" font-size="14">✏️</text>
      <text x="865" y="334" fill="#ef4444" font-size="14">🗑️</text>

      <!-- Highlight Action Box (like in the user's PDF) -->
      ${highlightText ? `
        <rect x="730" y="85" width="220" height="38" rx="6" fill="#0284c7"/>
        <text x="750" y="109" fill="#ffffff" font-size="12" font-weight="bold">${highlightText}</text>
        <rect x="726" y="81" width="228" height="46" rx="8" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="6,4"/>
      ` : ''}

      <!-- Arrow Annotation if requested (like user's Fig 5) -->
      ${hasArrow ? `
        <path d="M 830 380 Q 860 350 865 305" fill="none" stroke="#ef4444" stroke-width="3"/>
        <polygon points="865,298 858,312 872,312" fill="#ef4444"/>
        <rect x="858" y="278" width="30" height="30" rx="4" fill="none" stroke="#ef4444" stroke-width="2.5"/>
        <text x="700" y="405" fill="#ef4444" font-size="12" font-weight="bold">Ação de Exclusão (Lixeira)</text>
      ` : ''}
    </svg>
  `)}`;
};

export const defaultProject: TutorialProject = {
  id: 'projeto-exemplo',
  metadata: {
    organization: 'NOME DA ORGANIZAÇÃO',
    title: 'Gerenciamento de Unidades',
    subtitle: 'Manual Prático: Vinculação de Usuários, Titularidades e Gestão de Equipe',
    systemName: 'SISTEMA EXEMPLO',
    badgeText: 'Guia do Usuário',
    logoUrl: null,
    logoHeight: 64,
    purpose: 'Finalidade deste Manual: Orientar os usuários na execução do procedimento descrito neste guia, garantindo que cada etapa seja realizada corretamente e de forma padronizada.',
    author: 'Departamento de Tecnologia da Informação',
    version: '1.0',
    date: 'Outubro/2026',
  },
  theme: {
    primaryColor: '#0a335c', // Deep judicial blue
    secondaryColor: '#0284c7', // Sky blue
    accentColor: '#ef4444', // Red highlight
    badgeBgColor: '#0a335c',
    badgeTextColor: '#ffffff',
    cardBgColor: '#ffffff',
    cardBorderColor: '#e2e8f0',
    fontFamily: 'Inter',
  },
  support: {
    enabled: true,
    title: 'Central de Atendimento e Suporte de TI',
    description: 'Ficou com alguma dúvida, identificou alguma divergência ou necessita de auxílio na configuração do SIM? Nossa equipe da Central de TI está pronta para ajudar:',
    channels: [
      {
        id: 'c1',
        type: 'phone',
        label: 'TELEFONE / RAMAL',
        value: 'Ramal 1000',
      },
      {
        id: 'c2',
        type: 'chat',
        label: 'CHAT INTERNO',
        value: 'Chat na Intranet',
      },
      {
        id: 'c3',
        type: 'email',
        label: 'E-MAIL INSTITUCIONAL',
        value: 'suporte@exemplo.com',
      },
    ],
    department: 'Nome da Organização — Departamento de Tecnologia da Informação',
    footerNote: 'Documento gerado para instrução aos usuários do Sistema Exemplo • Outubro/2026',
  },
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: 'step-1',
      order: 1,
      title: 'Acessar a opção "Gerenciar unidade"',
      objective: 'Localizar o módulo de gestão da unidade ativa no sistema.',
      instructions: [
        'Faça login no **SIM** utilizando suas credenciais institucionais.',
        'No topo superior da tela, certifique-se de que a unidade ativa selecionada é aquela que você deseja gerenciar.',
        'No menu lateral esquerdo, localize e clique na opção **"Gerenciar unidade"** (ícone de engrenagem).',
      ],
      image: createMockSvg('Módulo Inicial do SIM', 'Painel Principal e Menu Lateral'),
      caption: 'Figura 1: Acesso à opção "Gerenciar unidade" no menu lateral do Sistema Exemplo.',
      imageWidthPercent: 100,
      callout: null,
      forcePageBreakAfter: true,
    },
    {
      id: 'step-2',
      order: 2,
      title: 'Visão Geral da Unidade e Iniciar Vinculação',
      objective: 'Compreender a estrutura de informações da unidade e acessar o formulário de cadastro.',
      instructions: [
        '**Informações da Unidade:** Visualize o nome da unidade e o **Promotor Titular Atual** ativo. Esse indicador é essencial para acompanhar quem está respondendo pela titularidade da unidade, inclusive em casos onde há promotor substituto atuando.',
        '**Tabela de Usuários Vinculados:** Lista todos os membros e servidores da equipe, seus períodos de atuação e ações disponíveis.',
        '**Vincular Novo Usuário:** Para associar um novo membro ou servidor à unidade, clique no botão azul **"+ Vincular Novo Usuário"** localizado no canto superior direito da tabela.',
      ],
      image: createMockSvg('Painel da Unidade', 'Gestão de Usuários e Titularidades', '+ Vincular Novo Usuário'),
      caption: 'Figura 2: Painel de Gerenciamento da Unidade com destaque para o botão "+ Vincular Novo Usuário".',
      imageWidthPercent: 100,
      callout: null,
      forcePageBreakAfter: true,
    },
    {
      id: 'step-3',
      order: 3,
      title: 'Localizar o Usuário para Vinculação',
      objective: 'Pesquisar e selecionar o usuário cadastrado no sistema (Membro ou Servidor).',
      instructions: [
        'Ao clicar no botão de vinculação, a janela suspensa **"Vincular Novo Usuário"** será exibida.',
        'No campo **Usuário \\***, comece a digitar o nome do usuário desejado.',
        'Aguarde a busca automática e clique sobre o nome correto na lista suspensa.',
      ],
      image: createMockSvg('Pesquisa de Usuário', 'Seleção dinâmica por nome ou matrícula'),
      caption: 'Figura 3: Janela suspensa para pesquisa e seleção dinâmica do usuário.',
      imageWidthPercent: 85,
      callout: null,
      forcePageBreakAfter: false,
    },
    {
      id: 'step-5',
      order: 4,
      title: 'Vinculação Rápida de Usuário (Perfil: Servidor)',
      objective: 'Adicionar servidores, assessores e estagiários à equipe da unidade.',
      instructions: [
        'No campo de busca, digite o nome do servidor e selecione-o na lista.',
        'Para servidores e colaboradores de apoio, **não é necessário informar datas de titularidade**.',
        'Basta clicar diretamente no botão azul **"Vincular Usuário"**.',
      ],
      image: null,
      caption: '',
      imageWidthPercent: 100,
      callout: {
        enabled: true,
        type: 'tip',
        title: '💡 Acesso Concedido:',
        content: 'O servidor passará a ter acesso imediato aos processos, expedientes e minutas da unidade, auxiliando na instrução e nas rotinas do órgão de execução.',
      },
      forcePageBreakAfter: true,
    },
    {
      id: 'step-4',
      order: 5,
      title: 'Configurar Titularidade e Período (Perfil: Membro)',
      objective: 'Parametrizar a atuação de Promotores Titulares ou Substitutos na unidade.',
      instructions: [
        'Quando o usuário selecionado possuir perfil de Membro (Promotor / Procurador de Justiça), a janela se expandirá exibindo opções de vigência:',
        '• **Promotor Titular:** Marque a opção **"Período Indefinido como Promotor Titular"** se o membro for o titular permanente da unidade.',
        '• **Promotor Substituto:** Mantenha a caixa de período indefinido desmarcada e preencha as datas de **Início** e **Fim** exatamente como consta no espelho de atribuição ou ato de designação.',
        '• Clique no botão azul **"Vincular Usuário"** para salvar a parametrização.',
      ],
      image: createMockSvg('Configuração de Datas de Titularidade', 'Vigência e Período do Membro'),
      caption: 'Figura 4: Opções de período indefinido ou intervalo de datas para Membros da unidade.',
      imageWidthPercent: 85,
      callout: {
        enabled: true,
        type: 'critical',
        title: '⚠️ ATENÇÃO CRÍTICA — IMPACTO NOS PRAZOS PROCESSUAIS:',
        content: 'Sem essa opção configurada corretamente, o SIM **não realizará a ciência automática nos processos**, o que pode causar graves incoerências e perda de prazos processuais da unidade! Certifique-se sempre de manter as datas de titularidade rigorosamente alinhadas com as designações vigentes.',
      },
      forcePageBreakAfter: true,
    },
    {
      id: 'step-6',
      order: 6,
      title: 'Desvincular Usuário (Remover Acesso à Unidade)',
      objective: 'Retirar o acesso de profissionais que foram transferidos ou deixaram a unidade.',
      instructions: [
        'Na tela principal de **Gerenciar unidade**, localize a tabela **Usuários Vinculados**.',
        'Encontre a linha correspondente ao usuário que concluiu sua atuação no setor.',
        'Na coluna **AÇÕES** (ao final da linha à direita), clique no ícone da **Lixeira vermelha** *(indicado pela seta no print)* para remover o acesso.',
        '**Recurso de Edição:** Caso necessite apenas ajustar ou prorrogar as datas de um Promotor Substituto, clique no ícone de **Lápis (Editar)**.',
      ],
      image: createMockSvg('Tabela de Ações', 'Edição e Exclusão de Acessos', undefined, true),
      caption: 'Figura 5: Ícones de Edição (Lápis) e Remoção (Lixeira vermelha) na coluna Ações.',
      imageWidthPercent: 100,
      callout: null,
      forcePageBreakAfter: false,
    },
  ],
};

/**
 * Normalizes any project (from API, localStorage, or JSON upload),
 * ensuring metadata, theme, support, and steps always adhere to the schema
 * with safe defaults to prevent runtime exceptions like reading undefined properties.
 */
export function normalizeProject(raw: any): TutorialProject {
  if (!raw || typeof raw !== 'object') {
    return defaultProject;
  }

  const metadata = {
    ...defaultProject.metadata,
    ...(raw.metadata || {}),
  };

  const theme = {
    ...defaultProject.theme,
    ...(raw.theme || {}),
  };

  const support = {
    ...defaultProject.support,
    ...(raw.support || {}),
    channels: Array.isArray(raw.support?.channels)
      ? raw.support.channels
      : defaultProject.support.channels,
  };

  const steps: TutorialStep[] = Array.isArray(raw.steps)
    ? raw.steps.map((s: any, idx: number) => {
        const order = s.order || idx + 1;
        const instructions = Array.isArray(s.instructions)
          ? s.instructions
          : s.instruction
          ? [s.instruction]
          : [];

        let callout = null;
        if (s.callout) {
          callout = {
            enabled: s.callout.enabled ?? true,
            type: s.callout.type || 'tip',
            title: s.callout.title || 'Observação:',
            content: s.callout.content || s.callout.text || '',
          };
        }

        const rawImages =
          Array.isArray(s.images) && s.images.length > 0
            ? s.images
            : s.image
            ? [
                {
                  id: `img-${s.id || idx + 1}-1`,
                  url: s.image,
                  originalUrl: s.originalImage || s.image,
                  caption: s.caption || '',
                  widthPercent: s.imageWidthPercent || 100,
                  annotations: s.annotations || [],
                },
              ]
            : [];

        return {
          id: s.id || `step-${Date.now()}-${idx + 1}`,
          order,
          title: s.title || `Passo ${order}`,
          objective: s.objective || '',
          instructions,
          image: s.image || rawImages[0]?.url || null,
          originalImage: s.originalImage || rawImages[0]?.originalUrl || rawImages[0]?.url || null,
          caption: s.caption || rawImages[0]?.caption || '',
          imageWidthPercent: s.imageWidthPercent || rawImages[0]?.widthPercent || 100,
          callout,
          images: rawImages,
          forcePageBreakBefore: !!s.forcePageBreakBefore,
          forcePageBreakAfter: !!s.forcePageBreakAfter,
        };
      })
    : defaultProject.steps;

  return {
    id: raw.id || `projeto-${Date.now()}`,
    metadata,
    theme,
    support,
    steps,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

