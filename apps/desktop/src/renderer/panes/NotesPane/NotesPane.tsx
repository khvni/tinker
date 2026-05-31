import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createNoteStore } from '@tinker/memory';
import type { Note, NoteListEntry } from '@tinker/shared-types';
import './NotesPane.css';

const AUTOSAVE_DELAY_MS = 600;

const store = createNoteStore();

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

export const NotesPane = (): JSX.Element => {
  const [notes, setNotes] = useState<NoteListEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const saveTimerRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const refreshList = useCallback(async () => {
    const entries = searchQuery.trim().length > 0
      ? await store.search(searchQuery)
      : await store.list();
    setNotes(entries);
  }, [searchQuery]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const selectNote = useCallback(async (id: string) => {
    const note = await store.get(id);
    if (!note) return;
    setSelectedId(id);
    setActiveNote(note);
    setTitleDraft(note.title);
    setBodyDraft(note.body);
  }, []);

  const saveNote = useCallback(async (id: string, title: string, body: string) => {
    await store.update(id, { title, body });
    void refreshList();
  }, [refreshList]);

  const scheduleSave = useCallback((id: string, title: string, body: string) => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveNote(id, title, body);
    }, AUTOSAVE_DELAY_MS);
  }, [saveNote]);

  const handleTitleChange = useCallback((value: string) => {
    setTitleDraft(value);
    if (selectedId) {
      scheduleSave(selectedId, value, bodyDraft);
    }
  }, [selectedId, bodyDraft, scheduleSave]);

  const handleBodyChange = useCallback((value: string) => {
    setBodyDraft(value);
    if (selectedId) {
      scheduleSave(selectedId, titleDraft, value);
    }
  }, [selectedId, titleDraft, scheduleSave]);

  const handleCreate = useCallback(async () => {
    const note = await store.create('Untitled', '');
    await refreshList();
    setSelectedId(note.id);
    setActiveNote(note);
    setTitleDraft(note.title);
    setBodyDraft(note.body);
    setTimeout(() => bodyRef.current?.focus(), 0);
  }, [refreshList]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await store.remove(selectedId);
    setSelectedId(null);
    setActiveNote(null);
    setTitleDraft('');
    setBodyDraft('');
    await refreshList();
  }, [selectedId, refreshList]);

  const handleToggleContext = useCallback(async () => {
    if (!activeNote) return;
    const updated = await store.update(activeNote.id, { contextEnabled: !activeNote.contextEnabled });
    if (updated) {
      setActiveNote(updated);
      void refreshList();
    }
  }, [activeNote, refreshList]);

  return (
    <div className="tinker-notes">
      <div className="tinker-notes__sidebar">
        <div className="tinker-notes__sidebar-header">
          <h2 className="tinker-notes__sidebar-title">Notes</h2>
          <button
            type="button"
            className="tinker-notes__new-btn"
            title="New note"
            onClick={() => void handleCreate()}
          >
            +
          </button>
        </div>
        <div className="tinker-notes__search">
          <input
            type="text"
            className="tinker-notes__search-input"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="tinker-notes__list">
          {notes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`tinker-notes__list-item${entry.id === selectedId ? ' tinker-notes__list-item--active' : ''}`}
              onClick={() => void selectNote(entry.id)}
            >
              <span className="tinker-notes__list-item-title">
                {entry.title || 'Untitled'}
              </span>
              {entry.excerpt && (
                <span className="tinker-notes__list-item-excerpt">{entry.excerpt}</span>
              )}
              <span className="tinker-notes__list-item-meta">
                {formatDate(entry.updatedAt)}
                {!entry.contextEnabled && ' · context off'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeNote ? (
        <div className="tinker-notes__editor">
          <div className="tinker-notes__editor-header">
            <input
              type="text"
              className="tinker-notes__title-input"
              placeholder="Note title"
              value={titleDraft}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
            <button
              type="button"
              className="tinker-notes__context-toggle"
              title={activeNote.contextEnabled ? 'Disable agent context' : 'Enable agent context'}
              onClick={() => void handleToggleContext()}
            >
              <span className={`tinker-notes__context-dot${activeNote.contextEnabled ? ' tinker-notes__context-dot--enabled' : ''}`} />
              {activeNote.contextEnabled ? 'Context on' : 'Context off'}
            </button>
            <button
              type="button"
              className="tinker-notes__delete-btn"
              title="Delete note"
              onClick={() => void handleDelete()}
            >
              ✕
            </button>
          </div>
          <textarea
            ref={bodyRef}
            className="tinker-notes__body-textarea"
            placeholder="Start writing…"
            value={bodyDraft}
            onChange={(e) => handleBodyChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="tinker-notes__empty">
          {notes.length === 0
            ? 'No notes yet. Create one to start writing.'
            : 'Select a note to start editing.'}
        </div>
      )}
    </div>
  );
};
