import { describe, it, expect } from 'vitest';
import { getStepImages, TutorialStep, StepImage } from '../tutorial';

describe('Tutorial Types & Helpers', () => {
  it('should return empty array when step has no image', () => {
    const step: TutorialStep = {
      id: 'step-1',
      order: 1,
      title: 'Passo 1',
      objective: 'Objetivo',
      instructions: ['Instrução 1'],
      image: null,
      callout: null,
    };

    const result = getStepImages(step);
    expect(result).toEqual([]);
  });

  it('should normalize legacy single image into StepImage array', () => {
    const step: TutorialStep = {
      id: 'step-legacy',
      order: 1,
      title: 'Passo Legado',
      objective: 'Objetivo',
      instructions: ['Instrução'],
      image: 'data:image/png;base64,mock123',
      originalImage: 'data:image/png;base64,mockOrig',
      caption: 'Legenda da figura',
      imageWidthPercent: 75,
      callout: null,
    };

    const result = getStepImages(step);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'img-step-legacy-legacy',
      url: 'data:image/png;base64,mock123',
      originalUrl: 'data:image/png;base64,mockOrig',
      caption: 'Legenda da figura',
      widthPercent: 75,
    });
  });

  it('should prefer images array over legacy single image field', () => {
    const customImages: StepImage[] = [
      {
        id: 'img-1',
        url: 'data:image/png;base64,img1',
        caption: 'Figura 1.1',
        widthPercent: 50,
      },
      {
        id: 'img-2',
        url: 'data:image/png;base64,img2',
        caption: 'Figura 1.2',
        widthPercent: 100,
      },
    ];

    const step: TutorialStep = {
      id: 'step-multi',
      order: 1,
      title: 'Passo Multi',
      objective: 'Objetivo',
      instructions: ['Instrução'],
      images: customImages,
      image: 'data:image/png;base64,oldIgnore',
      callout: null,
    };

    const result = getStepImages(step);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('img-1');
    expect(result[1].id).toBe('img-2');
  });
});
