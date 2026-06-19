import { logger } from '../services/logger';

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

/**
 * Subscribe to a server-sent events endpoint emitting JSON messages.
 * Returns an unsubscribe function that closes the connection.
 */
export function subscribeJsonStream<T>(
  url: string,
  subscriber: StreamSubscriber<T>,
  label = 'SSE',
): () => void {
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      subscriber.next(JSON.parse(event.data) as T);
    } catch (e) {
      logger.error(`Failed to parse ${label} message`, e);
    }
  };

  eventSource.onerror = (error) => {
    logger.error(`${label} error`, error);
    // EventSource auto-reconnects by default; only give up when the
    // connection is permanently closed by the server.
    if (eventSource.readyState === EventSource.CLOSED) {
      subscriber.complete?.();
    } else {
      subscriber.error?.(error);
    }
  };

  return () => eventSource.close();
}

/**
 * Subscribe to a server-sent events endpoint emitting raw text lines
 * (e.g. log streaming). Completes silently on error, like the legacy app.
 */
export function subscribeTextStream(url: string, subscriber: StreamSubscriber<string>): () => void {
  const eventSource = new EventSource(url);
  eventSource.onmessage = (event) => subscriber.next(event.data);
  eventSource.onerror = () => {
    eventSource.close();
    subscriber.complete?.();
  };
  return () => eventSource.close();
}
