export type IntegrationId =
  | 'slack'
  | 'notion'
  | 'linear'
  | 'salesforce'
  | 'gong'
  | 'snowflake'
  | 'zendesk'
  | 'google-calendar'
  | 'ramp-research'
  | 'ramp-inspect'
  | 'ramp-cli';

export type IntegrationStatus =
  | { state: 'connected' }
  | { state: 'reconnecting' }
  | { state: 'error'; message: string }
  | { state: 'disconnected' };

export type IntegrationDescriptor = {
  id: IntegrationId;
  displayName: string;
  icon: string;
  status: IntegrationStatus;
};

export type MCPToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type MCPClient = {
  id: IntegrationId;
  listTools(): Promise<MCPToolDescriptor[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
};

export type IntegrationRegistry = {
  list(): IntegrationDescriptor[];
  get(id: IntegrationId): MCPClient | null;
  register(client: MCPClient): void;
  healAll(): Promise<void>;
};
