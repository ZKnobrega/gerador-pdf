import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Square,
  ArrowUpRight,
  Circle,
  EyeOff,
  Grid3X3,
  Type,
  Check,
  X,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ListOrdered,
  ShieldAlert,
  ShieldCheck,
  MousePointer,
  MousePointerClick,
  Trash2,
  Move,
  Hand,
  Pencil,
  BoxSelect,
  Upload,
  Copy,
  Crosshair,
  ScanSearch,
  Target,
  Expand,
  Frame
} from 'lucide-react';
import { applyFastBoxBlur } from '../utils/canvasBlur';
import {
  ShapeAnnotation,
  EditorTool,
  FocusRegion,
  FocusMode,
  computeFocusRegionFromAnnotations,
  normalizeFocusBox,
  FOCUS_ANCHOR_TYPES,
  DEFAULT_FOCUS_MODE,
} from '../types/tutorial';

export interface ImageEditorModalProps {
  isOpen: boolean;
  imageSrc: string;
  originalImageSrc?: string;
  initialAnnotations?: ShapeAnnotation[];
  initialAltText?: string;
  initialFocusRegion?: FocusRegion | null;
  activeStepAction?: {
    actionType?: 'click' | 'typing' | 'hotkey';
    typedText?: string;
    hotkey?: string;
  };
  onClose: () => void;
  onSave: (
    newImageSrc: string,
    savedAnnotations?: ShapeAnnotation[],
    altText?: string,
    focusRegion?: FocusRegion | null
  ) => void;
  onBatchBlur?: (blurAnnotation: ShapeAnnotation) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  imageSrc,
  originalImageSrc,
  initialAnnotations,
  initialAltText = '',
  initialFocusRegion,
  activeStepAction,
  onClose,
  onSave,
  onBatchBlur,
}) => {
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [strokeColor, setStrokeColor] = useState<string>('#f97316'); // Default action orange
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [fontSize, setFontSize] = useState<number>(16);
  const [nextBadgeNumber, setNextBadgeNumber] = useState<number>(1);
  const [customText, setCustomText] = useState<string>('Clique aqui');
  const [altText, setAltText] = useState<string>(initialAltText);

  // Selection and Dragging State
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState<boolean>(false);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);

  // Blur configuration: radius (8px to 60px) and frosted matte (0% to 80%)
  const [blurIntensity, setBlurIntensity] = useState<number>(28);
  const [frostedOpacity, setFrostedOpacity] = useState<number>(40);

  // Pixelate configuration
  const [pixelateBlockSize, setPixelateBlockSize] = useState<number>(16);

  // Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History for Undo / Redo
  const [history, setHistory] = useState<ShapeAnnotation[][]>([initialAnnotations || []]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentShape, setCurrentShape] = useState<ShapeAnnotation | null>(null);

  // Crop box state
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isCropping, setIsCropping] = useState<boolean>(false);

  // RF-17: Non-destructive focus region ("Foco no Clique")
  // Stored in canvas pixel space while editing; normalized (0..1) only on save.
  const [focusBox, setFocusBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [focusEnabled, setFocusEnabled] = useState<boolean>(true);
  const [focusMode, setFocusMode] = useState<FocusMode>(DEFAULT_FOCUS_MODE);
  const [focusAuto, setFocusAuto] = useState<boolean>(true);
  const [focusShowFull, setFocusShowFull] = useState<boolean>(false);
  const [focusZoom, setFocusZoom] = useState<number>(1);
  const [isDrawingFocus, setIsDrawingFocus] = useState<boolean>(false);
  const [isMovingFocus, setIsMovingFocus] = useState<boolean>(false);
  const [focusHandle, setFocusHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const focusDragOriginRef = useRef<{ x: number; y: number; box: { x: number; y: number; w: number; h: number } } | null>(null);

  // Canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Current annotations from history
  const annotations = history[historyIndex] || [];

  // Color palette presets (Institutional + Status & Branding)
  const colorPresets = [
    { label: 'Laranja Ação', value: '#f97316' },
    { label: 'Vermelho Destaque', value: '#ef4444' },
    { label: 'Azul Marinho', value: '#0a335c' },
    { label: 'Ciano Institucional', value: '#0284c7' },
    { label: 'Verde Sucesso', value: '#16a34a' },
    { label: 'Amarelo Alerta', value: '#f59e0b' },
    { label: 'Roxo', value: '#9333ea' },
    { label: 'Preto', value: '#0f172a' },
    { label: 'Branco', value: '#ffffff' },
  ];

  // Helper to show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Push new state to history
  const pushState = useCallback((newAnnotations: ShapeAnnotation[]) => {
    setHistory((prevHistory) => {
      const updated = prevHistory.slice(0, historyIndex + 1);
      updated.push(newAnnotations);
      return updated;
    });
    setHistoryIndex((prevIndex) => prevIndex + 1);
  }, [historyIndex]);

  // Drag snapshot ref to track changes for history undo
  const dragSnapshotRef = useRef<ShapeAnnotation[] | null>(null);

  // Real-time update handler for Stroke Color
  const handleStrokeColorChange = (newColor: string) => {
    setStrokeColor(newColor);
    if (selectedShapeId) {
      const currentList = history[historyIndex] || [];
      const updated = currentList.map((s) =>
        s.id === selectedShapeId ? { ...s, color: newColor } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time update handler for Stroke Width
  const handleStrokeWidthChange = (newWidth: number) => {
    setStrokeWidth(newWidth);
    if (selectedShapeId) {
      const currentList = history[historyIndex] || [];
      const updated = currentList.map((s) =>
        s.id === selectedShapeId ? { ...s, strokeWidth: newWidth } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time update handler for Font Size
  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    if (selectedShapeId) {
      const currentList = history[historyIndex] || [];
      const updated = currentList.map((s) =>
        s.id === selectedShapeId ? { ...s, fontSize: newSize } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time update handler for Text Content
  const handleCustomTextChange = (newText: string) => {
    setCustomText(newText);
    if (selectedShapeId) {
      const currentList = history[historyIndex] || [];
      const updated = currentList.map((s) =>
        s.id === selectedShapeId ? { ...s, text: newText, label: newText } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time slider update handler for Blur Intensity
  const handleBlurIntensityChange = (newVal: number) => {
    setBlurIntensity(newVal);
    const currentList = history[historyIndex] || [];
    if (selectedShapeId) {
      const updated = currentList.map((s) =>
        s.id === selectedShapeId && s.type === 'blur' ? { ...s, blurIntensity: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    } else if (currentList.some((s) => s.type === 'blur')) {
      const updated = currentList.map((s) =>
        s.type === 'blur' ? { ...s, blurIntensity: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time slider update handler for Frosted Layer Opacity
  const handleFrostedOpacityChange = (newVal: number) => {
    setFrostedOpacity(newVal);
    const currentList = history[historyIndex] || [];
    if (selectedShapeId) {
      const updated = currentList.map((s) =>
        s.id === selectedShapeId && s.type === 'blur' ? { ...s, frostedOpacity: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    } else if (currentList.some((s) => s.type === 'blur')) {
      const updated = currentList.map((s) =>
        s.type === 'blur' ? { ...s, frostedOpacity: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Real-time slider update handler for Pixelate block size
  const handlePixelateBlockSizeChange = (newVal: number) => {
    setPixelateBlockSize(newVal);
    const currentList = history[historyIndex] || [];
    if (selectedShapeId) {
      const updated = currentList.map((s) =>
        s.id === selectedShapeId && s.type === 'pixelate' ? { ...s, pixelateBlockSize: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    } else if (currentList.some((s) => s.type === 'pixelate')) {
      const updated = currentList.map((s) =>
        s.type === 'pixelate' ? { ...s, pixelateBlockSize: newVal } : s
      );
      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
    }
  };

  // Delete currently selected shape
  const handleDeleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;
    const currentList = history[historyIndex] || [];
    const filtered = currentList.filter((s) => s.id !== selectedShapeId);
    setSelectedShapeId(null);
    setIsDraggingShape(false);
    pushState(filtered);
  }, [selectedShapeId, history, historyIndex, pushState]);

  // Nudge selected shape via arrow keys
  const handleNudgeSelectedShape = useCallback((dx: number, dy: number) => {
    if (!selectedShapeId) return;
    const currentList = history[historyIndex] || [];
    const updated = currentList.map((s) => {
      if (s.id !== selectedShapeId) return s;
      if (s.type === 'freehand' && s.points) {
        return {
          ...s,
          startX: s.startX + dx,
          endX: s.endX + dx,
          startY: s.startY + dy,
          endY: s.endY + dy,
          points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        };
      }
      return {
        ...s,
        startX: s.startX + dx,
        endX: s.endX + dx,
        startY: s.startY + dy,
        endY: s.endY + dy,
      };
    });
    pushState(updated);
  }, [selectedShapeId, history, historyIndex, pushState]);

  // Distance from point to line segment
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  // Find shape under cursor (top to bottom)
  const findShapeAtCoords = (x: number, y: number): ShapeAnnotation | null => {
    const list = history[historyIndex] || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const minX = Math.min(s.startX, s.endX);
      const maxX = Math.max(s.startX, s.endX);
      const minY = Math.min(s.startY, s.endY);
      const maxY = Math.max(s.startY, s.endY);

      if (s.type === 'circle') {
        const cx = (s.startX + s.endX) / 2;
        const cy = (s.startY + s.endY) / 2;
        const rx = Math.max(16, Math.abs(s.endX - s.startX) / 2);
        const ry = Math.max(16, Math.abs(s.endY - s.startY) / 2);
        const dist = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
        if (dist <= 1.4) return s;
      } else if (s.type === 'badge') {
        if (Math.hypot(x - s.startX, y - s.startY) <= 36) return s;
      } else if (s.type === 'click') {
        const cx = s.startX;
        const cy = s.startY;
        if (Math.hypot(x - cx, y - cy) <= 36) return s;
        if (x >= cx - 25 && x <= cx + 45 && y >= cy - 25 && y <= cy + 50) return s;
      } else if (s.type === 'arrow') {
        if (distToSegment(x, y, s.startX, s.startY, s.endX, s.endY) <= 20) return s;
      } else if (s.type === 'freehand' && s.points && s.points.length > 0) {
        if (x >= minX - 16 && x <= maxX + 16 && y >= minY - 16 && y <= maxY + 16) {
          for (let p = 0; p < s.points.length - 1; p++) {
            if (distToSegment(x, y, s.points[p].x, s.points[p].y, s.points[p + 1].x, s.points[p + 1].y) <= 16) {
              return s;
            }
          }
        }
      } else {
        // rect, action_box, blur, pixelate, blackout, text
        if (x >= minX - 12 && x <= maxX + 12 && y >= minY - 24 && y <= maxY + 12) {
          return s;
        }
      }
    }
    return null;
  };

  // Check if cursor is on a corner handle of the selected shape
  const getResizeHandleAtCoords = (x: number, y: number, shape: ShapeAnnotation): 'nw' | 'ne' | 'se' | 'sw' | null => {
    let minX = Math.min(shape.startX, shape.endX);
    let maxX = Math.max(shape.startX, shape.endX);
    let minY = Math.min(shape.startY, shape.endY);
    let maxY = Math.max(shape.startY, shape.endY);

    if (shape.type === 'click') {
      minX = shape.startX - 22;
      maxX = shape.startX + 34;
      minY = shape.startY - 22;
      maxY = shape.startY + 42;
    } else if (shape.type === 'badge') {
      minX = shape.startX - 24;
      maxX = shape.startX + 24;
      minY = shape.startY - 24;
      maxY = shape.startY + 24;
    }

    const pad = 6;
    const handleRadius = 18;

    if (Math.hypot(x - (minX - pad), y - (minY - pad)) <= handleRadius) return 'nw';
    if (Math.hypot(x - (maxX + pad), y - (minY - pad)) <= handleRadius) return 'ne';
    if (Math.hypot(x - (maxX + pad), y - (maxY + pad)) <= handleRadius) return 'se';
    if (Math.hypot(x - (minX - pad), y - (maxY + pad)) <= handleRadius) return 'sw';

    return null;
  };

  const calculateFitZoom = useCallback((imgW: number, imgH: number) => {
    const container = containerRef.current;
    if (imgW <= 0 || imgH <= 0) return 1;
    const pad = 48;
    const clientW = container && container.clientWidth > 100 ? container.clientWidth : (window.innerWidth - 360);
    const clientH = container && container.clientHeight > 100 ? container.clientHeight : (window.innerHeight - 220);
    const availW = Math.max(200, clientW - pad);
    const availH = Math.max(200, clientH - pad);
    const scaleW = availW / imgW;
    const scaleH = availH / imgH;
    const fitScale = Math.min(1, Math.min(scaleW, scaleH));
    return Math.max(0.15, Number(fitScale.toFixed(2)));
  }, []);

  // RF-01: Auto-Zoom to Action Coordinates
  const handleAutoZoomToAction = useCallback(() => {
    const list = history[historyIndex] || [];
    // Prioritize action_box or click, or first shape
    const actionShape = list.find((s) => s.type === 'action_box' || s.type === 'click') || list[0];

    const targetX = actionShape
      ? (actionShape.startX + (actionShape.endX ?? actionShape.startX)) / 2
      : imageDims.width / 2;
    const targetY = actionShape
      ? (actionShape.startY + (actionShape.endY ?? actionShape.startY)) / 2
      : imageDims.height / 2;

    const targetZoom = 1.6;
    setZoomLevel(targetZoom);

    setTimeout(() => {
      const container = containerRef.current;
      if (container) {
        const scrollX = targetX * targetZoom - container.clientWidth / 2;
        const scrollY = targetY * targetZoom - container.clientHeight / 2;
        container.scrollTo({
          left: Math.max(0, scrollX),
          top: Math.max(0, scrollY),
          behavior: 'smooth',
        });
      }
    }, 60);

    showToast('🎯 Foco automático centralizado na área de ação!');
  }, [history, historyIndex, imageDims]);

  // High-performance Pixelate algorithm
  const applyPixelateEffect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    blockSize: number = 16
  ) => {
    if (w < 2 || h < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const offW = Math.max(1, Math.round(w / blockSize));
    const offH = Math.max(1, Math.round(h / blockSize));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = offW;
    offCanvas.height = offH;
    const offCtx = offCanvas.getContext('2d');

    if (offCtx) {
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(ctx.canvas, x, y, w, h, 0, 0, offW, offH);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offCanvas, 0, 0, offW, offH, x, y, w, h);
    }

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
  };

  // Draw individual shapes / annotations
  const drawShape = (ctx: CanvasRenderingContext2D, shape: ShapeAnnotation) => {
    ctx.save();

    const minX = Math.min(shape.startX, shape.endX);
    const minY = Math.min(shape.startY, shape.endY);
    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);

    if (shape.type === 'action_box') {
      // RF-04: Action Box (Orange border with subtle highlight and badge)
      const actionColor = shape.color || '#f97316';
      ctx.strokeStyle = actionColor;
      ctx.lineWidth = shape.strokeWidth || 3.5;
      const radius = 8;

      // Soft action tint fill
      ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
      ctx.beginPath();
      ctx.roundRect(minX, minY, width, height, radius);
      ctx.fill();
      ctx.stroke();

      // Top action badge tag
      const label = shape.label || shape.text || '⚡ Ação';
      ctx.font = 'bold 11px sans-serif';
      const textMetrics = ctx.measureText(label);
      const badgeW = textMetrics.width + 16;
      const badgeH = 19;
      const badgeY = Math.max(0, minY - badgeH);

      ctx.fillStyle = actionColor;
      ctx.beginPath();
      ctx.roundRect(minX, badgeY, badgeW, badgeH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, minX + 8, badgeY + badgeH / 2);
    } else if (shape.type === 'rect') {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      const radius = 6;
      ctx.beginPath();
      ctx.roundRect(minX, minY, width, height, radius);
      ctx.stroke();
    } else if (shape.type === 'circle') {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.beginPath();
      const centerX = minX + width / 2;
      const centerY = minY + height / 2;
      ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'arrow') {
      const fromX = shape.startX;
      const fromY = shape.startY;
      const toX = shape.endX;
      const toY = shape.endY;

      const headlen = Math.max(14, shape.strokeWidth * 4);
      const angle = Math.atan2(toY - fromY, toX - fromX);

      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - headlen * Math.cos(angle - Math.PI / 6),
        toY - headlen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toX - headlen * Math.cos(angle + Math.PI / 6),
        toY - headlen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (shape.type === 'freehand' && shape.points && shape.points.length > 0) {
      // RF-09: Freehand Pencil / Brush Drawing
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let p = 1; p < shape.points.length; p++) {
        ctx.lineTo(shape.points[p].x, shape.points[p].y);
      }
      ctx.stroke();
    } else if (shape.type === 'blur') {
      // Powerful Fast Box Blur that completely replaces pixels and obscures text
      applyFastBoxBlur(
        ctx,
        minX,
        minY,
        width,
        height,
        shape.blurIntensity ?? blurIntensity,
        shape.frostedOpacity ?? frostedOpacity
      );
    } else if (shape.type === 'pixelate') {
      applyPixelateEffect(
        ctx,
        minX,
        minY,
        width,
        height,
        shape.pixelateBlockSize || pixelateBlockSize
      );
    } else if (shape.type === 'blackout') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(minX, minY, width, height);
    } else if (shape.type === 'badge') {
      const radius = Math.max(16, shape.strokeWidth * 5);
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.arc(shape.startX, shape.startY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${radius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(shape.badgeNumber || 1), shape.startX, shape.startY + 1);
    } else if (shape.type === 'text') {
      // RF-08: Text Annotations with dynamic font size
      const currentFontSize = shape.fontSize || fontSize || 16;
      const paddingX = 10;
      const paddingY = 6;
      ctx.font = `bold ${currentFontSize}px sans-serif`;
      const text = shape.text || 'Texto';
      const textWidth = ctx.measureText(text).width;
      const boxH = currentFontSize + paddingY * 2;
      const boxW = textWidth + paddingX * 2;

      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.roundRect(shape.startX, shape.startY, boxW, boxH, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, shape.startX + paddingX, shape.startY + boxH / 2);
    } else if (shape.type === 'click') {
      const cx = shape.startX;
      const cy = shape.startY;
      const color = shape.color || '#ef4444';
      const baseRadius = Math.max(16, shape.strokeWidth * 4.5);

      // 1. Concentric pulse ripple circle with subtle background
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = color + '28';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2.5, shape.strokeWidth);
      ctx.stroke();

      // 2. Click wave ripple arcs
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + 6, -Math.PI * 0.9, -Math.PI * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + 12, -Math.PI * 0.85, -Math.PI * 0.5);
      ctx.stroke();

      // 3. Center target point
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // 4. Vector Computer Mouse device (bottom-right of target)
      const mouseX = cx + 8;
      const mouseY = cy + 8;
      const mouseW = 22;
      const mouseH = 30;
      const mouseR = 7;

      // Mouse soft shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(mouseX + 2, mouseY + 2, mouseW, mouseH, mouseR);
      ctx.fill();

      // Mouse body base (clean white)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(mouseX, mouseY, mouseW, mouseH, mouseR);
      ctx.fill();

      // Left Button (CLICKED button - highlighted in bold color!)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(mouseX, mouseY, mouseW / 2, mouseH * 0.45, [mouseR, 0, 0, 0]);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      // Right Button (neutral light slate)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(mouseX + mouseW / 2, mouseY, mouseW / 2, mouseH * 0.45, [0, mouseR, 0, 0]);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.restore();

      // Mouse outer outline
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.roundRect(mouseX, mouseY, mouseW, mouseH, mouseR);
      ctx.stroke();

      // Button dividing lines
      ctx.beginPath();
      ctx.moveTo(mouseX + mouseW / 2, mouseY);
      ctx.lineTo(mouseX + mouseW / 2, mouseY + mouseH * 0.45);
      ctx.moveTo(mouseX, mouseY + mouseH * 0.45);
      ctx.lineTo(mouseX + mouseW, mouseY + mouseH * 0.45);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Scroll wheel
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(mouseX + mouseW / 2 - 1.5, mouseY + 3, 3, 5.5, 1.5);
      ctx.fill();
    }

    ctx.restore();
  };

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const allAnnotations = currentShape ? [...annotations, currentShape] : annotations;
    allAnnotations.forEach((shape) => {
      drawShape(ctx, shape);
    });

    // Draw interactive selection outline & corner handles when a shape is selected
    if (selectedShapeId) {
      const selectedShape = allAnnotations.find((s) => s.id === selectedShapeId);
      if (selectedShape) {
        let minX = Math.min(selectedShape.startX, selectedShape.endX);
        let maxX = Math.max(selectedShape.startX, selectedShape.endX);
        let minY = Math.min(selectedShape.startY, selectedShape.endY);
        let maxY = Math.max(selectedShape.startY, selectedShape.endY);

        if (selectedShape.type === 'click') {
          minX = selectedShape.startX - 22;
          maxX = selectedShape.startX + 34;
          minY = selectedShape.startY - 22;
          maxY = selectedShape.startY + 42;
        } else if (selectedShape.type === 'badge') {
          minX = selectedShape.startX - 24;
          maxX = selectedShape.startX + 24;
          minY = selectedShape.startY - 24;
          maxY = selectedShape.startY + 24;
        }

        const pad = 6;

        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);

        // Corner handles
        const handles = [
          { x: minX - pad, y: minY - pad },
          { x: maxX + pad, y: minY - pad },
          { x: maxX + pad, y: maxY + pad },
          { x: minX - pad, y: maxY + pad },
        ];

        ctx.setLineDash([]);
        handles.forEach((h) => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Small indicator above selection
        if (activeTool === 'select') {
          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Mover / Redimensionar', minX - pad, Math.max(14, minY - pad - 6));
        }

        ctx.restore();
      }
    }

    if (activeTool === 'crop' && cropBox) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, canvas.width, cropBox.y);
      ctx.fillRect(0, cropBox.y + cropBox.h, canvas.width, canvas.height - (cropBox.y + cropBox.h));
      ctx.fillRect(0, cropBox.y, cropBox.x, cropBox.h);
      ctx.fillRect(cropBox.x + cropBox.w, cropBox.y, canvas.width - (cropBox.x + cropBox.w), cropBox.h);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);

      const handleSize = 10;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(cropBox.x - handleSize / 2, cropBox.y - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(cropBox.x + cropBox.w - handleSize / 2, cropBox.y - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(cropBox.x - handleSize / 2, cropBox.y + cropBox.h - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(cropBox.x + cropBox.w - handleSize / 2, cropBox.y + cropBox.h - handleSize / 2, handleSize, handleSize);
    }

    // RF-17: Focus region preview (never baked into the image — overlay only)
    if (focusBox && focusBox.w > 4 && focusBox.h > 4 && (activeTool === 'focus' || focusEnabled)) {
      const isActive = activeTool === 'focus';
      const { x: fx, y: fy, w: fw, h: fh } = focusBox;

      if (isActive) {
        // Dim everything that will be left out of the focused view
        ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
        ctx.fillRect(0, 0, canvas.width, fy);
        ctx.fillRect(0, fy + fh, canvas.width, canvas.height - (fy + fh));
        ctx.fillRect(0, fy, fx, fh);
        ctx.fillRect(fx + fw, fy, canvas.width - (fx + fw), fh);
      }

      ctx.save();
      ctx.strokeStyle = isActive ? '#22d3ee' : 'rgba(34, 211, 238, 0.75)';
      ctx.lineWidth = isActive ? 3 : 2;
      if (!isActive) ctx.setLineDash([10, 7]);
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.setLineDash([]);

      if (isActive) {
        // Rule-of-thirds guides help centering the clicked control
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(fx + (fw / 3) * i, fy);
          ctx.lineTo(fx + (fw / 3) * i, fy + fh);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx, fy + (fh / 3) * i);
          ctx.lineTo(fx + fw, fy + (fh / 3) * i);
          ctx.stroke();
        }

        // Corner handles
        const corners = [
          { x: fx, y: fy },
          { x: fx + fw, y: fy },
          { x: fx + fw, y: fy + fh },
          { x: fx, y: fy + fh },
        ];
        corners.forEach((c) => {
          ctx.beginPath();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0891b2';
          ctx.lineWidth = 2.5;
          ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Badge with the current state of the region
        const label = focusAuto ? 'FOCO AUTOMÁTICO NO CLIQUE' : 'FOCO MANUAL';
        ctx.font = 'bold 12px sans-serif';
        const tw = ctx.measureText(label).width;
        const by = Math.max(0, fy - 26);
        ctx.fillStyle = focusAuto ? 'rgba(8, 145, 178, 0.95)' : 'rgba(217, 119, 6, 0.95)';
        ctx.fillRect(fx, by, tw + 16, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, fx + 8, by + 15);
      }
      ctx.restore();
    }
  }, [annotations, currentShape, activeTool, cropBox, blurIntensity, frostedOpacity, pixelateBlockSize, selectedShapeId, fontSize, focusBox, focusEnabled, focusAuto]);

  const handleFitToScreen = useCallback(() => {
    if (!baseImageRef.current) return;
    const fit = calculateFitZoom(baseImageRef.current.naturalWidth, baseImageRef.current.naturalHeight);
    setZoomLevel(fit);
  }, [calculateFitZoom]);

  // Load image once on modal open or imageSrc change
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImageRef.current = img;
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      const initial = initialAnnotations && Array.isArray(initialAnnotations) ? initialAnnotations : [];
      setHistory([initial]);
      setHistoryIndex(0);
      const fit = calculateFitZoom(img.naturalWidth, img.naturalHeight);
      setZoomLevel(fit);
      setCropBox(null);
      setSelectedShapeId(initial.length > 0 ? initial[initial.length - 1].id : null);
      setAltText(initialAltText || '');

      // RF-17: restore a previously saved focus region, or arm the automatic one
      const f = initialFocusRegion;
      if (f && f.width > 0 && f.height > 0) {
        setFocusEnabled(f.enabled !== false);
        setFocusMode(f.mode || DEFAULT_FOCUS_MODE);
        setFocusAuto(f.auto !== false);
        setFocusShowFull(!!f.showFull);
        setFocusZoom(f.zoom || 1);
        setFocusBox({
          x: f.x * img.naturalWidth,
          y: f.y * img.naturalHeight,
          w: f.width * img.naturalWidth,
          h: f.height * img.naturalHeight,
        });
      } else {
        setFocusEnabled(true);
        setFocusMode(DEFAULT_FOCUS_MODE);
        setFocusAuto(true);
        setFocusShowFull(false);
        setFocusZoom(1);
        setFocusBox(null);
      }
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  /**
   * RF-17: Automatic focus on the click.
   * While the region is in "auto" mode it keeps tracking the click / action
   * annotations, so marking a click is enough to focus the screenshot — the user
   * only touches the handles when they want a different framing.
   */
  useEffect(() => {
    if (!isOpen || !focusAuto) return;
    if (!imageDims.width || !imageDims.height) return;

    const auto = computeFocusRegionFromAnnotations(annotations, imageDims.width, imageDims.height);
    if (!auto) {
      setFocusBox(null);
      return;
    }
    setFocusBox({
      x: auto.x * imageDims.width,
      y: auto.y * imageDims.height,
      w: auto.width * imageDims.width,
      h: auto.height * imageDims.height,
    });
  }, [isOpen, focusAuto, annotations, imageDims.width, imageDims.height]);

  /** Normalized region currently configured, or null when there is nothing to focus. */
  const buildFocusRegion = useCallback((): FocusRegion | null => {
    if (!focusBox || focusBox.w < 8 || focusBox.h < 8) return null;
    if (!imageDims.width || !imageDims.height) return null;
    const box = normalizeFocusBox({
      x: focusBox.x / imageDims.width,
      y: focusBox.y / imageDims.height,
      width: focusBox.w / imageDims.width,
      height: focusBox.h / imageDims.height,
    });
    return {
      enabled: focusEnabled,
      mode: focusMode,
      ...box,
      auto: focusAuto,
      zoom: focusZoom,
      showFull: focusShowFull,
      srcWidth: imageDims.width,
      srcHeight: imageDims.height,
    };
  }, [focusBox, imageDims, focusEnabled, focusMode, focusAuto, focusZoom, focusShowFull]);

  /** Recomputes the region from the clicks (re-arms "auto" mode). */
  const handleFocusOnClicks = () => {
    const auto = computeFocusRegionFromAnnotations(annotations, imageDims.width, imageDims.height);
    if (!auto) {
      showToast('⚠️ Marque um clique ou uma caixa de ação para gerar o foco automático.');
      return;
    }
    setFocusAuto(true);
    setFocusEnabled(true);
    setFocusBox({
      x: auto.x * imageDims.width,
      y: auto.y * imageDims.height,
      w: auto.width * imageDims.width,
      h: auto.height * imageDims.height,
    });
    setActiveTool('focus');
    showToast('🎯 Foco recalculado automaticamente sobre os cliques!');
  };

  /** Detects which focus handle is under the cursor (canvas pixel space). */
  const getFocusHandleAt = (x: number, y: number): 'nw' | 'ne' | 'se' | 'sw' | null => {
    if (!focusBox) return null;
    const r = Math.max(10, 14 / Math.max(zoomLevel, 0.2));
    const corners: { id: 'nw' | 'ne' | 'se' | 'sw'; x: number; y: number }[] = [
      { id: 'nw', x: focusBox.x, y: focusBox.y },
      { id: 'ne', x: focusBox.x + focusBox.w, y: focusBox.y },
      { id: 'se', x: focusBox.x + focusBox.w, y: focusBox.y + focusBox.h },
      { id: 'sw', x: focusBox.x, y: focusBox.y + focusBox.h },
    ];
    for (const c of corners) {
      if (Math.hypot(x - c.x, y - c.y) <= r) return c.id;
    }
    return null;
  };

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, annotations, currentShape, cropBox, blurIntensity, frostedOpacity, pixelateBlockSize, selectedShapeId, fontSize, focusBox, focusEnabled, focusAuto]);

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Space for Pan, Escape, Delete, Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.code === 'Space' && !isSpacePressed) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        if (activeTool === 'focus') {
          setActiveTool('select');
        } else if (activeTool === 'crop') {
          setActiveTool('select');
          setCropBox(null);
        } else if (selectedShapeId) {
          setSelectedShapeId(null);
        } else {
          onClose();
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleDeleteSelectedShape();
      } else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        setActiveTool('pan');
      } else if (selectedShapeId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 2;
        const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
        const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
        handleNudgeSelectedShape(dx, dy);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
        setPanStart(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isSpacePressed, historyIndex, history.length, activeTool, selectedShapeId, handleDeleteSelectedShape, handleNudgeSelectedShape]);

  // Coordinates helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // RF-02: Pan handlers on container
  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'pan' || isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      const container = containerRef.current;
      if (container) {
        setPanStart({
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        });
      }
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStart && containerRef.current) {
      e.preventDefault();
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      containerRef.current.scrollLeft = panStart.scrollLeft - dx;
      containerRef.current.scrollTop = panStart.scrollTop - dy;
    }
  };

  const handleContainerMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
  };

  // Canvas Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan' || isSpacePressed || e.button === 1) {
      return; // Handled by container pan
    }

    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'crop') {
      setIsCropping(true);
      setCropBox({ x, y, w: 0, h: 0 });
      return;
    }

    // RF-17: Focus region — resize by the corners, drag to reframe, or draw a new one
    if (activeTool === 'focus') {
      const handle = getFocusHandleAt(x, y);
      if (handle && focusBox) {
        setFocusHandle(handle);
        setFocusAuto(false);
        focusDragOriginRef.current = { x, y, box: { ...focusBox } };
        return;
      }
      if (
        focusBox &&
        x >= focusBox.x &&
        x <= focusBox.x + focusBox.w &&
        y >= focusBox.y &&
        y <= focusBox.y + focusBox.h
      ) {
        setIsMovingFocus(true);
        setFocusAuto(false);
        focusDragOriginRef.current = { x, y, box: { ...focusBox } };
        return;
      }
      setIsDrawingFocus(true);
      setFocusAuto(false);
      setFocusEnabled(true);
      setFocusBox({ x, y, w: 0, h: 0 });
      focusDragOriginRef.current = { x, y, box: { x, y, w: 0, h: 0 } };
      return;
    }

    // 1. Check if clicking on resize handle of currently selected shape
    if (selectedShapeId) {
      const sel = annotations.find((s) => s.id === selectedShapeId);
      if (sel) {
        const handle = getResizeHandleAtCoords(x, y, sel);
        if (handle) {
          setResizeHandle(handle);
          setIsDraggingShape(true);
          setDragStartCoords({ x, y });
          dragSnapshotRef.current = annotations;
          return;
        }
      }
    }

    // 2. Check if clicked directly on an existing shape -> Select & Start Dragging!
    const found = findShapeAtCoords(x, y);
    if (found) {
      setSelectedShapeId(found.id);
      setIsDraggingShape(true);
      setResizeHandle(null);
      setDragStartCoords({ x, y });
      dragSnapshotRef.current = annotations;

      if (found.color) setStrokeColor(found.color);
      if (found.strokeWidth) setStrokeWidth(found.strokeWidth);
      if (found.fontSize) setFontSize(found.fontSize);
      if (found.text) setCustomText(found.text);
      if (found.blurIntensity !== undefined) setBlurIntensity(found.blurIntensity);
      if (found.frostedOpacity !== undefined) setFrostedOpacity(found.frostedOpacity);
      if (found.pixelateBlockSize !== undefined) setPixelateBlockSize(found.pixelateBlockSize);
      return;
    }

    if (activeTool === 'select') {
      // Clicked on empty space in select mode -> Deselect
      setSelectedShapeId(null);
      setIsDraggingShape(false);
      setResizeHandle(null);
      setDragStartCoords(null);
      dragSnapshotRef.current = null;
      return;
    }

    // RF-04: Action Box (Stamp default or start drawing box)
    if (activeTool === 'action_box') {
      setIsDrawing(true);
      const newShapeId = `action-box-${Date.now()}`;
      setCurrentShape({
        id: newShapeId,
        type: 'action_box',
        startX: Math.round(x),
        startY: Math.round(y),
        endX: Math.round(x + 120),
        endY: Math.round(y + 45),
        color: '#f97316',
        strokeWidth: 3.5,
        label: '⚡ Ação',
      });
      return;
    }

    // RF-09: Freehand Pencil / Brush Drawing
    if (activeTool === 'freehand') {
      setIsDrawing(true);
      const newShapeId = `freehand-${Date.now()}`;
      setCurrentShape({
        id: newShapeId,
        type: 'freehand',
        startX: Math.round(x),
        startY: Math.round(y),
        endX: Math.round(x),
        endY: Math.round(y),
        points: [{ x: Math.round(x), y: Math.round(y) }],
        color: strokeColor,
        strokeWidth: Math.max(3, strokeWidth),
      });
      return;
    }

    // Stamp tools
    if (activeTool === 'click') {
      const newShape: ShapeAnnotation = {
        id: `click-${Date.now()}`,
        type: 'click',
        startX: Math.round(x),
        startY: Math.round(y),
        endX: Math.round(x + 28),
        endY: Math.round(y + 36),
        color: strokeColor,
        strokeWidth,
      };
      pushState([...annotations, newShape]);
      setSelectedShapeId(newShape.id);
      return;
    }

    if (activeTool === 'badge') {
      const newShape: ShapeAnnotation = {
        id: `badge-${Date.now()}`,
        type: 'badge',
        startX: Math.round(x),
        startY: Math.round(y),
        endX: Math.round(x),
        endY: Math.round(y),
        color: strokeColor,
        strokeWidth,
        badgeNumber: nextBadgeNumber,
      };
      setNextBadgeNumber(nextBadgeNumber + 1);
      pushState([...annotations, newShape]);
      setSelectedShapeId(newShape.id);
      return;
    }

    if (activeTool === 'text') {
      const newShape: ShapeAnnotation = {
        id: `text-${Date.now()}`,
        type: 'text',
        startX: Math.round(x),
        startY: Math.round(y),
        endX: Math.round(x),
        endY: Math.round(y),
        color: strokeColor,
        strokeWidth,
        fontSize,
        text: customText,
      };
      pushState([...annotations, newShape]);
      setSelectedShapeId(newShape.id);
      return;
    }

    // Drawing drag tools: rect, circle, arrow, blur, pixelate
    setIsDrawing(true);
    const newShapeId = `shape-${Date.now()}`;
    setCurrentShape({
      id: newShapeId,
      type: activeTool,
      startX: Math.round(x),
      startY: Math.round(y),
      endX: Math.round(x),
      endY: Math.round(y),
      color: strokeColor,
      strokeWidth,
      fontSize,
      blurIntensity,
      frostedOpacity,
      pixelateBlockSize,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return;
    const { x, y } = getCanvasCoords(e);

    if (isDraggingShape && selectedShapeId && dragStartCoords) {
      const dx = Math.round(x - dragStartCoords.x);
      const dy = Math.round(y - dragStartCoords.y);
      if (dx === 0 && dy === 0) return;

      const currentList = history[historyIndex] || [];
      const updated = currentList.map((s) => {
        if (s.id !== selectedShapeId) return s;

        if (resizeHandle) {
          let { startX, startY, endX, endY } = s;
          if (resizeHandle === 'nw') {
            startX += dx;
            startY += dy;
          } else if (resizeHandle === 'ne') {
            endX += dx;
            startY += dy;
          } else if (resizeHandle === 'se') {
            endX += dx;
            endY += dy;
          } else if (resizeHandle === 'sw') {
            startX += dx;
            endY += dy;
          }
          return { ...s, startX, startY, endX, endY };
        } else {
          // Drag whole shape
          if (s.type === 'freehand' && s.points) {
            return {
              ...s,
              startX: s.startX + dx,
              endX: s.endX + dx,
              startY: s.startY + dy,
              endY: s.endY + dy,
              points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return {
            ...s,
            startX: s.startX + dx,
            endX: s.endX + dx,
            startY: s.startY + dy,
            endY: s.endY + dy,
          };
        }
      });

      const newHistory = [...history];
      newHistory[historyIndex] = updated;
      setHistory(newHistory);
      setDragStartCoords({ x, y });
      return;
    }

    // RF-17: Focus region interactions
    if (activeTool === 'focus') {
      const origin = focusDragOriginRef.current;
      const maxW = imageDims.width;
      const maxH = imageDims.height;

      if (isDrawingFocus && origin) {
        setFocusBox({
          x: Math.max(0, Math.min(origin.x, x)),
          y: Math.max(0, Math.min(origin.y, y)),
          w: Math.min(maxW, Math.abs(x - origin.x)),
          h: Math.min(maxH, Math.abs(y - origin.y)),
        });
        return;
      }

      if (isMovingFocus && origin) {
        const dx = x - origin.x;
        const dy = y - origin.y;
        setFocusBox({
          x: Math.max(0, Math.min(maxW - origin.box.w, origin.box.x + dx)),
          y: Math.max(0, Math.min(maxH - origin.box.h, origin.box.y + dy)),
          w: origin.box.w,
          h: origin.box.h,
        });
        return;
      }

      if (focusHandle && origin) {
        const b = origin.box;
        const right = b.x + b.w;
        const bottom = b.y + b.h;
        const cx = Math.max(0, Math.min(maxW, x));
        const cy = Math.max(0, Math.min(maxH, y));
        let nx = b.x;
        let ny = b.y;
        let nw = b.w;
        let nh = b.h;

        if (focusHandle === 'nw') {
          nx = Math.min(cx, right - 20);
          ny = Math.min(cy, bottom - 20);
          nw = right - nx;
          nh = bottom - ny;
        } else if (focusHandle === 'ne') {
          ny = Math.min(cy, bottom - 20);
          nw = Math.max(20, cx - b.x);
          nh = bottom - ny;
        } else if (focusHandle === 'se') {
          nw = Math.max(20, cx - b.x);
          nh = Math.max(20, cy - b.y);
        } else if (focusHandle === 'sw') {
          nx = Math.min(cx, right - 20);
          nw = right - nx;
          nh = Math.max(20, cy - b.y);
        }

        setFocusBox({ x: nx, y: ny, w: Math.min(nw, maxW - nx), h: Math.min(nh, maxH - ny) });
        return;
      }
      return;
    }

    if (activeTool === 'crop' && isCropping && cropBox) {
      setCropBox({
        x: Math.min(cropBox.x, x),
        y: Math.min(cropBox.y, y),
        w: Math.abs(x - cropBox.x),
        h: Math.abs(y - cropBox.y),
      });
      return;
    }

    if (!isDrawing || !currentShape) return;

    if (currentShape.type === 'freehand') {
      const currentPts = currentShape.points || [];
      const newPt = { x: Math.round(x), y: Math.round(y) };
      const minX = Math.min(currentShape.startX, newPt.x);
      const maxX = Math.max(currentShape.endX, newPt.x);
      const minY = Math.min(currentShape.startY, newPt.y);
      const maxY = Math.max(currentShape.endY, newPt.y);

      setCurrentShape({
        ...currentShape,
        startX: minX,
        endX: maxX,
        startY: minY,
        endY: maxY,
        points: [...currentPts, newPt],
      });
      return;
    }

    setCurrentShape({
      ...currentShape,
      endX: Math.round(x),
      endY: Math.round(y),
    });
  };

  const handleMouseUp = () => {
    if (isDraggingShape) {
      setIsDraggingShape(false);
      setResizeHandle(null);
      setDragStartCoords(null);
      if (dragSnapshotRef.current && dragSnapshotRef.current !== annotations) {
        const updatedHistory = history.slice(0, historyIndex);
        updatedHistory.push(dragSnapshotRef.current);
        updatedHistory.push(annotations);
        setHistory(updatedHistory);
        setHistoryIndex(updatedHistory.length - 1);
      }
      dragSnapshotRef.current = null;
      return;
    }

    if (activeTool === 'crop') {
      setIsCropping(false);
      return;
    }

    // RF-17: finish focus drag / draw
    if (activeTool === 'focus') {
      if (isDrawingFocus && focusBox && (focusBox.w < 20 || focusBox.h < 20)) {
        // Too small to be a real framing: fall back to the automatic region
        setFocusAuto(true);
        showToast('🎯 Área muito pequena — voltando ao foco automático no clique.');
      }
      setIsDrawingFocus(false);
      setIsMovingFocus(false);
      setFocusHandle(null);
      focusDragOriginRef.current = null;
      return;
    }

    if (!isDrawing || !currentShape) return;

    setIsDrawing(false);

    if (currentShape.type === 'freehand') {
      if (currentShape.points && currentShape.points.length > 1) {
        pushState([...annotations, currentShape]);
        setSelectedShapeId(currentShape.id);
      }
      setCurrentShape(null);
      return;
    }

    const dist = Math.hypot(
      currentShape.endX - currentShape.startX,
      currentShape.endY - currentShape.startY
    );
    if (dist > 3) {
      pushState([...annotations, currentShape]);
      setSelectedShapeId(currentShape.id);
    }
    setCurrentShape(null);
  };

  // Global mouseup listener to guarantee drags and drawings always release
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingShape || isDrawing || isCropping || isDrawingFocus || isMovingFocus || focusHandle) {
        handleMouseUp();
      }
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDraggingShape, isDrawing, isCropping, isPanning, isDrawingFocus, isMovingFocus, focusHandle, annotations, currentShape, history, historyIndex]);

  // RF-03: Apply Crop
  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img || !cropBox || cropBox.w < 10 || cropBox.h < 10) return;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropBox.w;
    croppedCanvas.height = cropBox.h;
    const cCtx = croppedCanvas.getContext('2d');
    if (!cCtx) return;

    cCtx.drawImage(
      canvas,
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h,
      0,
      0,
      cropBox.w,
      cropBox.h
    );

    const croppedDataUrl = croppedCanvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
      baseImageRef.current = newImg;
      setImageDims({ width: newImg.naturalWidth, height: newImg.naturalHeight });
      setHistory([[]]);
      setHistoryIndex(0);
      setCropBox(null);
      setFocusBox(null);
      setFocusAuto(true);
      setActiveTool('select');
      renderCanvas();
      showToast('✂️ Recorte definitivo aplicado! (a imagem completa foi substituída)');
    };
    newImg.src = croppedDataUrl;
  };

  // RNF-01: Revert all edits and restore original raw image
  const handleResetToOriginal = () => {
    const targetSource = originalImageSrc || imageSrc;
    if (window.confirm('Deseja restaurar a captura de tela original em resolução completa e descartar os recortes?')) {
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
        setHistory([[]]);
        setHistoryIndex(0);
        setCropBox(null);
        setFocusBox(null);
        setFocusAuto(true);
        setFocusEnabled(true);
        setSelectedShapeId(null);
        const fit = calculateFitZoom(img.naturalWidth, img.naturalHeight);
        setZoomLevel(fit);
        renderCanvas();
        showToast('↺ Imagem original restaurada!');
      };
      img.src = targetSource;
    }
  };

  // RF-12: Batch Blur replication
  const handleReplicateBlurToAllSteps = () => {
    const sel = annotations.find((s) => s.id === selectedShapeId);
    const targetBlur = sel && (sel.type === 'blur' || sel.type === 'pixelate')
      ? sel
      : annotations.find((s) => s.type === 'blur' || s.type === 'pixelate');

    if (!targetBlur) {
      alert('Selecione ou adicione uma área de desfoque ou mosaico primeiro para replicar.');
      return;
    }

    if (onBatchBlur) {
      onBatchBlur(targetBlur);
      showToast('🔁 Desfoque replicado com sucesso em todas as capturas do guia!');
    } else {
      showToast('✓ Desfoque memorizado para todas as telas!');
    }
  };

  // RF-14: Auto-detect PII (Auto-Censura Inteligente)
  const handleAutoCensorPII = () => {
    // If step has typed text or action coordinates, target that region
    let targetX = imageDims.width * 0.35;
    let targetY = imageDims.height * 0.45;
    let targetW = 240;
    let targetH = 48;

    if (activeStepAction?.actionType === 'typing' && activeStepAction.typedText) {
      // Find click or action location if any
      const existingClick = annotations.find((s) => s.type === 'click');
      if (existingClick) {
        targetX = Math.max(10, existingClick.startX - 20);
        targetY = Math.max(10, existingClick.startY - 15);
        targetW = Math.max(200, (activeStepAction.typedText.length * 12) + 40);
        targetH = 45;
      }
    }

    const piiBlurShape: ShapeAnnotation = {
      id: `pii-blur-${Date.now()}`,
      type: 'blur',
      startX: Math.round(targetX),
      startY: Math.round(targetY),
      endX: Math.round(targetX + targetW),
      endY: Math.round(targetY + targetH),
      color: '#ef4444',
      strokeWidth: 2,
      blurIntensity: 36,
      frostedOpacity: 50,
    };

    pushState([...annotations, piiBlurShape]);
    setSelectedShapeId(piiBlurShape.id);
    showToast('🛡️ Área de dados sensíveis censurada com desfoque!');
  };

  // RF-16: Image replacement via file upload or paste
  const handleReplaceImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newBase64 = event.target?.result as string;
      if (newBase64) {
        const img = new Image();
        img.onload = () => {
          baseImageRef.current = img;
          setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
          const fit = calculateFitZoom(img.naturalWidth, img.naturalHeight);
          setZoomLevel(fit);
          renderCanvas();
          showToast('🖼️ Imagem substituída com sucesso mantendo as anotações!');
        };
        img.src = newBase64;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Clipboard paste listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const pastedSrc = event.target?.result as string;
              if (pastedSrc) {
                const img = new Image();
                img.onload = () => {
                  baseImageRef.current = img;
                  setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
                  const fit = calculateFitZoom(img.naturalWidth, img.naturalHeight);
                  setZoomLevel(fit);
                  renderCanvas();
                  showToast('📋 Screenshot colado da área de transferência!');
                };
                img.src = pastedSrc;
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, calculateFitZoom, renderCanvas]);

  // Final Save (Non-destructive: clean rendering on offscreen canvas without selection outlines)
  const handleSave = () => {
    const img = baseImageRef.current;
    if (!img) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = img.naturalWidth;
    offCanvas.height = img.naturalHeight;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0);
    annotations.forEach((shape) => {
      drawShape(offCtx, shape);
    });

    const finalDataUrl = offCanvas.toDataURL('image/png');
    // RF-17: the focus region travels as metadata — the saved image is always complete
    onSave(finalDataUrl, annotations, altText, buildFocusRegion());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 modal-overlay">
      <div className="flex flex-col h-[95vh] w-[98vw] max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg shadow-sm">
              <BoxSelect className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Editor de Captura & Anotações
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full border border-orange-400/30">
                  Camadas Não-Destrutivas
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Caixas de ação, auto-zoom, setas, blur com proteção anti-transparência e recorte
              </p>
            </div>
          </div>

          {/* Quick Actions (Undo, Redo, Zoom, Auto-Zoom, Replace, Reset, Close) */}
          <div className="flex items-center gap-2.5">
            {/* Undo / Redo */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-700 rounded transition"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-700 rounded transition"
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls & RF-01 Auto-Zoom */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.15, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2 text-slate-300 min-w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleFitToScreen}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition text-xs flex items-center gap-1"
                title="Ajustar Imagem à Tela"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline font-medium">Ajustar</span>
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition text-xs font-mono"
                title="Tamanho Real (1:1)"
              >
                1:1
              </button>

              {/* RF-01: Auto-Zoom to Action Button */}
              <button
                onClick={handleAutoZoomToAction}
                className="ml-1 px-2 py-1 bg-orange-600/90 hover:bg-orange-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs transition"
                title="Auto-Zoom: Aproximar e centralizar exatamente no ponto de clique ou ação"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Focar na Ação</span>
              </button>
            </div>

            {/* RF-16: Substituir Imagem */}
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium cursor-pointer transition"
              title="Substituir captura por upload externo ou cole com Ctrl+V"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Substituir</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReplaceImageFile}
                className="hidden"
              />
            </label>

            {/* RNF-01: Reset / Restore Original */}
            <button
              onClick={handleResetToOriginal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-950/50 border border-rose-800/60 rounded-lg transition"
              title="Restaurar captura original e desfazer recortes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Original</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Work Area */}
        <div className="flex flex-1 overflow-hidden bg-slate-900 relative">
          {/* Toast Notification Pill */}
          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 text-white px-4 py-2 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-semibold backdrop-blur animate-fade-in">
              <span className="text-amber-400">⚡</span>
              {toastMessage}
            </div>
          )}

          {/* Left Vertical Tool Selector */}
          <div className="w-20 bg-slate-850 border-r border-slate-800 flex flex-col items-center py-3 gap-1.5 overflow-y-auto shrink-0 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Ações
            </span>

            {/* RF-04: Action Box Tool */}
            <button
              onClick={() => setActiveTool('action_box')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'action_box'
                  ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-orange-300'
              }`}
              title="Caixa de Ação Inteligente (Borda Laranja com Etiqueta)"
            >
              <BoxSelect className="w-5 h-5" />
              <span className="text-[9px] font-bold">Ação</span>
            </button>

            {/* Select & Move Tool */}
            <button
              onClick={() => setActiveTool('select')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'select'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Selecionar e Mover Elementos (V)"
            >
              <MousePointer className="w-5 h-5" />
              <span className="text-[9px]">Mover (V)</span>
            </button>

            {/* RF-02: Pan Tool (Mãozinha) */}
            <button
              onClick={() => setActiveTool('pan')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'pan' || isSpacePressed
                  ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Arrastar e Mover Tela (H ou segure Barra de Espaço)"
            >
              <Hand className="w-5 h-5" />
              <span className="text-[9px]">Pan (Espaço)</span>
            </button>

            {/* Rect Tool */}
            <button
              onClick={() => setActiveTool('rect')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'rect'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Retângulo de Destaque"
            >
              <Square className="w-5 h-5" />
              <span className="text-[9px]">Caixa</span>
            </button>

            {/* Circle / Ellipse Tool */}
            <button
              onClick={() => setActiveTool('circle')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'circle'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Elipse / Círculo de Destaque"
            >
              <Circle className="w-5 h-5" />
              <span className="text-[9px]">Círculo</span>
            </button>

            {/* Arrow Tool */}
            <button
              onClick={() => setActiveTool('arrow')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'arrow'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Seta Apontadora Direcional"
            >
              <ArrowUpRight className="w-5 h-5" />
              <span className="text-[9px]">Seta</span>
            </button>

            {/* RF-09: Freehand Pencil / Brush Tool */}
            <button
              onClick={() => setActiveTool('freehand')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'freehand'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Desenho à Mão Livre / Lápis / Pincel"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-[9px]">Lápis</span>
            </button>

            {/* Mouse Click Tool */}
            <button
              onClick={() => setActiveTool('click')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'click'
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Ícone de Clique do Mouse com Destaque"
            >
              <MousePointerClick className="w-5 h-5" />
              <span className="text-[9px]">Clique</span>
            </button>

            <div className="w-12 h-px bg-slate-800 my-1" />

            {/* Blur Tool with Badge Indicator */}
            <button
              onClick={() => setActiveTool('blur')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition relative ${
                activeTool === 'blur'
                  ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Censura com Desfoque (Nível e Película Fosca Ajustáveis)"
            >
              <EyeOff className="w-5 h-5" />
              <span className="text-[9px]">Blur</span>
              <span className="text-[9px] font-bold text-amber-300 font-mono">
                {blurIntensity}px
              </span>
            </button>

            {/* Pixelate Tool */}
            <button
              onClick={() => setActiveTool('pixelate')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'pixelate'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Censura com Mosaico"
            >
              <Grid3X3 className="w-5 h-5" />
              <span className="text-[9px]">Mosaico</span>
            </button>

            {/* Step Badge Stamp */}
            <button
              onClick={() => setActiveTool('badge')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'badge'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Carimbo de Passo Numérico (1, 2, 3...)"
            >
              <ListOrdered className="w-5 h-5" />
              <span className="text-[9px]">Passo ({nextBadgeNumber})</span>
            </button>

            {/* Text Callout */}
            <button
              onClick={() => setActiveTool('text')}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'text'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Texto Flutuante / Caixa de Texto"
            >
              <Type className="w-5 h-5" />
              <span className="text-[9px]">Texto</span>
            </button>

            {/* RF-17: Focus Region Tool (non-destructive) */}
            <button
              onClick={() => {
                setActiveTool('focus');
                if (!focusBox) handleFocusOnClicks();
              }}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'focus'
                  ? 'bg-cyan-600 text-white shadow-md ring-2 ring-cyan-400/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
              }`}
              title="Foco no Clique: destaca a área importante no PDF sem cortar a imagem (reversível)"
            >
              <ScanSearch className="w-5 h-5" />
              <span className="text-[9px] font-bold">Foco</span>
            </button>

            {/* Crop Tool */}
            <button
              onClick={() => {
                setActiveTool('crop');
                setCropBox(null);
              }}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 w-16 transition ${
                activeTool === 'crop'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Recortar Imagem Livremente"
            >
              <Crop className="w-5 h-5" />
              <span className="text-[9px]">Recortar</span>
            </button>
          </div>

          {/* Central Canvas Viewport with Pan Support */}
          <div
            ref={containerRef}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                setZoomLevel((prev) => Math.max(0.15, Math.min(3.0, Number((prev + delta).toFixed(2)))));
              }
            }}
            className={`flex-1 bg-slate-950 flex items-center justify-center p-6 overflow-auto relative select-none ${
              activeTool === 'pan' || isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={{
              backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <div
              style={{
                width: `${Math.round(imageDims.width * zoomLevel)}px`,
                height: `${Math.round(imageDims.height * zoomLevel)}px`,
              }}
              className="shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white relative shrink-0 transition-[width,height] duration-75"
            >
              <canvas
                ref={canvasRef}
                width={imageDims.width}
                height={imageDims.height}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`max-w-none block ${
                  activeTool === 'pan' || isSpacePressed
                    ? isPanning ? 'cursor-grabbing' : 'cursor-grab'
                    : activeTool === 'crop'
                    ? 'cursor-crosshair'
                    : activeTool === 'focus'
                    ? isMovingFocus
                      ? 'cursor-grabbing'
                      : 'cursor-crosshair'
                    : activeTool === 'badge' || activeTool === 'click'
                    ? 'cursor-pointer'
                    : activeTool === 'select'
                    ? 'cursor-default'
                    : 'cursor-crosshair'
                }`}
              />
            </div>

            {/* Crop Action Floating Bar */}
            {activeTool === 'crop' && cropBox && cropBox.w > 10 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl px-5 py-2.5 flex items-center gap-4 shadow-xl z-20">
                <span className="text-xs text-slate-300 font-medium">
                  Área selecionada: {Math.round(cropBox.w)} × {Math.round(cropBox.h)} px
                </span>
                <button
                  onClick={handleApplyCrop}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Recorte
                </button>
                <button
                  onClick={() => {
                    setCropBox(null);
                    setActiveTool('select');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              </div>
            )}

            {/* RF-17: Focus Region Floating Bar */}
            {activeTool === 'focus' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur border border-cyan-800/70 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xl z-20 max-w-[95%] flex-wrap justify-center">
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <ScanSearch className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Foco no Clique</span>
                </div>

                {focusBox ? (
                  <span className="text-[11px] text-slate-300 font-mono">
                    {Math.round(focusBox.w)} × {Math.round(focusBox.h)} px
                    {focusAuto ? ' • automático' : ' • manual'}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-300">
                    Marque um clique ou arraste para definir a área
                  </span>
                )}

                <div className="h-5 w-px bg-slate-700" />

                {/* Mode selector */}
                <div className="flex items-center gap-1">
                  {([
                    { id: 'crop' as FocusMode, label: 'Recorte', icon: <Frame className="w-3.5 h-3.5" />, hint: 'Mostra apenas a área do clique no PDF' },
                    { id: 'spotlight' as FocusMode, label: 'Holofote', icon: <Target className="w-3.5 h-3.5" />, hint: 'Mostra a tela inteira e escurece o resto' },
                    { id: 'inset' as FocusMode, label: 'Lupa', icon: <Expand className="w-3.5 h-3.5" />, hint: 'Tela inteira + detalhe ampliado abaixo' },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setFocusMode(m.id);
                        setFocusEnabled(true);
                      }}
                      title={m.hint}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                        focusMode === m.id && focusEnabled
                          ? 'bg-cyan-600 text-white shadow'
                          : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-700" />

                <button
                  onClick={handleFocusOnClicks}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold rounded-lg transition"
                  title="Recalcular a área automaticamente a partir dos cliques marcados"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Focar nos Cliques
                </button>

                <button
                  onClick={() => {
                    setFocusEnabled(false);
                    setActiveTool('select');
                    showToast('🖼️ Foco removido — o PDF usará a imagem completa.');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium rounded-lg transition"
                  title="Voltar a usar a captura completa no PDF"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Imagem Completa
                </button>
              </div>
            )}
          </div>

          {/* Right Properties Panel */}
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 flex flex-col gap-4 text-slate-200 overflow-y-auto shrink-0">
            {/* Contextual Settings for SELECT / MOVE */}
            {activeTool === 'select' && (
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <Move className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Modo de Seleção & Ajuste
                  </h3>
                </div>

                {selectedShapeId ? (
                  <div className="space-y-3">
                    {(() => {
                      const sel = annotations.find((s) => s.id === selectedShapeId);
                      if (!sel) return null;
                      const typeLabel =
                        sel.type === 'action_box' ? 'Caixa de Ação (Borda Laranja)' :
                        sel.type === 'click' ? 'Ícone de Clique do Mouse' :
                        sel.type === 'circle' ? 'Círculo de Destaque' :
                        sel.type === 'rect' ? 'Retângulo' :
                        sel.type === 'arrow' ? 'Seta Apontadora' :
                        sel.type === 'freehand' ? 'Desenho à Mão Livre' :
                        sel.type === 'blur' ? 'Censura Desfoque' :
                        sel.type === 'pixelate' ? 'Censura Mosaico' :
                        sel.type === 'badge' ? `Marcador de Passo (${sel.badgeNumber})` :
                        sel.type === 'text' ? 'Texto Flutuante' : 'Elemento';

                      return (
                        <>
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Elemento Selecionado</span>
                            <p className="text-xs font-bold text-white mt-0.5">{typeLabel}</p>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              Arraste para reposicionar ou puxe os cantos azuis para redimensionar.
                            </p>
                          </div>

                          {/* Text / Action Label Editing */}
                          {(sel.type === 'text' || sel.type === 'action_box') && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-slate-300">
                                Texto do Marcador:
                              </label>
                              <input
                                type="text"
                                value={sel.label || sel.text || ''}
                                onChange={(e) => handleCustomTextChange(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          )}

                          <button
                            onClick={handleDeleteSelectedShape}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow transition"
                            title="Remover este elemento (Del)"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir Elemento (Del)
                          </button>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <p className="font-semibold text-slate-300 mb-1">💡 Dica de Edição:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>Clique em qualquer caixa, seta ou desfoque para editar.</li>
                      <li>Arraste para reposicionar no ponto exato.</li>
                      <li>Pressione <strong>Delete</strong> para remover.</li>
                      <li>Use as setas do teclado para ajuste fino (Shift + Seta para 10px).</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* RF-11 & RF-12: Contextual Settings for BLUR / PRIVACY */}
            {(activeTool === 'blur' || activeTool === 'pixelate' || (activeTool === 'select' && selectedShapeId && annotations.some((s) => s.id === selectedShapeId && (s.type === 'blur' || s.type === 'pixelate')))) && (
              <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-800/60 space-y-3.5">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Privacidade & Censura de Dados
                  </h3>
                </div>

                {/* Intensity Slider with Live Update */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Intensidade do Blur:</span>
                    <span className="font-mono text-amber-400 font-bold">{blurIntensity}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="60"
                    step="2"
                    value={blurIntensity}
                    onChange={(e) => handleBlurIntensityChange(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Leve (8px)</span>
                    <span>Médio (28px)</span>
                    <span>Extremo (60px)</span>
                  </div>
                </div>

                {/* Frosted Layer Opacity */}
                <div className="pt-2 border-t border-amber-800/40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Película Fosca Anti-Vazamento:</span>
                    <span className="font-mono text-amber-400 font-bold">{frostedOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={frostedOpacity}
                    onChange={(e) => handleFrostedOpacityChange(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    Garante que CPFs, senhas e nomes fiquem 100% ilegíveis e irreversíveis.
                  </p>
                </div>

                {/* RF-12: Replicate to all steps (Batch Blur) */}
                <button
                  type="button"
                  onClick={handleReplicateBlurToAllSteps}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow transition"
                  title="Replicar este desfoque nestas mesmas coordenadas em todos os demais passos do tutorial"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Replicar Desfoque em Todos os Passos
                </button>
              </div>
            )}

            {/* RF-14: Auto-PII Detection Quick Action */}
            <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Proteção de PII
                </span>
                <span className="text-[10px] text-slate-400">Automático</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Detecta e censura senhas, CPFs e campos confidenciais digitados no passo.
              </p>
              <button
                type="button"
                onClick={handleAutoCensorPII}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Auto-Censurar Dados do Passo
              </button>
            </div>

            {/* RF-10: Color Selector & Branding */}
            {(activeTool === 'action_box' ||
              activeTool === 'rect' ||
              activeTool === 'arrow' ||
              activeTool === 'circle' ||
              activeTool === 'freehand' ||
              activeTool === 'badge' ||
              activeTool === 'text' ||
              (activeTool === 'select' && selectedShapeId && annotations.some((s) => s.id === selectedShapeId && s.type !== 'blur' && s.type !== 'pixelate' && s.type !== 'blackout'))) && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cores & Branding da Marca
                </h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {colorPresets.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleStrokeColorChange(c.value)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 transition ${
                        strokeColor === c.value
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {strokeColor === c.value && (
                        <Check
                          className={`w-3.5 h-3.5 ${
                            c.value === '#ffffff' ? 'text-black' : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => handleStrokeColorChange(e.target.value)}
                    className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-300 uppercase">
                    {strokeColor}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">Personalizada</span>
                </div>
              </div>
            )}

            {/* Stroke Width Slider for Vector Tools */}
            {(activeTool === 'action_box' ||
              activeTool === 'rect' ||
              activeTool === 'arrow' ||
              activeTool === 'circle' ||
              activeTool === 'freehand' ||
              (activeTool === 'select' && selectedShapeId && annotations.some((s) => s.id === selectedShapeId && ['action_box', 'rect', 'arrow', 'circle', 'freehand'].includes(s.type)))) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Espessura do Traço
                  </h3>
                  <span className="text-xs font-mono text-blue-400 font-semibold">
                    {strokeWidth}px
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={strokeWidth}
                  onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            )}

            {/* RF-08: Font Size for Text Annotation */}
            {(activeTool === 'text' || (activeTool === 'select' && selectedShapeId && annotations.some((s) => s.id === selectedShapeId && s.type === 'text'))) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tamanho da Fonte
                  </h3>
                  <span className="text-xs font-mono text-blue-400 font-semibold">
                    {fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="42"
                  step="2"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            )}

            {/* Text Tool Input */}
            {activeTool === 'text' && (
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 mb-1.5">Texto do Balão</h4>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Clique aqui"
                />
              </div>
            )}

            {/* Badge Tool Step Number */}
            {activeTool === 'badge' && (
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 mb-2">Número do Próximo Passo</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNextBadgeNumber((n) => Math.max(1, n - 1))}
                    className="w-8 h-8 rounded bg-slate-700 text-white font-bold hover:bg-slate-600"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-base text-emerald-400">
                    {nextBadgeNumber}
                  </span>
                  <button
                    onClick={() => setNextBadgeNumber((n) => n + 1)}
                    className="w-8 h-8 rounded bg-slate-700 text-white font-bold hover:bg-slate-600"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* RF-17: Focus Region settings */}
            {activeTool === 'focus' && (
              <div className="bg-cyan-950/40 p-3.5 rounded-xl border border-cyan-800/60 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <ScanSearch className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Foco no Clique (Não Destrutivo)
                  </h3>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  A captura completa continua salva no projeto. O foco é aplicado apenas na
                  exibição do PDF e pode ser desligado a qualquer momento.
                </p>

                <label className="flex items-center justify-between gap-2 bg-slate-900/70 rounded-lg px-2.5 py-2 cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Aplicar foco neste PDF
                  </span>
                  <input
                    type="checkbox"
                    checked={focusEnabled}
                    onChange={(e) => setFocusEnabled(e.target.checked)}
                    className="accent-cyan-500 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 bg-slate-900/70 rounded-lg px-2.5 py-2 cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Seguir os cliques automaticamente
                  </span>
                  <input
                    type="checkbox"
                    checked={focusAuto}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleFocusOnClicks();
                      } else {
                        setFocusAuto(false);
                      }
                    }}
                    className="accent-cyan-500 w-4 h-4 cursor-pointer"
                  />
                </label>

                {focusMode === 'crop' && (
                  <label className="flex items-center justify-between gap-2 bg-slate-900/70 rounded-lg px-2.5 py-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-200">
                      Mostrar também a tela completa
                    </span>
                    <input
                      type="checkbox"
                      checked={focusShowFull}
                      onChange={(e) => setFocusShowFull(e.target.checked)}
                      className="accent-cyan-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                )}

                {focusMode === 'inset' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Tamanho do Detalhe
                      </h4>
                      <span className="text-[11px] font-mono text-cyan-300 font-semibold">
                        {Math.round(focusZoom * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1"
                      step="0.05"
                      value={focusZoom}
                      onChange={(e) => setFocusZoom(Number(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className="text-[10px] text-slate-400 leading-snug border-t border-slate-800 pt-2">
                  {focusMode === 'crop' && '✂️ Recorte: o PDF mostra somente a área do clique, ampliada na largura da figura.'}
                  {focusMode === 'spotlight' && '🔆 Holofote: a tela inteira aparece no PDF, com o entorno escurecido e a área do clique realçada.'}
                  {focusMode === 'inset' && '🔍 Lupa: a tela inteira aparece no PDF e, abaixo, um detalhe ampliado da área do clique.'}
                </div>
              </div>
            )}

            {/* RF-15: Alt Text (Acessibilidade) */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Texto Alternativo (Alt Text)</span>
                <span className="text-[10px] text-slate-400 font-normal">Acessibilidade</span>
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Ex: Captura de tela da opção Configurações do Sistema"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 leading-tight">
                Lido por leitores de tela e utilizado em relatórios de conformidade.
              </p>
            </div>

            {/* Bottom Finalize Button */}
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition"
              >
                <Check className="w-4 h-4" />
                Salvar e Aplicar no Passo
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
