export { createHostApp, type CreateHostAppArgs } from './createHostApp.js';
export { createSharedSecretAuth, extractBearerToken } from './auth.js';
export {
  createGooseRuntimeAdapter,
  createRunEventLog,
  type GooseRuntimeAdapter,
  type CreateAdapterOptions,
  type RunEventLog,
  type GooseRunConfig,
  type GooseRunEvent,
  type GooseRunEventListener,
  type GooseRunStatus,
  type GooseRunSummary,
} from './goose/index.js';
export { loadHostIdentity, type HostIdentity, type LoadHostIdentityOptions } from './identity.js';
export { createRunManager, type RunEventListener, type RunManager, type StoredRunEvent } from './runs.js';
export { HOST_SERVICE_VERSION } from './version.js';
export {
  discoverAcpConnectors,
  type AcpConnectorId,
  type AcpConnectorState,
  type AcpConnectorStatus,
  type AcpDiscoveryResult,
  type GooseStatus,
} from './acp-discovery.js';
export type {
  GitCredentialProvider,
  HealthCheckResponse,
  HostAppHandle,
  HostAuthProvider,
  HostConfig,
  HostInfoResponse,
  HostProviders,
  IntegrationCredentialWriter,
  ModelProviderResolver,
} from './types.js';
