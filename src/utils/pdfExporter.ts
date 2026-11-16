import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface ExportProgressCallback {
  (current: number, total: number, status: string): void;
}

export interface BuiltPdf {
  pdf: jsPDF;
  /** Number of A4 sheets written into the document */
  pages: number;
}

/** Finds the rendered A4 pages, trying the dedicated export stage first. */
function collectPageElements(): HTMLElement[] {
  const selectors = [
    '#pdf-direct-export-stage .pdf-page',
    '#pdf-export-container .pdf-page',
    '.pdf-document-root .pdf-page',
    '.pdf-page',
  ];

  for (const selector of selectors) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (found.length > 0) return found;
  }
  return [];
}

/**
 * Renders every .pdf-page element into a multi-page A4 jsPDF document using
 * html2canvas-pro (full support for Tailwind's modern oklch colors).
 *
 * Shared by the direct download and by publishing to the shared library, so both
 * produce byte-identical documents.
 */
export async function buildPdfDocument(
  onProgress?: ExportProgressCallback
): Promise<BuiltPdf | null> {
  const pages = collectPageElements();
  if (pages.length === 0) {
    return null;
  }

  const totalPages = pages.length;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const a4WidthMm = 210;
  const a4HeightMm = 297;
  let sheetCount = 0;

  for (let i = 0; i < totalPages; i++) {
    const pageEl = pages[i];
    if (onProgress) {
      onProgress(i + 1, totalPages, `Renderizando página ${i + 1} de ${totalPages}...`);
    }

    // Render page element with html2canvas-pro at scale 2 for crisp 300dpi-like output
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth = a4WidthMm;
    const pdfHeight = canvas.width > 0 ? (canvas.height * pdfWidth) / canvas.width : a4HeightMm;

    if (pdfHeight <= a4HeightMm + 2) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, a4HeightMm, undefined, 'FAST');
      sheetCount++;
    } else {
      // Multi-page slice: element was taller than standard 297mm A4, slice smoothly
      let heightLeft = pdfHeight;
      let position = 0;

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= a4HeightMm;
      sheetCount++;

      while (heightLeft > 2) {
        position -= a4HeightMm;
        pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= a4HeightMm;
        sheetCount++;
      }
    }
  }

  return { pdf, pages: sheetCount };
}

export function buildPdfFilename(title: string): string {
  return `manual-${title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'tutorial'}.pdf`;
}

/**
 * Exports all .pdf-page elements directly into a high-quality multi-page A4 PDF file
 * and downloads it to the user's Downloads folder.
 */
export async function exportPdfDirectly(
  title: string,
  onProgress?: ExportProgressCallback
): Promise<boolean> {
  try {
    const built = await buildPdfDocument(onProgress);
    if (!built) {
      alert('Nenhuma página encontrada para exportar.');
      return false;
    }

    if (onProgress) {
      onProgress(built.pages, built.pages, 'Gerando arquivo PDF...');
    }

    built.pdf.save(buildPdfFilename(title));
    return true;
  } catch (err: any) {
    console.error('Erro na exportação direta do PDF:', err);
    alert(`Ocorreu um erro ao gerar o PDF: ${err?.message || err}. Você também pode usar a opção "Imprimir / Salvar PDF" do navegador.`);
    return false;
  }
}

export interface GeneratedPdfPayload {
  /** Raw base64 (no data: prefix) of the finished PDF */
  base64: string;
  pages: number;
  /** Approximate size of the decoded file, in bytes */
  bytes: number;
}

/**
 * Generates the final PDF in memory (no download) so it can be published to the
 * shared "Tutoriais do Sistema" library.
 */
export async function generatePdfPayload(
  onProgress?: ExportProgressCallback
): Promise<GeneratedPdfPayload | null> {
  const built = await buildPdfDocument(onProgress);
  if (!built) return null;

  if (onProgress) {
    onProgress(built.pages, built.pages, 'Compactando o arquivo PDF...');
  }

  const dataUri = built.pdf.output('datauristring');
  const marker = 'base64,';
  const idx = dataUri.indexOf(marker);
  const base64 = idx >= 0 ? dataUri.substring(idx + marker.length) : dataUri;

  return {
    base64,
    pages: built.pages,
    bytes: Math.round((base64.length * 3) / 4),
  };
}
