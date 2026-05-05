/**
 * Catalog of MCP integrations the picker can surface.
 *
 * "catalog" entries are pre-configured remote MCPs the user can add with
 * one click (optionally providing an API key). The `url` and `headerName`
 * fields are pre-filled — the user only needs to supply a credential value.
 */
export type CatalogMcp = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly url: string;
  readonly headerName: string;
  readonly headerPlaceholder: string;
};

export const CATALOG_MCPS: ReadonlyArray<CatalogMcp> = [
  {
    id: 'composio',
    label: 'Composio',
    description: 'Connect 250+ apps — Gmail, Slack, GitHub, Notion, and more — through a single MCP endpoint.',
    url: 'https://connect.composio.dev/mcp',
    headerName: 'x-consumer-api-key',
    headerPlaceholder: 'ck_…',
  },
];
