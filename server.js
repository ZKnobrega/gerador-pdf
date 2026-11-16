const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 80;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data', 'projects');
// Public library of published PDFs ("Tutoriais do Sistema" history)
const PDF_DIR = process.env.PDF_DIR || path.join(__dirname, 'data', 'pdfs');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// Enable Gzip compression, CORS and high-capacity JSON body parsing
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to sanitize filename
function getProjectFilePath(id) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeId}.json`);
}

// ==========================================
// PUBLISHED PDF LIBRARY HELPERS
// ==========================================

/** Maximum accepted size for a published PDF (decoded bytes). */
const MAX_PDF_BYTES = 60 * 1024 * 1024;

function sanitizeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function getPdfPaths(id) {
  const safeId = sanitizeId(id);
  return {
    safeId,
    file: path.join(PDF_DIR, `${safeId}.pdf`),
    meta: path.join(PDF_DIR, `${safeId}.json`),
  };
}

function buildPdfFileName(title) {
  const slug = String(title || 'tutorial')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `manual-${slug || 'tutorial'}.pdf`;
}

function readPdfLibrary() {
  if (!fs.existsSync(PDF_DIR)) return [];
  const entries = [];
  const files = fs.readdirSync(PDF_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(PDF_DIR, file), 'utf8'));
      const { file: pdfPath } = getPdfPaths(meta.id);
      if (!fs.existsSync(pdfPath)) continue; // orphan metadata
      entries.push(meta);
    } catch (err) {
      console.warn(`Erro ao ler metadados de PDF ${file}:`, err.message);
    }
  }

  entries.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  return entries;
}

const DEFAULT_SUPPORT = {
  enabled: true,
  title: 'Central de Atendimento e Suporte de TI',
  description: 'Em caso de dúvidas operacionais ou problemas de acesso, contate a Central de TI:',
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
  footerNote: 'Documento gerado para instrução aos usuários',
};

const DEFAULT_THEME = {
  primaryColor: '#0a335c',
  secondaryColor: '#0284c7',
  accentColor: '#ef4444',
  badgeBgColor: '#0a335c',
  badgeTextColor: '#ffffff',
  cardBgColor: '#ffffff',
  cardBorderColor: '#e2e8f0',
  fontFamily: 'Inter',
};

function normalizeServerProject(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    ...p,
    metadata: {
      organization: 'NOME DA ORGANIZAÇÃO',
      title: 'Tutorial Passo a Passo',
      subtitle: 'Manual Prático e Guia Operacional',
      system: (p.metadata && (p.metadata.system || p.metadata.systemName)) || 'SISTEMA',
      systemName: (p.metadata && (p.metadata.systemName || p.metadata.system)) || 'SISTEMA',
      badgeText: 'Guia do Usuário',
      purpose: 'Finalidade deste Manual: Apresentar as instruções de uso e operação dos recursos disponíveis.',
      author: 'Departamento de Tecnologia da Informação',
      version: '1.0',
      date: new Date().toLocaleDateString('pt-BR'),
      ...(p.metadata || {}),
    },
    theme: {
      ...DEFAULT_THEME,
      ...(p.theme || {}),
    },
    support: {
      ...DEFAULT_SUPPORT,
      ...(p.support || {}),
      channels: Array.isArray(p.support?.channels) ? p.support.channels : DEFAULT_SUPPORT.channels,
    },
    steps: Array.isArray(p.steps) ? p.steps : [],
  };
}

// Seed default project if empty
function ensureSeededProjects() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    if (files.length === 0) {
      // Check if defaultProject exists in dist or seed default
      const seedFile = path.join(__dirname, 'data', 'seed-default.json');
      if (fs.existsSync(seedFile)) {
        const seedData = fs.readFileSync(seedFile, 'utf8');
        fs.writeFileSync(path.join(DATA_DIR, 'projeto-exemplo.json'), seedData, 'utf8');
      }
    }
  } catch (err) {
    console.error('Erro ao verificar seed de projetos:', err);
  }
}
ensureSeededProjects();

// Heal any previously created projects that lack support or full theme
function healExistingProjects() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const fullPath = path.join(DATA_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const proj = JSON.parse(content);
        if (!proj.support || typeof proj.support.enabled !== 'boolean') {
          const healed = normalizeServerProject(proj);
          fs.writeFileSync(fullPath, JSON.stringify(healed, null, 2), 'utf8');
          console.log(`[SERVER] Projeto normalizado com suporte adicionado: ${file}`);
        }
      } catch (err) {
        console.warn(`[SERVER] Falha ao verificar/curar ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Erro ao curar projetos existentes:', err);
  }
}
healExistingProjects();

