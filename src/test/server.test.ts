import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TEST_DATA_DIR = path.resolve('src/test/temp_test_data');
process.env.DATA_DIR = TEST_DATA_DIR;

const app = require('../../server.js');

describe('Server REST API Endpoints', () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  it('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/projects should reject invalid payload with 400', async () => {
    const res = await request(app).post('/api/projects').send({ foo: 'bar' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/projects should save new project to disk', async () => {
    const newProject = {
      id: 'test-project-1',
      metadata: {
        title: 'Tutorial Teste API',
        organization: 'Nome da Organização',
      },
      steps: [
        {
          id: 'step-1',
          title: 'Passo 1',
          instructions: ['Acessar sistema'],
        },
      ],
    };

    const res = await request(app).post('/api/projects').send(newProject);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project.id).toBe('test-project-1');
    expect(res.body.project.updatedAt).toBeDefined();

    // Verify written to disk
    const savedPath = path.join(TEST_DATA_DIR, 'test-project-1.json');
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it('GET /api/projects should list saved projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: any) => p.id === 'test-project-1')).toBe(true);
  });

  it('GET /api/projects/:id should return single project', async () => {
    const res = await request(app).get('/api/projects/test-project-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('test-project-1');
    expect(res.body.metadata.title).toBe('Tutorial Teste API');
  });

  it('GET /api/projects/:id should return 404 for non-existent project', async () => {
    const res = await request(app).get('/api/projects/non-existent-xyz');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/projects/:id should remove project from disk', async () => {
    const res = await request(app).delete('/api/projects/test-project-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const savedPath = path.join(TEST_DATA_DIR, 'test-project-1.json');
    expect(fs.existsSync(savedPath)).toBe(false);
  });

  it('POST /api/recorder/import should reject empty steps with 400', async () => {
    const res = await request(app).post('/api/recorder/import').send({ steps: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/recorder/import should create project offline with click annotations', async () => {
    const recorderPayload = {
      title: 'Tutorial Teste Gravador',
      systemName: 'Sistema Exemplo',
      author: 'Testador Automatizado',
      steps: [
        {
          imageBase64: 'data:image/png;base64,mockImage1',
          originalImageBase64: 'data:image/png;base64,mockOrig1',
          clickX: 120,
          clickY: 340,
          windowTitle: 'Sistema Exemplo - Protocolo de Processos',
          elementText: 'Botão Protocolar',
        },
      ],
    };

    const res = await request(app).post('/api/recorder/import').send(recorderPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project).toBeDefined();
    expect(res.body.redirectUrl).toContain('/?id=');

    const proj = res.body.project;
    expect(proj.metadata.title).toBe('Tutorial Teste Gravador');
    expect(proj.metadata.system).toBe('Sistema Exemplo');
    expect(proj.steps).toHaveLength(1);

    const step = proj.steps[0];
    expect(step.title).toContain('Protocolar');
    expect(step.objective).toBeDefined();
    expect(step.instructions[0]).toContain('Protocolar');
    expect(step.originalImage).toBe('data:image/png;base64,mockOrig1');

    // Check non-destructive annotations layer
    expect(step.images[0].annotations).toHaveLength(1);
    expect(step.images[0].annotations[0].type).toBe('click');
    expect(step.images[0].annotations[0].startX).toBe(120);
    expect(step.images[0].annotations[0].startY).toBe(340);
    expect(step.images[0].annotations[0].color).toBe('#ef4444');

    // Verify file written to disk
    const savedPath = path.join(TEST_DATA_DIR, `${proj.id}.json`);
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it('POST /api/recorder/import should handle typing and hotkey steps', async () => {
    const recorderPayload = {
      title: 'Tutorial Ações de Teclado',
      system: 'Sistema Integrado',
      steps: [
        {
          actionType: 'typing',
          windowTitle: 'Formulário de Cadastro',
          typedText: 'Maria da Silva',
          imageDataUrl: 'data:image/png;base64,mockTypingImg',
          timestamp: '2026-10-15T10:00:00Z'
        },
        {
          actionType: 'hotkey',
          windowTitle: 'Formulário de Cadastro',
          hotkey: 'Ctrl + S',
          imageDataUrl: 'data:image/png;base64,mockHotkeyImg',
          timestamp: '2026-10-15T10:00:05Z'
        }
      ]
    };

    const res = await request(app).post('/api/recorder/import').send(recorderPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const proj = res.body.project;
    expect(proj.steps).toHaveLength(2);

    // Typing step
    expect(proj.steps[0].actionType).toBe('typing');
    expect(proj.steps[0].typedText).toBe('Maria da Silva');
    expect(proj.steps[0].title).toContain('Digitar');
    expect(proj.steps[0].instructions[0]).toContain('Maria da Silva');

    // Hotkey step
    expect(proj.steps[1].actionType).toBe('hotkey');
    expect(proj.steps[1].hotkey).toBe('Ctrl + S');
    expect(proj.steps[1].title).toContain('Ctrl + S');
    expect(proj.steps[1].instructions[0]).toContain('Ctrl + S');
  });

  it('GET /api/ai/status should return status and candidate models', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hasServerKey');
    expect(Array.isArray(res.body.supportedModels)).toBe(true);
    expect(res.body.supportedModels).toContain('gemini-2.5-flash');
  });

  it('POST /api/ai/test-key should require api key', async () => {
    const res = await request(app).post('/api/ai/test-key').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Nenhuma chave de API');
  });

  it('POST /api/ai/analyze-step should require api key', async () => {
    const res = await request(app).post('/api/ai/analyze-step').send({
      windowTitle: 'Tela de Teste',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Chave API');
  });

  it('POST /api/recorder/import should store procedureContext in metadata', async () => {
    const res = await request(app).post('/api/recorder/import').send({
      systemName: 'SEI Judicial',
      procedureContext: 'Este passo a passo ensina o servidor a cadastrar novo processo de compras.',
      steps: [
        {
          actionType: 'click',
          clickX: 100,
          clickY: 150,
          windowTitle: 'SEI - Tela Inicial',
          imageDataUrl: 'data:image/png;base64,mockImg',
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project.metadata.aiContext).toBe('Este passo a passo ensina o servidor a cadastrar novo processo de compras.');
  });

  it('POST /api/ai/enhance-manual should require api key and procedureContext', async () => {
    const res1 = await request(app).post('/api/ai/enhance-manual').send({});
    expect(res1.status).toBe(400);
    expect(res1.body.error).toContain('Chave API');

    const res2 = await request(app).post('/api/ai/enhance-manual').send({
      apiKey: 'test-key',
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toContain('explicação do procedimento');
  });
});
