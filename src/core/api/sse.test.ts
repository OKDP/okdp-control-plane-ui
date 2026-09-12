import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeTextStream, subscribeJsonStream, applyListEvent, StreamServerError } from './sse';
import { setAuthTokenProvider } from './http';

// A controllable SSE response body: a test pushes frames and ends/fails it.
class FakeStream {
  private controllerRef!: ReadableStreamDefaultController<Uint8Array>;
  readonly body: ReadableStream<Uint8Array>;
  private readonly encoder = new TextEncoder();

  constructor() {
    this.body = new ReadableStream({
      start: (controller) => {
        this.controllerRef = controller;
      },
    });
  }

  // No-op once closed/errored, like a real connection with nothing left to push into.
  emit(data: string, event = 'message') {
    try {
      this.controllerRef.enqueue(this.encoder.encode(`event:${event}\ndata:${data}\n\n`));
    } catch {
      // already closed
    }
  }

  emitKeepalive() {
    this.controllerRef.enqueue(this.encoder.encode(': keepalive\n\n'));
  }

  end() {
    this.controllerRef.close();
  }

  fail(reason: unknown) {
    this.controllerRef.error(reason);
  }
}

let fetchMock: ReturnType<typeof vi.fn>;
let streams: FakeStream[];

function nextStream(): FakeStream {
  return streams[streams.length - 1];
}

beforeEach(() => {
  streams = [];
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    const stream = new FakeStream();
    streams.push(stream);
    // Mirrors a real fetch: aborting stops delivery, so unsubscribe is real.
    init?.signal?.addEventListener('abort', () => stream.fail(new DOMException('aborted', 'AbortError')));
    return Promise.resolve(new Response(stream.body, { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  setAuthTokenProvider(() => Promise.resolve('a-token'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenProvider(null);
  vi.useRealTimers();
});

// Lets the async read loop catch up after pushing a chunk.
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('subscribeTextStream', () => {
  it('delivers each line to next', async () => {
    const next = vi.fn();
    subscribeTextStream('/logs', { next });
    await tick();

    nextStream().emit('first');
    nextStream().emit('second');
    await tick();

    expect(next.mock.calls.map((c) => c[0])).toEqual(['first', 'second']);
  });

  it('sends the bearer token, not a plain EventSource connection', async () => {
    subscribeTextStream('/logs', { next: vi.fn() });
    await tick();

    expect(fetchMock).toHaveBeenCalledWith(
      '/logs',
      expect.objectContaining({ headers: { Authorization: 'Bearer a-token' } }),
    );
  });

  it('drops keepalive comments without calling next', async () => {
    const next = vi.fn();
    subscribeTextStream('/logs', { next });
    await tick();

    nextStream().emitKeepalive();
    await tick();

    expect(next).not.toHaveBeenCalled();
  });

  // A clean end must reach `complete`, not `error` — the response just closes,
  // indistinguishable from a job finishing, so `error` would fire on every job.
  it('completes, rather than errors, when the stream simply ends', async () => {
    const error = vi.fn();
    const complete = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error, complete });
    await tick();

    nextStream().end();
    await tick();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('raises a server error when the server describes a failure', async () => {
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error });
    await tick();

    nextStream().emit('pod not found', 'error');
    nextStream().end();
    await tick();

    const raised = error.mock.calls[0][0];
    expect(raised).toBeInstanceOf(StreamServerError);
    expect((raised as Error).message).toBe('pod not found');
  });

  it('reports a network failure as a plain error, not a server one', async () => {
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error });
    await tick();

    nextStream().fail(new Error('network drop'));
    await tick();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).not.toBeInstanceOf(StreamServerError);
  });

  it('does not reconnect on its own', async () => {
    subscribeTextStream('/logs', { next: vi.fn() });
    await tick();

    nextStream().end();
    await tick();
    await tick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops delivering events once unsubscribed', async () => {
    const next = vi.fn();
    const unsubscribe = subscribeTextStream('/logs', { next });
    await tick();
    unsubscribe();
    await tick();

    nextStream().emit('too late');
    await tick();

    expect(next).not.toHaveBeenCalled();
  });
});

describe('subscribeJsonStream', () => {
  it('parses each message', async () => {
    const next = vi.fn();
    subscribeJsonStream<{ a: number }>('/watch', { next });
    await tick();

    nextStream().emit(JSON.stringify({ a: 1 }));
    await tick();

    expect(next).toHaveBeenCalledWith({ a: 1 });
  });

  // A single malformed frame must not tear down a watch that is otherwise fine.
  it('survives a malformed message', async () => {
    const next = vi.fn();
    const error = vi.fn();
    subscribeJsonStream('/watch', { next, error });
    await tick();

    nextStream().emit('{not json');
    nextStream().emit(JSON.stringify({ a: 2 }));
    await tick();

    expect(error).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ a: 2 });
  });

  it('reconnects after the connection drops', async () => {
    vi.useFakeTimers();
    const next = vi.fn();
    subscribeJsonStream('/watch', { next });
    await vi.advanceTimersByTimeAsync(0);

    nextStream().end();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    nextStream().emit(JSON.stringify({ a: 1 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(next).toHaveBeenCalledWith({ a: 1 });
  });

  it('reports a dropped connection to the caller before retrying', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    subscribeJsonStream('/watch', { next: vi.fn(), error });
    await vi.advanceTimersByTimeAsync(0);

    nextStream().fail(new Error('network drop'));
    await vi.advanceTimersByTimeAsync(0);

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('stops reconnecting once unsubscribed', async () => {
    vi.useFakeTimers();
    const unsubscribe = subscribeJsonStream('/watch', { next: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);

    nextStream().end();
    unsubscribe();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('applyListEvent', () => {
  const key = (item: { name: string }) => item.name;

  it('appends an object it has never seen', () => {
    const list = [{ name: 'a' }];
    expect(applyListEvent(list, { type: 'ADDED', object: { name: 'b' } }, key)).toEqual([
      { name: 'a' },
      { name: 'b' },
    ]);
  });

  // A watch replays ADDED after a reconnect, so it must upsert rather than
  // duplicate every row already on screen.
  it('replaces in place when the key is already there', () => {
    const list = [{ name: 'a', v: 1 }];
    const next = applyListEvent(list, { type: 'ADDED', object: { name: 'a', v: 2 } }, key);
    expect(next).toEqual([{ name: 'a', v: 2 }]);
  });

  it('removes on DELETED and ignores an unknown key', () => {
    const list = [{ name: 'a' }, { name: 'b' }];
    expect(applyListEvent(list, { type: 'DELETED', object: { name: 'a' } }, key)).toEqual([
      { name: 'b' },
    ]);
    expect(applyListEvent(list, { type: 'DELETED', object: { name: 'z' } }, key)).toBe(list);
  });

  it('leaves the input untouched', () => {
    const list = [{ name: 'a' }];
    applyListEvent(list, { type: 'ADDED', object: { name: 'b' } }, key);
    expect(list).toEqual([{ name: 'a' }]);
  });
});
