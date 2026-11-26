import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../config/environment';
import {
  clearApiCache,
  http,
  HttpError,
  invalidateApiCache,
  isSecureRoute,
  setAuthTokenProvider,
} from './http';

const API_BASE = environment.apiBaseUrl;

const fetchMock = vi.fn();

beforeEach(() => {
  clearApiCache();
  setAuthTokenProvider(null);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setAuthTokenProvider(null);
  vi.unstubAllGlobals();
});

describe('invalidateApiCache', () => {
  it('drops the exact URL, its sub-paths and its query variants while keeping siblings', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));

    await http.get('/api/projects/team-a/services');
    await http.get('/api/projects/team-a/services/lake');
    await http.get('/api/projects/team-a/services?page=2');
    await http.get('/api/projects/team-a/services-extra');
    await http.get('/api/projects/team-b/services');
    expect(fetchMock).toHaveBeenCalledTimes(5);

    invalidateApiCache('/api/projects/team-a/services');

    // Exact match, sub-path and query string must hit the network again.
    await http.get('/api/projects/team-a/services');
    await http.get('/api/projects/team-a/services/lake');
    await http.get('/api/projects/team-a/services?page=2');
    expect(fetchMock).toHaveBeenCalledTimes(8);

    // Sibling prefix lookalike and other project stay cached.
    await http.get('/api/projects/team-a/services-extra');
    await http.get('/api/projects/team-b/services');
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});

describe('http.deleteWithStatus', () => {
  it('sends DELETE with custom headers and bearer token, returning status and parsed JSON body', async () => {
    setAuthTokenProvider(() => Promise.resolve('tok-123'));
    const payload = { operation: { outcome: 'accepted', desiredRevision: 'rev-1' } };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 202 }));

    const targetUrl = `${API_BASE}/api/projects/team-a/services/lake`;
    const res = await http.deleteWithStatus<typeof payload>(targetUrl, {
      headers: { 'If-Match': '"rev-0"' },
    });

    expect(res).toEqual({ status: 202, body: payload });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(targetUrl);
    expect(init.method).toBe('DELETE');
    const headers = new Headers(init.headers);
    expect(headers.get('If-Match')).toBe('"rev-0"');
    expect(headers.get('Authorization')).toBe('Bearer tok-123');
  });

  it('returns undefined body on an empty 204 or non-JSON 202 without failing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(http.deleteWithStatus('/api/projects/team-a/services/lake')).resolves.toEqual({
      status: 204,
      body: undefined,
    });

    fetchMock.mockResolvedValueOnce(new Response('accepted', { status: 202 }));
    await expect(http.deleteWithStatus('/api/projects/team-a/services/lake')).resolves.toEqual({
      status: 202,
      body: undefined,
    });
  });

  it('clears cached GET responses after both successful and failed deletes', async () => {
    fetchMock.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await http.getList('/api/projects/team-a/services');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await http.deleteWithStatus('/api/projects/team-a/services/lake');

    fetchMock.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await http.getList('/api/projects/team-a/services');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'stale', code: 'conflict' }), { status: 409 }),
    );
    await expect(http.deleteWithStatus('/api/projects/team-a/services/lake')).rejects.toBeInstanceOf(
      HttpError,
    );

    fetchMock.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await http.getList('/api/projects/team-a/services');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe('setAuthTokenProvider cache purge', () => {
  it('clears the GET cache when the token provider is cleared or replaced', async () => {
    const providerA = () => Promise.resolve('tok-a');
    const providerB = () => Promise.resolve('tok-b');
    setAuthTokenProvider(providerA);
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{"v":1}', { status: 200 })));

    const url = `${API_BASE}/api/projects`;
    await http.get(url);
    await http.get(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setAuthTokenProvider(null);
    await http.get(url);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    setAuthTokenProvider(providerA);
    await http.get(url);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Same provider reference keeps cache intact.
    setAuthTokenProvider(providerA);
    await http.get(url);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Switching to another provider purges the cache.
    setAuthTokenProvider(providerB);
    await http.get(url);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('isSecureRoute', () => {
  it('accepts API origin URLs under /api/ and rejects cross-origin or non-/api/ URLs', async () => {
    expect(isSecureRoute(`${API_BASE}/api/projects`)).toBe(true);
    expect(isSecureRoute('https://evil.example/api/projects')).toBe(false);
    expect(isSecureRoute('//evil.example/api/projects')).toBe(false);
    expect(isSecureRoute(`${API_BASE}/public?next=/api/projects`)).toBe(false);
    expect(isSecureRoute(`${API_BASE}/api/../public`)).toBe(false);
    expect(isSecureRoute(`${API_BASE}/config.js`)).toBe(false);
    expect(isSecureRoute(`${API_BASE}/api`)).toBe(false);

    setAuthTokenProvider(() => Promise.resolve('secret-token'));
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));

    await http.get('https://evil.example/api/projects');
    await http.get(`${API_BASE}/public?next=/api/projects`);
    await http.get(`${API_BASE}/api/projects`);

    const evilHeaders = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    const queryHeaders = new Headers((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers);
    const apiHeaders = new Headers((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers);
    expect(evilHeaders.get('Authorization')).toBeNull();
    expect(queryHeaders.get('Authorization')).toBeNull();
    expect(apiHeaders.get('Authorization')).toBe('Bearer secret-token');
  });

  it('accepts relative /api/ paths when apiBaseUrl is empty (same-origin production)', () => {
    const prev = environment.apiBaseUrl;
    environment.apiBaseUrl = '';
    try {
      expect(isSecureRoute('/api/projects')).toBe(true);
      expect(isSecureRoute('/public?next=/api/projects')).toBe(false);
      expect(isSecureRoute('https://evil.example/api/projects')).toBe(false);
    } finally {
      environment.apiBaseUrl = prev;
    }
  });
});

describe('cachedGet error eviction', () => {
  it('does not evict a newer cache entry when an earlier in-flight request fails', async () => {
    let rejectFirst!: (err: unknown) => void;
    fetchMock
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ fresh: true }), { status: 200 }));

    const url = `${API_BASE}/api/projects/team-a/services`;
    const first = http.get(url);
    clearApiCache();

    const second = await http.get<{ fresh: boolean }>(url);
    expect(second).toEqual({ fresh: true });

    rejectFirst(new Error('network blip'));
    await expect(first).rejects.toThrow('network blip');

    // Second entry must still be cached (no third fetch).
    const third = await http.get<{ fresh: boolean }>(url);
    expect(third).toEqual({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
