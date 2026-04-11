import type {
  IntegrationDescriptor,
  IntegrationId,
  IntegrationRegistry,
  MCPClient,
} from '@ramp-glass/shared-types';

export const createIntegrationRegistry = (): IntegrationRegistry => {
  const clients = new Map<IntegrationId, MCPClient>();
  const descriptors: IntegrationDescriptor[] = [];

  return {
    list: () => descriptors,
    get: (id) => clients.get(id) ?? null,
    register: (client) => {
      clients.set(client.id, client);
    },
    healAll: async () => {
      throw new Error('integrations.healAll: not yet implemented — see tasks/integrations.md');
    },
  };
};

export const createSlackClient = (_config: { token: string }): MCPClient => {
  throw new Error('createSlackClient: not yet implemented — see tasks/integrations.md');
};
export const createNotionClient = (_config: { token: string }): MCPClient => {
  throw new Error('createNotionClient: not yet implemented — see tasks/integrations.md');
};
export const createLinearClient = (_config: { token: string }): MCPClient => {
  throw new Error('createLinearClient: not yet implemented — see tasks/integrations.md');
};
export const createSalesforceClient = (_config: { token: string }): MCPClient => {
  throw new Error('createSalesforceClient: not yet implemented — see tasks/integrations.md');
};
export const createGongClient = (_config: { token: string }): MCPClient => {
  throw new Error('createGongClient: not yet implemented — see tasks/integrations.md');
};
export const createSnowflakeClient = (_config: { token: string }): MCPClient => {
  throw new Error('createSnowflakeClient: not yet implemented — see tasks/integrations.md');
};
export const createZendeskClient = (_config: { token: string }): MCPClient => {
  throw new Error('createZendeskClient: not yet implemented — see tasks/integrations.md');
};
export const createGoogleCalendarClient = (_config: { token: string }): MCPClient => {
  throw new Error('createGoogleCalendarClient: not yet implemented — see tasks/integrations.md');
};
export const createRampResearchClient = (_config: { token: string }): MCPClient => {
  throw new Error('createRampResearchClient: not yet implemented — see tasks/integrations.md');
};
export const createRampInspectClient = (_config: { token: string }): MCPClient => {
  throw new Error('createRampInspectClient: not yet implemented — see tasks/integrations.md');
};
export const createRampCliClient = (_config: { token: string }): MCPClient => {
  throw new Error('createRampCliClient: not yet implemented — see tasks/integrations.md');
};
