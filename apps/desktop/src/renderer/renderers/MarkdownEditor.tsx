import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { IDockviewPanelProps } from 'dockview-react';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

const isSaveShortcut = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
};

type MarkdownEditorProps = IDockviewPanelProps<FilePaneParams> & {
  vaultRevision: number;
};

export const MarkdownEditor = ({ params, vaultRevision }: MarkdownEditorProps): JSX.Element => {
  const path = params?.path;
  const [value, setValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [status, setStatus] = useState('Loading note…');
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const loadedPathRef = useRef<string | null>(null);
  const loadedRevisionRef = useRef<number>(-1);

  useEffect(() => {
    if (!path) {
      setError('Missing markdown file path.');
      setStatus('Unavailable');
      setValue('');
      setSavedValue('');
      dirtyRef.current = false;
      loadedPathRef.current = null;
      return;
    }

    const isSamePath = loadedPathRef.current === path;
    const externalChange = isSamePath && loadedRevisionRef.current !== vaultRevision;

    if (externalChange && dirtyRef.current) {
      setStatus('File changed externally. Save or reopen to avoid overwriting newer content.');
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        setStatus('Loading note…');
        const text = await readTextFile(path);
        if (!active) {
          return;
        }

        setValue(text);
        setSavedValue(text);
        dirtyRef.current = false;
        loadedPathRef.current = path;
        loadedRevisionRef.current = vaultRevision;
        setStatus('Saved');
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setStatus('Failed to load');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [path, vaultRevision]);

  const save = async (): Promise<void> => {
    if (!path || savingRef.current || value === savedValue) {
      return;
    }

    savingRef.current = true;
    setStatus('Saving…');

    try {
      await writeTextFile(path, value);
      setSavedValue(value);
      dirtyRef.current = false;
      setStatus('Saved');
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setStatus('Failed to save');
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Markdown editor</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled note'}</h2>
        </div>
        <span className="tinker-pill">{value === savedValue ? status : 'Unsaved changes'}</span>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}

      <textarea
        className="tinker-markdown-editor"
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setValue(nextValue);
          dirtyRef.current = nextValue !== savedValue;
          setStatus(nextValue === savedValue ? 'Saved' : 'Editing…');
        }}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (isSaveShortcut(event)) {
            event.preventDefault();
            void save();
          }
        }}
        spellCheck={false}
        placeholder="Write your note in Markdown."
      />
    </section>
  );
};
