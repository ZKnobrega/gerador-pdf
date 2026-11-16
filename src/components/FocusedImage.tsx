import React from 'react';
import { StepImage, getEffectiveFocus } from '../types/tutorial';

interface FocusedImageProps {
  image: StepImage;
  alt: string;
  /** Highlight color for the focus ring (defaults to the institutional action orange) */
  accentColor?: string;
  /** Rendered inside the editor preview instead of the PDF page */
  compact?: boolean;
}

const DIM = 'rgba(15, 23, 42, 0.62)';

/**
 * RF-17 — Renders a step image honoring its non-destructive focus region.
 *
 * The underlying `image.url` is ALWAYS the complete screenshot: focusing is
 * purely presentational (CSS), so turning it off restores the full capture with
 * no loss of quality and no re-encoding.
 *
 * Modes:
 *  - crop      -> shows only the focused region, scaled up to the figure width
 *  - spotlight -> shows the whole capture, dimming everything but the region
 *  - inset     -> shows the whole capture plus a magnified detail below it
 */
export const FocusedImage: React.FC<FocusedImageProps> = ({
  image,
  alt,
  accentColor = '#f97316',
  compact = false,
}) => {
  const focus = getEffectiveFocus(image);

  // No focus configured: plain complete screenshot
  if (!focus) {
    return (
      <img
        src={image.url}
        alt={alt}
        className="w-full h-auto object-contain block"
      />
    );
  }

  const srcAspect =
    focus.srcWidth && focus.srcHeight && focus.srcHeight > 0
      ? focus.srcWidth / focus.srcHeight
      : null;

  // Aspect ratio of the cut is required to reserve the right height for a crop.
  // Without it we degrade gracefully to the spotlight presentation, which never
  // hides any part of the screenshot.
  const canCrop = srcAspect !== null && srcAspect > 0;
  const mode = canCrop ? focus.mode : 'spotlight';

  /** The focused region rendered as a real "cut" of the full image (pure CSS). */
  const renderCut = (keyPrefix: string) => {
    const cutAspect = (srcAspect as number) * (focus.width / focus.height);
    return (
      <div
        key={`${keyPrefix}-cut`}
        className="relative w-full overflow-hidden block"
        style={{ paddingBottom: `${(100 / cutAspect).toFixed(4)}%` }}
      >
        <img
          src={image.url}
          alt={alt}
          className="absolute max-w-none block"
          style={{
            width: `${(100 / focus.width).toFixed(4)}%`,
            height: 'auto',
            left: `${(-(focus.x / focus.width) * 100).toFixed(4)}%`,
            top: `${(-(focus.y / focus.height) * 100).toFixed(4)}%`,
          }}
        />
      </div>
    );
  };

  /** Highlight ring drawn exactly over the focused region of the full image. */
  const renderRing = () => (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${focus.x * 100}%`,
        top: `${focus.y * 100}%`,
        width: `${focus.width * 100}%`,
        height: `${focus.height * 100}%`,
        border: `${compact ? 2 : 3}px solid ${accentColor}`,
        borderRadius: '6px',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.65)`,
      }}
    />
  );

  // ---------- MODE: crop (only the clicked area) ----------
  if (mode === 'crop') {
    return (
      <div className="block w-full">
        {renderCut('main')}

        {focus.showFull && (
          <div className="mt-2 flex flex-col items-center">
            <div className="w-[62%] max-w-full relative rounded-md border border-slate-200 overflow-hidden bg-white">
              <img src={image.url} alt={alt} className="w-full h-auto object-contain block" />
              {renderRing()}
            </div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">
              Tela completa para referência
            </span>
          </div>
        )}
      </div>
    );
  }

  // ---------- MODE: spotlight (whole capture, surroundings dimmed) ----------
  if (mode === 'spotlight') {
    const outside: React.CSSProperties[] = [
      // top band
      { left: 0, top: 0, width: '100%', height: `${focus.y * 100}%` },
      // bottom band
      {
        left: 0,
        top: `${(focus.y + focus.height) * 100}%`,
        width: '100%',
        height: `${Math.max(0, 1 - focus.y - focus.height) * 100}%`,
      },
      // left band
      {
        left: 0,
        top: `${focus.y * 100}%`,
        width: `${focus.x * 100}%`,
        height: `${focus.height * 100}%`,
      },
      // right band
      {
        left: `${(focus.x + focus.width) * 100}%`,
        top: `${focus.y * 100}%`,
        width: `${Math.max(0, 1 - focus.x - focus.width) * 100}%`,
        height: `${focus.height * 100}%`,
      },
    ];

    return (
      <div className="relative block w-full">
        <img src={image.url} alt={alt} className="w-full h-auto object-contain block" />
        {outside.map((style, i) => (
          <div
            key={`dim-${i}`}
            className="absolute pointer-events-none"
            style={{ ...style, backgroundColor: DIM }}
          />
        ))}
        {renderRing()}
      </div>
    );
  }

  // ---------- MODE: inset (whole capture + magnified detail) ----------
  const insetWidth = Math.round(Math.min(1, Math.max(0.35, focus.zoom || 0.6)) * 100);

  return (
    <div className="block w-full">
      <div className="relative block w-full">
        <img src={image.url} alt={alt} className="w-full h-auto object-contain block" />
        {renderRing()}
      </div>

      <div className="mt-2.5 flex flex-col items-center">
        <div
          className="rounded-lg overflow-hidden bg-white"
          style={{
            width: `${insetWidth}%`,
            maxWidth: '100%',
            border: `2px solid ${accentColor}`,
          }}
        >
          {renderCut('inset')}
        </div>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">
          Detalhe ampliado da ação
        </span>
      </div>
    </div>
  );
};
