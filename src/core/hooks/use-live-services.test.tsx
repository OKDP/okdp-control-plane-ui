import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLiveServices } from './use-live-services';
import { serviceApi } from '../api/service-api';
import { readUiCache } from '../api/ui-cache';
import type { StreamSubscriber } from '../api/sse';
import type { ServiceEvent, ServiceInstance } from '../models/service.model';

vi.mock('../api/service-api', () => ({
  serviceApi: {
    getServices: vi.fn(),
    subscribeServices: vi.fn(),
    forgetServiceReads: vi.fn(),
  },
}));

function instance(name: string): ServiceInstance {
  return {
    name,
    releaseName: name,
    service: 'trino',
    serviceTag: '0.1.0',
    status: 'Ready',
    targetNamespace: 'team-a',
    parameters: {},
  };
}

let stream: StreamSubscriber<ServiceEvent> | undefined;

describe('useLiveServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream = undefined;
    vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
      stream = subscriber;
      return () => undefined;
    });
  });

  it('keeps an instance the stream deleted out of a read that lands later, and of the cache', async () => {
    let answer: (value: ServiceInstance[]) => void = () => undefined;
    vi.mocked(serviceApi.getServices).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { result } = renderHook(() => useLiveServices('live-late'));
    await waitFor(() => expect(stream).toBeDefined());

    act(() => stream!.next({ type: 'DELETED', object: instance('lake') }));
    await act(async () => answer([instance('lake'), instance('sea')]));

    expect(result.current.instances.map((s) => s.name)).toEqual(['sea']);
    expect(readUiCache<ServiceInstance[]>('services:live-late')?.map((s) => s.name)).toEqual([
      'sea',
    ]);
    expect(serviceApi.forgetServiceReads).toHaveBeenCalledWith('live-late');
  });

  it('drops a deleted instance from the cached snapshot a later visit paints', async () => {
    vi.mocked(serviceApi.getServices).mockResolvedValue([instance('lake'), instance('sea')]);
    const first = renderHook(() => useLiveServices('live-revisit'));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));

    act(() => stream!.next({ type: 'DELETED', object: instance('lake') }));
    first.unmount();
    vi.mocked(serviceApi.getServices).mockImplementation(() => new Promise(() => undefined));
    const second = renderHook(() => useLiveServices('live-revisit'));

    expect(second.result.current.instances.map((s) => s.name)).toEqual(['sea']);
  });
});
