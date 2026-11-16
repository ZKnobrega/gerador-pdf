import { TutorialProject } from '../types/tutorial';
import { generatePdfPayload, ExportProgressCallback } from './pdfExporter';

/** A PDF published into the shared "Tutoriais do Sistema" library. */
export interface PublishedPdf {
  id: string;
  projectId: string | null;
  title: string;
  subtitle: string;
  systemName: string;
  organization: string;
  version: string;
  author: string;
  pages: number;
  stepsCount: number;
  fileName: string;
  sizeBytes: number;
  publishedAt: string;
  downloadUrl: string;
}

const LIBRARY_CACHE_KEY = 'guiamaker_published_pdfs';

/** Inline (browser viewer) URL of a published PDF. */
export const getPdfViewUrl = (pdf: PublishedPdf): string =>
  pdf.downloadUrl || `/api/pdfs/${encodeURIComponent(pdf.id)}/file`;

/** Forced-download URL of a published PDF. */
export const getPdfDownloadUrl = (pdf: PublishedPdf): string =>
  `${getPdfViewUrl(pdf)}?download=1`;

export const formatPdfSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function readCache(): PublishedPdf[] {
  try {
    const raw = localStorage.getItem(LIBRARY_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lists every PDF published to the shared library. Falls back to the local
 * cache when the server is unreachable (standalone desktop / offline).
 */
export async function fetchPublishedPdfs(): Promise<PublishedPdf[]> {
  try {
    const res = await fetch('/api/pdfs');
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        try {
          localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(list));
        } catch {
          // cache is best-effort only
        }
        return list;
      }
    }
  } catch {
    // offline: use the cached listing
  }
  return readCache();
}

export interface PublishResult {
  success: boolean;
  pdf?: PublishedPdf;
  error?: string;
}

/**
 * Generates the final PDF of the given project and publishes it to the shared
 * library, where every computer on the network can read it.
 *
 * The project itself is NOT modified: this only adds a snapshot of the PDF to
 * the public history.
 */
export async function publishProjectPdf(
  project: TutorialProject,
  onProgress?: ExportProgressCallback
): Promise<PublishResult> {
  try {
    const payload = await generatePdfPayload(onProgress);
    if (!payload) {
      return { success: false, error: 'Nenhuma página encontrada para gerar o PDF.' };
    }

    if (onProgress) {
      onProgress(payload.pages, payload.pages, 'Publicando em Tutoriais do Sistema...');
    }

    const res = await fetch('/api/pdfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: project.metadata.title,
        subtitle: project.metadata.subtitle,
        systemName: project.metadata.systemName,
        organization: project.metadata.organization,
        version: project.metadata.version,
        author: project.metadata.author,
        pages: payload.pages,
        stepsCount: Array.isArray(project.steps) ? project.steps.length : 0,
        pdfBase64: payload.base64,
      }),
    });

    if (!res.ok) {
      let message = `Falha ao publicar (HTTP ${res.status}).`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // keep the generic message
      }
      return { success: false, error: message };
    }

    const body = await res.json();
    return { success: true, pdf: body?.pdf };
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.message ||
        'Não foi possível contatar o servidor. A publicação exige a versão em rede do sistema.',
    };
  }
}

/** Removes a published PDF from the shared library. */
export async function deletePublishedPdf(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/pdfs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
