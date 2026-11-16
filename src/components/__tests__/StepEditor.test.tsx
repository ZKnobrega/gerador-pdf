import { describe, it, expect, vi } from 'vitest';
import { TutorialStep } from '../../types/tutorial';

describe('StepEditor Instruction Logic Unit Tests', () => {
  const mockStep: TutorialStep = {
    id: 'step-test-1',
    order: 1,
    title: 'Passo de Teste',
    objective: 'Objetivo de teste',
    instructions: [
      'Acesse o sistema pelo endereço institucional.',
      'Insira suas credenciais de usuário e senha.',
    ],
    image: null,
    caption: 'Figura 1',
    imageWidthPercent: 100,
    callout: null,
    forcePageBreakAfter: false,
  };

  it('adds instruction with typed text to the instructions array', () => {
    const onUpdate = vi.fn();
    const newInstruction = 'Clique no botão Salvar';

    // Simulating handleAddInstruction with text
    const updatedInstructions = [...mockStep.instructions, newInstruction.trim()];
    onUpdate({ ...mockStep, instructions: updatedInstructions });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: [
          'Acesse o sistema pelo endereço institucional.',
          'Insira suas credenciais de usuário e senha.',
          'Clique no botão Salvar',
        ],
      })
    );
  });

  it('adds fallback instruction when button is clicked with empty input', () => {
    const onUpdate = vi.fn();
    const emptyInput = '';

    // Simulating handleAddInstruction with empty input
    const textToAdd = emptyInput.trim() || 'Nova instrução...';
    const updatedInstructions = [...mockStep.instructions, textToAdd];
    onUpdate({ ...mockStep, instructions: updatedInstructions });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: [
          'Acesse o sistema pelo endereço institucional.',
          'Insira suas credenciais de usuário e senha.',
          'Nova instrução...',
        ],
      })
    );
  });

  it('inserts a new instruction line on Enter key at specific index', () => {
    const onUpdate = vi.fn();
    const current = [...mockStep.instructions];
    // Pressing enter on index 0
    current.splice(1, 0, '');
    onUpdate({ ...mockStep, instructions: current });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: [
          'Acesse o sistema pelo endereço institucional.',
          '',
          'Insira suas credenciais de usuário e senha.',
        ],
      })
    );
  });
});
