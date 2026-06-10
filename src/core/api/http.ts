// Minimal fetch wrapper replacing Angular's HttpClient.
//
// - Attaches the OIDC access token to secure routes (any URL containing
//   '/api/'), mirroring the `secureRoutes` config of the Angular app.
// - On 401/403 responses, invokes the registered unauthorized handler
//   (forced logout + redirect to login), mirroring the auth interceptor.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    url: string,
  ) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpError';
  }
}

type TokenProvider = () => Promise<string | undefined>;
type UnauthorizedHandler = (status: number) => void;

let tokenProvider: TokenProvider | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setAuthTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function isSecureRoute(url: string): boolean {
  return url.includes('/api/');
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  if (isSecureRoute(url) && tokenProvider) {
    const token = await tokenProvider();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      unauthorizedHandler?.(response.status);
    }
    const body = await response.text().catch(() => '');
    throw new HttpError(response.status, response.statusText, body, url);
  }

  return response;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const http = {
  async get<T>(url: string): Promise<T> {
    return parseJson<T>(await request(url));
  },

  async getText(url: string): Promise<string> {
    return (await request(url)).text();
  },

  async post<T>(url: string, body: unknown): Promise<T> {
    return parseJson<T>(await request(url, jsonInit('POST', body)));
  },

  async put<T>(url: string, body: unknown): Promise<T> {
    return parseJson<T>(await request(url, jsonInit('PUT', body)));
  },

  async patch<T>(url: string, body: unknown): Promise<T> {
    return parseJson<T>(await request(url, jsonInit('PATCH', body)));
  },

  async delete(url: string): Promise<void> {
    await request(url, { method: 'DELETE' });
  },
};
