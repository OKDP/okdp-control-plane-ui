import { useEffect, useState } from 'react';
import { capabilitiesApi, type Capabilities } from '../api/capabilities-api';

// Servers without /api/capabilities always exposed the identity API, so an
// unreachable endpoint must keep the previous behaviour.
const legacyCapabilities: Capabilities = {
  identity: { provider: 'kubauth', userManagement: true },
  oidcProvisioning: { provider: 'none' },
};

// Fetched once per tab: capabilities only change when an operator edits the
// platform Context, so a reload is enough to pick them up.
let cached: Capabilities | undefined;
let inflight: Promise<Capabilities> | undefined;

export function fetchCapabilities(): Promise<Capabilities> {
  inflight ??= capabilitiesApi
    .get()
    .catch(() => legacyCapabilities)
    .then((caps) => {
      cached = caps;
      return caps;
    });
  return inflight;
}

export function useCapabilities(): Capabilities | undefined {
  const [capabilities, setCapabilities] = useState<Capabilities | undefined>(cached);

  useEffect(() => {
    if (capabilities) return;
    let alive = true;
    void fetchCapabilities().then((caps) => {
      if (alive) setCapabilities(caps);
    });
    return () => {
      alive = false;
    };
  }, [capabilities]);

  return capabilities;
}

// undefined while loading: treat as hidden.
export function useUserManagementEnabled(): boolean | undefined {
  return useCapabilities()?.identity.userManagement;
}
