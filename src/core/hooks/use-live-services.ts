import { useEffect, useState } from 'react';
import { serviceApi } from '../api/service-api';
import { applyListEvent } from '../api/sse';
import { readUiCache, writeUiCache } from '../api/ui-cache';
import type { ServiceInstance } from '../models/service.model';
import { logger } from '../services/logger';

export interface LiveServicesState {
  instances: ServiceInstance[];
  loaded: boolean;
}

/** Live list of a project's deployed service instances: cached snapshot
 *  paint, then initial REST fetch + SSE merge keyed by instance name — the
 *  app's standard live-list pattern. `projectName` undefined keeps the hook
 *  inert. The state carries its owning project, so a project switch can
 *  never serve the previous project's list, not even for one frame. */
export function useLiveServices(projectName: string | undefined): LiveServicesState {
  const [state, setState] = useState<{
    project: string;
    instances: ServiceInstance[];
    loaded: boolean;
  } | null>(null);

  useEffect(() => {
    if (!projectName) return;
    let cancelled = false;

    // Recent snapshot: paint immediately; the fetch below still runs.
    const cached = readUiCache<ServiceInstance[]>(`services:${projectName}`);
    setState({ project: projectName, instances: cached ?? [], loaded: !!cached });

    serviceApi
      .getServices(projectName)
      .then((data) => {
        if (cancelled) return;
        writeUiCache(`services:${projectName}`, data);
        setState({ project: projectName, instances: data, loaded: true });
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to load services', err);
        setState((curr) =>
          curr && curr.project === projectName ? { ...curr, loaded: true } : curr,
        );
      });

    const unsubscribe = serviceApi.subscribeServices(projectName, {
      next: (event) =>
        setState((curr) =>
          curr && curr.project === projectName
            ? { ...curr, instances: applyListEvent(curr.instances, event, (s) => s.name) }
            : curr,
        ),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectName]);

  return state && state.project === projectName
    ? { instances: state.instances, loaded: state.loaded }
    : { instances: [], loaded: false };
}