// ==========================================
// REST API Endpoints
// ==========================================

// GET /api/health - Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/projects - List all saved tutorials
app.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    const projects = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const project = JSON.parse(content);
        projects.push(normalizeServerProject(project));
      } catch (err) {
        console.warn(`Erro ao ler arquivo ${file}:`, err.message);
      }
    }

    // Sort by updatedAt descending
    projects.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json(projects);
  } catch (err) {
    console.error('Erro ao listar tutoriais:', err);
    res.status(500).json({ error: 'Erro ao listar tutoriais no servidor' });
  }
});

// GET /api/projects/:id - Get single project
app.get('/api/projects/:id', (req, res) => {
  try {
    const filePath = getProjectFilePath(req.params.id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Tutorial não encontrado' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    res.json(normalizeServerProject(JSON.parse(content)));
  } catch (err) {
    console.error('Erro ao buscar tutorial:', err);
    res.status(500).json({ error: 'Erro ao buscar tutorial' });
  }
});

// POST /api/projects - Create or Update project
app.post('/api/projects', (req, res) => {
  try {
    const project = req.body;
    if (!project || !project.metadata || !project.steps) {
      return res.status(400).json({ error: 'Dados do tutorial inválidos' });
    }

    const id = project.id || `project-${Date.now()}`;
    const updatedProject = {
      ...project,
      id,
      updatedAt: new Date().toISOString(),
    };

    const filePath = getProjectFilePath(id);
    fs.writeFileSync(filePath, JSON.stringify(updatedProject, null, 2), 'utf8');

    console.log(`[STORAGE] Tutorial salvo com sucesso: ${id} ("${updatedProject.metadata.title}")`);
    res.json({ success: true, project: updatedProject });
  } catch (err) {
    console.error('Erro ao salvar tutorial:', err);
    res.status(500).json({ error: 'Erro ao salvar tutorial no servidor' });
  }
});

// DELETE /api/projects/:id - Delete project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const filePath = getProjectFilePath(req.params.id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[STORAGE] Tutorial removido: ${req.params.id}`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir tutorial:', err);
    res.status(500).json({ error: 'Erro ao excluir tutorial' });
  }
});

// ==========================================
// PUBLISHED PDF LIBRARY (public tutorial history)
// ==========================================

// GET /api/pdfs - Public list of every published PDF
app.get('/api/pdfs', (req, res) => {
  try {
    res.json(readPdfLibrary());
  } catch (err) {
    console.error('Erro ao listar PDFs publicados:', err);
    res.status(500).json({ error: 'Erro ao listar os PDFs publicados' });
  }
});

