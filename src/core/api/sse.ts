import { logger } from '../services/logger';
import { getAuthToken } from './http';

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
 * A failure the server itself described, as opposed to a connection that
 * merely stopped.
 *
 * The distinction is not cosmetic. A log stream carries no end marker: when
 * the driver finishes, the handler returns and the caller cannot tell a
 * finished stream from a dropped one. Reporting every end as a failure would
 * raise one at the end of every successful job. Only this type means
 * something actually went wrong.
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

interface SSEFrame {
  event: string;
  data: string;
}

// Splits a growing buffer into complete SSE frames (blank-line terminated).
// Keepalive comment lines carry no `data:` and are dropped.
function extractFrames(buffer: string): { frames: SSEFrame[]; rest: string } {
  const frames: SSEFrame[] = [];
  let rest = buffer;
  let boundary = rest.indexOf('\n\n');
  while (boundary !== -1) {
    let event = 'message';
    const data: string[] = [];
    for (const line of rest.slice(0, boundary).split('\n')) {
      if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
      else if (line.startsWith('data:')) data.push(line.slice('data:'.length).trim());
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') });
    rest = rest.slice(boundary + 2);
    boundary = rest.indexOf('\n\n');
  }
  return { frames, rest };
}

// A plain `fetch`, not `EventSource`, since EventSource cannot set the
// Authorization header the API now requires. Resolves when the server closes
// the response; rejects on a network failure or a non-2xx status.
async function readStream(url: string, signal: AbortSignal, onFrame: (frame: SSEFrame) => void): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(url, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok || !response.body) {
    throw new Error(`stream request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const extracted = extractFrames(buffer);
    buffer = extracted.rest;
    extracted.frames.forEach(onFrame);
  }
}

const RECONNECT_DELAY_MS = 3000;

// Reconnects quietly on a dropped connection: the server's underlying
// Kubernetes watch is recycled periodically, which is not a failure.
export function subscribeJsonStream<T>(
  url: string,
  subscriber: StreamSubscriber<T>,
  label = 'SSE',
): () => void {
  const controller = new AbortController();
  let stopped = false;

  (async function run() {
    while (!stopped) {
      try {
        await readStream(url, controller.signal, (frame) => {
          if (frame.event !== 'message') return;
          try {
            subscriber.next(JSON.parse(frame.data) as T);
          } catch (e) {
            logger.error(`Failed to parse ${label} message`, e);
          }
        });
      } catch (e) {
        if (stopped) return;
        logger.error(`${label} error`, e);
        subscriber.error?.(e);
      }
      if (stopped) return;
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  })();

  return () => {
    stopped = true;
    controller.abort();
  };
}

// Unlike subscribeJsonStream, never reconnects: a log has no replay, so
// retrying it would duplicate everything already shown.
export function subscribeTextStream(url: string, subscriber: StreamSubscriber<string>): () => void {
  const controller = new AbortController();
  let stopped = false;
  let serverError: string | undefined;

  readStream(url, controller.signal, (frame) => {
    if (frame.event === 'error') {
      serverError = frame.data;
      return;
    }
    subscriber.next(frame.data);
  })
    .then(() => {
      if (stopped) return;
      if (serverError !== undefined) subscriber.error?.(new StreamServerError(serverError));
      else subscriber.complete?.();
    })
    .catch((e) => {
      if (stopped) return;
      subscriber.error?.(e instanceof Error ? e : new Error('log stream interrupted'));
    });

  return () => {
    stopped = true;
    controller.abort();
  };
}
