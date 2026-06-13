import { useEffect, useRef, useState } from 'react';
import { serviceApi } from '../../../core/api/service-api';
import { readUiCache, writeUiCache } from '../../../core/api/ui-cache';
import { useLiveServices } from '../../../core/hooks/use-live-services';
import type { ServiceInstance, ServiceMetrics } from '../../../core/models/service.model';

export interface ProjectServicesSummary {
  instances: ServiceInstance[];
  metrics: Record<string, ServiceMetrics>;
  loaded: boolean;
}

/** Live picture of the project's deployed services: initial REST fetch
 *  merged with SSE updates, plus one metrics request per instance. Shared
 *  by the overview KPI strip and the deployed-services table. */
export function useProjectServicesSummary(projectId: string | undefined): ProjectServicesSummary {
  const { instances, loaded } = useLiveServices(projectId);
  const [metrics, setMetrics] = useState<Record<string, ServiceMetrics>>({});
  // Metrics are fetched once per instance — SSE status churn must not
  // re-trigger the per-row requests.
  const fetchedMetricsRef = useRef<Set<string>>(new Set());

  // Per-project reset, declared before the metrics effect so the fetch set
  // is replaced before requests are keyed against the new project.
  useEffect(() => {
    setMetrics({});
    fetchedMetricsRef.current = new Set();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    // useLiveServices keys its state on the project, so `instances` always
    // belongs to `projectId` (empty while the new project's list loads) —
    // no requests fire for the previous project's instances. SSE events
    // churn the array identity, re-running this effect while requests are
    // in flight; staleness is therefore keyed on the per-project fetch set
    // (replaced when projectId changes), not on a per-run cancelled flag.
    const fetched = fetchedMetricsRef.current;
    for (const svc of instances) {
      if (fetched.has(svc.name)) continue;
      fetched.add(svc.name);
      // Recent snapshot fills the cell while the fresh request runs.
      const cached = readUiCache<ServiceMetrics>(`metrics:${projectId}/${svc.name}`);
      if (cached) {
        setMetrics((prev) => (prev[svc.name] ? prev : { ...prev, [svc.name]: cached }));
      }
      serviceApi
        .getServiceMetrics(projectId, svc.name)
        .then((m) => {
          writeUiCache(`metrics:${projectId}/${svc.name}`, m);
          if (fetchedMetricsRef.current === fetched) {
            setMetrics((prev) => ({ ...prev, [svc.name]: m }));
          }
        })
        .catch(() => undefined);
    }
  }, [instances, projectId]);

  return { instances, metrics, loaded };
}