// POST /api/pdfs - Publish the final PDF into the shared library
app.post('/api/pdfs', (req, res) => {
  try {
    const {
      projectId,
      title,
      subtitle,
      systemName,
      organization,
      version,
      author,
      pages,
      stepsCount,
      pdfBase64,
    } = req.body || {};

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'Arquivo PDF ausente ou invalido' });
    }

    const cleanBase64 = pdfBase64.includes('base64,')
      ? pdfBase64.substring(pdfBase64.indexOf('base64,') + 7)
      : pdfBase64;

    let buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Nao foi possivel decodificar o arquivo PDF' });
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Arquivo PDF vazio' });
    }
    if (buffer.length > MAX_PDF_BYTES) {
      return res.status(413).json({ error: 'Arquivo PDF muito grande (limite de 60 MB)' });
    }
    // Only accept real PDF files
    if (buffer.slice(0, 5).toString('latin1') !== '%PDF-') {
      return res.status(400).json({ error: 'O arquivo enviado nao e um PDF valido' });
    }

    const id = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const { file, meta: metaPath, safeId } = getPdfPaths(id);

    const meta = {
      id: safeId,
      projectId: projectId || null,
      title: title || 'Manual sem titulo',
      subtitle: subtitle || '',
      systemName: systemName || '',
      organization: organization || '',
      version: version || '',
      author: author || '',
      pages: Number(pages) || 0,
      stepsCount: Number(stepsCount) || 0,
      fileName: buildPdfFileName(title),
      sizeBytes: buffer.length,
      publishedAt: new Date().toISOString(),
      downloadUrl: `/api/pdfs/${safeId}/file`,
    };

    fs.writeFileSync(file, buffer);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    console.log(
      `[BIBLIOTECA] PDF publicado: ${safeId} ("${meta.title}", ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`
    );
    res.json({ success: true, pdf: meta });
  } catch (err) {
    console.error('Erro ao publicar PDF:', err);
    res.status(500).json({ error: 'Erro ao publicar o PDF no servidor' });
  }
});

// GET /api/pdfs/:id/file - Serve the published PDF (inline preview or download)
app.get('/api/pdfs/:id/file', (req, res) => {
  try {
    const { file, meta: metaPath } = getPdfPaths(req.params.id);
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'PDF nao encontrado' });
    }

    let fileName = 'manual.pdf';
    if (fs.existsSync(metaPath)) {
      try {
        fileName = JSON.parse(fs.readFileSync(metaPath, 'utf8')).fileName || fileName;
      } catch {
        // keep the fallback name
      }
    }

    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error('Erro ao servir PDF publicado:', err);
    res.status(500).json({ error: 'Erro ao abrir o PDF publicado' });
  }
});

