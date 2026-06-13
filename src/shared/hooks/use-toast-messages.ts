import { useCallback, useRef } from 'react';
import type { Toast } from 'primereact/toast';

/** Standard success/error/warn toast helpers used by the CRUD pages. Render
 *  `<Toast ref={toast} />` once in the page and call the helpers — all are
 *  stable, so they can sit in effect dependency arrays. */
export function useToastMessages() {
  const toast = useRef<Toast>(null);
  const showSuccess = useCallback(
    (detail: string, summary = 'Success') =>
      toast.current?.show({ severity: 'success', summary, detail, life: 3000 }),
    [],
  );
  const showError = useCallback(
    (detail: string, summary = 'Error') =>
      toast.current?.show({ severity: 'error', summary, detail, life: 5000 }),
    [],
  );
  const showWarn = useCallback(
    (detail: string, summary: string) =>
      toast.current?.show({ severity: 'warn', summary, detail, life: 5000 }),
    [],
  );
  return { toast, showSuccess, showError, showWarn };
}
