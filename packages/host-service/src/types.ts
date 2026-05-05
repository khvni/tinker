/**
 * Public contract types for `@tinker/host-service`.
 *
 * Per `agent-knowledge/features/11-host-service.md` and decision [[D17]]:
 * - Config fields are all required. Defaults silently leak presentation concerns into host.
 * - Providers are dependency-injected by the device layer (Tauri shell today, headless launcher later).
 * - Host identity is intrinsic and never accepted as config (see `identity.ts`).
 */

export type HostConfig = {
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  /** Absolute path to the user's vault root, or null on first-run before vault selection. */
  vaultRoot: string | null;
  /** Absolute path to the SQL migrations directory. */
  migrationsPath: string;
  /** CORS allowlist for browser-style devices. Empty array disables all cross-origin access. */
  allowedOrigins: readonly string[];
  /** Bind host. `'127.0.0.1'` for co-resident, `'0.0.0.0'` for LAN host. */
  listenHost: string;
  /** Bind port. `0` lets the OS pick a free port. */
  listenPort: number;
};

/**
 * Validates inbound PSK tokens. The device generates the secret and keeps it
 * in memory (the Rust coordinator passes it via env var); the host only validates.
 */
export type HostAuthProvider = {
  validate(token: string | null): boolean;
};

/** Returns credentials for git operations (push/fetch authentication). */
export type GitCredentialProvider = {
  resolve(scope: string): Promise<{ token: string } | null>;
};

/** Returns provider env vars to inject into the OpenCode sidecar. */
export type ModelProviderResolver = {
  envVars(): Promise<Record<string, string>>;
};

/** Device-side keychain writer for integration credentials. */
export type IntegrationCredentialWriter = {
  write(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
};

export type HostProviders = {
  hostAuth: HostAuthProvider;
  credentials: GitCredentialProvider;
  modelResolver: ModelProviderResolver;
  secretsWriter: IntegrationCredentialWriter;
};

export type HealthCheckResponse = {
  status: 'ok';
  hostId: string;
  version: string;
};

export type HostInfoResponse = {
  hostId: string;
  hostName: string;
  platform: NodeJS.Platform;
  version: string;
  uptimeMs: number;
  deviceCount: number;
};

export type HostAppHandle = {
  /** Intrinsic host identity. Stable across restarts. */
  readonly hostId: string;
  /**
   * Bind the listener. Resolves once `health.check` is reachable.
   * Returns the actual bound port (relevant when `listenPort: 0`).
   */
  start(): Promise<{ port: number; hostId: string }>;
  /** Stop accepting new connections and close the listener. Idempotent. */
  stop(): Promise<void>;
};
