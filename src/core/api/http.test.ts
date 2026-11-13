import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpError, setUnauthorizedHandler } from './http';

let status: number;

beforeEach(() => {
  status = 200;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"error":"no"}', { status }))));
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('http', () => {
  it('logs the user out on a 401', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    status = 401;

    await expect(http.get('/api/projects')).rejects.toBeInstanceOf(HttpError);
    expect(onUnauthorized).toHaveBeenCalledWith(401);
  });

  // The session is valid, the action is not allowed: the caller shows it.
  it('keeps the user signed in on a 403', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    status = 403;

    await expect(http.post('/api/projects', {})).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
