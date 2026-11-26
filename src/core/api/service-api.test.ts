import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceApi } from './service-api';
import { clearApiCache, HttpError } from './http';

// Dev environment base URL (import.meta.env.PROD is false under Vitest).
const INSTANCE = 'http://localhost:8093/api/projects/team-a/services/lake';
const SHA = '0123456789abcdef0123456789abcdef01234567';

const fetchMock = vi.fn();

function answer(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

/** Method and headers of the only request sent. */
function sent(): { method?: string; headers: Headers; body?: unknown } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { method: init.method, headers: new Headers(init.headers), body: init.body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('serviceApi.updateServiceParameters', () => {
  it('sends If-Match with the expected revision, next to the JSON content type', async () => {
    answer(200, { name: 'lake' });
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: { a: 1 } }, SHA);

    const { method, headers, body } = sent();
    expect(fetchMock.mock.calls[0][0]).toBe(`${INSTANCE}/parameters`);
    expect(method).toBe('PATCH');
    expect(headers.get('If-Match')).toBe(`"${SHA}"`);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(body).toBe(JSON.stringify({ parameters: { a: 1 } }));
  });

  it('sends no If-Match without a revision, or with an empty one', async () => {
    answer(200, {});
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: {} });
    expect(sent().headers.has('If-Match')).toBe(false);

    fetchMock.mockReset();
    answer(200, {});
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: {} }, '');
    expect(sent().headers.has('If-Match')).toBe(false);
  });

  it('sends no If-Match for a revision the header cannot carry', async () => {
    answer(200, {});
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: {} }, 'a"b');
    expect(sent().headers.has('If-Match')).toBe(false);
  });

  it.each([
    ['a comma', 'a,b'],
    ['a space', 'a b'],
    ['a control character', 'a\u0007b'],
    ['a line break', 'a\nb'],
    ['a character outside ASCII', 'révision'],
    ['a character outside Latin-1', 'rev\u2603'],
  ])('sends no If-Match for a revision with %s, and never throws', async (_label, revision) => {
    answer(200, {});
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: {} }, revision);
    expect(sent().headers.has('If-Match')).toBe(false);
  });

  it('sends If-Match for every visible ASCII character but the quote and the comma', async () => {
    const revision = "Az09!#$%&'()*+-./:;<=>?@[\\]^_`{|}~";
    answer(200, {});
    await serviceApi.updateServiceParameters('team-a', 'lake', { parameters: {} }, revision);
    expect(sent().headers.get('If-Match')).toBe(`"${revision}"`);
  });

  it('rejects a 409 conflict with its body, for the page to classify', async () => {
    answer(409, { error: 'stale', code: 'conflict' });
    const err = await serviceApi
      .updateServiceParameters('team-a', 'lake', { parameters: {} }, '3')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect(JSON.parse((err as HttpError).body)).toEqual({ error: 'stale', code: 'conflict' });
  });
});

describe('serviceApi.deleteService', () => {
  it('sends If-Match with the expected revision', async () => {
    answer(204);
    await serviceApi.deleteService('team-a', 'lake', '7');

    const { method, headers } = sent();
    expect(fetchMock.mock.calls[0][0]).toBe(INSTANCE);
    expect(method).toBe('DELETE');
    expect(headers.get('If-Match')).toBe('"7"');
  });

  it('sends no If-Match without a revision', async () => {
    answer(204);
    await serviceApi.deleteService('team-a', 'lake');
    expect(sent().headers.has('If-Match')).toBe(false);
  });

  it('resolves the status alone on an empty 204', async () => {
    answer(204);
    await expect(serviceApi.deleteService('team-a', 'lake')).resolves.toEqual({ status: 204 });
  });

  it('keeps the 202 of an answer whose body is empty or not JSON', async () => {
    answer(202);
    await expect(serviceApi.deleteService('team-a', 'lake')).resolves.toEqual({ status: 202 });
    fetchMock.mockResolvedValueOnce(new Response('accepted', { status: 202 }));
    await expect(serviceApi.deleteService('team-a', 'lake')).resolves.toEqual({ status: 202 });
  });

  it('resolves the status alone on a 200 whose body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('deleted', { status: 200 }));
    await expect(serviceApi.deleteService('team-a', 'lake')).resolves.toEqual({ status: 200 });
  });

  it('resolves the status and the engine answer of a 202', async () => {
    const body = { operation: { outcome: 'accepted', desiredRevision: SHA } };
    answer(202, body);
    await expect(serviceApi.deleteService('team-a', 'lake', '7')).resolves.toEqual({
      status: 202,
      result: body,
    });
  });
});

describe('serviceApi.forgetServiceReads', () => {
  const LIST = 'http://localhost:8093/api/projects/team-a/services';

  beforeEach(() => clearApiCache());

  it('makes the next read of the project ask the server again', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('[]', { status: 200 })));
    await serviceApi.getServices('team-a');
    await serviceApi.getServices('team-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    serviceApi.forgetServiceReads('team-a');
    await serviceApi.getServices('team-a');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(LIST);
  });

  it('keeps the cached reads of another project', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('[]', { status: 200 })));
    await serviceApi.getServices('team-b');

    serviceApi.forgetServiceReads('team-a');
    await serviceApi.getServices('team-b');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
