import { useEffect, useMemo, useState, type JSX } from 'react';
import type { MemoryStore } from '@tinker/shared-types';
import type { IDockviewPanelProps } from 'dockview-react';
import { relativeVaultPath, resolveVaultPath, walkVaultFiles } from '@tinker/memory';
import { getPaneKindForPath, getPanelIdForPath, getPanelTitleForPath } from '../renderers/file-utils.js';
import { useDockviewApi } from '../workspace/DockviewContext.js';

type VaultBrowserParams = {
  memoryStore?: MemoryStore;
  vaultPath?: string | null;
};

type VaultBrowserProps = IDockviewPanelProps<VaultBrowserParams> & {
  vaultRevision: number;
};

type GroupedFiles = Array<{
  directory: string;
  files: string[];
}>;

const groupFilesByDirectory = (vaultPath: string, absolutePaths: string[]): GroupedFiles => {
  const groups = new Map<string, string[]>();

  for (const absolutePath of absolutePaths) {
    const relativePath = relativeVaultPath(vaultPath, absolutePath);
    const directory = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : 'Vault root';
    const existing = groups.get(directory) ?? [];
    existing.push(relativePath);
    groups.set(directory, existing);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([directory, files]) => ({
      directory,
      files: files.sort((left, right) => left.localeCompare(right)),
    }));
};

const getReferencePanelId = (dockviewApi: NonNullable<ReturnType<typeof useDockviewApi>>): string | null => {
  return dockviewApi.activePanel?.id ?? dockviewApi.panels[0]?.id ?? null;
};

export const VaultBrowser = ({ params, vaultRevision }: VaultBrowserProps): JSX.Element => {
  const dockviewApi = useDockviewApi();
  const memoryStore = params?.memoryStore;
  const vaultPath = params?.vaultPath ?? null;
  const [files, setFiles] = useState<string[]>([]);
  const [recentEntityIds, setRecentEntityIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultPath) {
      setFiles([]);
      setRecentEntityIds(new Set());
      setError(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        const [recentEntities, vaultFiles] = await Promise.all([
          memoryStore?.recentEntities(50) ?? Promise.resolve([]),
          walkVaultFiles(vaultPath),
        ]);

        if (!active) {
          return;
        }

        setFiles(vaultFiles);
        setRecentEntityIds(
          new Set(
            recentEntities
              .flatMap((entity) => entity.sources)
              .filter((source) => source.integration === 'vault')
              .map((source) => source.externalId),
          ),
        );
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setFiles([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [memoryStore, vaultPath, vaultRevision]);

  const groupedFiles = useMemo(() => {
    return vaultPath ? groupFilesByDirectory(vaultPath, files) : [];
  }, [files, vaultPath]);

  const openFile = (absolutePath: string): void => {
    if (!dockviewApi) {
      return;
    }

    const component = getPaneKindForPath(absolutePath);
    const panelId = getPanelIdForPath(component, absolutePath);
    const existingPanel = dockviewApi.panels.find((panel) => panel.id === panelId);

    if (existingPanel) {
      existingPanel.api.updateParameters({ path: absolutePath });
      existingPanel.api.setActive();
      return;
    }

    const referencePanelId = getReferencePanelId(dockviewApi);
    dockviewApi.addPanel({
      id: panelId,
      component,
      title: getPanelTitleForPath(absolutePath),
      params: { path: absolutePath },
      ...(referencePanelId
        ? {
            position: {
              referencePanel: referencePanelId,
              direction: 'right' as const,
            },
          }
        : {}),
    });
  };

  return (
    <section className="tinker-pane tinker-vault-browser">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Vault</p>
          <h2>{vaultPath ? getPanelTitleForPath(vaultPath) : 'No vault connected'}</h2>
        </div>
        <span className="tinker-pill">{files.length} files</span>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!vaultPath ? <p className="tinker-muted">Connect a vault to browse local files.</p> : null}

      {vaultPath ? (
        <div className="tinker-vault-groups">
          {groupedFiles.map((group) => (
            <section key={group.directory} className="tinker-vault-group">
              <h3>{group.directory}</h3>
              <div className="tinker-vault-list">
                {group.files.map((relativePath) => {
                  const absolutePath = resolveVaultPath(vaultPath, relativePath);
                  return (
                    <button
                      key={relativePath}
                      className={`tinker-vault-entry ${recentEntityIds.has(relativePath) ? 'tinker-vault-entry--recent' : ''}`}
                      type="button"
                      onClick={() => openFile(absolutePath)}
                    >
                      <span>{getPanelTitleForPath(relativePath)}</span>
                      <span className="tinker-vault-path">{relativePath}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
};
