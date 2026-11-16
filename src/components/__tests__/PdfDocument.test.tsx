import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PdfDocument } from '../PdfDocument';
import { TutorialProject } from '../../types/tutorial';
import { defaultProject } from '../../data/defaultProject';

describe('PdfDocument Component Unit Tests', () => {
  it('renders cover page with correct title, organization and purpose', () => {
    const html = renderToString(<PdfDocument project={defaultProject} />);

    expect(html).toContain('NOME DA ORGANIZAÇÃO');
    expect(html).toContain('Gerenciamento de Unidades');
    expect(html).toContain('SISTEMA EXEMPLO');
    expect(html).toContain('pdf-page');
  });

  it('generates multiple pages when forcePageBreakAfter is set', () => {
    const multiPageProject: TutorialProject = {
      ...defaultProject,
      steps: [
        {
          id: 'step-1',
          order: 1,
          title: 'Primeiro Passo',
          instructions: ['Instrução 1'],
          forcePageBreakAfter: true, // Forces page break
        },
        {
          id: 'step-2',
          order: 2,
          title: 'Segundo Passo',
          instructions: ['Instrução 2'],
          forcePageBreakAfter: false,
        },
      ],
    };

    const html = renderToString(<PdfDocument project={multiPageProject} />);
    // Should have 2 .pdf-page elements
    const matches = html.match(/pdf-page/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBeGreaterThanOrEqual(2);

    // Page 2 should include running header with metadata
    expect(html).toMatch(/PÁGINA.*?2/);
    expect(html).toContain('Segundo Passo');
  });

  it('renders multiple images with captions within a single step', () => {
    const multiImageProject: TutorialProject = {
      ...defaultProject,
      steps: [
        {
          id: 'step-images',
          order: 1,
          title: 'Passo com Multi-Imagens',
          instructions: ['Observe ambas as figuras'],
          images: [
            {
              id: 'img-1',
              url: 'data:image/png;base64,mock1',
              caption: 'Primeira captura de tela',
              aspectRatio: 'wide',
            },
            {
              id: 'img-2',
              url: 'data:image/png;base64,mock2',
              caption: 'Segunda captura de tela',
              aspectRatio: 'wide',
            },
          ],
        },
      ],
    };

    const html = renderToString(<PdfDocument project={multiImageProject} />);
    expect(html).toContain('Primeira captura de tela');
    expect(html).toContain('Segunda captura de tela');
    expect(html).toContain('data:image/png;base64,mock1');
    expect(html).toContain('data:image/png;base64,mock2');
  });

  it('renders callout boxes when step callout is configured', () => {
    const calloutProject: TutorialProject = {
      ...defaultProject,
      steps: [
        {
          id: 'step-callout',
          order: 1,
          title: 'Passo Importante',
          instructions: ['Atenção aos detalhes'],
          callout: {
            enabled: true,
            type: 'warning',
            title: 'ATENÇÃO / CUIDADO',
            content: 'Não compartilhe suas credenciais funcionais com terceiros!',
          },
        },
      ],
    };

    const html = renderToString(<PdfDocument project={calloutProject} />);
    expect(html).toContain('ATENÇÃO / CUIDADO');
    expect(html).toContain('Não compartilhe suas credenciais funcionais com terceiros!');
  });

  it('renders support contacts on final page', () => {
    const html = renderToString(<PdfDocument project={defaultProject} />);
    expect(html).toContain(defaultProject.support.title);
    expect(html).toContain(defaultProject.support.channels[0].value);
    expect(html).toContain(defaultProject.support.channels[2].value);
  });
});
