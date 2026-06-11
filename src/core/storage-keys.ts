// Web-storage keys shared across modules. Centralized so that the writers
// (auth, project context, layout shells) and the cleaners (logout) cannot
// drift apart.
export const PROJECT_STORAGE_KEY = 'okdp-selected-projectId';
export const AUTH_RETURN_URL_KEY = 'auth_return_url';
export const SIDEBAR_COLLAPSED_KEY = 'okdp-sidebar-collapsed';
// Also read by the pre-paint script in index.html — keep the two in sync.
export const THEME_STORAGE_KEY = 'okdp-theme';
export const PROJECT_COLORS_KEY = 'okdp-project-colors';
export const ENV_BAR_STORAGE_KEY = 'okdp-env-bar';
