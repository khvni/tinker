/**
 * Type contract for the preload → renderer bridge.
 *
 * Electron main injects these values via `contextBridge.exposeInMainWorld`
 * so the renderer can construct a `@tinker/host-client` without touching
 * Node APIs or knowing how the host was launched.
 */

export type HostConnectionInfo = {
  /** Base URL for the host, e.g. `http://127.0.0.1:51724`. */
  baseUrl: string;
  /** PSK for `Authorization: Bearer <secret>`. */
  secret: string;
  /** Stable host identity. */
  hostId: string;
};

export type TinkerBridge = {
  /** Resolves once the host is healthy and connection info is available. */
  getHostConnection(): Promise<HostConnectionInfo>;
};
