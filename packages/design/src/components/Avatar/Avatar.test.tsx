import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar.js';

afterEach(() => cleanup());

describe('<Avatar>', () => {
  it('renders initials from first+last word of name', () => {
    render(<Avatar name="Khani Bangalu" />);
    expect(screen.getByText('KB')).toBeInTheDocument();
  });

  it('renders single letter for single-word names', () => {
    render(<Avatar name="Khani" />);
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders "?" for empty name', () => {
    render(<Avatar name="   " />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('uses image when src is provided and loads', () => {
    const { container } = render(<Avatar name="Khani" src="https://x/avatar.png" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://x/avatar.png');
  });

  it('falls back to initials when image load errors', () => {
    const { container } = render(<Avatar name="Khani Bangalu" src="https://x/404" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(screen.getByText('KB')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('assigns deterministic palette class based on name hash', () => {
    const { container: a } = render(<Avatar name="Ada Lovelace" />);
    const { container: b } = render(<Avatar name="Ada Lovelace" />);
    const classA = a.querySelector('.tk-avatar')?.className ?? '';
    const classB = b.querySelector('.tk-avatar')?.className ?? '';
    const paletteA = classA.match(/tk-avatar--p\d/u)?.[0];
    const paletteB = classB.match(/tk-avatar--p\d/u)?.[0];
    expect(paletteA).toBeDefined();
    expect(paletteA).toBe(paletteB);
  });

  it('applies size class', () => {
    const { container } = render(<Avatar name="K" size="lg" />);
    expect(container.querySelector('.tk-avatar--lg')).not.toBeNull();
  });

  it('sets aria-label to name for accessibility', () => {
    render(<Avatar name="Khani Bangalu" />);
    expect(screen.getByRole('img', { name: 'Khani Bangalu' })).toBeInTheDocument();
  });
});
