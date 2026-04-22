import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { betterAuth } from 'better-auth';

type DesktopProvider = 'google' | 'github' | 'microsoft';

type SessionPayload = {
  provider: DesktopProvider;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
};

type PendingTicketRecord = {
  status: 'pending';
  provider: DesktopProvider;
  expiresAt: number;
};

type ReadyTicketRecord = {
  status: 'ready';
  provider: DesktopProvider;
  expiresAt: number;
  payload: SessionPayload;
};

type FailedTicketRecord = {
  status: 'error';
  provider: DesktopProvider;
  expiresAt: number;
  error: string;
};

type AuthTicketRecord = PendingTicketRecord | ReadyTicketRecord | FailedTicketRecord;

type StartAuthRequest = {
  provider: DesktopProvider;
};

const TRANSFER_TTL_MS = 5 * 60 * 1000;
const SESSION_FALLBACK_TTL_MS = 60 * 60 * 1000;
const DEFAULT_BETTER_AUTH_PORT = 3147;
const BRIDGE_SECRET_HEADER = 'x-tinker-bridge-secret';

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const optionalEnv = (name: string): string | null => {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
};

const isPlaceholderValue = (value: string): boolean => {
  return /PLACEHOLDER|^YOUR_|^CHANGE(?:_|-)ME$/iu.test(value.trim());
};

const looksLikeGoogleClientId = (value: string): boolean => {
  return value.trim().endsWith('.apps.googleusercontent.com');
};

const parsePort = (value: string): number => {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const authPort = parsePort(optionalEnv('TINKER_BETTER_AUTH_PORT') ?? String(DEFAULT_BETTER_AUTH_PORT));
const bridgeSecret = requiredEnv('TINKER_BETTER_AUTH_BRIDGE_SECRET');
const baseURL = `http://127.0.0.1:${authPort}`;
const googleClientId = optionalEnv('GOOGLE_OAUTH_CLIENT_ID');
const googleClientSecret = optionalEnv('GOOGLE_OAUTH_CLIENT_SECRET');
const githubClientId = optionalEnv('GITHUB_OAUTH_CLIENT_ID');
const githubClientSecret = optionalEnv('GITHUB_OAUTH_CLIENT_SECRET');
const microsoftClientId = optionalEnv('MICROSOFT_OAUTH_CLIENT_ID');
const microsoftClientSecret = optionalEnv('MICROSOFT_OAUTH_CLIENT_SECRET');
const microsoftTenantId = optionalEnv('MICROSOFT_OAUTH_TENANT_ID');
const configuredGoogleClientId =
  googleClientId && !isPlaceholderValue(googleClientId) && looksLikeGoogleClientId(googleClientId) ? googleClientId : null;
const configuredGoogleClientSecret = googleClientSecret && !isPlaceholderValue(googleClientSecret) ? googleClientSecret : null;
const configuredGithubClientId = githubClientId && !isPlaceholderValue(githubClientId) ? githubClientId : null;
const configuredGithubClientSecret = githubClientSecret && !isPlaceholderValue(githubClientSecret) ? githubClientSecret : null;
const configuredMicrosoftClientId = microsoftClientId && !isPlaceholderValue(microsoftClientId) ? microsoftClientId : null;
const configuredMicrosoftClientSecret =
  microsoftClientSecret && !isPlaceholderValue(microsoftClientSecret) ? microsoftClientSecret : null;
const configuredMicrosoftTenantId = microsoftTenantId && !isPlaceholderValue(microsoftTenantId) ? microsoftTenantId : null;

const authTickets = new Map<string, AuthTicketRecord>();

const socialProviders = {
  ...(configuredGoogleClientId && configuredGoogleClientSecret
    ? {
        google: {
          clientId: configuredGoogleClientId,
          clientSecret: configuredGoogleClientSecret,
          redirectURI: `${baseURL}/api/auth/callback/google`,
          scope: ['openid', 'email', 'profile'],
          disableDefaultScope: true,
          accessType: 'offline' as const,
          prompt: 'select_account' as const,
        },
      }
    : {}),
  ...(configuredGithubClientId && configuredGithubClientSecret
    ? {
        github: {
          clientId: configuredGithubClientId,
          clientSecret: configuredGithubClientSecret,
          redirectURI: `${baseURL}/api/auth/callback/github`,
          scope: ['read:user', 'user:email'],
          disableDefaultScope: true,
        },
      }
    : {}),
  ...(configuredMicrosoftClientId
    ? {
        microsoft: {
          clientId: configuredMicrosoftClientId,
          clientSecret: configuredMicrosoftClientSecret ?? '',
          redirectURI: `${baseURL}/api/auth/callback/microsoft`,
          tenantId: configuredMicrosoftTenantId ?? 'common',
          authority: 'https://login.microsoftonline.com',
          scope: ['openid', 'email', 'profile', 'offline_access'],
          disableDefaultScope: true,
          prompt: 'select_account' as const,
        },
      }
    : {}),
};

const enabledProviders = new Set(Object.keys(socialProviders).filter((value): value is DesktopProvider => {
  return value === 'google' || value === 'github' || value === 'microsoft';
}));

const auth = betterAuth({
  appName: 'Tinker',
  baseURL,
  secret: optionalEnv('TINKER_BETTER_AUTH_SECRET') ?? bridgeSecret,
  trustedOrigins: [baseURL],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300,
      strategy: 'compact',
    },
  },
  account: {
    storeStateStrategy: 'cookie',
    storeAccountCookie: true,
    accountLinking: {
      enabled: false,
    },
  },
  socialProviders,
});

