import { useEffect, useState } from 'react';
import { serviceApi } from '../../core/api/service-api';
import type { PlatformService } from '../../core/models/service.model';
import { logger } from '../../core/services/logger';

/**
 * The platform-service catalog (what a project can deploy), fetched once.
 * Used by the console sidebar to surface services that have no bespoke area
 * under a generic "Other services" section. On failure it stays empty, so the
 * sidebar simply shows the bespoke services — never blocks the console.
 */
export function usePlatformCatalog(): PlatformService[] {
  const [services, setServices] = useState<PlatformService[]>([]);

  useEffect(() => {
    let cancelled = false;
    serviceApi
      .getPlatformServices()
      .then((data) => {
        if (!cancelled) setServices(data);
      })
      .catch((err) => logger.error('Failed to load the platform catalog for the sidebar', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return services;
}
