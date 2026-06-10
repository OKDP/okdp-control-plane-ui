// Web-storage keys shared across modules. Centralized so that the writers
// (auth, project context, layout shells) and the cleaners (logout) cannot
// drift apart.
export const PROJECT_STORAGE_KEY = 'okdp-selected-projectId';
export const AUTH_RETURN_URL_KEY = 'auth_return_url';
export const SIDEBAR_COLLAPSED_KEY = 'okdp-sidebar-collapsed';