const isDesktopProvider = (value: string): value is DesktopProvider => {
  return value === 'google' || value === 'github' || value === 'microsoft';
};

const isConfiguredProvider = (provider: DesktopProvider): boolean => {
  return enabledProviders.has(provider);
};

const pruneTransfers = (): void => {
  const now = Date.now();
  for (const [ticket, record] of authTickets.entries()) {
    if (record.expiresAt <= now) {
      authTickets.delete(ticket);
    }
  }
};

const readBody = async (request: IncomingMessage): Promise<Uint8Array | undefined> => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

const toHeaders = (request: IncomingMessage): Headers => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
      continue;
    }

    headers.set(key, value);
  }

  return headers;
};

const toRequest = async (request: IncomingMessage): Promise<Request> => {
  const url = new URL(request.url ?? '/', baseURL);
  const body = await readBody(request);

  const init: RequestInit = {
    method: request.method ?? 'GET',
    headers: toHeaders(request),
  };

  if (body !== undefined) {
    init.body = Buffer.from(body);
  }

  return new Request(url, init);
};

const getSetCookieValues = (headers: Headers): string[] => {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const values = withSetCookie.getSetCookie?.();
  if (values && values.length > 0) {
    return values;
  }

  const value = headers.get('set-cookie');
  return value ? [value] : [];
};

const sendResponse = async (response: Response, reply: ServerResponse): Promise<void> => {
  reply.statusCode = response.status;
  reply.statusMessage = response.statusText;

  for (const setCookie of getSetCookieValues(response.headers)) {
    reply.appendHeader('set-cookie', setCookie);
  }

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }

    reply.setHeader(key, value);
  });

  const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
  reply.end(body);
};

const errorResponse = (status: number, message: string): Response => {
  return Response.json({ error: message }, { status });
};

const authorizedBridgeRequest = (request: Request): boolean => {
  return request.headers.get(BRIDGE_SECRET_HEADER) === bridgeSecret;
};

const parseStartAuthRequest = (value: unknown): StartAuthRequest | null => {
  if (!isRecord(value) || typeof value.provider !== 'string' || !isDesktopProvider(value.provider)) {
    return null;
  }

  return { provider: value.provider };
};

const browserStartUrl = (ticket: string): string => {
  const url = new URL('/auth/start', baseURL);
  url.searchParams.set('ticket', ticket);
  return url.toString();
};

const authCallbackUrl = (provider: DesktopProvider, ticket: string): string => {
  const url = new URL(`/auth/callback/${provider}`, baseURL);
  url.searchParams.set('ticket', ticket);
  return url.toString();
};

const getActiveTicket = (ticket: string): AuthTicketRecord | null => {
  const record = authTickets.get(ticket);
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    authTickets.delete(ticket);
    return null;
  }

  return record;
};

const setTicketError = (ticket: string, provider: DesktopProvider, message: string): FailedTicketRecord => {
  const record: FailedTicketRecord = {
    status: 'error',
    provider,
    expiresAt: Date.now() + TRANSFER_TTL_MS,
    error: message,
  };
  authTickets.set(ticket, record);
  return record;
};

