import { Injectable, signal } from '@angular/core';
import type { UserProfile } from '../auth/auth.service';

type SpaceKey = 'project' | 'admin';

const STORAGE_KEY = 'okdp-preferred-space';
const ADMIN_ROLE = 'admins';
@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly fallbackSpace = signal<SpaceKey>('project');

  resolveInitialRoute(input: { profile?: UserProfile | null | undefined; roles: string[] }): string {
    const stored = this.readStoredSpace();
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

    return `/${this.fallbackSpace()}`;
  }

  remember(space: SpaceKey): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, space);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }

  private readStoredSpace(): SpaceKey | null {
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
}

