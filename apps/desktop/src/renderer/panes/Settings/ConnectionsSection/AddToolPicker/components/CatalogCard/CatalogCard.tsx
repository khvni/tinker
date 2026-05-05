import { useCallback, useState, type JSX } from 'react';
import { Button, TextInput } from '@tinker/design';
import type { CatalogMcp } from '../../available-mcps.js';
import { useField } from '../../use-field.js';

type CatalogCardProps = {
  mcp: CatalogMcp;
  alreadyAdded: boolean;
  onAdd: (catalog: CatalogMcp, secret: string) => void;
};

export const CatalogCard = ({ mcp, alreadyAdded, onAdd }: CatalogCardProps): JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [secret, onSecretChange] = useField();

  const handleAdd = useCallback(() => {
    onAdd(mcp, secret);
  }, [mcp, secret, onAdd]);

  if (alreadyAdded) {
    return (
      <li className="tinker-add-tool-picker__card" aria-disabled="true" data-available="false">
        <div className="tinker-add-tool-picker__card-body">
          <p className="tinker-add-tool-picker__card-title">{mcp.label}</p>
          <p className="tinker-add-tool-picker__card-blurb">Already added</p>
        </div>
      </li>
    );
  }

  return (
    <li className="tinker-add-tool-picker__card" data-available="true">
      <div className="tinker-add-tool-picker__card-body">
        <p className="tinker-add-tool-picker__card-title">{mcp.label}</p>
        <p className="tinker-add-tool-picker__card-blurb">{mcp.description}</p>
      </div>
      {expanded ? (
        <div className="tinker-add-tool-picker__card-secret">
          <TextInput
            value={secret}
            onChange={onSecretChange}
            placeholder={mcp.headerPlaceholder}
            aria-label={mcp.headerName}
          />
          <Button variant="primary" size="s" disabled={secret.trim().length === 0} onClick={handleAdd}>
            Connect
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="s" onClick={() => setExpanded(true)}>
          Set up
        </Button>
      )}
    </li>
  );
};
