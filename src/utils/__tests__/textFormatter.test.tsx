import { describe, it, expect } from 'vitest';
import React from 'react';
import { formatInstructionText } from '../textFormatter';

describe('formatInstructionText', () => {
  it('should return null for empty or falsy text', () => {
    expect(formatInstructionText('')).toBeNull();
    // @ts-expect-error testing falsy input
    expect(formatInstructionText(null)).toBeNull();
    // @ts-expect-error testing falsy input
    expect(formatInstructionText(undefined)).toBeNull();
  });

  it('should return plain text wrapped in React elements', () => {
    const nodes = formatInstructionText('Instrução simples') as React.ReactElement[];
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes[0].props.children).toBe('Instrução simples');
  });

  it('should parse **bold text** into strong element', () => {
    const nodes = formatInstructionText('Clique em **Gerenciar Unidade** para acessar') as React.ReactElement[];
    expect(Array.isArray(nodes)).toBe(true);
    
    // Find the strong element
    const boldEl = nodes.find((n) => n.type === 'strong');
    expect(boldEl).toBeDefined();
    expect(boldEl?.props.children).toBe('Gerenciar Unidade');
    expect(boldEl?.props.className).toContain('font-semibold');
  });

  it('should parse *italic text* into em element', () => {
    const nodes = formatInstructionText('Aviso *importante* aqui') as React.ReactElement[];
    const emEl = nodes.find((n) => n.type === 'em');
    expect(emEl).toBeDefined();
    expect(emEl?.props.children).toBe('importante');
    expect(emEl?.props.className).toContain('italic');
  });

  it('should parse `code text` into code element', () => {
    const nodes = formatInstructionText('Use a porta `8090` no navegador') as React.ReactElement[];
    const codeEl = nodes.find((n) => n.type === 'code');
    expect(codeEl).toBeDefined();
    expect(codeEl?.props.children).toBe('8090');
    expect(codeEl?.props.className).toContain('font-mono');
  });

  it('should handle multiple mixed tags in single instruction', () => {
    const nodes = formatInstructionText('Clique em **Salvar**, use `JSON` e aguarde *confirmação*.') as React.ReactElement[];
    const strongEl = nodes.find((n) => n.type === 'strong');
    const codeEl = nodes.find((n) => n.type === 'code');
    const emEl = nodes.find((n) => n.type === 'em');

    expect(strongEl?.props.children).toBe('Salvar');
    expect(codeEl?.props.children).toBe('JSON');
    expect(emEl?.props.children).toBe('confirmação');
  });
});
