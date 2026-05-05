export { createHostApp, type CreateHostAppArgs } from './createHostApp.js';
export { createSharedSecretAuth, extractBearerToken } from './auth.js';
export { loadHostIdentity, type HostIdentity, type LoadHostIdentityOptions } from './identity.js';
export { HOST_SERVICE_VERSION } from './version.js';
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
