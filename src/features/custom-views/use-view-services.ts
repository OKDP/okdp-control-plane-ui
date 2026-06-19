import { useLiveServices, type LiveServicesState } from '../../core/hooks/use-live-services';

export type ViewServicesState = LiveServicesState;

/** Deployed instances backing the /views page and its sidebar. The project
 *  shell owns the single subscription and shares it with the page via
 *  outlet context. `projectName` undefined (not on /views) keeps the hook
 *  inert. */
export function useViewServices(projectName: string | undefined): ViewServicesState {
  return useLiveServices(projectName);
}
