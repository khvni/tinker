import { useCallback, useState, type JSX } from 'react';
import { Button, Modal, TextInput } from '@tinker/design';
import type { CustomMcpEntry } from '@tinker/shared-types';
import type { CatalogMcp } from './available-mcps.js';
import { useField } from './use-field.js';
import { CatalogView } from './components/CatalogView/index.js';
import './AddToolPicker.css';

export type AddToolPickerProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (entry: CustomMcpEntry, secret: string) => void;
  existingIds: ReadonlyArray<string>;
};

type View = 'catalog' | 'custom';

const generateId = (): string => `mcp-${Date.now().toString(36)}`;

export const AddToolPicker = ({
  open,
  onClose,
  onAdd,
  existingIds,
}: AddToolPickerProps): JSX.Element => {
  const [view, setView] = useState<View>('catalog');
  const [label, onLabelChange, resetLabel] = useField();
  const [url, onUrlChange, resetUrl] = useField();
  const [headerName, onHeaderNameChange, resetHeaderName] = useField();
  const [headerValue, onHeaderValueChange, resetHeaderValue] = useField();

  const resetForm = useCallback(() => {
    setView('catalog');
    resetLabel();
    resetUrl();
    resetHeaderName();
    resetHeaderValue();
  }, [resetLabel, resetUrl, resetHeaderName, resetHeaderValue]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleAddCustom = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    let hostname = trimmedUrl;
    try {
      hostname = new URL(trimmedUrl).hostname;
    } catch {
      // keep raw URL as label fallback
    }

    const entry: CustomMcpEntry = {
      id: generateId(),
      label: label.trim() || hostname,
      url: trimmedUrl,
      headerName: headerName.trim(),
      enabled: true,
    };
    onAdd(entry, headerValue.trim());
    handleClose();
  }, [url, label, headerName, headerValue, onAdd, handleClose]);

  const handleAddCatalog = useCallback(
    (catalog: CatalogMcp, secret: string) => {
      const entry: CustomMcpEntry = {
        id: catalog.id,
        label: catalog.label,
        url: catalog.url,
        headerName: catalog.headerName,
        enabled: true,
      };
      onAdd(entry, secret.trim());
      handleClose();
    },
    [onAdd, handleClose],
  );

  const isCustomValid = url.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a tool"
      contentClassName="tinker-add-tool-picker"
    >
      {view === 'catalog' ? (
        <CatalogView
          existingIds={existingIds}
          onAddCatalog={handleAddCatalog}
          onSwitchToCustom={() => setView('custom')}
        />
      ) : (
        <div className="tinker-add-tool-picker__custom-form">
          <p className="tinker-add-tool-picker__intro tinker-muted">
            Enter any MCP server URL. Add an auth header if the server requires one.
          </p>

          <div className="tinker-add-tool-picker__fields">
            <label className="tinker-add-tool-picker__field">
              <span className="tinker-add-tool-picker__field-label">Label (optional)</span>
              <TextInput value={label} onChange={onLabelChange} placeholder="My MCP server" />
            </label>
            <label className="tinker-add-tool-picker__field">
              <span className="tinker-add-tool-picker__field-label">MCP URL</span>
              <TextInput value={url} onChange={onUrlChange} placeholder="https://example.com/mcp" />
            </label>
            <label className="tinker-add-tool-picker__field">
              <span className="tinker-add-tool-picker__field-label">Header name (optional)</span>
              <TextInput value={headerName} onChange={onHeaderNameChange} placeholder="Authorization" />
            </label>
            <label className="tinker-add-tool-picker__field">
              <span className="tinker-add-tool-picker__field-label">Header value (optional)</span>
              <TextInput value={headerValue} onChange={onHeaderValueChange} placeholder="Bearer sk-…" />
            </label>
          </div>

          <div className="tinker-add-tool-picker__actions">
            <Button variant="ghost" size="s" onClick={() => setView('catalog')}>
              Back
            </Button>
            <Button
              variant="primary"
              size="s"
              disabled={!isCustomValid}
              onClick={handleAddCustom}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
