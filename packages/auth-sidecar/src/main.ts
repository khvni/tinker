import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { betterAuth } from 'better-auth';

type DesktopProvider = 'google' | 'github';

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

type TransferRecord = {
  expiresAt: number;
  payload: SessionPayload;
};

const TRANSFER_TTL_MS = 5 * 60 * 1000;
const SESSION_FALLBACK_TTL_MS = 60 * 60 * 1000;
const DEFAULT_BETTER_AUTH_PORT = 3147;

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

const authPort = parsePort(optionalEnv('TINKER_BETTER_AUTH_PORT') ?? String(DEFAULT_BETTER_AUTH_PORT));
const bridgeSecret = requiredEnv('TINKER_BETTER_AUTH_BRIDGE_SECRET');
const baseURL = `http://127.0.0.1:${authPort}`;
const googleClientId = optionalEnv('GOOGLE_OAUTH_CLIENT_ID');
const googleClientSecret = optionalEnv('GOOGLE_OAUTH_CLIENT_SECRET');
const githubClientId = optionalEnv('GITHUB_OAUTH_CLIENT_ID');
const githubClientSecret = optionalEnv('GITHUB_OAUTH_CLIENT_SECRET');
const configuredGoogleClientId =
  googleClientId && !isPlaceholderValue(googleClientId) && looksLikeGoogleClientId(googleClientId) ? googleClientId : null;
const configuredGoogleClientSecret = googleClientSecret && !isPlaceholderValue(googleClientSecret) ? googleClientSecret : null;
const configuredGithubClientId = githubClientId && !isPlaceholderValue(githubClientId) ? githubClientId : null;
const configuredGithubClientSecret = githubClientSecret && !isPlaceholderValue(githubClientSecret) ? githubClientSecret : null;

const transfers = new Map<string, TransferRecord>();

const socialProviders = {
  ...(configuredGoogleClientId && configuredGoogleClientSecret
    ? {
        google: {
          clientId: configuredGoogleClientId,
          clientSecret: configuredGoogleClientSecret,
          redirectURI: `${baseURL}/api/auth/callback/google`,
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
          ],
        },
      }
    : {}),
  ...(configuredGithubClientId && configuredGithubClientSecret
    ? {
        github: {
          clientId: configuredGithubClientId,
          clientSecret: configuredGithubClientSecret,
          redirectURI: `${baseURL}/api/auth/callback/github`,
          scope: ['read:user', 'user:email', 'repo'],
        },
      }
    : {}),
};

const enabledProviders = new Set(Object.keys(socialProviders));

if (enabledProviders.size === 0) {
  throw new Error('At least one social provider must be configured for Better Auth.');
}

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
  return value === 'google' || value === 'github';
};

const isConfiguredProvider = (provider: DesktopProvider): boolean => {
  return enabledProviders.has(provider);
};

const pruneTransfers = (): void => {
  const now = Date.now();
  for (const [ticket, record] of transfers.entries()) {
    if (record.expiresAt <= now) {
      transfers.delete(ticket);
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

const isLoopbackCallback = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
};

const appRedirect = (appCallback: string, params: Record<string, string | null>, headers?: Headers): Response => {
  const url = new URL(appCallback);

  for (const [key, value] of Object.entries(params)) {
    if (value === null) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  const responseHeaders = new Headers({ Location: url.toString() });
  if (headers) {
    for (const setCookie of getSetCookieValues(headers)) {
      responseHeaders.append('set-cookie', setCookie);
    }
  }

  return new Response(null, { status: 302, headers: responseHeaders });
};

const finishOAuth = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const appCallback = url.searchParams.get('appCallback');
  const ticket = url.searchParams.get('ticket');
  const provider = url.searchParams.get('provider');

  if (!appCallback || !isLoopbackCallback(appCallback)) {
    return errorResponse(400, 'Missing or invalid desktop callback URL.');
  }

  if (!ticket || ticket.trim().length === 0) {
    return appRedirect(appCallback, { error: 'missing_ticket' });
  }

  if (!provider || !isDesktopProvider(provider)) {
    return appRedirect(appCallback, { error: 'invalid_provider' });
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return appRedirect(appCallback, { error: 'missing_session', ticket });
    }

    const accounts = await auth.api.listUserAccounts({
      headers: request.headers,
    });
    const account = accounts.find((entry) => entry.providerId === provider);

    if (!account) {
      return appRedirect(appCallback, { error: 'missing_account', ticket });
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
      if (provider === 'google') {
        throw error;
      }
    }

    if (access.accessToken.length === 0) {
      return appRedirect(appCallback, { error: 'missing_access_token', ticket });
    }

    const signOut = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });

    transfers.set(ticket, {
      expiresAt: Date.now() + TRANSFER_TTL_MS,
      payload: {
        provider,
        userId: account.accountId,
        email: session.user.email,
        displayName: session.user.name,
        avatarUrl: session.user.image ?? null,
        accessToken: access.accessToken,
        refreshToken,
        expiresAt: (expiresAt ?? new Date(Date.now() + SESSION_FALLBACK_TTL_MS)).toISOString(),
        scopes: refreshScope.length > 0 ? refreshScope : account.scopes,
      },
    });

    return appRedirect(appCallback, { ticket }, signOut.headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'oauth_failed';
    return appRedirect(appCallback, { error: message, ticket });
  }
};

