import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FocusedImage } from '../FocusedImage';
import {
  StepImage,
  ShapeAnnotation,
  FocusRegion,
  computeFocusRegionFromAnnotations,
  getEffectiveFocus,
  hasFocusAnchors,
  normalizeFocusBox,
} from '../../types/tutorial';

const clickAt = (x: number, y: number): ShapeAnnotation => ({
  id: `click-${x}-${y}`,
  type: 'click',
  startX: x,
  startY: y,
  endX: x,
  endY: y,
  color: '#f97316',
  strokeWidth: 3,
});

const makeImage = (focusRegion?: FocusRegion, annotations?: ShapeAnnotation[]): StepImage => ({
  id: 'img-1',
  url: 'data:image/png;base64,COMPLETE',
  caption: 'Figura 1.1',
  widthPercent: 100,
  annotations,
  focusRegion,
});

describe('RF-17 — automatic focus region from clicks', () => {
  it('derives a padded region around a single click', () => {
    const region = computeFocusRegionFromAnnotations([clickAt(500, 250)], 1000, 500);

    expect(region).not.toBeNull();
    expect(region!.enabled).toBe(true);
    expect(region!.mode).toBe('crop');
    expect(region!.auto).toBe(true);
    expect(region!.srcWidth).toBe(1000);
    expect(region!.srcHeight).toBe(500);

    // The click sits at the center of the capture, so the region is centered too
    expect(region!.x + region!.width / 2).toBeCloseTo(0.5, 2);
    expect(region!.y + region!.height / 2).toBeCloseTo(0.5, 2);

    // It must be a real zoom (smaller than the capture) but never microscopic
    expect(region!.width).toBeGreaterThanOrEqual(0.18);
    expect(region!.width).toBeLessThan(1);
    expect(region!.height).toBeLessThan(1);
  });

  it('covers every click when the step has several of them', () => {
    const region = computeFocusRegionFromAnnotations(
      [clickAt(200, 150), clickAt(800, 400)],
      1000,
      500
    );

    expect(region).not.toBeNull();
    // both clicks inside the region
    expect(region!.x).toBeLessThanOrEqual(200 / 1000);
    expect(region!.y).toBeLessThanOrEqual(150 / 500);
    expect(region!.x + region!.width).toBeGreaterThanOrEqual(800 / 1000);
    expect(region!.y + region!.height).toBeGreaterThanOrEqual(400 / 500);
  });

  it('includes action boxes and numeric badges as focus anchors', () => {
    const actionBox: ShapeAnnotation = {
      id: 'box-1',
      type: 'action_box',
      startX: 100,
      startY: 100,
      endX: 300,
      endY: 160,
      color: '#f97316',
      strokeWidth: 3,
    };
    const region = computeFocusRegionFromAnnotations([actionBox], 1000, 500);
    expect(region).not.toBeNull();
    expect(hasFocusAnchors(makeImage(undefined, [actionBox]))).toBe(true);
  });

  it('returns null when there is no click to focus on', () => {
    const blur: ShapeAnnotation = {
      id: 'blur-1',
      type: 'blur',
      startX: 10,
      startY: 10,
      endX: 90,
      endY: 50,
      color: '#ef4444',
      strokeWidth: 2,
    };
    expect(computeFocusRegionFromAnnotations([blur], 1000, 500)).toBeNull();
    expect(computeFocusRegionFromAnnotations([], 1000, 500)).toBeNull();
    expect(computeFocusRegionFromAnnotations(undefined, 1000, 500)).toBeNull();
    expect(hasFocusAnchors(makeImage(undefined, [blur]))).toBe(false);
  });

  it('keeps the region inside the image even for clicks on the very edge', () => {
    const region = computeFocusRegionFromAnnotations([clickAt(0, 0)], 1000, 500);
    expect(region!.x).toBeGreaterThanOrEqual(0);
    expect(region!.y).toBeGreaterThanOrEqual(0);

    const corner = computeFocusRegionFromAnnotations([clickAt(1000, 500)], 1000, 500);
    expect(corner!.x + corner!.width).toBeLessThanOrEqual(1);
    expect(corner!.y + corner!.height).toBeLessThanOrEqual(1);
  });

  it('normalizeFocusBox clamps oversized and negative boxes', () => {
    const box = normalizeFocusBox({ x: -0.5, y: -0.2, width: 2, height: 3 });
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(1);
    expect(box.height).toBe(1);
  });
});

