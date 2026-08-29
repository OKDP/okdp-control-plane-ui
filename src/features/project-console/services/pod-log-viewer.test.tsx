import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PodLogViewer } from './pod-log-viewer';
import { serviceApi } from '../../../core/api/service-api';
import type { StreamSubscriber } from '../../../core/api/sse';
import type { Pod } from '../../../core/models/service.model';

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    getPodLogs: vi.fn(async () => ''),
    streamPodLogs: vi.fn(() => () => undefined),
  },
}));

const pods: Pod[] = [
  { name: 'pod-a', status: 'Running', containers: ['main'] } as unknown as Pod,
];

let subscriber: StreamSubscriber<string>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(serviceApi.streamPodLogs).mockImplementation(
    (_p: string, _s: string, _pod: string, sub: StreamSubscriber<string>) => {
      subscriber = sub;
      return () => undefined;
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderStreaming() {
  const view = render(
    <PodLogViewer projectId="demo" serviceName="svc" pods={pods} initialPodName="pod-a" />,
  );
  await act(async () => {
    subscriber.next('a first line');
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(screen.getByText('streaming')).toBeTruthy();
  return view;
}

describe('PodLogViewer, the stream stops', () => {
  // Both showed at once: the banner said the stream had stopped while the dot
  // below still pulsed "streaming".
  it('does not say streaming under a stream-stopped banner', async () => {
    await renderStreaming();

    await act(async () => {
      subscriber.error?.(new Error('log stream interrupted'));
    });

    expect(screen.getByText(/log stream stopped/i)).toBeTruthy();
    expect(screen.queryByText('streaming')).toBeNull();
  });

  it('does not say streaming under a server failure either', async () => {
    const { unmount } = await renderStreaming();
    const { StreamServerError } = await import('../../../core/api/sse');
    await act(async () => {
      subscriber.error?.(new StreamServerError('pod is gone'));
    });
    expect(screen.getByText(/pod is gone/)).toBeTruthy();
    expect(screen.queryByText('streaming')).toBeNull();
    unmount();
  });
});
