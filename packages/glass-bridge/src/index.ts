/**
 * Glass Bridge — wraps @opencode-ai/sdk to provide:
 * 1. OpenCode server lifecycle (createOpencode starts the server + returns a client)
 * 2. Session management (create, prompt, abort)
 * 3. Streaming events relay to the UI
 * 4. Memory injection before each turn
 * 5. Model selection passthrough
 * 6. Auth credential forwarding (SSO tokens → OpenCode → MCP servers)
 *
 * SDK reference: https://opencode.ai/docs/sdk/
 */

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; output: string }
  | { type: 'file_written'; path: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ModelRef = {
  providerID: string;
  modelID: string;
};

export type GlassBridgeConfig = {
  memoryTopK?: number;
};

export type GlassBridge = {
  /** Start OpenCode server + connect. Call once on app launch. */
  init(): Promise<void>;

  /** Shut down OpenCode server. Call on app quit. */
  shutdown(): Promise<void>;

  /** Health check. */
  isHealthy(): Promise<boolean>;

  /** Create a new chat session. */
  createSession(): Promise<string>;

  /** Send a message. Returns an async iterable of stream events. */
  sendMessage(sessionId: string, text: string, model?: ModelRef): AsyncIterable<StreamEvent>;

  /** Abort an in-flight message. */
  abort(sessionId: string): Promise<void>;

  /** List available models from all configured providers. */
  listModels(): Promise<Array<{ providerID: string; modelID: string; name: string }>>;

  /** Forward SSO credentials to OpenCode so MCP servers can use them. */
  setAuth(providerId: string, credentials: Record<string, string>): Promise<void>;

  /** List available agents (build, plan, etc.). */
  listAgents(): Promise<Array<{ name: string; description: string }>>;

  /** Get messages for a session. */
  getMessages(sessionId: string): Promise<unknown[]>;
};

export const createGlassBridge = (_config: GlassBridgeConfig): GlassBridge => {
  // Implementation will use:
  //   import { createOpencode } from "@opencode-ai/sdk"
  //   const { client } = await createOpencode()
  //
  // Then wrap client.session.*, client.event.subscribe(), client.auth.set(), etc.
  // See tasks/glass-bridge.md for full implementation brief.
  throw new Error('glass-bridge: not yet implemented — see tasks/glass-bridge.md');
};