describe('RF-17 — getEffectiveFocus (reversibility)', () => {
  const base: FocusRegion = {
    enabled: true,
    mode: 'crop',
    x: 0.2,
    y: 0.2,
    width: 0.4,
    height: 0.4,
    srcWidth: 1000,
    srcHeight: 500,
  };

  it('ignores a disabled region so the PDF uses the complete image', () => {
    expect(getEffectiveFocus(makeImage({ ...base, enabled: false }))).toBeNull();
  });

  it('ignores a region that covers the whole capture', () => {
    expect(getEffectiveFocus(makeImage({ ...base, width: 1, height: 1 }))).toBeNull();
  });

  it('ignores a degenerate region', () => {
    expect(getEffectiveFocus(makeImage({ ...base, width: 0, height: 0 }))).toBeNull();
  });

  it('returns the region when it is enabled and partial', () => {
    expect(getEffectiveFocus(makeImage(base))).not.toBeNull();
  });
});

describe('RF-17 — FocusedImage rendering', () => {
  const base: FocusRegion = {
    enabled: true,
    mode: 'crop',
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5,
    srcWidth: 1000,
    srcHeight: 500,
  };

  it('renders the plain complete image when no focus is configured', () => {
    const html = renderToString(<FocusedImage image={makeImage()} alt="Captura" />);
    expect(html).toContain('data:image/png;base64,COMPLETE');
    expect(html).not.toContain('padding-bottom');
  });

  it('crop mode never discards the full screenshot (same src, CSS cut only)', () => {
    const html = renderToString(<FocusedImage image={makeImage(base)} alt="Captura" />);
    // The source is still the untouched complete capture
    expect(html).toContain('data:image/png;base64,COMPLETE');
    // 1000x500 with a square region -> cut aspect 2:1 -> 50% padding-bottom
    expect(html).toContain('padding-bottom:50.0000%');
    // img scaled to 1/0.5 = 200% and shifted by -50% on both axes
    expect(html).toContain('width:200.0000%');
    expect(html).toContain('left:-50.0000%');
    expect(html).toContain('top:-50.0000%');
  });

  it('crop mode can also show the complete screenshot below the cut', () => {
    const html = renderToString(
      <FocusedImage image={makeImage({ ...base, showFull: true })} alt="Captura" />
    );
    expect(html).toContain('Tela completa para refer');
    // cut + full image = two <img> tags
    expect(html.match(/<img/g)?.length).toBe(2);
  });

  it('spotlight mode keeps the whole capture visible and dims the surroundings', () => {
    const html = renderToString(
      <FocusedImage image={makeImage({ ...base, mode: 'spotlight' })} alt="Captura" />
    );
    expect(html).toContain('data:image/png;base64,COMPLETE');
    expect(html).not.toContain('padding-bottom');
    // four dimming bands around the region
    expect(html.match(/rgba\(15, 23, 42, 0\.62\)/g)?.length).toBe(4);
  });

  it('inset mode renders the full capture plus a magnified detail', () => {
    const html = renderToString(
      <FocusedImage image={makeImage({ ...base, mode: 'inset', zoom: 0.6 })} alt="Captura" />
    );
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toContain('Detalhe ampliado da a');
    expect(html).toContain('width:60%');
  });

  it('falls back to spotlight when the source size is unknown (legacy data)', () => {
    const legacy: FocusRegion = { ...base, srcWidth: undefined, srcHeight: undefined };
    const html = renderToString(<FocusedImage image={makeImage(legacy)} alt="Captura" />);
    // no crop math without an aspect ratio, but nothing is hidden either
    expect(html).not.toContain('padding-bottom');
    expect(html).toContain('data:image/png;base64,COMPLETE');
  });

  it('uses the document accent color for the highlight ring', () => {
    const html = renderToString(
      <FocusedImage
        image={makeImage({ ...base, mode: 'spotlight' })}
        alt="Captura"
        accentColor="#e11d48"
      />
    );
    expect(html).toContain('#e11d48');
  });
});
