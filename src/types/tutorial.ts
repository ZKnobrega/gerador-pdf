export type CalloutType = 'tip' | 'warning' | 'info' | 'critical' | 'success';

export interface StepCallout {
  enabled: boolean;
  type: CalloutType;
  title: string;
  content: string;
}

export type EditorTool =
  | 'select'
  | 'pan'
  | 'crop'
  | 'action_box'
  | 'rect'
  | 'arrow'
  | 'circle'
  | 'blur'
  | 'pixelate'
  | 'blackout'
  | 'badge'
  | 'text'
  | 'freehand'
  | 'click'
  | 'focus';

export interface ShapeAnnotation {
  id: string;
  type: EditorTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  strokeWidth: number;
  text?: string;
  label?: string;
  fontSize?: number;
  badgeNumber?: number;
  blurIntensity?: number;
  frostedOpacity?: number;
  pixelateBlockSize?: number;
  points?: { x: number; y: number }[]; // For freehand pencil/brush
}

/**
 * How a focus region is presented in the exported PDF.
 * - 'crop'      -> only the selected region is shown (zoomed to the image width)
 * - 'spotlight' -> whole screenshot stays visible, everything outside is dimmed
 * - 'inset'     -> whole screenshot plus a magnified detail of the region below
 */
export type FocusMode = 'crop' | 'spotlight' | 'inset';

/**
 * Non-destructive focus region ("recorte inteligente").
 *
 * Coordinates are NORMALIZED (0..1) against the rendered image, so they stay
 * valid regardless of the screenshot resolution. The full image is never
 * modified: `StepImage.url` keeps the complete capture and the focus is applied
 * only at render time, which makes it reversible with a single click.
 */
export interface FocusRegion {
  enabled: boolean;
  mode: FocusMode;
  x: number; // 0..1 (left)
  y: number; // 0..1 (top)
  width: number; // 0..1
  height: number; // 0..1
  /** true while the region is derived automatically from the click annotations */
  auto?: boolean;
  /** Magnification of the detail box in 'inset' mode (default 1 = fits the box) */
  zoom?: number;
  /** 'crop' mode: also render the complete screenshot below the focused cut */
  showFull?: boolean;
  /** Source pixel size, required to compute the aspect ratio of the cut */
  srcWidth?: number;
  srcHeight?: number;
}

export interface StepImage {
  id: string;
  url: string; // Base64 data URL
  originalUrl?: string; // To revert edits or re-render annotations non-destructively
  caption: string;
  altText?: string; // Accessibility & screen reader alt attribute
  widthPercent: number; // 50, 70, 85, 100
  annotations?: ShapeAnnotation[]; // Editable layers (circles, blur, mosaics, etc.)
  cropRegion?: { x: number; y: number; width: number; height: number }; // Legacy non-destructive crop metadata
  focusRegion?: FocusRegion; // Non-destructive "focus on the click" region (see FocusRegion)
}

export interface TutorialStep {
  id: string;
  order: number;
  title: string;
  objective: string;
  instructions: string[]; // List of bullet points or numbered instructions
  images?: StepImage[]; // Multiple images supported per step!
  image?: string | null; // Backward compatibility
  originalImage?: string | null;
  caption?: string;
  imageWidthPercent?: number;
  callout: StepCallout | null;
  forcePageBreakBefore?: boolean;
  forcePageBreakAfter?: boolean;
  actionType?: 'click' | 'typing' | 'hotkey';
  typedText?: string;
  hotkey?: string;
}

/**
 * Normalizes images array for a step, providing full backward compatibility
 * for steps saved with a single `image` field.
 */
export function getStepImages(step: TutorialStep): StepImage[] {
  if (step.images && Array.isArray(step.images) && step.images.length > 0) {
    return step.images;
  }
  if (step.image) {
    return [
      {
        id: `img-${step.id}-legacy`,
        url: step.image,
        originalUrl: step.originalImage || step.image,
        caption: step.caption || '',
        widthPercent: step.imageWidthPercent || 100,
      },
    ];
  }
  return [];
}

/** Annotation types that represent "where the user clicked / must act". */
export const FOCUS_ANCHOR_TYPES: EditorTool[] = ['click', 'action_box', 'badge'];

/** Breathing room kept around the clicks, as a fraction of the image size. */
export const FOCUS_DEFAULT_PADDING = 0.12;

/** Smallest region allowed, so a single click never produces an unreadable zoom. */
export const FOCUS_MIN_SIZE = 0.18;

export const DEFAULT_FOCUS_MODE: FocusMode = 'crop';

/**
 * Builds the focus region automatically from the click / action annotations:
 * takes the bounding box of every anchor shape and adds breathing room, so the
 * reader sees the clicked control *with* enough surrounding context to locate it.
 *
 * Returns null when the image has no click to focus on.
 */
