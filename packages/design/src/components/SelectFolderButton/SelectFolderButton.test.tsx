import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectFolderButton } from './SelectFolderButton.js';

describe('SelectFolderButton', () => {
  it('shows the placeholder label when no folder is picked', () => {
    render(<SelectFolderButton onClick={() => {}} />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Select folder');
    expect(button).toHaveAttribute('title', 'Select folder');
    expect(button.getAttribute('aria-label')).toBe('Select folder');
  });

  it('shows the folder basename and full path in the title when a folder is picked', () => {
    render(<SelectFolderButton folderPath="/Users/k/projects/alpha" />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('alpha');
    expect(button).toHaveAttribute('title', '/Users/k/projects/alpha');
    expect(button.getAttribute('aria-label')).toContain('alpha');
  });

  it('handles Windows-style separators when computing the basename', () => {
    render(<SelectFolderButton folderPath="C:\\Users\\k\\proj" />);

    expect(screen.getByRole('button')).toHaveTextContent('proj');
  });

  it('invokes the click handler when pressed', () => {
    const onClick = vi.fn();
    render(<SelectFolderButton onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button and exposes aria-busy while loading', () => {
    render(<SelectFolderButton loading folderPath="/tmp/alpha" />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent(/starting/i);
  });

  it('respects the disabled prop without showing loading copy', () => {
    render(<SelectFolderButton disabled folderPath="/tmp/alpha" />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('alpha');
    expect(button).not.toHaveAttribute('aria-busy', 'true');
  });
});