const pageResponse = (title: string, message: string, headers?: Headers): Response => {
  const responseHeaders = new Headers({
    'content-type': 'text/html; charset=utf-8',
  });

  if (headers) {
    for (const setCookie of getSetCookieValues(headers)) {
      responseHeaders.append('set-cookie', setCookie);
    }
  }

  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #111827;
        color: #f9fafb;
        font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        max-width: 28rem;
        padding: 2rem;
        text-align: center;
      }

      h1 {
        margin: 0 0 0.75rem;
        font-size: 1.5rem;
      }

      p {
        margin: 0;
        color: #d1d5db;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;

  return new Response(body, {
    status: 200,
    headers: responseHeaders,
  });
};

const readSessionPayload = async (request: Request, provider: DesktopProvider): Promise<SessionPayload> => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new Error('missing_session');
  }

  const accounts = await auth.api.listUserAccounts({
    headers: request.headers,
  });
  const account = accounts.find((entry) => entry.providerId === provider);

  if (!account) {
    throw new Error('missing_account');
  }

  const access = await auth.api.getAccessToken({
    headers: request.headers,
    body: {
      providerId: provider,
      accountId: account.accountId,
    },
  });

  let refreshToken = '';
  let refreshScope = access.scopes;
  let expiresAt = access.accessTokenExpiresAt;

  try {
    const refresh = await auth.api.refreshToken({
      headers: request.headers,
      body: {
        providerId: provider,
        accountId: account.accountId,
      },
    });

    refreshToken = refresh.refreshToken;
    refreshScope = refresh.scope?.split(/[ ,]+/u).filter((scope) => scope.length > 0) ?? refreshScope;
    expiresAt = refresh.accessTokenExpiresAt ?? expiresAt;
  } catch (error) {
    if (provider === 'google' || provider === 'microsoft') {
      throw error;
    }
  }

  if (access.accessToken.length === 0) {
    throw new Error('missing_access_token');
  }

  if ((provider === 'google' || provider === 'microsoft') && refreshToken.length === 0) {
    throw new Error('missing_refresh_token');
  }

  return {
    provider,
    userId: account.accountId,
    email: session.user.email,
    displayName: session.user.name,
    avatarUrl: session.user.image ?? null,
    accessToken: access.accessToken,
    refreshToken,
    expiresAt: (expiresAt ?? new Date(Date.now() + SESSION_FALLBACK_TTL_MS)).toISOString(),
    scopes: refreshScope.length > 0 ? refreshScope : account.scopes,
  };
};

const startAuthSession = async (request: Request): Promise<Response> => {
  if (!authorizedBridgeRequest(request)) {
    return errorResponse(401, 'Unauthorized.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body.');
  }

  const startRequest = parseStartAuthRequest(body);
  if (!startRequest) {
    return errorResponse(400, 'Missing or invalid provider.');
  }

  if (!isConfiguredProvider(startRequest.provider)) {
    return errorResponse(503, `${startRequest.provider} is not configured.`);
  }

  const ticket = randomUUID();
  authTickets.set(ticket, {
    status: 'pending',
    provider: startRequest.provider,
    expiresAt: Date.now() + TRANSFER_TTL_MS,
  });

  return Response.json({
    ticket,
    authorizationUrl: browserStartUrl(ticket),
  });
};

const continueAuthSession = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket');

  if (!ticket || ticket.trim().length === 0) {
    return pageResponse('Sign-in expired', 'Return to Tinker and start sign-in again.');
  }

  const record = getActiveTicket(ticket);
  if (!record || record.status !== 'pending') {
    return pageResponse('Sign-in expired', 'Return to Tinker and start sign-in again.');
  }

  return auth.api.signInSocial({
    asResponse: true,
    headers: request.headers,
    body: {
      provider: record.provider,
      callbackURL: authCallbackUrl(record.provider, ticket),
      errorCallbackURL: authCallbackUrl(record.provider, ticket),
      newUserCallbackURL: authCallbackUrl(record.provider, ticket),
    },
  });
};

