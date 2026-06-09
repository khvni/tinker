export { createHostApp, type CreateHostAppArgs } from './createHostApp.js';
export { createSharedSecretAuth, extractBearerToken } from './auth.js';
export {
  createGooseRuntimeAdapter,
  createRunEventLog,
  type GooseRuntimeAdapter,
  type CreateAdapterOptions,
  type RunEventLog,
} from './goose/index.js';
export { loadHostIdentity, type HostIdentity, type LoadHostIdentityOptions } from './identity.js';
export { resolveDataPaths, ensureDataPaths, type HostDataPaths, type ResolveDataPathsOptions } from './dataPaths.js';
export {
  writeManifest,
  readManifest,
  listManifests,
  validateManifestSecret,
  removeManifest,
  type ManifestEntry,
  type WriteManifestOptions,
} from './manifest.js';
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
  RunStatus,
  WorkspaceCurrentResponse,
} from './types.js';
