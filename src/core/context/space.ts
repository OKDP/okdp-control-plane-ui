import type { UserProfile } from '../auth/user-profile';

export type SpaceKey = 'project' | 'admin';

const STORAGE_KEY = 'okdp-preferred-space';
const ADMIN_ROLE = 'admins';
const FALLBACK_SPACE: SpaceKey = 'project';

export function resolveInitialRoute(input: {
  profile?: UserProfile | null | undefined;
  roles: string[];
}): string {
  const stored = readStoredSpace();
  const isAdmin = input.roles.includes(ADMIN_ROLE);

  if (stored === 'admin' && isAdmin) {
    return '/admin';
  }
  if (stored === 'project') {
    return '/project';
  }

  if (isAdmin) {
    return '/admin';
  }

  return `/${FALLBACK_SPACE}`;
}

export function rememberSpace(space: SpaceKey): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, space);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

function readStoredSpace(): SpaceKey | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'project' || raw === 'admin') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
