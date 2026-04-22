import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton.js';

afterEach(() => cleanup());

describe('<Skeleton>', () => {
  it('defaults to the text variant', () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el.classList.contains('tk-skeleton')).toBe(true);
    expect(el.classList.contains('tk-skeleton--text')).toBe(true);
  });

  it('renders the circle variant with a matching height when only width is given', () => {
    render(<Skeleton variant="circle" width={40} data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el.classList.contains('tk-skeleton--circle')).toBe(true);
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('40px');
  });

  it('renders the rect variant with width and height', () => {
    render(<Skeleton variant="rect" width="100%" height={120} data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el.classList.contains('tk-skeleton--rect')).toBe(true);
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('120px');
  });

  it('exposes aria-busy for assistive tech', () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('merges caller className', () => {
    render(<Skeleton className="extra" data-testid="sk" />);
    const el = screen.getByTestId('sk');
    expect(el.classList.contains('extra')).toBe(true);
    expect(el.classList.contains('tk-skeleton')).toBe(true);
  });
});
