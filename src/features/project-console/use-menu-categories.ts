import { useEffect, useState } from 'react';
import { serviceApi } from '../../core/api/service-api';
import type { MenuCategory } from '../../core/models/service.model';
import { logger } from '../../core/services/logger';

/**
 * The console navigation categories (labels, section icons and order for each
 * service `category`), fetched once. Used by the console sidebar to group and
 * order the catalog services into sections. On failure it stays empty, so the
 * sidebar falls back to a single "Other services" section, never blocks the
 * console.
 */
export function useMenuCategories(): MenuCategory[] {
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    serviceApi
      .getMenuCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err) => logger.error('Failed to load the menu categories for the sidebar', err));
    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
