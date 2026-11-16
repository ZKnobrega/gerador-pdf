import { describe, it, expect, vi } from 'vitest';
import { applyFastBoxBlur } from '../canvasBlur';

describe('applyFastBoxBlur', () => {
  function createMockContext(width = 100, height = 100) {
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);
    // Fill with high contrast pattern: alternating white (255) and black (0)
    for (let i = 0; i < pixelBuffer.length; i += 4) {
      const val = (i / 4) % 2 === 0 ? 255 : 0;
      pixelBuffer[i] = val;
      pixelBuffer[i + 1] = val;
      pixelBuffer[i + 2] = val;
      pixelBuffer[i + 3] = 255;
    }

    const ctx = {
      canvas: { width, height },
      getImageData: vi.fn((x, y, w, h) => {
        const slice = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < slice.length; i++) {
          slice[i] = pixelBuffer[i];
        }
        return {
          data: slice,
          width: w,
          height: h,
        } as ImageData;
      }),
      putImageData: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    return { ctx, pixelBuffer };
  }

  it('should ignore calls with zero or negative width/height', () => {
    const { ctx } = createMockContext();
    applyFastBoxBlur(ctx, 10, 10, 0, 0, 20);
    expect(ctx.getImageData).not.toHaveBeenCalled();

    applyFastBoxBlur(ctx, 10, 10, -5, 50, 20);
    expect(ctx.getImageData).not.toHaveBeenCalled();
  });

  it('should blur pixel data and call putImageData', () => {
    const { ctx } = createMockContext(50, 50);
    applyFastBoxBlur(ctx, 10, 10, 30, 30, 15, 0);

    expect(ctx.getImageData).toHaveBeenCalledWith(10, 10, 30, 30);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it('should apply frosted privacy overlay when frostedOpacity > 0', () => {
    const { ctx } = createMockContext(50, 50);
    applyFastBoxBlur(ctx, 5, 5, 20, 20, 10, 50);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 20, 20);
    expect(ctx.strokeRect).toHaveBeenCalledWith(5, 5, 20, 20);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('should clamp bounds when coordinates exceed canvas size', () => {
    const { ctx } = createMockContext(100, 100);
    applyFastBoxBlur(ctx, 80, 80, 50, 50, 20);

    // width should be clamped to 100 - 80 = 20
    expect(ctx.getImageData).toHaveBeenCalledWith(80, 80, 20, 20);
  });
});
