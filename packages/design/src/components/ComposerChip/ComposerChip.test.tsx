import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposerChip } from './ComposerChip.js';

describe('<ComposerChip>', () => {
  it('renders label', () => {
    render(<ComposerChip label="Build" />);
    expect(screen.getByText('Build')).toBeInTheDocument();
  });

  it('renders primary variant with amber bg class', () => {
    const { container } = render(<ComposerChip label="Auto Accept" variant="primary" />);
    const chip = container.querySelector('.tk-composer-chip--primary');
    expect(chip).not.toBeNull();
  });

  it('renders secondaryLabel with separator', () => {
    const { container } = render(<ComposerChip label="Default" secondaryLabel="Opus 4.6" />);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Opus 4.6')).toBeInTheDocument();
    expect(container.querySelector('.tk-composer-chip__separator')).not.toBeNull();
  });

  it('shows chevron by default', () => {
    const { container } = render(<ComposerChip label="Plan" />);
    expect(container.querySelector('.tk-composer-chip__chevron')).not.toBeNull();
  });

  it('hides chevron when showChevron=false', () => {
    const { container } = render(<ComposerChip label="Plan" showChevron={false} />);
    expect(container.querySelector('.tk-composer-chip__chevron')).toBeNull();
  });
});
