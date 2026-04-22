import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { KeyboardHint } from './KeyboardHint.js';

afterEach(() => cleanup());

describe('<KeyboardHint>', () => {
  it('renders one kbd element per key', () => {
    render(<KeyboardHint keys={['Cmd', 'K']} os="mac" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = group.querySelectorAll('kbd');
    expect(keys).toHaveLength(2);
  });

  it('maps modifiers to macOS glyphs when os="mac"', () => {
    render(<KeyboardHint keys={['Cmd', 'Shift', 'P']} os="mac" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = Array.from(group.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['⌘', '⇧', 'P']);
  });

  it('spells modifiers out when os="other"', () => {
    render(<KeyboardHint keys={['Cmd', 'Shift', 'P']} os="other" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = Array.from(group.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['Ctrl', 'Shift', 'P']);
  });

  it('handles a single-key hint (Esc)', () => {
    render(<KeyboardHint keys={['Esc']} os="mac" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = Array.from(group.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['Esc']);
  });

  it('uppercases single character keys', () => {
    render(<KeyboardHint keys={['Alt', 't']} os="mac" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = Array.from(group.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['⌥', 'T']);
  });

  it('composes an aria-label when none is provided', () => {
    render(<KeyboardHint keys={['Cmd', 'K']} os="mac" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    expect(group.getAttribute('aria-label')).toBe('⌘ K');
  });

  it('honours an explicit aria-label', () => {
    render(
      <KeyboardHint keys={['Cmd', 'K']} os="mac" label="Open command palette" data-testid="hint" />,
    );
    const group = screen.getByTestId('hint');
    expect(group.getAttribute('aria-label')).toBe('Open command palette');
  });

  it('passes symbol keys through unchanged', () => {
    render(<KeyboardHint keys={['Ctrl', '/']} os="other" data-testid="hint" />);
    const group = screen.getByTestId('hint');
    const keys = Array.from(group.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['Ctrl', '/']);
  });
});
