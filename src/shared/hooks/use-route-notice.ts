import { useEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Toast } from 'primereact/toast';

/** A toast handed to the page a navigation lands on, so it outlives the page
 *  that raised it. */
export interface RouteNotice {
  severity: 'success' | 'warn' | 'error';
  summary: string;
  detail: string;
}

/** Navigation state carrying a notice: `navigate(path, { state: withNotice(n) })`. */
export function withNotice(notice: RouteNotice): { notice: RouteNotice } {
  return { notice };
}

/** Shows the notice the current navigation carries, once, then drops it from
 *  the history entry so a reload or a back navigation does not replay it. */
export function useRouteNotice(toast: RefObject<Toast | null>): void {
  const location = useLocation();
  const navigate = useNavigate();
  const shownFor = useRef<string | null>(null);
  const notice = (location.state as { notice?: RouteNotice } | null)?.notice;

  useEffect(() => {
    if (!notice || shownFor.current === location.key) return;
    shownFor.current = location.key;
    toast.current?.show({
      severity: notice.severity,
      summary: notice.summary,
      detail: notice.detail,
      life: notice.severity === 'success' ? 3000 : 5000,
    });
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    });
  }, [notice, location.key, location.pathname, location.search, location.hash, navigate, toast]);
}
