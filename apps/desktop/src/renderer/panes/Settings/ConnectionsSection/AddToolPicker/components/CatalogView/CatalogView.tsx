import type { JSX } from 'react';
import { Button } from '@tinker/design';
import { CATALOG_MCPS, type CatalogMcp } from '../../available-mcps.js';
import { CatalogCard } from '../CatalogCard/index.js';

type CatalogViewProps = {
  existingIds: ReadonlyArray<string>;
  onAddCatalog: (catalog: CatalogMcp, secret: string) => void;
  onSwitchToCustom: () => void;
};

export const CatalogView = ({
  existingIds,
  onAddCatalog,
  onSwitchToCustom,
}: CatalogViewProps): JSX.Element => (
  <>
    <p className="tinker-add-tool-picker__intro tinker-muted">
      Pick a pre-configured integration or add any MCP server by URL.
    </p>

    <ul className="tinker-add-tool-picker__grid" role="list">
      {CATALOG_MCPS.map((mcp) => {
        const alreadyAdded = existingIds.includes(mcp.id);
        return (
          <CatalogCard
            key={mcp.id}
            mcp={mcp}
            alreadyAdded={alreadyAdded}
            onAdd={onAddCatalog}
          />
        );
      })}

      <li className="tinker-add-tool-picker__card tinker-add-tool-picker__card--custom">
        <div className="tinker-add-tool-picker__card-body">
          <p className="tinker-add-tool-picker__card-title">Custom MCP</p>
          <p className="tinker-add-tool-picker__card-blurb">
            Connect any MCP server by URL
          </p>
        </div>
        <Button variant="secondary" size="s" onClick={onSwitchToCustom}>
          Add
        </Button>
      </li>
    </ul>
  </>
);