export function computeFocusRegionFromAnnotations(
  annotations: ShapeAnnotation[] | undefined,
  srcWidth: number,
  srcHeight: number,
  options?: { padding?: number; mode?: FocusMode }
): FocusRegion | null {
  if (!annotations || annotations.length === 0) return null;
  if (!srcWidth || !srcHeight || srcWidth <= 0 || srcHeight <= 0) return null;

  const anchors = annotations.filter((s) => FOCUS_ANCHOR_TYPES.includes(s.type));
  if (anchors.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  anchors.forEach((s) => {
    const x1 = Math.min(s.startX, s.endX ?? s.startX);
    const x2 = Math.max(s.startX, s.endX ?? s.startX);
    const y1 = Math.min(s.startY, s.endY ?? s.startY);
    const y2 = Math.max(s.startY, s.endY ?? s.startY);
    // A click/badge marker is a point: give it the footprint of its own icon
    const marker = s.type === 'click' || s.type === 'badge' ? Math.max(28, s.strokeWidth * 9) : 0;
    minX = Math.min(minX, x1 - marker);
    maxX = Math.max(maxX, x2 + marker);
    minY = Math.min(minY, y1 - marker);
    maxY = Math.max(maxY, y2 + marker);
  });

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;

  const pad = options?.padding ?? FOCUS_DEFAULT_PADDING;
  const padX = srcWidth * pad;
  const padY = srcHeight * pad;

  const region = normalizeFocusBox(
    {
      x: (minX - padX) / srcWidth,
      y: (minY - padY) / srcHeight,
      width: (maxX - minX + padX * 2) / srcWidth,
      height: (maxY - minY + padY * 2) / srcHeight,
    },
    FOCUS_MIN_SIZE
  );

  return {
    enabled: true,
    mode: options?.mode ?? DEFAULT_FOCUS_MODE,
    ...region,
    auto: true,
    srcWidth,
    srcHeight,
  };
}

/**
 * Clamps a normalized box into the image bounds, enforcing a minimum size and
 * keeping it fully inside 0..1 on both axes.
 */
export function normalizeFocusBox(
  box: { x: number; y: number; width: number; height: number },
  minSize = 0.05
): { x: number; y: number; width: number; height: number } {
  let width = Math.min(1, Math.max(minSize, box.width));
  let height = Math.min(1, Math.max(minSize, box.height));
  // Keep the center while growing, so a tiny click stays centered in the cut
  let x = box.x - (width - box.width) / 2;
  let y = box.y - (height - box.height) / 2;
  x = Math.min(1 - width, Math.max(0, x));
  y = Math.min(1 - height, Math.max(0, y));
  return {
    x: Number(x.toFixed(5)),
    y: Number(y.toFixed(5)),
    width: Number(width.toFixed(5)),
    height: Number(height.toFixed(5)),
  };
}

/**
 * Returns the focus region that should actually be rendered for an image,
 * or null when the complete screenshot must be shown as-is.
 */
export function getEffectiveFocus(image: StepImage): FocusRegion | null {
  const f = image.focusRegion;
  if (!f || !f.enabled) return null;
  if (!(f.width > 0) || !(f.height > 0)) return null;
  // A region covering (almost) the whole capture is the same as no focus at all
  if (f.mode === 'crop' && f.width >= 0.995 && f.height >= 0.995) return null;
  return f;
}

/** True when the image has clicks that a focus region can be derived from. */
export function hasFocusAnchors(image: StepImage): boolean {
  return (image.annotations || []).some((s) => FOCUS_ANCHOR_TYPES.includes(s.type));
}

export interface SupportChannel {
  id: string;
  type: 'phone' | 'chat' | 'email' | 'custom';
  label: string;
  value: string;
}

export interface SupportConfig {
  enabled: boolean;
  title: string;
  description: string;
  channels: SupportChannel[];
  department: string;
  footerNote: string;
}

export interface DocumentTheme {
  primaryColor: string; // e.g. #0a335c (Judicial navy)
  secondaryColor: string; // e.g. #0284c7 (Sky blue)
  accentColor: string; // e.g. #e11d48 (Highlight red)
  badgeBgColor: string; // e.g. #0a335c
  badgeTextColor: string; // e.g. #ffffff
  cardBgColor: string; // e.g. #ffffff
  cardBorderColor: string; // e.g. #e2e8f0
  fontFamily: 'Inter' | 'Segoe UI' | 'Roboto' | 'Arial';
}

export interface DocumentMetadata {
  organization: string; // "NOME DA ORGANIZAÇÃO"
  title: string; // "Gerenciamento de Unidades"
  subtitle: string; // "Manual Prático: Vinculação de Usuários, Titularidades e Gestão de Equipe"
  systemName: string; // "SISTEMA EXEMPLO"
  badgeText: string; // "Guia do Usuário"
  logoUrl?: string | null; // Institutional Logo (Base64 data URL or image path)
  logoHeight?: number; // Height in px for the header (e.g. 56)
  purpose: string; // "Finalidade deste Manual: Orientar os responsáveis..."
  author: string;
  version: string;
  date: string; // "Outubro/2026"
  aiContext?: string; // Explicação prévia do procedimento fornecida pelo usuário para a IA
}

export interface TutorialProject {
  id: string;
  metadata: DocumentMetadata;
  theme: DocumentTheme;
  support: SupportConfig;
  steps: TutorialStep[];
  updatedAt: string;
}

export interface AnnotationItem {
  id: string;
  type: 'rect' | 'arrow' | 'circle' | 'blur' | 'pixelate' | 'badge' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill?: string;
  text?: string;
  badgeNumber?: number;
  blurIntensity?: number;
  frostedOpacity?: number;
  pixelateBlockSize?: number;
}
