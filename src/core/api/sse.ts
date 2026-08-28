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
 * stopped.
 *
 * The distinction is not cosmetic. A caller that reports every error to the
 * user would raise a failure every time a proxy cuts an idle stream, or every
 * time a job finishes. Only this type means something actually went wrong, and
 * the log viewers show only this one.
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

/** What EventSource waited before reconnecting, kept so nothing else changes. */
const RECONNECT_MS = 3000;

/** One decoded server-sent event. `type` is "message" unless the frame names one. */
interface StreamEvent {
  type: string;
  data: string;
}

/**
 * Splits a server-sent event stream into events, per the text/event-stream
 * grammar: fields one per line, `data:` repeatable and joined with newlines, a
 * blank line ending the event. Written out here because the transport below no
 * longer gets it from the browser.
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
    // One optional space after the colon belongs to the delimiter, not the
    // value: a log line starting with a space would lose it otherwise.
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
 * Opens a server-sent event stream over fetch, and returns a function that
 * closes it.
 *
 * Not EventSource: that API cannot carry an Authorization header, by design and
 * with no way around it. Once the control plane authenticates its API, every
 * stream it serves would answer 401 forever, and the lists they feed would
 * quietly stop moving while the pages still rendered.
 */
function openEventStream(url: string, label: string, handlers: StreamHandlers): () => void {
  const controller = new AbortController();
  let stopped = false;

  const stop = () => {
    stopped = true;
    controller.abort();
  };

  /**
   * Waits out the reconnect delay, or gives up the moment the stream is closed.
   *
   * A plain timer would keep the loop alive for the whole delay after
   * unsubscribing, and leave a pending timer behind with it.
   */
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
          // Deliberately not retried. The session is what is wrong, and a
          // reconnecting stream would ask again every few seconds for as long
          // as the tab stays open, against a server that will keep refusing.
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
        // The server closed the stream of its own accord. On a stream that
        // reopens, that is an interruption and not an ending: complete is a
        // terminal signal, and reporting one before emitting again would break
        // the contract the subscribers are written against. EventSource drew
        // the same line, raising an error while it still meant to reconnect and
        // completing only once it had given up for good.
        if (!handlers.reconnect) {
          handlers.onClose();
          return;
        }
        handlers.onFailure(new Error(`${label} was interrupted, reopening`));
      } catch (err) {
        if (stopped || controller.signal.aborted) {
          return;
        }
        // A drop on a stream that reopens is expected traffic, not a fault: a
        // proxy will cut an idle stream on its own, and this reconnects. Only a
        // stream that gives up here is an error.
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
        return false;
      }
      // A chunk can split a multi-byte character, so the decoder is told the
      // text continues.
      buffer += decoder.decode(value, { stream: true });

      // \r\n\r\n is as valid a separator as \n\n, and a proxy may rewrite one
      // into the other.
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
        // A message that does not parse is one message lost, not a dead
        // stream: the next one may well be fine.
        logger.error(`Failed to parse ${label} message`, e);
      }
      return true;
    },
    onClose: () => subscriber.complete?.(),
    onFailure: (err) => subscriber.error?.(err),
    // These feed lists that must keep moving, which is what EventSource did.
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
      // The server reports a failure it has already started answering as a
      // named event, so the reason reaches the screen instead of a blank pane.
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
    // A log stream that ended has ended: reopening it would replay the log
    // from the top, which is not what following it means.
    reconnect: false,
  });
}
