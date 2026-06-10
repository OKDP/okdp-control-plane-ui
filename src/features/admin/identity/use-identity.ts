import { useCallback, useEffect, useState } from 'react';
import { identityApi, type Group, type User } from '../../../core/api/identity-api';
import { logger } from '../../../core/services/logger';

const POLL_INTERVAL_MS = 15000;

function usePolledList<T>(fetcher: () => Promise<T[]>, label: string) {
  const [items, setItems] = useState<T[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetcher()
        .then((data) => {
          if (!cancelled) setItems(data);
        })
        .catch((err) => logger.error(`Failed to load ${label}`, err));

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Legacy loading semantics: loading while the list is empty
  return { items, loading: items.length === 0, refresh };
}

/** Users fetched on init, every 15s, and on demand (IdentityService equivalent). */
export function useIdentityUsers() {
  const { items: users, loading, refresh } = usePolledList<User>(identityApi.listUsers, 'users');
  return { users, loading, refresh };
}

/** Groups fetched on init, every 15s, and on demand (IdentityService equivalent). */
export function useIdentityGroups() {
  const {
    items: groups,
    loading,
    refresh,
  } = usePolledList<Group>(identityApi.listGroups, 'groups');
  return { groups, loading, refresh };
}
