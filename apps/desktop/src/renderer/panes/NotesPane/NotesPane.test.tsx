import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotesPane } from './NotesPane.js';

vi.mock('@tinker/memory', () => ({
  createNoteStore: () => ({
    create: vi.fn().mockResolvedValue({
      id: 'new-1',
      title: 'Untitled',
      body: '',
      contextEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    get: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(true),
  }),
}));

describe('NotesPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sidebar with title and new button', () => {
    render(<NotesPane />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByTitle('New note')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<NotesPane />);
    expect(screen.getByPlaceholderText('Search notes…')).toBeInTheDocument();
  });

  it('shows empty state when no notes exist', () => {
    render(<NotesPane />);
    expect(screen.getByText('No notes yet. Create one to start writing.')).toBeInTheDocument();
  });
});