// DELETE /api/pdfs/:id - Remove a published PDF from the library
app.delete('/api/pdfs/:id', (req, res) => {
  try {
    const { file, meta: metaPath } = getPdfPaths(req.params.id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    console.log(`[BIBLIOTECA] PDF removido: ${sanitizeId(req.params.id)}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir PDF publicado:', err);
    res.status(500).json({ error: 'Erro ao excluir o PDF publicado' });
  }
});

// ==========================================
// Gravador de Passos com IA (Offline & Gemini)
// ==========================================

function generateStepOffline(stepData, index) {
  const stepNumber = index + 1;
  const windowTitle = (stepData.windowTitle || '').trim();
  const elementText = (stepData.elementText || '').trim();
  const actionType = stepData.actionType || (stepData.typedText ? 'typing' : stepData.hotkey ? 'hotkey' : 'click');

  let title = `Passo ${stepNumber}`;
  let objective = 'Executar a ação necessária na tela do sistema.';
  let instructions = [];
  let callout = null;

  if (actionType === 'typing' || stepData.typedText) {
    const text = (stepData.typedText || '').trim();
    title = `Digitar "${text}"`;
    objective = `Preencher os dados solicitados no campo ativo.`;
    instructions = [
      windowTitle
        ? `Na janela **${windowTitle}**, localize o campo correspondente e digite **"${text}"**.`
        : `No campo de entrada ativo, digite **"${text}"** e confirme.`,
    ];
    callout = {
      enabled: true,
      type: 'info',
      title: '⌨️ Entrada de Texto',
      content: `Insira exatamente "${text}" sem espaços adicionais no campo.`,
    };
  } else if (actionType === 'hotkey' || stepData.hotkey) {
    const hk = (stepData.hotkey || '').trim();
    title = `Pressionar atalho [${hk}]`;
    objective = `Acionar o comando pelo teclado para agilizar o processo.`;
    instructions = [
      windowTitle
        ? `Na janela **${windowTitle}**, pressione as teclas **${hk}** no teclado.`
        : `Pressione a combinação de teclas **${hk}** no seu teclado para executar a ação.`,
    ];
    callout = {
      enabled: true,
      type: 'tip',
      title: '💡 Comando de Teclado',
      content: `Pressione ${hk} para executar o comando rapidamente.`,
    };
  } else {
    // Mouse Click Action
    if (elementText) {
      title = `Clicar em "${elementText}"`;
      objective = `Acionar a opção ou funcionalidade "${elementText}".`;
      instructions.push(`Localize e clique com o botão esquerdo em **${elementText}**.`);
    } else if (windowTitle) {
      title = `Clicar em "${windowTitle}"`;
      objective = `Interagir com os controles da janela "${windowTitle}".`;
      if (stepData.clickX != null && stepData.clickY != null) {
        instructions.push(`Na janela **${windowTitle}**, clique com o botão esquerdo no ponto indicado pelo ícone de mouse.`);
      } else {
        instructions.push(`Na janela **${windowTitle}**, localize a área de trabalho para prosseguir.`);
      }
    } else {
      title = `Clicar na tela (Passo ${stepNumber})`;
      objective = `Prosseguir com o fluxo de trabalho.`;
      instructions.push(`Clique com o botão esquerdo no ponto destacado para continuar.`);
    }
  }

  return {
    title,
    objective,
    instructions,
    callout,
  };
}

const GEMINI_CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function testGeminiConnection(apiKey) {
  let lastError = null;
  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Responda apenas com a palavra 'OK'." }] }],
            generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        return {
          success: true,
          model,
          message: `Conexão estabelecida com sucesso com o modelo Google Gemini (${model})!`,
          sampleResponse: text?.trim(),
        };
      }

      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error?.message || `${response.status} ${response.statusText}`;
      lastError = errMsg;

      if (response.status === 400 && errMsg.toLowerCase().includes('api key')) {
        return { success: false, error: `Chave de API inválida: ${errMsg}` };
      }
      if (response.status === 403) {
        return { success: false, error: `Acesso negado: ${errMsg}` };
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    success: false,
    error: `Falha ao conectar com a API Gemini: ${lastError || 'Nenhum modelo respondeu'}`,
  };
}

async function generateManualMetadataWithGemini(procedureContext, systemName, stepsCount, apiKey) {
  if (!procedureContext || !procedureContext.trim() || !apiKey) {
    return null;
  }

  const prompt = `Você é um redator técnico sênior especializado em documentação de sistemas.
O usuário explicou o seguinte contexto sobre o procedimento passo a passo que está sendo documentado:
"${procedureContext.trim()}"
Sistema informado: "${systemName || 'Sistema Corporativo'}"
Quantidade de passos capturados: ${stepsCount || 1}

Com base nessa explicação, defina a apresentação institucional deste manual:
1. "title": Título conciso, profissional e formal do tutorial (Ex: "Abertura e Tramitação de Processos no SEI", "Emissão de Certidão Negativa", "Solicitação Eletrônica de Férias").
2. "subtitle": Subtítulo operacional explicando o escopo (Ex: "Manual Operacional: Procedimento Padrão para Autuação, Anexação e Envio").
3. "purpose": Parágrafo formal iniciando com "Finalidade deste Manual: " descrevendo a finalidade clara e objetiva do procedimento para os usuários do sistema.
4. "badgeText": Categoria formal (Ex: "Manual do Usuário", "Procedimento Padrão", "Guia Rápido").
5. "systemName": Nome padronizado do sistema ou módulo (Ex: "SEI", "Sistema Exemplo", "Portal do Servidor").

Retorne ESTRITAMENTE um JSON no seguinte formato:
{
  "title": "Título formal do tutorial",
  "subtitle": "Subtítulo operacional",
  "purpose": "Finalidade deste Manual: ...",
  "badgeText": "Guia do Usuário",
  "systemName": "Nome do Sistema"
}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) continue;
      const json = await response.json();
      let text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(text);
    } catch {
      // try next candidate model
    }
  }
  return null;
}

async function generateStepWithGemini(stepData, apiKey) {
  const cleanBase64 = (stepData.imageBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '');

  let actionDesc = `clique do mouse nas coordenadas aproximadas X: ${stepData.clickX ?? 'N/A'}, Y: ${stepData.clickY ?? 'N/A'}`;
  if (stepData.actionType === 'typing' || stepData.typedText) {
    actionDesc = `usuário digitou o seguinte texto no campo: "${stepData.typedText}"`;
  } else if (stepData.actionType === 'hotkey' || stepData.hotkey) {
    actionDesc = `usuário pressionou o comando/atalho de teclado: "${stepData.hotkey}"`;
  }

  const procedureContextPrompt = stepData.procedureContext
    ? `\nCONTEXTO GERAL DO PROCEDIMENTO FORNECIDO PELO AUTOR:\n"${stepData.procedureContext}"\nUtilize este contexto geral para identificar com exatidão a finalidade de cada tela, botões, campos e termos técnicos dentro do fluxo institucional.`
    : '';

  const customPromptText = (stepData.customPrompt || stepData.prompt)
    ? `\nINSTRUÇÃO ESPECÍFICA DO USUÁRIO PARA ESTE PASSO:\n"${stepData.customPrompt || stepData.prompt}"`
    : '';

  const totalStepsPrompt = stepData.totalSteps ? ` de ${stepData.totalSteps}` : '';

  const systemPrompt = `Você é um redator técnico sênior especializado em manuais de sistemas e tutoriais passo a passo.
Sua missão é gerar um título de ação objetivo, uma frase de objetivo formal, instruções claras em Markdown destacando botões e campos em negrito, e uma dica ou aviso se pertinente.
${procedureContextPrompt}
${customPromptText}
Janela ativa atual: "${stepData.windowTitle || 'Sistema Corporativo'}"
Ação do usuário: ${actionDesc}
Texto do elemento identificado (se houver): "${stepData.elementText || 'N/A'}"
Passo nº: ${stepData.stepNumber || 1}${totalStepsPrompt}

Retorne ESTRITAMENTE um JSON no seguinte formato:
{
  "title": "Ação em modo imperativo/infinitivo (Ex: Digitar Processo no Campo de Busca)",
  "objective": "Objetivo do passo em uma frase clara e formal.",
  "instructions": [
    "Instrução direta com **Elementos de Interface** em negrito."
  ],
  "callout": {
    "enabled": true,
    "type": "tip",
    "title": "💡 Dica ou Aviso",
    "content": "Observação importante ou atalho útil (ou vazio se não for necessário)"
  }
}`;

  const payload = {
    contents: [
      {
        parts: [
          ...(cleanBase64 ? [{ inline_data: { mime_type: 'image/png', data: cleanBase64 } }] : []),
          { text: systemPrompt },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  };

  let lastError = null;
  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error?.message || `${response.status} ${response.statusText}`;
        lastError = new Error(`Gemini API error (${model}): ${errMsg}`);
        if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
          continue;
        }
        throw lastError;
      }

      const json = await response.json();
      let text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Resposta vazia da IA Gemini (${model})`);

      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('404')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini compatível respondeu com sucesso.');
}

// POST /api/recorder/import - Ingest steps recorded by Windows Recorder companion
app.post('/api/recorder/import', async (req, res) => {
  try {
    const { title, systemName, author, geminiApiKey, procedureContext, steps: rawSteps } = req.body || {};

    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      return res.status(400).json({ error: 'Nenhum passo gravado foi fornecido' });
    }

    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY || null;

    // AI Synthesis for Document Title and Overview based on Procedure Context
    let aiMeta = null;
    if (apiKey && procedureContext && procedureContext.trim()) {
      try {
        aiMeta = await generateManualMetadataWithGemini(procedureContext, systemName, rawSteps.length, apiKey);
      } catch (err) {
        console.warn('[AI] Falha ao sintetizar metadados com IA:', err.message);
      }
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const effectiveTitle = (title && title.trim()) || aiMeta?.title || (systemName ? `Tutorial ${systemName} - ${dateStr}` : `Tutorial Passo a Passo - ${dateStr}`);
    const effectiveSubtitle = aiMeta?.subtitle || 'Manual Prático e Guia Operacional';
    const effectiveSystem = (systemName && systemName.trim()) || aiMeta?.systemName || 'Sistema Corporativo';
    const effectivePurpose = aiMeta?.purpose || 'Finalidade deste Manual: Apresentar as instruções de uso e operação dos recursos disponíveis.';
    const effectiveBadge = aiMeta?.badgeText || 'Guia do Usuário';

    const processedSteps = [];

    for (let i = 0; i < rawSteps.length; i++) {
      const raw = rawSteps[i];
      let generated = null;

      if (apiKey) {
        try {
          generated = await generateStepWithGemini({
            ...raw,
            stepNumber: i + 1,
            totalSteps: rawSteps.length,
            procedureContext: procedureContext || undefined,
          }, apiKey);
        } catch (err) {
          console.warn(`[AI] Falha no passo ${i + 1} com Gemini, usando fallback offline:`, err.message);
          generated = generateStepOffline(raw, i);
        }
      } else {
        generated = generateStepOffline(raw, i);
      }

      const clickAnnotation =
        raw.clickX != null && raw.clickY != null
          ? {
              id: `click-marker-${Date.now()}-${i}`,
              type: 'click',
              startX: raw.clickX,
              startY: raw.clickY,
              endX: raw.clickX + 28,
              endY: raw.clickY + 36,
              color: '#ef4444',
              strokeWidth: 3,
            }
          : null;

      const annotations = clickAnnotation ? [clickAnnotation] : [];
      const originalUrl = raw.originalImageBase64 || raw.imageBase64 || '';
      const displayUrl = raw.imageBase64 || raw.originalImageBase64 || '';
      let callout = null;
      if (generated && generated.callout) {
        const textContent = generated.callout.content || generated.callout.text || '';
        if (textContent.trim()) {
          callout = {
            enabled: generated.callout.enabled !== false,
            type: generated.callout.type || 'info',
            title: generated.callout.title || 'Observação:',
            content: textContent,
          };
        }
      }

      processedSteps.push({
        id: `step-${Date.now()}-${i + 1}`,
        order: i + 1,
        title: generated.title || `Passo ${i + 1}`,
        objective: generated.objective || 'Executar procedimento indicado.',
        instructions: Array.isArray(generated.instructions)
          ? generated.instructions
          : [generated.instruction || 'Clique no ponto destacado para prosseguir.'],
        image: displayUrl,
        originalImage: originalUrl,
        caption: `Figura ${i + 1}: ${raw.windowTitle || generated.title || 'Ação no sistema'}`,
        imageWidthPercent: 100,
        callout: callout,
        actionType: raw.actionType || (raw.typedText ? 'typing' : raw.hotkey ? 'hotkey' : 'click'),
        typedText: raw.typedText || null,
        hotkey: raw.hotkey || null,
        images: [
          {
            id: `img-${Date.now()}-${i + 1}`,
            url: displayUrl,
            originalUrl: originalUrl,
            caption: `Figura ${i + 1}: ${raw.windowTitle || generated.title || 'Ação no sistema'}`,
            widthPercent: 100,
            annotations: annotations,
          },
        ],
      });
    }

    const projId = `gravacao-${Date.now()}`;

    const newProject = normalizeServerProject({
      id: projId,
      metadata: {
        organization: 'NOME DA ORGANIZAÇÃO',
        title: effectiveTitle,
        subtitle: effectiveSubtitle,
        system: effectiveSystem,
        systemName: effectiveSystem,
        badgeText: effectiveBadge,
        purpose: effectivePurpose,
        aiContext: procedureContext || '',
        version: '1.0',
        author: author || 'Gravador Automático de Passos',
        department: 'Nome da Organização',
        date: dateStr,
      },
      theme: {
        primaryColor: '#0a335c',
        secondaryColor: '#0284c7',
        accentColor: '#ef4444',
        badgeBgColor: '#0a335c',
        badgeTextColor: '#ffffff',
        cardBgColor: '#ffffff',
        cardBorderColor: '#e2e8f0',
        fontFamily: 'Inter',
      },
      support: {
        enabled: true,
        title: 'Central de Atendimento e Suporte de TI',
        description: 'Em caso de dúvidas operacionais ou problemas de acesso, contate a Central de TI:',
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
        footerNote: `Documento gerado pelo Gravador de Passos • ${dateStr}`,
      },
      steps: processedSteps,
      updatedAt: now.toISOString(),
    });

    const filePath = getProjectFilePath(projId);
    fs.writeFileSync(filePath, JSON.stringify(newProject, null, 2), 'utf8');
    console.log(`[RECORDER] Tutorial gravado criado com sucesso: ${projId} ("${newProject.metadata.title}")`);

    res.json({
      success: true,
      project: newProject,
      redirectUrl: `/?id=${projId}`,
    });
  } catch (err) {
    console.error('Erro ao importar passos gravados:', err);
    res.status(500).json({ error: 'Erro ao importar passos gravados no servidor' });
  }
});

// GET /api/ai/status - Check if AI is configured on server
app.get('/api/ai/status', (req, res) => {
  res.json({
    hasServerKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    supportedModels: GEMINI_CANDIDATE_MODELS,
  });
});

// POST /api/ai/test-key - Test a Gemini API key connectivity
app.post('/api/ai/test-key', async (req, res) => {
  try {
    const key = req.body?.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Nenhuma chave de API foi fornecida.' });
    }

    const result = await testGeminiConnection(key.trim());
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Falha ao testar chave Gemini.' });
  }
});

// POST /api/ai/analyze-step - Enhance single step using Gemini AI
app.post('/api/ai/analyze-step', async (req, res) => {
  try {
    const {
      imageBase64,
      clickX,
      clickY,
      windowTitle,
      elementText,
      apiKey,
      stepNumber,
      totalSteps,
      procedureContext,
      prompt,
      customPrompt,
      actionType,
      typedText,
      hotkey,
    } = req.body || {};

    const key = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'Chave API do Gemini não configurada' });
    }

    const analyzed = await generateStepWithGemini(
      {
        imageBase64,
        clickX,
        clickY,
        windowTitle,
        elementText,
        stepNumber: stepNumber || 1,
        totalSteps,
        procedureContext,
        customPrompt: customPrompt || prompt,
        actionType,
        typedText,
        hotkey,
      },
      key.trim()
    );

    res.json({ success: true, step: analyzed });
  } catch (err) {
    console.error('Erro na análise de IA do passo:', err);
    res.status(500).json({ error: err.message || 'Falha ao analisar passo com IA' });
  }
});

// POST /api/ai/enhance-manual - Reorganize whole manual with AI based on user explanation
app.post('/api/ai/enhance-manual', async (req, res) => {
  try {
    const {
      projectId,
      procedureContext,
      systemName,
      apiKey,
      updateMetadata = true,
      updateSteps = true,
    } = req.body || {};

    const key = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'Chave API do Gemini não configurada' });
    }

    if (!procedureContext || !procedureContext.trim()) {
      return res.status(400).json({ error: 'Forneça uma explicação do procedimento para a IA.' });
    }

    // Load existing project or use provided in body
    let currentProject = req.body.project;
    if (!currentProject && projectId) {
      const filePath = getProjectFilePath(projectId);
      if (fs.existsSync(filePath)) {
        currentProject = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    if (!currentProject) {
      return res.status(404).json({ error: 'Projeto não fornecido para aprimoramento' });
    }

    const steps = currentProject.steps || [];
    let updatedMetadata = { ...currentProject.metadata, aiContext: procedureContext.trim() };

    // 1. Refine Metadata if requested
    if (updateMetadata) {
      try {
        const aiMeta = await generateManualMetadataWithGemini(
          procedureContext.trim(),
          systemName || currentProject.metadata?.systemName,
          steps.length,
          key.trim()
        );
        if (aiMeta) {
          if (aiMeta.title) updatedMetadata.title = aiMeta.title;
          if (aiMeta.subtitle) updatedMetadata.subtitle = aiMeta.subtitle;
          if (aiMeta.purpose) updatedMetadata.purpose = aiMeta.purpose;
          if (aiMeta.badgeText) updatedMetadata.badgeText = aiMeta.badgeText;
          if (aiMeta.systemName) updatedMetadata.systemName = aiMeta.systemName;
        }
      } catch (err) {
        console.warn('[AI] Falha ao atualizar metadados com IA:', err.message);
      }
    }

    // 2. Refine Steps if requested
    let updatedSteps = [...steps];
    if (updateSteps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepImg = step.images?.[0]?.url || step.image || '';
        try {
          const analyzed = await generateStepWithGemini(
            {
              imageBase64: stepImg,
              windowTitle: step.caption || step.title,
              stepNumber: i + 1,
              totalSteps: steps.length,
              procedureContext: procedureContext.trim(),
              actionType: step.actionType,
              typedText: step.typedText,
              hotkey: step.hotkey,
            },
            key.trim()
          );

          if (analyzed) {
            updatedSteps[i] = {
              ...step,
              title: analyzed.title || step.title,
              objective: analyzed.objective || step.objective,
              instructions: Array.isArray(analyzed.instructions)
                ? analyzed.instructions
                : [analyzed.instruction || 'Execute a ação indicada.'],
              callout: analyzed.callout?.content
                ? {
                    enabled: true,
                    type: analyzed.callout.type || 'tip',
                    title: analyzed.callout.title || 'Dica:',
                    content: analyzed.callout.content,
                  }
                : step.callout,
            };
          }
        } catch (stepErr) {
          console.warn(`[AI] Falha ao aprimorar passo ${i + 1}:`, stepErr.message);
        }
      }
    }

    const enhancedProject = {
      ...currentProject,
      metadata: updatedMetadata,
      steps: updatedSteps,
      updatedAt: new Date().toISOString(),
    };

    if (projectId) {
      const filePath = getProjectFilePath(projectId);
      fs.writeFileSync(filePath, JSON.stringify(enhancedProject, null, 2), 'utf8');
      console.log(`[AI] Manual aprimorado com sucesso salvo em disco: ${projectId}`);
    }

    res.json({ success: true, project: enhancedProject });
  } catch (err) {
    console.error('Erro ao aprimorar manual com IA:', err);
    res.status(500).json({ error: err.message || 'Falha ao processar manual com IA' });
  }
});

// ==========================================
// Static Files & SPA Routing
// ==========================================
const recorderPath = path.join(__dirname, 'recorder');
if (fs.existsSync(recorderPath)) {
  app.use('/recorder', express.static(recorderPath));
}

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback for all client routes (Express 5 compatible)
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use((req, res) => {
    res.send('API do Gerador de Tutoriais ativa. Execute "npm run build" para servir o frontend.');
  });
}

// Start server when run directly
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  GuiaMaker Pro - Servidor Ativo (Rede e Persistência) `);
    console.log(`  Porta: ${PORT}`);
    console.log(`  Armazenamento: ${DATA_DIR}`);
    console.log(`  Biblioteca de PDFs: ${PDF_DIR}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

