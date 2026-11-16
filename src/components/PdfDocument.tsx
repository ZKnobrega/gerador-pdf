import React from 'react';
import { TutorialProject, TutorialStep, getStepImages } from '../types/tutorial';
import { formatInstructionText } from '../utils/textFormatter';
import { FocusedImage } from './FocusedImage';
import { Phone, MessageSquare, Mail, AlertTriangle, Lightbulb, Info, CheckCircle2 } from 'lucide-react';

interface PdfDocumentProps {
  project: TutorialProject;
  printMode?: boolean;
}

export const PdfDocument: React.FC<PdfDocumentProps> = ({ project, printMode = false }) => {
  const { metadata, theme, steps } = project;
  const support = project.support || {
    enabled: false,
    title: '',
    description: '',
    channels: [],
    department: '',
    footerNote: '',
  };

  // Group steps into pages based on user's forcePageBreakAfter toggles
  const pages: TutorialStep[][] = [];
  let currentPage: TutorialStep[] = [];

  steps.forEach((step, idx) => {
    currentPage.push(step);
    if (step.forcePageBreakAfter || idx === steps.length - 1) {
      pages.push([...currentPage]);
      currentPage = [];
    }
  });

  if (pages.length === 0) {
    pages.push([]);
  }

  // Total pages count
  const totalPages = pages.length;

  return (
    <div
      className={`pdf-document-root ${printMode ? 'print-container' : 'flex flex-col items-center gap-8'}`}
      style={{ fontFamily: theme.fontFamily }}
    >
      {pages.map((pageSteps, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const isFirstPage = pageNumber === 1;
        const isLastPage = pageNumber === totalPages;

        return (
          <div
            key={`page-${pageNumber}`}
            className={`pdf-page bg-white relative text-slate-800 ${
              printMode
                ? 'page-break'
                : 'w-[210mm] min-h-[297mm] shadow-2xl rounded-sm p-[16mm] transition-all border border-slate-200'
            }`}
            style={{
              padding: printMode ? '0' : '16mm 18mm',
            }}
          >
            {/* Top Running Header (Pages 2+) */}
            {!isFirstPage && (
              <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-200 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                <div className="flex items-center gap-2.5">
                  {metadata.logoUrl && (
                    <img
                      src={metadata.logoUrl}
                      alt="Logotipo"
                      className="h-5 w-auto object-contain block opacity-85"
                    />
                  )}
                  <span>{metadata.organization || 'NOME DA ORGANIZAÇÃO'}</span>
                  <span>•</span>
                  <span className="text-slate-700">{metadata.systemName || 'SISTEMA'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>MANUAL DE {metadata.title || 'GERENCIAMENTO'}</span>
                  <span>•</span>
                  <span>PÁGINA {pageNumber}</span>
                </div>
              </div>
            )}

            {/* Page 1: Official Main Header */}
            {isFirstPage && (
              <div className="mb-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 pr-2">
                    <span
                      className="block text-xs font-bold uppercase tracking-wider mb-1"
                      style={{ color: theme.primaryColor }}
                    >
                      {metadata.organization}
                    </span>
                    <h1
                      className="text-2xl font-extrabold tracking-tight leading-tight mb-1"
                      style={{ color: theme.primaryColor }}
                    >
                      {metadata.title}
                    </h1>
                    <p className="text-sm font-semibold text-slate-500">
                      {metadata.subtitle}
                    </p>
                  </div>

                  {/* Top Right: Institutional Logo or Fallback System Badge */}
                  {metadata.logoUrl ? (
                    <div className="flex-shrink-0 flex flex-col items-end justify-center">
                      <img
                        src={metadata.logoUrl}
                        alt="Logotipo"
                        className="object-contain block"
                        style={{
                          height: `${metadata.logoHeight || 64}px`,
                          maxWidth: '220px',
                        }}
                      />
                    </div>
                  ) : metadata.systemName ? (
                    <div
                      className="rounded-2xl px-5 py-3 text-center shadow-xs flex-shrink-0"
                      style={{
                        backgroundColor: theme.badgeBgColor || theme.primaryColor,
                        color: theme.badgeTextColor || '#ffffff',
                      }}
                    >
                      <div className="text-xs font-black uppercase tracking-wider">
                        {metadata.systemName}
                      </div>
                      <div className="text-[11px] text-sky-200 font-medium">
                        {metadata.badgeText || 'Guia do Usuário'}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Dark Blue Separator Line */}
                <div
                  className="h-1 w-full my-4 rounded-full"
                  style={{ backgroundColor: theme.primaryColor }}
                />

                {/* Purpose Callout Box */}
                {metadata.purpose && (
                  <div
                    className="p-3.5 rounded-lg mb-6 bg-slate-50 border-l-4"
                    style={{ borderColor: theme.primaryColor }}
                  >
                    <p className="text-xs leading-relaxed text-slate-700">
                      {formatInstructionText(metadata.purpose)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Steps Container for this page */}
            <div className="flex flex-col gap-6">
              {pageSteps.map((step) => {
                return (
                  <div
                    key={step.id}
                    className="step-card bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-shadow"
                    style={{ borderColor: theme.cardBorderColor }}
                  >
                    {/* Step Title Header with Number Badge */}
                    <div className="flex items-start gap-3.5 mb-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        {step.order}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {step.title}
                        </h2>
                        {step.objective && (
                          <p className="text-xs italic text-slate-500 mt-0.5">
                            {step.objective.startsWith('Objetivo:') ? step.objective : `Objetivo: ${step.objective}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step Instructions List */}
                    {step.instructions && step.instructions.length > 0 && (
                      <div className="text-xs text-slate-700 leading-relaxed mb-4 pl-10 space-y-1.5">
                        {step.instructions.map((inst, iIdx) => {
                          const hasCustomPrefix =
                            inst.startsWith('•') ||
                            inst.startsWith('-') ||
                            /^\d+\./.test(inst);

                          return (
                            <div key={iIdx} className="flex items-start gap-2">
                              {!hasCustomPrefix && (
                                <span className="font-semibold text-slate-500 select-none">
                                  {iIdx + 1}.
                                </span>
                              )}
                              <div className="flex-1">
                                {formatInstructionText(inst)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Step Images (Supports multiple images per step) */}
                    {(() => {
                      const stepImages = getStepImages(step);
                      if (stepImages.length === 0) return null;

                      return (
                        <div className="mt-3 flex flex-col gap-4">
                          {stepImages.map((imgItem, imgIdx) => (
                            <div key={imgItem.id || `img-${imgIdx}`} className="flex flex-col items-center">
                              <div
                                className="rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-slate-50"
                                style={{
                                  width: `${imgItem.widthPercent || 100}%`,
                                  maxWidth: '100%',
                                }}
                              >
                                <FocusedImage
                                  image={imgItem}
                                  alt={imgItem.altText || imgItem.caption || step.title}
                                  accentColor={theme.accentColor || '#f97316'}
                                />
                              </div>
                              {imgItem.caption && (
                                <p className="text-[11px] italic text-slate-500 mt-1.5 text-center">
                                  {imgItem.caption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Step Callout / Alert Box */}
                    {step.callout && (step.callout.enabled ?? true) && (
                      <div
                        className={`mt-4 p-3.5 rounded-xl border-l-4 text-xs leading-relaxed ${
                          step.callout.type === 'critical' || step.callout.type === 'warning'
                            ? 'bg-rose-50/80 border-rose-500 text-rose-950'
                            : step.callout.type === 'tip'
                            ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950'
                            : 'bg-sky-50/80 border-sky-500 text-sky-950'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          {step.callout.type === 'critical' && (
                            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          )}
                          {step.callout.type === 'tip' && (
                            <Lightbulb className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          )}
                          {step.callout.type === 'info' && (
                            <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          )}
                          {step.callout.type === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          )}
                          <span>{step.callout.title || 'Observação:'}</span>
                        </div>
                        <div className="pl-5 text-slate-700">
                          {formatInstructionText(step.callout.content || (step.callout as any).text || '')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Support Card (Rendered on Last Page) */}
            {isLastPage && support.enabled && (
              <div className="mt-8 mb-4">
                <div
                  className="rounded-2xl p-5 text-white shadow-md"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <h3 className="text-sm font-bold text-white mb-1">
                    {support.title}
                  </h3>
                  <p className="text-xs text-sky-100 mb-4 leading-relaxed">
                    {support.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {support.channels.map((chan) => (
                      <div
                        key={chan.id}
                        className="bg-white/10 hover:bg-white/15 backdrop-blur-xs p-3 rounded-xl border border-white/10 flex flex-col justify-center"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-200 tracking-wider uppercase mb-1">
                          {chan.type === 'phone' && <Phone className="w-3.5 h-3.5" />}
                          {chan.type === 'chat' && <MessageSquare className="w-3.5 h-3.5" />}
                          {chan.type === 'email' && <Mail className="w-3.5 h-3.5" />}
                          <span>{chan.label}</span>
                        </div>
                        <span className="text-xs font-bold text-white truncate">
                          {chan.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-6 text-center text-slate-400 text-[11px] space-y-0.5">
                  <p className="font-medium">{support.department}</p>
                  <p>{support.footerNote}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
