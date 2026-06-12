import { useCallback, useRef } from 'react';
import type { Toast } from 'primereact/toast';

/** Standard success/error toast pair used by the CRUD pages. Render
 *  `<Toast ref={toast} />` once in the page and call the helpers — both are
 *  stable, so they can sit in effect dependency arrays. */
export function useToastMessages() {
  const toast = useRef<Toast>(null);
  const showSuccess = useCallback(
    (detail: string) =>
      toast.current?.show({ severity: 'success', summary: 'Success', detail, life: 3000 }),
    [],
  );
  const showError = useCallback(
    (detail: string) =>
      toast.current?.show({ severity: 'error', summary: 'Error', detail, life: 5000 }),
    [],
  );
  return { toast, showSuccess, showError };
}
