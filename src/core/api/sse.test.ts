import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeTextStream, subscribeJsonStream, applyListEvent, StreamServerError } from './sse';

/**
 * Stands in for the browser's EventSource so a test can decide what the
 * connection looked like when the error fired, which is the only thing telling
 * a finished stream apart from a broken one.
 */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static last: FakeEventSource;

  readyState = FakeEventSource.OPEN;
  closeCalls = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Record<string, ((event: Event) => void)[]> = {};

  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }

  addEventListener(type: string, handler: (event: Event) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
    this.closeCalls++;
  }

  emitMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  /** readyState is read before close(), so it is set first here too. */
  emitError(readyState: number, data?: string) {
    this.readyState = readyState;
    const event = new MessageEvent('error', data === undefined ? {} : { data });
    this.onerror?.(event);
    (this.listeners.error ?? []).forEach((handler) => handler(event));
  }
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subscribeTextStream', () => {
  it('delivers each line to next', () => {
    const next = vi.fn();
    subscribeTextStream('/logs', { next });

    FakeEventSource.last.emitMessage('first');
    FakeEventSource.last.emitMessage('second');

    expect(next.mock.calls.map((c) => c[0])).toEqual(['first', 'second']);
  });

  // The regression this file exists for. A log stream carries no end marker:
  // the handler returns when the driver finishes and the browser, which cannot
  // tell that apart from a drop, goes back to CONNECTING and fires `error`. A
  // caller reporting every error would raise one at the end of every job, so
  // the type must say whether the server actually complained.
  it('does not raise a server error when the stream merely ends', () => {
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error });

    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).not.toBeInstanceOf(StreamServerError);
  });

  it('raises a server error when the server describes a failure', () => {
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error });

    FakeEventSource.last.emitError(FakeEventSource.CONNECTING, 'pod not found');

    const raised = error.mock.calls[0][0];
    expect(raised).toBeInstanceOf(StreamServerError);
    expect((raised as Error).message).toBe('pod not found');
  });

  it('completes when the browser gives up for good', () => {
    const complete = vi.fn();
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), complete, error });

    FakeEventSource.last.emitError(FakeEventSource.CLOSED);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  // Left open, the browser reconnects on its own and replays the log from the
  // top, so a finished job would stream itself again forever.
  it('closes the connection whatever ended it', () => {
    subscribeTextStream('/logs', { next: vi.fn() });

    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);

    expect(FakeEventSource.last.closeCalls).toBeGreaterThan(0);
  });

  it('closes the connection when unsubscribed', () => {
    const unsubscribe = subscribeTextStream('/logs', { next: vi.fn() });
    unsubscribe();

    expect(FakeEventSource.last.readyState).toBe(FakeEventSource.CLOSED);
  });
});

describe('subscribeJsonStream', () => {
  it('parses each message', () => {
    const next = vi.fn();
    subscribeJsonStream<{ a: number }>('/watch', { next });

    FakeEventSource.last.emitMessage(JSON.stringify({ a: 1 }));

    expect(next).toHaveBeenCalledWith({ a: 1 });
  });

  // A single malformed frame must not tear down a watch that is otherwise fine.
  it('survives a malformed message', () => {
    const next = vi.fn();
    const error = vi.fn();
    subscribeJsonStream('/watch', { next, error });

    FakeEventSource.last.emitMessage('{not json');
    FakeEventSource.last.emitMessage(JSON.stringify({ a: 2 }));

    expect(error).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ a: 2 });
  });

  it('reports a reconnecting stream as an error and a closed one as complete', () => {
    const error = vi.fn();
    const complete = vi.fn();
    subscribeJsonStream('/watch', { next: vi.fn(), error, complete });
    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);
    expect(error).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();

    subscribeJsonStream('/watch', { next: vi.fn(), error, complete });
    FakeEventSource.last.emitError(FakeEventSource.CLOSED);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
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

describe('subscribeTextStream, a stream that stops without a reason', () => {
  // The half that was silent. A dropped connection closes the EventSource,
  // which kills the browser's own reconnection, and raises an error carrying no
  // server message. Reported as nothing at all, Follow mode froze with no
  // notice and no way to tell it had stopped.
  it('always tells the caller the stream ended, one way or the other', () => {
    const error = vi.fn();
    const complete = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error, complete });

    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);

    expect(error.mock.calls.length + complete.mock.calls.length).toBe(1);
  });

  // The distinction the viewers key off: a message from the server is a
  // failure, anything else is just the end of the stream.
  it('separates a server failure from a stream that merely stopped', () => {
    const error = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error });
    FakeEventSource.last.emitError(FakeEventSource.CONNECTING, 'pod not found');
    expect(error.mock.calls[0][0]).toBeInstanceOf(StreamServerError);

    const other = vi.fn();
    subscribeTextStream('/logs', { next: vi.fn(), error: other });
    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);
    expect(other.mock.calls[0][0]).not.toBeInstanceOf(StreamServerError);
  });

  // Closing is deliberate: left open the browser reconnects and replays a
  // finished log from the top. The caller is told instead.
  it('closes rather than reconnecting, so the caller decides what to do', () => {
    subscribeTextStream('/logs', { next: vi.fn(), error: vi.fn() });
    FakeEventSource.last.emitError(FakeEventSource.CONNECTING);
    expect(FakeEventSource.last.closeCalls).toBeGreaterThan(0);
  });
});