const forwardAuthRequest = async (request: Request): Promise<Response> => {
  return auth.handler(request);
};

const startSignIn = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const provider = url.pathname.split('/').pop();
  const appCallback = url.searchParams.get('appCallback');
  const ticket = url.searchParams.get('ticket');

  if (!provider || !isDesktopProvider(provider)) {
    return errorResponse(400, 'Unsupported provider.');
  }

  if (!isConfiguredProvider(provider)) {
    return errorResponse(503, `${provider} is not configured.`);
  }

  if (!appCallback || !isLoopbackCallback(appCallback)) {
    return errorResponse(400, 'Missing or invalid desktop callback URL.');
  }

  if (!ticket || ticket.trim().length === 0) {
    return errorResponse(400, 'Missing ticket.');
  }

  return auth.api.signInSocial({
    asResponse: true,
    headers: request.headers,
    body: {
      provider,
      callbackURL: `${baseURL}/desktop/finish?provider=${provider}&ticket=${encodeURIComponent(ticket)}&appCallback=${encodeURIComponent(appCallback)}`,
      errorCallbackURL: `${baseURL}/desktop/error?ticket=${encodeURIComponent(ticket)}&appCallback=${encodeURIComponent(appCallback)}`,
      newUserCallbackURL: `${baseURL}/desktop/finish?provider=${provider}&ticket=${encodeURIComponent(ticket)}&appCallback=${encodeURIComponent(appCallback)}`,
    },
  });
};

const handleErrorRedirect = (request: Request): Response => {
  const url = new URL(request.url);
  const appCallback = url.searchParams.get('appCallback');

  if (!appCallback || !isLoopbackCallback(appCallback)) {
    return errorResponse(400, 'Missing or invalid desktop callback URL.');
  }

  return appRedirect(appCallback, {
    error: url.searchParams.get('error') ?? 'oauth_failed',
    errorDescription: url.searchParams.get('error_description'),
    ticket: url.searchParams.get('ticket'),
  });
};

const readTransferSession = (request: Request): Response => {
  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket');
  const header = request.headers.get('x-tinker-bridge-secret');

  if (header !== bridgeSecret) {
    return errorResponse(401, 'Unauthorized.');
  }

  if (!ticket || ticket.trim().length === 0) {
    return errorResponse(400, 'Missing ticket.');
  }

  const record = transfers.get(ticket);
  if (!record || record.expiresAt <= Date.now()) {
    transfers.delete(ticket);
    return errorResponse(404, 'Session transfer expired.');
  }

  transfers.delete(ticket);
  return Response.json(record.payload);
};

const handleRequest = async (request: Request): Promise<Response> => {
  pruneTransfers();

  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return Response.json({ ok: true });
  }

  if (url.pathname.startsWith('/api/auth/')) {
    return forwardAuthRequest(request);
  }

  if (url.pathname.startsWith('/desktop/sign-in/')) {
    return startSignIn(request);
  }

  if (url.pathname === '/desktop/finish') {
    return finishOAuth(request);
  }

  if (url.pathname === '/desktop/error') {
    return handleErrorRedirect(request);
  }

  if (url.pathname === '/desktop/session') {
    return readTransferSession(request);
  }

  return errorResponse(404, 'Not found.');
};

const server = createServer(async (request, response) => {
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

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
