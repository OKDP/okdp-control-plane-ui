/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ENV_BAR_STORAGE_KEY } from '../storage-keys';

export interface EnvBarContextValue {
  envBarEnabled: boolean;
  setEnvBarEnabled: (enabled: boolean) => void;
}

const EnvBarContext = createContext<EnvBarContextValue | null>(null);

/** Whether the per-project environment color strip paints across the top of
 *  the header. Persisted per browser; shared between the console shell
 *  (reader) and the settings page (writer). */
export function EnvBarProvider({ children }: { children: ReactNode }) {
  const [envBarEnabled, setEnabled] = useState(
    () => localStorage.getItem(ENV_BAR_STORAGE_KEY) !== 'false',
  );

  const setEnvBarEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(ENV_BAR_STORAGE_KEY, String(enabled));
    setEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({ envBarEnabled, setEnvBarEnabled }),
    [envBarEnabled, setEnvBarEnabled],
  );

  return <EnvBarContext.Provider value={value}>{children}</EnvBarContext.Provider>;
}

export function useEnvBar(): EnvBarContextValue {
  const ctx = useContext(EnvBarContext);
  if (!ctx) {
    throw new Error('useEnvBar must be used within an EnvBarProvider');
  }
  return ctx;
}
