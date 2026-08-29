import { logger } from '../services/logger';
import { authToken, reportUnauthorized } from './http';

export interface StreamSubscriber<T> {
  next: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
}

export interface ListEvent<T> {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: T;
}

/**
 * A failure the server itself described, as opposed to a connection that merely
 * stopped. The log viewers surface only this one.
 */
export class StreamServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamServerError';
  }
}

/**
 * Apply a watch-style ADDED/MODIFIED/DELETED event to an immutable list,
 * upserting by key. Shared by every SSE-backed list in the app.
 */
export function applyListEvent<T>(list: T[], event: ListEvent<T>, key: (item: T) => string): T[] {
  const eventKey = key(event.object);
  const idx = list.findIndex((item) => key(item) === eventKey);

  switch (event.type) {
    case 'ADDED':
    case 'MODIFIED': {
      if (idx === -1) {
        return [...list, event.object];
      }
      const next = [...list];
      next[idx] = event.object;
      return next;
    }
    case 'DELETED':
      return idx === -1 ? list : list.filter((_, i) => i !== idx);
    default:
      return list;
  }
}

/** EventSource's reconnect delay, kept. */
const RECONNECT_MS = 3000;

/** One decoded server-sent event. `type` is "message" unless the frame names one. */
interface StreamEvent {
  type: string;
  data: string;
}

/**
 * text/event-stream grammar: fields one per line, `data:` repeatable and joined
 * with newlines, a blank line ending the event.
 */
function decodeFrame(frame: string): StreamEvent | null {
  let type = 'message';
  const data: string[] = [];

  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // One space after the colon belongs to the delimiter, not the value.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (field === 'event') {
      type = value;
    } else if (field === 'data') {
      data.push(value);
    }
  }

  return data.length === 0 && type === 'message' ? null : { type, data: data.join('\n') };
}

interface StreamHandlers {
  /** Called for every event the server sends. Returning false ends the stream. */
  onEvent: (event: StreamEvent) => boolean;
  /** The server closed the stream, and it will not be reopened. */
  onClose: () => void;
  /** The stream could not be read, or could not be opened. */
  onFailure: (err: unknown) => void;
  /** Whether a dropped connection is reopened, as EventSource used to do. */
  reconnect: boolean;
}

/**
 * Opens a server-sent event stream over fetch, which takes headers where
 * EventSource cannot carry an Authorization header at all.
 */
function openEventStream(url: string, label: string, handlers: StreamHandlers): () => void {
  const controller = new AbortController();
  let stopped = false;

  const stop = () => {
    stopped = true;
    controller.abort();
  };

  // Resolves on abort as well as on time, so unsubscribing does not leave the
  // loop or a timer alive for the rest of the delay.
  const pause = (ms: number) =>
    new Promise<void>((resolve) => {
      const signal = controller.signal;
      if (signal.aborted) {
        resolve();
        return;
      }
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      signal.addEventListener('abort', done);
    });

  const run = async () => {
    while (!stopped) {
      try {
        const token = await authToken(url);
        const headers = new Headers({ Accept: 'text/event-stream' });
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });

        if (response.status === 401 || response.status === 403) {
          // Not retried: the session is what is wrong.
          reportUnauthorized(response.status);
          handlers.onFailure(new Error(`${label} refused: the session is no longer valid`));
          return;
        }
        if (!response.ok || !response.body) {
          throw new Error(`${label} could not be opened: HTTP ${response.status}`);
        }

        const ended = await pump(response.body, handlers);
        if (stopped || ended) {
          return;
        }
        // complete is terminal: a stream that means to reopen reports an
        // interruption instead, as EventSource did.
        if (!handlers.reconnect) {
          handlers.onClose();
          return;
        }
        handlers.onFailure(new Error(`${label} was interrupted, reopening`));
      } catch (err) {
        if (stopped || controller.signal.aborted) {
          return;
        }
        // A drop this loop recovers from is not an error; proxies cut idle
        // streams on their own.
        if (handlers.reconnect) {
          logger.warn(`${label} dropped, reopening`, err);
        } else {
          logger.error(`${label} failed`, err);
        }
        handlers.onFailure(err);
        if (!handlers.reconnect) {
          return;
        }
      }

      if (!stopped) {
        await pause(RECONNECT_MS);
      }
    }
  };

  void run();
  return stop;
}

/**
 * Reads the body frame by frame. Returns true when a handler asked to end the
 * stream, false when the server closed it.
 */
async function pump(body: ReadableStream<Uint8Array>, handlers: StreamHandlers): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush the decoder; a partial character cannot complete a
        // dispatchable event, but the invariant should not rest on that.
        buffer += decoder.decode();
        return false;
      }
      // stream: true, a chunk can split a multi-byte character.
      buffer += decoder.decode(value, { stream: true });

      // Proxies may rewrite \n\n into \r\n\r\n.
      buffer = buffer.replace(/\r\n/g, '\n');
      let cut = buffer.indexOf('\n\n');
      while (cut !== -1) {
        const event = decodeFrame(buffer.slice(0, cut));
        buffer = buffer.slice(cut + 2);
        if (event && !handlers.onEvent(event)) {
          return true;
        }
        cut = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

/**
 * Subscribe to a server-sent events endpoint emitting JSON messages.
 * Returns an unsubscribe function that closes the connection.
 */
export function subscribeJsonStream<T>(
  url: string,
  subscriber: StreamSubscriber<T>,
  label = 'SSE',
): () => void {
  return openEventStream(url, label, {
    onEvent: (event) => {
      if (event.type !== 'message') {
        return true;
      }
      try {
        subscriber.next(JSON.parse(event.data) as T);
      } catch (e) {
        // One unparseable message is one message lost, not a dead stream.
        logger.error(`Failed to parse ${label} message`, e);
      }
      return true;
    },
    onClose: () => subscriber.complete?.(),
    onFailure: (err) => subscriber.error?.(err),
    reconnect: true,
  });
}

/**
 * Subscribe to a server-sent events endpoint emitting raw text lines
 * (e.g. log streaming).
 */
export function subscribeTextStream(url: string, subscriber: StreamSubscriber<string>): () => void {
  return openEventStream(url, 'log stream', {
    onEvent: (event) => {
      // A named error event carries the server's reason.
      if (event.type === 'error') {
        subscriber.error?.(new StreamServerError(event.data || 'log stream interrupted'));
        return false;
      }
      if (event.type === 'message') {
        subscriber.next(event.data);
      }
      return true;
    },
    onClose: () => subscriber.complete?.(),
    onFailure: (err) => subscriber.error?.(err),
    // Reopening a finished log would replay it from the top.
    reconnect: false,
  });
}
