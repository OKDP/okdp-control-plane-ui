import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogBatch, appendCapped, LOG_FLUSH_MS } from './use-log-batch';

describe('useLogBatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // The whole point: a chatty driver must cost one render, not one per line.
  it('hands over many lines in a single flush', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => {
      for (let i = 0; i < 500; i++) result.current.push(`line ${i}`);
    });
    expect(onFlush).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0]).toHaveLength(500);
  });

  // Lines arriving after a flush must start a new window rather than wait for
  // one that already fired.
  it('re-arms after a flush', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => result.current.push('first'));
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));
    act(() => result.current.push('second'));
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush.mock.calls[1][0]).toEqual(['second']);
  });

  // A stream that ends before the window elapses must not lose its tail.
  it('flushes on demand without waiting', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => result.current.push('tail'));
    act(() => result.current.flush());

    expect(onFlush).toHaveBeenCalledWith(['tail']);
  });

  // Nothing queued means nothing to report, so a completing idle stream does
  // not trigger a pointless render.
  it('stays silent when there is nothing pending', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => result.current.flush());
    expect(onFlush).not.toHaveBeenCalled();
  });

  // Switching streams must not spill the previous one's tail into the next.
  it('drops pending lines on reset', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => result.current.push('stale'));
    act(() => result.current.reset());
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS * 5));

    expect(onFlush).not.toHaveBeenCalled();
  });

  // A flush firing against an unmounted tree would warn and update nothing.
  it('cancels its pending flush on unmount', () => {
    const onFlush = vi.fn();
    const { result, unmount } = renderHook(() => useLogBatch(onFlush));

    act(() => result.current.push('inflight'));
    unmount();
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS * 5));

    expect(onFlush).not.toHaveBeenCalled();
  });
});

describe('appendCapped', () => {
  it('keeps the newest lines when the cap is passed', () => {
    expect(appendCapped(['a', 'b'], ['c', 'd'], 3)).toEqual(['b', 'c', 'd']);
  });

  it('leaves the list alone below the cap', () => {
    expect(appendCapped(['a'], ['b'], 10)).toEqual(['a', 'b']);
  });

  // The batch itself can exceed the cap when a burst lands at once.
  it('trims a batch larger than the cap', () => {
    expect(appendCapped([], ['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd']);
  });
});

describe('useLogBatch, bounded buffer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // A background tab throttles timers to a minute, so without a cap the buffer
  // grows unbounded while the flush that would trim it never runs.
  it('keeps only the newest lines while the flush is delayed', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush, 100));

    act(() => {
      for (let i = 0; i < 5000; i++) result.current.push(`line ${i}`);
    });
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));

    const batch = onFlush.mock.calls[0][0];
    expect(batch).toHaveLength(100);
    expect(batch[batch.length - 1]).toBe('line 4999');
  });

  // Without a cap the hook must keep everything, as the pod viewer expects.
  it('keeps everything when no cap is given', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush));

    act(() => {
      for (let i = 0; i < 300; i++) result.current.push(`line ${i}`);
    });
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));

    expect(onFlush.mock.calls[0][0]).toHaveLength(300);
  });
});

describe('useLogBatch, the cost of staying bounded', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // splice moves the whole array, so trimming one line at a time cost the cap
  // on every push past it and turned a chatty driver into the freeze this hook
  // exists to prevent. The buffer may overshoot between trims; what reaches the
  // caller is still capped.
  it('hands over no more than the cap however far the buffer overshot', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush, 100));

    act(() => {
      for (let i = 0; i < 5000; i++) result.current.push(`line ${i}`);
    });
    act(() => vi.advanceTimersByTime(LOG_FLUSH_MS));

    const batch = onFlush.mock.calls[0][0];
    expect(batch).toHaveLength(100);
    expect(batch[batch.length - 1]).toBe('line 4999');
    expect(batch[0]).toBe('line 4900');
  });

  // The trimming must not run on every line: a burst well past the cap is
  // allowed to sit in the buffer until it is worth moving.
  it('does not trim on every line past the cap', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useLogBatch(onFlush, 100));

    const spliced = vi.spyOn(Array.prototype, 'splice');
    act(() => {
      for (let i = 0; i < 1000; i++) result.current.push(`line ${i}`);
    });
    const calls = spliced.mock.calls.length;
    spliced.mockRestore();

    // One trim per half-cap of overshoot at worst, nowhere near one per line.
    expect(calls).toBeLessThan(50);
  });
});
