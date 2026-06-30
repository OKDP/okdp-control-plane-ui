import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../../core/api/catalog-api';
import type { PlatformService } from '../../../core/models/service.model';
import { logger } from '../../../core/services/logger';

/**
 * Platform-service catalog fetched on mount and on demand. Unlike the identity
 * lists this is not polled: the catalog is admin-edited and low-churn, so we
 * refresh it explicitly after each mutation instead of hammering the endpoint.
 */
export function useCatalog() {
  const [services, setServices] = useState<PlatformService[]>([]);
  // Stays true once the first load resolves so a manual refresh() never
  // re-masks an already-painted table with the loading spinner.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .listServices()
      .then((data) => {
        if (!cancelled) {
          setServices(data);
          setError(false);
        }
      })
      .catch((err) => {
        logger.error('Failed to load platform services', err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { services, loading: !loaded, error, refresh };
}
