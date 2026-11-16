import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TEST_DATA_DIR = path.resolve('src/test/temp_pdf_projects');
const TEST_PDF_DIR = path.resolve('src/test/temp_pdf_library');
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.PDF_DIR = TEST_PDF_DIR;

const app = require('../../server.js');

/** Minimal but structurally valid PDF file. */
function makePdfBase64(): string {
  const pdf =
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n' +
    '%%EOF\n';
  return Buffer.from(pdf, 'latin1').toString('base64');
}

describe('Published PDF library API (Tutoriais do Sistema)', () => {
  beforeAll(() => {
    [TEST_DATA_DIR, TEST_PDF_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  });

  afterAll(() => {
    [TEST_DATA_DIR, TEST_PDF_DIR].forEach((dir) => {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  it('GET /api/pdfs starts empty', async () => {
    const res = await request(app).get('/api/pdfs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/pdfs rejects a missing file', async () => {
    const res = await request(app).post('/api/pdfs').send({ title: 'Sem arquivo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/pdfs rejects content that is not a PDF', async () => {
    const res = await request(app)
      .post('/api/pdfs')
      .send({
        title: 'Arquivo falso',
        pdfBase64: Buffer.from('<html>not a pdf</html>').toString('base64'),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('PDF');
  });

  it('POST /api/pdfs publishes the final PDF and returns its metadata', async () => {
    const res = await request(app)
      .post('/api/pdfs')
      .send({
        projectId: 'project-abc',
        title: 'Gerenciamento de Unidades',
        subtitle: 'Manual Prático',
        systemName: 'SISTEMA EXEMPLO',
        organization: 'Nome da Organização',
        version: '1.0',
        author: 'DTI',
        pages: 4,
        stepsCount: 6,
        pdfBase64: makePdfBase64(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const pdf = res.body.pdf;
    expect(pdf.id).toMatch(/^pdf-/);
    expect(pdf.title).toBe('Gerenciamento de Unidades');
    expect(pdf.systemName).toBe('SISTEMA EXEMPLO');
    expect(pdf.projectId).toBe('project-abc');
    expect(pdf.pages).toBe(4);
    expect(pdf.stepsCount).toBe(6);
    expect(pdf.sizeBytes).toBeGreaterThan(0);
    expect(pdf.publishedAt).toBeDefined();
    expect(pdf.fileName).toBe('manual-gerenciamento-de-unidades.pdf');
    expect(pdf.downloadUrl).toBe(`/api/pdfs/${pdf.id}/file`);

    // Both the file and its metadata must land on disk
    expect(fs.existsSync(path.join(TEST_PDF_DIR, `${pdf.id}.pdf`))).toBe(true);
    expect(fs.existsSync(path.join(TEST_PDF_DIR, `${pdf.id}.json`))).toBe(true);
  });

  it('accepts a data-URI prefixed payload too', async () => {
    const res = await request(app)
      .post('/api/pdfs')
      .send({
        title: 'Com prefixo',
        pdfBase64: `data:application/pdf;filename=generated.pdf;base64,${makePdfBase64()}`,
      });
    expect(res.status).toBe(200);
    expect(res.body.pdf.sizeBytes).toBeGreaterThan(0);
  });

  it('GET /api/pdfs lists published files, newest first', async () => {
    const res = await request(app).get('/api/pdfs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    const times = res.body.map((p: any) => new Date(p.publishedAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
    }
  });

  it('GET /api/pdfs/:id/file serves the PDF inline and as a download', async () => {
    const list = await request(app).get('/api/pdfs');
    const target = list.body[0];

    const inline = await request(app).get(`/api/pdfs/${target.id}/file`);
    expect(inline.status).toBe(200);
    expect(inline.headers['content-type']).toContain('application/pdf');
    expect(inline.headers['content-disposition']).toContain('inline');
    expect(inline.headers['content-disposition']).toContain(target.fileName);

    const download = await request(app).get(`/api/pdfs/${target.id}/file?download=1`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
  });

  it('GET /api/pdfs/:id/file returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/pdfs/pdf-does-not-exist/file');
    expect(res.status).toBe(404);
  });

  it('does not allow path traversal through the id', async () => {
    const res = await request(app).get('/api/pdfs/..%2F..%2Fserver.js/file');
    expect(res.status).toBe(404);
    expect(fs.existsSync(path.resolve('server.js'))).toBe(true);
  });

  it('DELETE /api/pdfs/:id removes the file and its metadata', async () => {
    const list = await request(app).get('/api/pdfs');
    const target = list.body[0];

    const del = await request(app).delete(`/api/pdfs/${target.id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    expect(fs.existsSync(path.join(TEST_PDF_DIR, `${target.id}.pdf`))).toBe(false);
    expect(fs.existsSync(path.join(TEST_PDF_DIR, `${target.id}.json`))).toBe(false);

    const after = await request(app).get('/api/pdfs');
    expect(after.body.find((p: any) => p.id === target.id)).toBeUndefined();
  });
});
