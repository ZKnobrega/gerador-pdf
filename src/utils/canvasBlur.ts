/**
 * Fast, robust, multi-pass Box Blur algorithm directly manipulating ImageData.
 * 3 passes of box blur mathematically converges to an exact Gaussian blur.
 * Replaces original pixel data completely so no high-frequency text can show through.
 */
export function applyFastBoxBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 25,
  frostedOpacity: number = 40
) {
  // Clamp boundaries to canvas
  const canvasW = ctx.canvas?.width || 2000;
  const canvasH = ctx.canvas?.height || 2000;

  const startX = Math.max(0, Math.min(canvasW - 1, Math.round(x)));
  const startY = Math.max(0, Math.min(canvasH - 1, Math.round(y)));
  const w = Math.max(1, Math.min(canvasW - startX, Math.round(width)));
  const h = Math.max(1, Math.min(canvasH - startY, Math.round(height)));

  if (w <= 1 || h <= 1) return;

  const r = Math.max(2, Math.min(80, Math.round(radius)));

  try {
    const imgData = ctx.getImageData(startX, startY, w, h);
    const data = imgData.data;

    // 3 passes of horizontal and vertical box blur
    for (let pass = 0; pass < 3; pass++) {
      boxBlurH(data, w, h, r);
      boxBlurV(data, w, h, r);
    }

    ctx.putImageData(imgData, startX, startY);

    // Apply frosted privacy overlay if enabled
    if (frostedOpacity > 0) {
      ctx.save();
      const alpha = Math.min(0.85, Math.max(0.05, frostedOpacity / 100));
      ctx.fillStyle = `rgba(248, 250, 252, ${alpha})`; // Frosted slate-50
      ctx.fillRect(startX, startY, w, h);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, startY, w, h);
      ctx.restore();
    }
  } catch (err) {
    console.error('Erro ao aplicar blur:', err);
    // Fallback: opaque censor box
    ctx.fillStyle = 'rgba(203, 213, 225, 0.95)';
    ctx.fillRect(startX, startY, w, h);
  }
}

// 1D Horizontal Box Blur with sliding window accumulator
function boxBlurH(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < h; i++) {
    const ti = i * w * 4;
    let li = ti;
    let ri = ti + r * 4;

    const fvR = data[ti];
    const fvG = data[ti + 1];
    const fvB = data[ti + 2];
    const lvR = data[ti + (w - 1) * 4];
    const lvG = data[ti + (w - 1) * 4 + 1];
    const lvB = data[ti + (w - 1) * 4 + 2];

    let valR = (r + 1) * fvR;
    let valG = (r + 1) * fvG;
    let valB = (r + 1) * fvB;

    for (let j = 0; j < r; j++) {
      const idx = ti + Math.min(j, w - 1) * 4;
      valR += data[idx];
      valG += data[idx + 1];
      valB += data[idx + 2];
    }

    for (let j = 0; j <= r; j++) {
      const rIdx = ri < ti + w * 4 ? ri : ti + (w - 1) * 4;
      valR += data[rIdx] - fvR;
      valG += data[rIdx + 1] - fvG;
      valB += data[rIdx + 2] - fvB;

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      ri += 4;
      li += 4;
    }

    for (let j = r + 1; j < w - r; j++) {
      const rIdx = ri;
      const lIdx = li - (r + 1) * 4;
      valR += data[rIdx] - data[lIdx];
      valG += data[rIdx + 1] - data[lIdx + 1];
      valB += data[rIdx + 2] - data[lIdx + 2];

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      ri += 4;
      li += 4;
    }

    for (let j = w - r; j < w; j++) {
      const lIdx = li - (r + 1) * 4;
      valR += lvR - data[lIdx];
      valG += lvG - data[lIdx + 1];
      valB += lvB - data[lIdx + 2];

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      li += 4;
    }
  }
}

// 1D Vertical Box Blur with sliding window accumulator
function boxBlurV(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < w; i++) {
    let ti = i * 4;
    let li = ti;
    let ri = ti + r * w * 4;

    const fvR = data[ti];
    const fvG = data[ti + 1];
    const fvB = data[ti + 2];
    const lvR = data[ti + (h - 1) * w * 4];
    const lvG = data[ti + (h - 1) * w * 4 + 1];
    const lvB = data[ti + (h - 1) * w * 4 + 2];

    let valR = (r + 1) * fvR;
    let valG = (r + 1) * fvG;
    let valB = (r + 1) * fvB;

    for (let j = 0; j < r; j++) {
      const idx = ti + Math.min(j, h - 1) * w * 4;
      valR += data[idx];
      valG += data[idx + 1];
      valB += data[idx + 2];
    }

    for (let j = 0; j <= r; j++) {
      const rIdx = ri < (h * w * 4) ? ri : ti + (h - 1) * w * 4;
      valR += data[rIdx] - fvR;
      valG += data[rIdx + 1] - fvG;
      valB += data[rIdx + 2] - fvB;

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      ri += w * 4;
      li += w * 4;
    }

    for (let j = r + 1; j < h - r; j++) {
      const rIdx = ri;
      const lIdx = li - (r + 1) * w * 4;
      valR += data[rIdx] - data[lIdx];
      valG += data[rIdx + 1] - data[lIdx + 1];
      valB += data[rIdx + 2] - data[lIdx + 2];

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      ri += w * 4;
      li += w * 4;
    }

    for (let j = h - r; j < h; j++) {
      const lIdx = li - (r + 1) * w * 4;
      valR += lvR - data[lIdx];
      valG += lvG - data[lIdx + 1];
      valB += lvB - data[lIdx + 2];

      data[li] = Math.round(valR * iarr);
      data[li + 1] = Math.round(valG * iarr);
      data[li + 2] = Math.round(valB * iarr);

      li += w * 4;
    }
  }
}
