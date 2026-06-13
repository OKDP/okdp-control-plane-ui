import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_INTERVAL_MS } from './constants';

interface UseStatusDialogOptions<TRow extends { name: string }, TDetail> {
  projectId: string;
  /** Fetches the detailed status of one resource. Must be referentially
   *  stable (module-level function or API method reference). */
  getStatus: (projectId: string, name: string) => Promise<TDetail>;
  /** Re-fetches the resource list, folds it into the table state and
   *  resolves with the fresh rows (used by refresh). */
  listAndMerge: () => Promise<TRow[]>;
  /** Builds a summary-only detail (conditions: []) from a list row —
   *  used as fallback when the status fetch fails and as the immediate
   *  detail during refresh. Must be referentially stable. */
  toFallbackDetail: (row: TRow) => TDetail;
  showError: (detail: string) => void;
}

/** Status-detail dialog state shared by the secret store and external secret
 *  lists: open/close, fetch with list-row fallback, poll while visible, and
 *  manual refresh that also updates the table. */
export function useStatusDialog<TRow extends { name: string }, TDetail>({
  projectId,
  getStatus,
  listAndMerge,
  toFallbackDetail,
  showError,
}: UseStatusDialogOptions<TRow, TDetail>) {
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<TDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  const fetchDetail = useCallback(
    (name: string, fallback?: TRow) => {
      getStatus(projectId, name)
        .then((fresh) => {
          setDetail(fresh);
          setLoading(false);
        })
        .catch(() => {
          if (fallback) {
            setDetail(toFallbackDetail(fallback));
          }
          setLoading(false);
        });
    },
    [projectId, getStatus, toFallbackDetail],
  );

  const open = (row: TRow) => {
    setSelectedName(row.name);
    setLoading(true);
    setDetail(null);
    setVisible(true);
    fetchDetail(row.name, row);
  };

  const close = () => setVisible(false);

  // Poll the status detail while the dialog is open
  useEffect(() => {
    if (!visible || !selectedName || !projectId) return;
    const timer = setInterval(() => {
      if (loadingRef.current) return;
      fetchDetail(selectedName);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [visible, selectedName, projectId, fetchDetail]);

  const refresh = () => {
    if (!selectedName || !projectId) return;
    setLoading(true);

    listAndMerge()
      .then((rows) => {
        const fresh = rows.find((r) => r.name === selectedName);
        if (fresh) {
          setDetail(toFallbackDetail(fresh));
          fetchDetail(fresh.name);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        showError('Failed to refresh status');
        setLoading(false);
      });
  };

  return { visible, detail, loading, selectedName, open, close, refresh };
}
