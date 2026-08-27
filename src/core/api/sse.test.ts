import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  subscribeJsonStream,
  subscribeTextStream,
  applyListEvent,
  StreamServerError,
} from './sse';
import { authToken, reportUnauthorized } from './http';

vi.mock('./http', () => ({
  authToken: vi.fn(async () => 'a-token'),
  reportUnauthorized: vi.fn(),
}));

/** A body the test writes into, so a stream can be held open and closed on cue. */
function openBody() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    body,
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

function respondWith(body: ReadableStream<Uint8Array>, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, body } as unknown as Response;
}

/** Lets the transport's detached loop run to its next suspension point. */
const settle = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
  await new Promise((r) => setTimeout(r, 0));
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(authToken).mockResolvedValue('a-token');
  vi.mocked(reportUnauthorized).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyListEvent', () => {
  const key = (x: { id: string }) => x.id;

  it('adds, replaces and removes by key', () => {
    let list = applyListEvent<{ id: string }>([], { type: 'ADDED', object: { id: 'a' } }, key);
    expect(list).toEqual([{ id: 'a' }]);
    list = applyListEvent(list, { type: 'MODIFIED', object: { id: 'a' } }, key);
    expect(list).toHaveLength(1);
    list = applyListEvent(list, { type: 'DELETED', object: { id: 'a' } }, key);
    expect(list).toEqual([]);
  });
});

// The regression this whole file exists for. EventSource cannot carry an
// Authorization header, so once the control plane authenticates its API every
// stream answered 401 forever and the lists they feed silently stopped moving.
describe('the stream carries the caller credential', () => {
  it('sends the bearer token the rest of the API is called with', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn() });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer a-token');
    expect(headers.get('Accept')).toBe('text/event-stream');
    stop();
  });

  it('opens the stream anyway when there is no token to send', async () => {
    vi.mocked(authToken).mockResolvedValue(undefined);
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn() });
    await settle();

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
    stop();
  });
});

describe('subscribeJsonStream', () => {
  it('delivers each message as a parsed object', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();

    const stop = subscribeJsonStream<{ n: number }>('/api/projects/stream', { next });
    await settle();
    s.send('data: {"n":1}\n\ndata: {"n":2}\n\n');
    await settle();

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1, { n: 1 });
    expect(next).toHaveBeenNthCalledWith(2, { n: 2 });
    stop();
  });

  // A frame can arrive in pieces, and a piece can cut a message in half.
  it('reassembles a message split across chunks', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();

    const stop = subscribeJsonStream<{ n: number }>('/api/projects/stream', { next });
    await settle();
    s.send('data: {"n');
    await settle();
    expect(next).not.toHaveBeenCalled();
    s.send('":7}\n\n');
    await settle();

    expect(next).toHaveBeenCalledWith({ n: 7 });
    stop();
  });

  // A proxy may rewrite the line endings on its way through.
  it('accepts CRLF separators', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();

    const stop = subscribeJsonStream<{ n: number }>('/api/projects/stream', { next });
    await settle();
    s.send('data: {"n":3}\r\n\r\n');
    await settle();

    expect(next).toHaveBeenCalledWith({ n: 3 });
    stop();
  });

  // One unparseable message is one message lost, not a dead stream.
  it('keeps reading after a message that does not parse', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();
    const error = vi.fn();

    const stop = subscribeJsonStream<{ n: number }>('/api/projects/stream', { next, error });
    await settle();
    s.send('data: not json\n\ndata: {"n":9}\n\n');
    await settle();

    expect(error).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledExactlyOnceWith({ n: 9 });
    stop();
  });

  // complete is terminal. A stream that reopens and keeps emitting after it
  // would break the contract every subscriber is written against, so a drop it
  // means to recover from is reported as the interruption it is.
  it('reports an interruption, not a completion, when it means to reopen', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const complete = vi.fn();
    const error = vi.fn();

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn(), complete, error });
    await settle();
    s.close();
    await settle();

    expect(complete).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect((error.mock.calls[0][0] as Error).message).toContain('interrupted');
    // A drop is not a failure the server described, and must not read as one.
    expect(error.mock.calls[0][0]).not.toBeInstanceOf(StreamServerError);
    stop();
  });

  // And it does reopen, rather than reporting a fault and giving up.
  it('reopens the stream after the server drops it', async () => {
    const first = openBody();
    const second = openBody();
    fetchMock
      .mockResolvedValueOnce(respondWith(first.body))
      .mockResolvedValueOnce(respondWith(second.body));
    const next = vi.fn();

    vi.useFakeTimers();
    try {
      const stop = subscribeJsonStream<{ n: number }>('/api/projects/stream', { next });
      await vi.advanceTimersByTimeAsync(1);
      first.close();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3100);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      second.send('data: {"n":42}\n\n');
      await vi.advanceTimersByTimeAsync(1);
      expect(next).toHaveBeenCalledWith({ n: 42 });
      stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

// A refused stream must not become a request loop. EventSource reconnected on
// its own, and against a server that keeps saying no that is one refusal every
// few seconds for as long as the tab stays open.
describe('a stream the server refuses', () => {
  it('ends the session once and does not ask again', async () => {
    fetchMock.mockResolvedValue(respondWith(openBody().body, 401));
    const error = vi.fn();

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn(), error });
    await settle();
    await settle();

    expect(reportUnauthorized).toHaveBeenCalledExactlyOnceWith(401);
    expect(error).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('treats a 403 the same way', async () => {
    fetchMock.mockResolvedValue(respondWith(openBody().body, 403));

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn(), error: vi.fn() });
    await settle();

    expect(reportUnauthorized).toHaveBeenCalledExactlyOnceWith(403);
    stop();
  });
});

