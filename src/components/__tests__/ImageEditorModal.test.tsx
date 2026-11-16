import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { ImageEditorModal } from '../ImageEditorModal';
import { ShapeAnnotation } from '../../types/tutorial';

describe('ImageEditorModal Component', () => {
  const setupCanvasMock = () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      setLineDash: vi.fn(),
      roundRect: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 60 }),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(400),
        width: 10,
        height: 10,
      }),
      putImageData: vi.fn(),
      canvas: { width: 800, height: 600 },
    }) as any;
  };

  it('renders and mounts without throwing ReferenceError or TDZ errors', () => {
    setupCanvasMock();
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = ReactDOM.createRoot(div);

    expect(() => {
      act(() => {
        root.render(
          <ImageEditorModal
            isOpen={true}
            imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            onClose={handleClose}
            onSave={handleSave}
          />
        );
      });
    }).not.toThrow();

    act(() => {
      root.unmount();
    });
    div.remove();
  });

  it('renders action_box, click, and freehand annotations correctly', () => {
    setupCanvasMock();
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    const handleBatchBlur = vi.fn();

    const initialAnnotations: ShapeAnnotation[] = [
      {
        id: 'ab-1',
        type: 'action_box',
        startX: 50,
        startY: 50,
        endX: 180,
        endY: 100,
        color: '#f97316',
        strokeWidth: 3.5,
        label: '⚡ Ação',
      },
      {
        id: 'click-1',
        type: 'click',
        startX: 100,
        startY: 80,
        endX: 128,
        endY: 116,
        color: '#ef4444',
        strokeWidth: 3,
      },
      {
        id: 'freehand-1',
        type: 'freehand',
        startX: 200,
        startY: 200,
        endX: 250,
        endY: 250,
        color: '#0284c7',
        strokeWidth: 3,
        points: [
          { x: 200, y: 200 },
          { x: 220, y: 230 },
          { x: 250, y: 250 },
        ],
      },
      {
        id: 'blur-1',
        type: 'blur',
        startX: 300,
        startY: 300,
        endX: 450,
        endY: 350,
        color: '#ef4444',
        strokeWidth: 2,
        blurIntensity: 30,
        frostedOpacity: 40,
      },
    ];

    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = ReactDOM.createRoot(div);

    act(() => {
      root.render(
        <ImageEditorModal
          isOpen={true}
          imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          originalImageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          initialAnnotations={initialAnnotations}
          initialAltText="Tela com caixa de ação e clique"
          onClose={handleClose}
          onSave={handleSave}
          onBatchBlur={handleBatchBlur}
        />
      );
    });

    // Verify UI has new tools present
    expect(div.textContent).toContain('Editor de Captura & Anotações');
    expect(div.textContent).toContain('Focar na Ação');
    expect(div.textContent).toContain('Ação');
    expect(div.textContent).toContain('Pan (Espaço)');
    expect(div.textContent).toContain('Lápis');
    expect(div.textContent).toContain('Alt Text');
    expect(div.textContent).toContain('Proteção de PII');

    act(() => {
      root.unmount();
    });
    div.remove();
  });
});
