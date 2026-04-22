import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Progress } from './Progress.js';

afterEach(() => cleanup());

describe('<Progress>', () => {
  it('renders a determinate bar with ARIA values', () => {
    render(<Progress variant="bar" value={25} max={100} label="Uploading" />);
    const bar = screen.getByRole('progressbar', { name: 'Uploading' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar.className).toContain('tk-progress--bar-determinate');
    const fill = bar.querySelector('.tk-progress__fill') as HTMLElement | null;
    expect(fill?.style.width).toBe('25%');
  });

  it('clamps determinate value to [0, max]', () => {
    render(<Progress variant="bar" value={500} max={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    const fill = bar.querySelector('.tk-progress__fill') as HTMLElement | null;
    expect(fill?.style.width).toBe('100%');
  });

  it('renders indeterminate bar without aria-valuenow', () => {
    render(<Progress variant="bar" label="Working" />);
    const bar = screen.getByRole('progressbar', { name: 'Working' });
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(bar.className).toContain('tk-progress--bar-indeterminate');
  });

  it('renders spinner variant with status role', () => {
    render(<Progress variant="spinner" size="md" label="Refreshing" />);
    const spinner = screen.getByRole('status', { name: 'Refreshing' });
    expect(spinner.className).toContain('tk-progress--spinner');
    expect(spinner.className).toContain('tk-progress--spinner-md');
  });

  it('defaults spinner to sm size and "Loading" label', () => {
    render(<Progress variant="spinner" />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.className).toContain('tk-progress--spinner-sm');
  });
});
