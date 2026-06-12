import { useEffect, useState } from 'react';
import { serviceApi } from '../../core/api/service-api';
import { applyListEvent } from '../../core/api/sse';
import { readUiCache, writeUiCache } from '../../core/api/ui-cache';
import type { ServiceInstance } from '../../core/models/service.model';
import { logger } from '../../core/services/logger';

export interface ViewServicesState {
  instances: ServiceInstance[];
  loaded: boolean;
}

/** Deployed instances backing the /views page and its sidebar — initial REST
 *  fetch + SSE merge, like every live list in the app. The project shell owns
 *  the single subscription and shares it with the page via outlet context.
 *  `projectName` undefined (not on /views) keeps the hook inert. */
export function useViewServices(projectName: string | undefined): ViewServicesState {
  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectName) return;
    let cancelled = false;

    // Recent snapshot: paint immediately; the fetch below still runs.
    const cached = readUiCache<ServiceInstance[]>(`services:${projectName}`);
    setInstances(cached ?? []);
    setLoaded(!!cached);

    serviceApi
      .getServices(projectName)
      .then((data) => {
        if (cancelled) return;
        writeUiCache(`services:${projectName}`, data);
        setInstances(data);
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to load services for views', err);
        setLoaded(true);
      });

    const unsubscribe = serviceApi.subscribeServices(projectName, {
      next: (event) => setInstances((current) => applyListEvent(current, event, (s) => s.name)),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectName]);

  return { instances, loaded };
}