describe('subscribeTextStream', () => {
  it('delivers each line as it is, spaces included', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();

    const stop = subscribeTextStream('/api/projects/x/services/y/pods/z/logs', { next });
    await settle();
    // The single space after the colon belongs to the protocol; a second one
    // belongs to the log line and must survive.
    s.send('data:  indented\n\ndata: plain\n\n');
    await settle();

    expect(next).toHaveBeenNthCalledWith(1, ' indented');
    expect(next).toHaveBeenNthCalledWith(2, 'plain');
    stop();
  });

  it('joins a message spread over several data lines', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();

    const stop = subscribeTextStream('/logs', { next });
    await settle();
    s.send('data: first\ndata: second\n\n');
    await settle();

    expect(next).toHaveBeenCalledExactlyOnceWith('first\nsecond');
    stop();
  });

  // The server reports a failure it has already begun answering as a named
  // event. Losing it would leave a blank pane with no reason on it.
  it('surfaces the reason the server names, and stops there', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const next = vi.fn();
    const error = vi.fn();

    const stop = subscribeTextStream('/logs', { next, error });
    await settle();
    s.send('event: error\ndata: pod is gone\n\ndata: never read\n\n');
    await settle();

    expect(error).toHaveBeenCalledTimes(1);
    expect((error.mock.calls[0][0] as Error).message).toBe('pod is gone');
    // Typed, so a caller can show a failure the server described and stay quiet
    // about a connection that merely stopped.
    expect(error.mock.calls[0][0]).toBeInstanceOf(StreamServerError);
    expect(next).not.toHaveBeenCalled();
    stop();
  });

  // Following a log that ended and reopening it would replay it from the top,
  // which is not what following means.
  it('does not reopen a log stream the server closed', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const complete = vi.fn();

    const stop = subscribeTextStream('/logs', { next: vi.fn(), complete });
    await settle();
    s.close();
    await settle();
    await settle();

    expect(complete).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('unsubscribing', () => {
  it('aborts the request in flight', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn() });
    await settle();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    stop();
    expect(signal.aborted).toBe(true);
  });

  // A closed stream must not report a failure on its way out: the caller has
  // already moved on, and the message would land on another page.
  it('says nothing after it has been closed', async () => {
    const s = openBody();
    fetchMock.mockResolvedValue(respondWith(s.body));
    const error = vi.fn();
    const complete = vi.fn();

    const stop = subscribeJsonStream('/api/projects/stream', { next: vi.fn(), error, complete });
    await settle();
    stop();
    await settle();
    await settle();

    expect(error).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
});
