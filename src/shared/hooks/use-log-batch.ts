import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Lines are held this long before a flush, so a chatty stream renders once. */
export const LOG_FLUSH_MS = 100;

export interface LogBatch {
  /** Queue a streamed line. The first one arms the flush. */
  push: (line: string) => void;
  /** Flush whatever is queued now, for stream completion or failure. */
  flush: () => void;
  /** Drop everything pending, for a stream that is being replaced. */
  reset: () => void;
}

/**
 * Collects streamed log lines and hands them over in batches.
 *
 * A driver can emit thousands of lines a second. Rendering each one saturates
 * the main thread until the page stops answering, so lines accumulate for
 * LOG_FLUSH_MS and reach the caller as one array, one render.
 *
 * The pending timer is cleared when the component goes away, so a flush never
 * fires against an unmounted tree. A cap bounds the buffer itself, for a tab
 * left in the background where timers barely run.
 */
export function useLogBatch(onFlush: (lines: string[]) => void, cap?: number): LogBatch {
  const pendingRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Kept in a ref so a caller passing an inline closure does not re-arm the
  // batch on every render.
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const batch = pendingRef.current;
    pendingRef.current = [];
    if (batch.length > 0) onFlushRef.current(batch);
  }, []);

  const push = useCallback(
    (line: string) => {
      pendingRef.current.push(line);
      // A background tab throttles setTimeout to a minute, so a chatty stream
      // would pile up lines the flush is about to discard anyway. Trimming
      // here keeps the buffer bounded whatever the browser does with timers.
      if (cap !== undefined && pendingRef.current.length > cap) {
        pendingRef.current.splice(0, pendingRef.current.length - cap);
      }
      if (timerRef.current === undefined) {
        timerRef.current = setTimeout(flush, LOG_FLUSH_MS);
      }
    },
    [flush, cap],
  );

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    pendingRef.current = [];
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Stable across renders, so callers can list it in an effect's dependencies
  // without re-subscribing their stream on every render.
  return useMemo(() => ({ push, flush, reset }), [push, flush, reset]);
}

/**
 * Appends a batch to the lines already shown, dropping the oldest beyond the
 * cap so a long-running stream cannot grow without bound.
 */
export function appendCapped(previous: string[], batch: string[], cap: number): string[] {
  const next = [...previous, ...batch];
  if (next.length > cap) next.splice(0, next.length - cap);
  return next;
}