const completeAuthSession = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket');
  const providerValue = url.pathname.split('/').pop();

  if (!ticket || ticket.trim().length === 0) {
    return pageResponse('Sign-in failed', 'Return to Tinker and try again.');
  }

  if (!providerValue || !isDesktopProvider(providerValue)) {
    return pageResponse('Sign-in failed', 'Return to Tinker and try again.');
  }

  const record = getActiveTicket(ticket);
  if (!record || record.provider !== providerValue) {
    return pageResponse('Sign-in failed', 'Return to Tinker and try again.');
  }

  if (url.searchParams.get('error')) {
    const errorDescription = url.searchParams.get('error_description');
    const message = errorDescription && errorDescription.trim().length > 0 ? errorDescription : 'oauth_failed';
    setTicketError(ticket, providerValue, message);
    return pageResponse('Sign-in failed', 'Return to Tinker and retry sign-in.');
  }

  try {
    const payload = await readSessionPayload(request, providerValue);
    authTickets.set(ticket, {
      status: 'ready',
      provider: providerValue,
      expiresAt: Date.now() + TRANSFER_TTL_MS,
      payload,
    });

    let signOutHeaders: Headers | undefined;
    try {
      const signOut = await auth.api.signOut({
        headers: request.headers,
        returnHeaders: true,
      });
      signOutHeaders = signOut.headers;
    } catch {
      signOutHeaders = undefined;
    }

    return pageResponse('Sign-in complete', 'You can close this window and return to Tinker.', signOutHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'oauth_failed';
    setTicketError(ticket, providerValue, message);
    return pageResponse('Sign-in failed', 'Return to Tinker and retry sign-in.');
  }
};

const readAuthSession = (request: Request): Response => {
  if (!authorizedBridgeRequest(request)) {
    return errorResponse(401, 'Unauthorized.');
  }

  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket');

  if (!ticket || ticket.trim().length === 0) {
    return errorResponse(400, 'Missing ticket.');
  }

  const record = getActiveTicket(ticket);
  if (!record) {
    return Response.json({ authenticated: false, status: 'expired' }, { status: 401 });
  }

  if (record.status === 'pending') {
    return Response.json({ authenticated: false, status: 'pending' });
  }

  if (record.status === 'error') {
    return Response.json({
      authenticated: false,
      status: 'error',
      error: record.error,
    });
  }

  authTickets.delete(ticket);
  return Response.json({
    authenticated: true,
    provider: record.payload.provider,
    user: {
      id: record.payload.userId,
      providerUserId: record.payload.userId,
      email: record.payload.email,
      displayName: record.payload.displayName,
      avatarUrl: record.payload.avatarUrl,
    },
    tokens: {
      accessToken: record.payload.accessToken,
      refreshToken: record.payload.refreshToken,
      expiresAt: record.payload.expiresAt,
      scopes: record.payload.scopes,
    },
  });
};

const logoutAuthSession = async (request: Request): Promise<Response> => {
  if (!authorizedBridgeRequest(request)) {
    return errorResponse(401, 'Unauthorized.');
  }

  try {
    const body = (await request.json()) as unknown;
    if (isRecord(body) && typeof body.ticket === 'string' && body.ticket.trim().length > 0) {
      authTickets.delete(body.ticket);
    }
  } catch {
    // Malformed JSON body — treat as a no-op revoke, caller still gets 204.
  }

  return new Response(null, { status: 204 });
};

const handleRequest = async (request: Request): Promise<Response> => {
  pruneTransfers();

  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return Response.json({ ok: true });
  }

  if (url.pathname.startsWith('/api/auth/')) {
    return auth.handler(request);
  }

  if (url.pathname === '/auth/start' && request.method === 'POST') {
    return startAuthSession(request);
  }

  if (url.pathname === '/auth/start' && request.method === 'GET') {
    return continueAuthSession(request);
  }

  if (url.pathname.startsWith('/auth/callback/')) {
    return completeAuthSession(request);
  }

  if (url.pathname === '/auth/session') {
    return readAuthSession(request);
  }

  if (url.pathname === '/auth/logout' && request.method === 'POST') {
    return logoutAuthSession(request);
  }

  return errorResponse(404, 'Not found.');
};

let server:
  | ReturnType<typeof createServer>
  | null = null;

if (process.env.VITEST !== 'true') {
  server = createServer(async (request, response) => {
    try {
      const webRequest = await toRequest(request);
      const webResponse = await handleRequest(webRequest);
      await sendResponse(webResponse, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unhandled auth sidecar error.';
      await sendResponse(errorResponse(500, message), response);
    }
  });

  server.listen(authPort, '127.0.0.1', () => {
    process.stdout.write(`[better-auth] listening on ${baseURL}\n`);
  });
}

const shutdown = (): void => {
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    process.exit(0);
  });
};

if (server) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
