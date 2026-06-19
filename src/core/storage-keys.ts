// Web-storage keys shared across modules. Centralized so that the writers
// (auth, project context, layout shells) and the cleaners (logout) cannot
// drift apart.
export const PROJECT_STORAGE_KEY = 'okdp-selected-projectId';
export const AUTH_RETURN_URL_KEY = 'auth_return_url';
export const SIDEBAR_COLLAPSED_KEY = 'okdp-sidebar-collapsed';
export const NAV_EXPANDED_KEY = 'okdp-nav-expanded';
// Also read by the pre-paint script in index.html — keep the two in sync.
export const THEME_STORAGE_KEY = 'okdp-theme';
export const PROJECT_COLORS_KEY = 'okdp-project-colors';
export const ENV_BAR_STORAGE_KEY = 'okdp-env-bar';
export const NAV_HIDDEN_KEY = 'okdp-nav-hidden';
// Lateral-menu entry/icon size (compact | default | large | xl).
export const NAV_SIZE_KEY = 'okdp-nav-size';
// User-created view launchers, keyed by project. Local-only for now — the
// API knows nothing about them.
export const CUSTOM_VIEWS_KEY = 'okdp-custom-views';
export const TYPED_DELETE_KEY = 'okdp-typed-delete';
// Prefix for per-project SQL query drafts (`okdp-sql-query:<projectId>`). May
// embed sensitive literals, so the logout cleaner sweeps every key under it.
export const SQL_QUERY_KEY = 'okdp-sql-query';
