import { useCallback, useEffect, useState } from 'react';
import { identityApi, type Group, type User } from '../../../core/api/identity-api';
import { logger } from '../../../core/services/logger';

const POLL_INTERVAL_MS = 15000;

function usePolledList<T>(fetcher: () => Promise<T[]>, label: string) {
  const [items, setItems] = useState<T[]>([]);
  // Stays true across refresh()/poll cycles so background refreshes don't
  // re-mask an already-painted table with the loading spinner.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetcher()
        .then((data) => {
          if (!cancelled) {
            setItems(data);
            setError(false);
          }
        })
        .catch((err) => {
          logger.error(`Failed to load ${label}`, err);
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, loading: !loaded, error, refresh };
}

/** Users fetched on init, every 15s, and on demand (IdentityService equivalent). */
export function useIdentityUsers() {
  const {
    items: users,
    loading,
    error,
    refresh,
  } = usePolledList<User>(identityApi.listUsers, 'users');
  return { users, loading, error, refresh };
}

/** Groups fetched on init, every 15s, and on demand (IdentityService equivalent). */
export function useIdentityGroups() {
  const {
    items: groups,
    loading,
    error,
    refresh,
  } = usePolledList<Group>(identityApi.listGroups, 'groups');
  return { groups, loading, error, refresh };
}
