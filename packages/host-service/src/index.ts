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
  type AcpConnectorState,
  type AcpConnectorStatus,
  type AcpDiscoveryResult,
  type DiscoverAcpConnectorsOptions,
} from './acp-discovery.js';
export {
  createRegistryManager,
  type AcpBinaryDistribution,
  type AcpAgentDistribution,
  type AcpAgentEnv,
  type AcpAuthDelegation,
  type AcpPlatformKey,
  type AcpRegistry,
  type AcpRegistryAgent,
  type RegistryManager,
  type RegistryManagerOptions,
} from './registry-manager.js';
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
