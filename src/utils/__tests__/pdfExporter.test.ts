import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportPdfDirectly } from '../pdfExporter';

// Mock dependencies
const mockAddImage = vi.fn();
const mockAddPage = vi.fn();
const mockSave = vi.fn();

vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      addImage = mockAddImage;
      addPage = mockAddPage;
      save = mockSave;
    },
  };
});

vi.mock('html2canvas-pro', () => {
  return {
    default: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/jpeg;base64,mockJpegData',
    }),
  };
});

describe('exportPdfDirectly', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    global.alert = vi.fn();
  });

  it('should alert and return false if no pages are present in document', async () => {
    const success = await exportPdfDirectly('Tutorial Vazio');
    expect(success).toBe(false);
    expect(global.alert).toHaveBeenCalledWith('Nenhuma página encontrada para exportar.');
  });

  it('should capture pages, report progress, and save PDF with sanitized filename', async () => {
    // Mount mock pages inside dedicated stage
    const container = document.createElement('div');
    container.id = 'pdf-direct-export-stage';
    container.innerHTML = `
      <div class="pdf-page">Página 1</div>
      <div class="pdf-page">Página 2</div>
    `;
    document.body.appendChild(container);

    const progressLogs: string[] = [];
    const success = await exportPdfDirectly('Sistema SIM / Gestão (2026)', (cur, tot, status) => {
      progressLogs.push(status);
    });

    expect(success).toBe(true);
    expect(mockAddImage).toHaveBeenCalledTimes(2);
    expect(mockAddPage).toHaveBeenCalledTimes(1); // Page 2 added

    // Verify progress reporting
    expect(progressLogs.length).toBeGreaterThan(0);
    expect(progressLogs.some((l) => l.includes('Página 1') || l.includes('página 1'))).toBe(true);

    // Verify clean sanitized filename: symbols turned to dashes
    expect(mockSave).toHaveBeenCalledWith('manual-sistema-sim---gest-o--2026-.pdf');
  });
});
