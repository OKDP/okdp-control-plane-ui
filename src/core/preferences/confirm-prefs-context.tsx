/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TYPED_DELETE_KEY } from '../storage-keys';

export interface ConfirmPrefsContextValue {
  /** GitHub-style type-the-name confirmation on delete dialogs (default on). */
  typedDeleteEnabled: boolean;
  setTypedDeleteEnabled: (enabled: boolean) => void;
}

const ConfirmPrefsContext = createContext<ConfirmPrefsContextValue | null>(null);

/** Destructive-action confirmation preferences. Persisted per browser;
 *  shared between the delete dialogs (readers) and User Settings (writer). */
export function ConfirmPrefsProvider({ children }: { children: ReactNode }) {
  const [typedDeleteEnabled, setEnabled] = useState(
    () => localStorage.getItem(TYPED_DELETE_KEY) !== 'false',
  );

  const setTypedDeleteEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(TYPED_DELETE_KEY, String(enabled));
    setEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({ typedDeleteEnabled, setTypedDeleteEnabled }),
    [typedDeleteEnabled, setTypedDeleteEnabled],
  );

  return <ConfirmPrefsContext.Provider value={value}>{children}</ConfirmPrefsContext.Provider>;
}

export function useConfirmPrefs(): ConfirmPrefsContextValue {
  const ctx = useContext(ConfirmPrefsContext);
  if (!ctx) {
    throw new Error('useConfirmPrefs must be used within a ConfirmPrefsProvider');
  }
  return ctx;
}
