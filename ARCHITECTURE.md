# Architecture

The OKDP Console is the web UI for managing OKDP projects and data-platform
services (Spark, Jupyter, Airflow, Trino, Superset, Polaris, secrets…). It is a
**React 19 + Vite** single-page application written in strict TypeScript that
talks to the OKDP **control-plane API**. The codebase is a port of an earlier
Angular app; comments referencing Angular constructs (`APP_INITIALIZER`,
`HttpClient`, `route.data`, route guards) document which construct each piece
replaces.

Tech stack: React 19, react-router 7, PrimeReact 10 (styled mode, lara theme),
Tailwind CSS v4, oidc-client-ts 3, Vite 7, Vitest 3.

- [Bootstrap & provider tree](#bootstrap--provider-tree)
- [Platform capabilities](#platform-capabilities)
- [Routing](#routing)
- [Authentication](#authentication)
- [HTTP & API clients](#http--api-clients)
- [Streaming: the REST + SSE pattern](#streaming-the-rest--sse-pattern)
- [State & storage](#state--storage)
- [Dynamic schema forms](#dynamic-schema-forms)
- [Navigation & the views world](#navigation--the-views-world)
- [SQL editor](#sql-editor)
- [Styling](#styling)
- [Build, test & deployment](#build-test--deployment)
- [Directory layout](#directory-layout)
- [Known limitations & open decisions](#known-limitations--open-decisions)

## Bootstrap & provider tree

`src/main.tsx` mounts `<App />` under `<StrictMode>`. `src/App.tsx` declares the
provider tree — **order is intentional**, outermost first:

| # | Provider | Responsibility |
|---|----------|----------------|
| 1 | `PrimeReactProvider` | PrimeReact global config (`ripple: true`) |
| 2 | `ThemeProvider` | light/dark/system theme, persisted, toggles `body.dark-mode` |
| 3 | `EnvBarProvider` | environment-bar visibility preference |
| 4 | `NavPrefsProvider` | sidebar item show/hide + entry size |
| 5 | `CustomViewsProvider` | user-created view launchers per project (local-only) |
| 6 | `ConfirmPrefsProvider` | typed-delete confirmation preference |
| 7 | `BrowserRouter` | routing (+ `ScrollToTop` on pathname change) |
| 8 | `AuthProvider` | OIDC state machine around `oidc-client-ts` `UserManager` |
| 9 | `AuthGate` | renders `null` until the one-shot OIDC check resolves — **no route mounts before auth state is known** (the `APP_INITIALIZER` equivalent) |
| 10 | `AuthRedirector` | post-login deep-link restore + global 401/403 handler |
| 11 | `CapabilitiesProvider` | reads `GET /api/capabilities` once (see [Platform capabilities](#platform-capabilities)) |
| 12 | `ProjectContextProvider` | available projects (REST + SSE) and the selected project |
| 13 | `AppRoutes` | the route table |

## Platform capabilities

### Capability discovery

`GET /api/capabilities` tells the console what the platform serves. Two readers:

- `src/core/capabilities/use-capabilities.ts` fetches it before mount
  (`main.tsx`) for the OIDC client, with a per-tab cache.
- `CapabilitiesProvider` (`src/core/context/capabilities-context.tsx`) exposes
  it to screens through `useCapabilities()`: `userManagement` gates the
  identity screens, and `engine` holds the engine capabilities resolved by
  `resolveEngineCapability()` in
  `src/core/capabilities/deployment-capabilities.ts`.

| Field | Effect | Default when absent |
|-------|--------|---------------------|
| `engine.name` | display only (administration page), never branched on | not shown |
| `engine.renderedValues`, `engine.suspend` | not used by any screen yet | `false` |

The console is shared by every engine and never knows where an engine stores
its desired state. No screen branches on a storage mode, and no screen shows
a revision. Screens test capabilities, never the engine name. Missing or
mistyped fields resolve to the defaults, which match a server that publishes
no engine capabilities. The deployment-capability resolver reads only `engine`,
while identity and OIDC provisioning capabilities are handled separately.

### Instance phases and connections

Instance phases common to every engine: `Pending`, `Installing`, `Updating`,
`Ready`, `Degraded`, `Error`, `Suspended`, `Deleting`, `Unknown`
(`service-utils.ts`, `instance-status-alert.tsx`). `Unknown` means the engine
cannot observe the instance and is never shown as `Pending`. Screens read an
instance's state through `instancePhase()`: its `phase` when the server sends
one of the nine, else its historical `status` (`Ready`, `Error`, `Updating`,
`Installing`), which is all an older server sends. The list's Error chip counts
`Degraded` too, as the historical status reports it as `Error`. The connections
on an instance's detail show their `state` (`declared`, `published`, `bound`,
`ready`) when the server sends it, else `Resolved` or `Waiting` from
`resolved`.

What a screen shows of an instance comes from its phase, the `Deleting…` of a
deletion requested from this page, and `InstanceStatusAlert`. The alert shows
the server's `statusMessage`, or a generic text for the phase, for every phase
but `Ready`. A `Ready` instance shows the alert only when the server sends a
`statusMessage`, for example about a change the engine could not apply while
the instance keeps running.

### Write outcomes and optimistic concurrency

Instance writes (deploy, edit) carry `operation: { outcome, desiredRevision,
problems }` (`write-outcome.ts`). An accepted write answers 2xx with it next to
the instance. A rejected write answers 409 or 500, and an unknown write outcome
answers 504, with `operation` in the error body next to `error` and `code` (a
bare 504 without a body is treated as `unknown` too). `rejected` keeps the form
and shows the problems, or the server's `error` text when the code says the
name is taken (`instance-exists`), since those problems carry the engine's raw
error. `unknown` opens the instance detail (preserving `returnTo`) so its state
is read again. A 2xx without `operation` is an accepted write, and an error
body without it is reported as an error. The toast of a write travels with the
navigation that follows it (`useRouteNotice`,
`src/shared/hooks/use-route-notice.ts`) and shows on the service list or the
instance detail.

Instances may carry `desiredRevision`, an opaque version of the desired state,
empty when the engine reports none. It is never displayed. Edit always fetches
the instance uncached (`fresh = true`) so it starts from the current revision.
Edit and delete send `desiredRevision` back as `If-Match: "<desiredRevision>"`
when the loaded instance has one and its characters are all visible ASCII
excluding `"` and `,`. Anything else would break the header, so no `If-Match`
is sent. A stale one answers 409 with code `conflict`: the edit form stays,
Save is blocked until Reload fetches the current instance without using the
cache and finishes loading its connection inputs, and delete reads the instance
or the list again.

### Deletion lifecycle

Delete reads the engine answer with its HTTP status (`classifyDelete`):

| Answer | Outcome | Screen |
|--------|---------|--------|
| `operation.outcome` `rejected` (code `conflict`: conflict) or `unknown`, any 2xx | rejected, conflict or unknown | error, or warning and reread |
| 204, or 200 | deleted | the row goes, the detail page goes back to the list |
| 202 with `operation.outcome: "accepted"` | accepted | the row, or the detail page, shows `Deleting…` with Edit, Delete and Open disabled until the stream sends `DELETED`. The detail page then goes back to the list |
| 202 without an accepted `operation` | unknown | warning, the instance or the list is read again |

An engine that deletes asynchronously must answer 202 with an accepted
`operation`: a 204 removes the row at once. While a DELETE request is in
flight, Edit, Delete and Open stay disabled, and an early stream `DELETED`
navigates back without flashing `Instance not found`.

An instance in the `Deleting` phase, from a read or from the stream, has Edit,
Delete and Open disabled too, and the detail page goes back to the list when
the stream sends its `DELETED`. A list read that lands after the stream deleted
a row does not bring it back, and neither does a revisit: a `DELETED` event, or
a deletion that answers 204 or 200, drops the instance from the `ui-cache`
snapshot and the project's cached GET answers, and from every read of the
project still in flight (`forgetDeletedInstance`,
`src/core/api/service-deletions.ts`). The deletions a tab saw are shared by the
reads of every screen of the project, `useLiveServices` included, and kept only
while a read started before them is in flight. A later `ADDED` or `MODIFIED`
lifts a deletion only for the screen whose stream sent it, since another stream
may be late.

A deletion belongs to the project it was asked from. The list marks
`Deleting…` rows per project and filter, and the detail page identifies an
instance on its way out by project and name. A confirmation dialog closes when
the page moves to another project or instance. A DELETE answer that arrives
after the page moved, after it was left, or after it came back to the same
place, changes nothing on screen (a generation counter, not the route, tells
them apart), so a same-named instance elsewhere is never locked or removed.

### Untrusted values

Values the server or the URL hand to the console are checked before use. An
instance `url` is opened or linked only when it is an absolute `http:` or
`https:` URL (`safeExternalUrl`, `openInNewTab`). A `returnTo` query value is
followed only when it starts with `/` but not `//`, holds no whitespace,
control character or backslash, and resolves to the console's own origin
(`safeReturnTo`), else the page goes back to its service area.

## Routing

All routes live in `src/app-routes.tsx`. Pages are `lazy()`-loaded and
**default-exported** (keep both when adding a page); the tree is wrapped in
`<Suspense fallback={null}>`.

| Path | Component | Guards |
|------|-----------|--------|
| `/` | `RootRedirect` | — (consumes a pending return URL, else `/home`) |
| `/login` | `HomePage` (landing) | — |
| `/home` | `StartPage` | `RequireAuth` |
| `/admin` | `AdminPage` | `RequireAuth` → `RequireAdmin` |
| `/identity` | `IdentityPage` | `RequireAuth` → `RequireAdmin` |
| `/platform-connections` | `PlatformConnectionsPage` | `RequireAuth` → `RequireAdmin` |
| `/settings` | `SettingsPage` | `RequireAuth` |
| `/views` | `ViewsRedirect` → `/projects/{current}/views` | `RequireAuth` |
| `/projects` | `ProjectList` | `RequireAuth` |
| `/projects/:projectId` | `ProjectRouteSync` → `ProjectHome` (index) | `RequireAuth` |
| `/projects/:projectId/secret-stores` | `SecretsPage` | same |
| `/projects/:projectId/connections` | `ConnectionsPage` | same |
| `/projects/:projectId/settings` | `ProjectSettingsPage` | same |
| `/projects/:projectId/views` | `CustomViewsPage` | same |
| `/projects/:projectId/views/sql-editor` | `SqlEditorPage` | same |
| `/projects/:projectId/views/spark/applications[...]` | Spark list / submit / detail / edit pages | same |
| `*` | redirect to `/home` | — |

Three structural pieces:

- **`ProjectPage`** (`features/project-console/project-page.tsx`) is the shared
  console shell — a pathless layout route. `/admin`, `/identity`, `/settings`,
  `/views`, `/projects` and everything under `/projects/:projectId` render in
  its `<Outlet>`.
- **`ProjectRouteSync`** (`core/guards/project-route.tsx`) is the route-guard
  equivalent: it syncs the selected project in `ProjectContext` from the URL
  param and renders nothing until context matches the URL, so project-scoped
  pages never see a mismatched context.
- **`serviceRoutes(basePath, data)`** generates the list/deploy/edit/detail
  route quadruple for a service area. The generic `ServicesPage` is driven
  entirely by per-route props (`title`, `deployLabel`, `serviceFilter`,
  `emptyMessage` — the `route.data` equivalent), so jupyterhub,
  spark/history-server, polaris, trino, hive-metastore, airflow and superset
  all share one component. **Differentiate service areas via the props object,
  not new components.** A service area is three things that must stay in sync:
  a `SERVICE_AREAS` entry, a `serviceRoutes()` call on the same base path and
  the sidebar entry in `NAV_CATEGORIES`. `src/app-routes.test.tsx` asserts that
  every sidebar segment resolves to a route instead of the `*` catch-all.

## Authentication

Everything lives in `src/core/auth/`; configuration in
`src/config/environment.ts` (`environment.oidc`).

1. **Init.** `AuthProvider` creates a single `UserManager` (held in a ref):
   authorization-code flow, tokens stored in **sessionStorage**
   (`WebStorageStateStore`), `automaticSilentRenew` enabled, `offline_access`
   in scope.
2. **One-shot callback.** The init effect redeems the OIDC redirect callback
   **exactly once** via a ref-held promise. StrictMode double-invokes effects
   in dev; without this guard the single-use authorization code would be
   redeemed twice and the IdP may revoke the tokens. **Preserve that guard.**
   When no callback is present, the session is restored from sessionStorage
   (rejected if expired). Either way `ready: true` is set and `AuthGate` lets
   the app render.
3. **Deep links.** On mount (before auth state is knowable), the current URL is
   saved under the `auth_return_url` sessionStorage key (skipping `/`,
   `/index.html` and login paths). After login, `AuthRedirector` consumes the
   key and `replace`-navigates to it; the `/` index route is handled by
   `RootRedirect`, which also consumes a pending return URL before defaulting
   to `/home`, so the two redirects cannot race. `RequireAuth` re-saves the
   location whenever it bounces an unauthenticated user, which covers the
   silent-renew-expiry path.
4. **Roles.** Read from the claim named by `identity.rolesClaim` (default
   `groups`). `isAdmin`, true when the roles carry `identity.adminRole`
   (default `platform_admin`), gates `RequireAdmin`, and non-admins are sent to
   `/home`.
5. **Token renewal.** Silent renew runs automatically. `silentRenewError` is
   logged (the current token is usually still valid at that point);
   `accessTokenExpired` drops the local session, which routes the user back to
   login with their location saved. `token()` refuses to hand out an expired
   access token.
6. **401/403.** `http.ts` fires the unauthorized handler registered by
   `AuthRedirector`: forced logout (local state cleared, including the
   project selection and per-project SQL drafts), the interrupted location is
   re-saved, and the user lands on `/login?sessionExpired=true` — the landing
   page shows a session-expired notice and the deep link is restored after
   re-login.

## HTTP & API clients

`src/core/api/http.ts` is a small `fetch` wrapper (the `HttpClient` +
interceptors equivalent):

- Attaches `Authorization: Bearer <token>` to any URL containing `/api/`
  (the `secureRoutes` equivalent). Auth wires the token provider via
  `setAuthTokenProvider`; **feature code never reads the token directly** — it
  goes through `http`.
- Throws `HttpError { status, statusText, body, url }` on non-OK responses;
  401/403 additionally fire the unauthorized handler.
- `get` / `getText` / `post` / `put` / `patch` / `delete` plus
  **`getList<T>`**, which resolves `[]` on an empty body — use it for every
  list endpoint instead of hand-rolling `|| []`.
- Every method accepts an optional trailing `init?: RequestInit`, used e.g. to
  thread an `AbortSignal` through (`sqlApi.execute`).
- `get` and `getList` without `init` share one answer per URL for 5 s. Every
  write clears that cache. `invalidateApiCache(url)` drops the answers for a
  URL and the URLs under it: `serviceApi.forgetServiceReads(projectId)` uses
  it when the stream reports an instance deleted.

Each domain has a `*-api.ts` exporting a plain object of methods, with URLs
built from `environment.apiBaseUrl`. Path segments are encoded with
`encodeURIComponent` at the client boundary (the per-file `seg` helper) —
follow that pattern for new endpoints. Current clients:

| Client | Endpoints |
|--------|-----------|
| `project-api.ts` | `/api/projects` CRUD + `/stream` SSE |
| `service-api.ts` | platform services, schema, per-project service instances CRUD + `/stream` SSE, pods, metrics, pod logs (text + follow stream), profile images |
| `spark-api.ts` | spark config/schema, spark-apps CRUD (guided + YAML submit) + `/stream` SSE, Spark UI info, driver logs (text + follow stream) |
| `identity-api.ts` | `/api/v1/identity` users/groups CRUD (admin) |
| `secret-store-api.ts` | per-project secret stores CRUD, connection test, status |
| `external-secret-api.ts` | per-project external secrets CRUD, status |
| `connection-api.ts` | contract descriptors, per-project external connections CRUD + connectivity test, derived internal connections, and the same external CRUD + test at platform scope (admin) |
| `sql-api.ts` | `execute(projectId, serviceName, query, maxRows?, signal?)` — POST `/api/projects/{id}/services/{name}/sql` to the control plane's SQL proxy |

`src/core/api/ui-cache.ts` is a deliberate in-memory, per-tab,
stale-while-revalidate cache (60 s TTL) for slow reads (instance lists,
metrics): revisited pages paint instantly from the snapshot while the fresh
request always runs and overwrites. It is never a reason to skip a fetch.

## Streaming: the REST + SSE pattern

`src/core/api/sse.ts` holds the primitives:

- `subscribeJsonStream<T>(url, subscriber, label)`: `fetch`-based SSE reader
  carrying the OIDC `Authorization: Bearer` header, emitting parsed JSON and
  reconnecting after 3 s on disconnect (stopping without retry on `401` or
  `403`).
- `subscribeTextStream(url, subscriber)`: authenticated `fetch` stream for raw
  text lines (log following), forwarding failures to `subscriber.error`.
- `applyListEvent<T>(list, event, key)` — folds a watch-style
  `{ type: 'ADDED' | 'MODIFIED' | 'DELETED', object }` event into an immutable
  list, upserting by key. The event types (`ProjectEvent`, `ServiceEvent`,
  `SparkAppEvent`) are aliases of `ListEvent<T>`.

**Every live list does an initial REST fetch, then merges SSE events** —
follow this pattern for new lists. Current consumers:

| Consumer | Resource |
|----------|----------|
| `core/context/project-context.tsx` | projects |
| `core/hooks/use-live-services.ts` | service instances (shared hook) |
| `features/project-console/services/service-list.tsx` | service instances (filtered per area) |
| `features/project-console/services/service-detail-page.tsx` | one service instance: an event about it triggers an uncached GET (since the stream payload lacks the bound connections) and refreshes pods on `ADDED`/`MODIFIED`. Reads are numbered and a read lands only if no later one did. `DELETED` shows the instance as gone, or goes back to the list for an instance being deleted |
| `features/project-console/spark/spark-list.tsx` | spark applications |

`useLiveServices(projectName)` (`src/core/hooks/use-live-services.ts`) is the
canonical live service-instance hook: cached paint from `ui-cache`, REST fetch,
SSE merge, and **state keyed by the owning project** so a project switch can
never flash another project's data. `useViewServices` (views world) and
`useProjectServicesSummary` (dashboard) are built on it — build new
instance-driven features on it too.

## State & storage

### Project context (`src/core/context/project-context.tsx`)

Holds `availableProjects` (REST + SSE), the selected project (persisted in
sessionStorage), `isLoading` / `loadError` / `reload()`, and self-corrects when
the selection disappears from the list: it falls back to the first remaining
project (navigating only if the user is inside `/projects/:id/...`), or clears
the selection and goes to `/projects` when none remain. The destructive
self-correction is gated on at least one **successful** load, so a transient
fetch failure never wipes the saved selection. It only fetches while
authenticated — the provider is mounted on anonymous routes too, and an early
fetch would 401 and trigger the forced-logout handler.

### Preferences

Theme, env-bar, nav-prefs, custom views and confirm-prefs are
localStorage-backed contexts under `src/core/preferences/` and
`src/core/theme/`. State updaters are pure (persistence happens in effects) —
the app runs under StrictMode, which double-invokes updaters in dev.

### Storage keys

**All web-storage keys live in `src/core/storage-keys.ts`** — add new keys
there so writers and the logout cleaner cannot drift.

| Key | Stores | Storage |
|-----|--------|---------|
| `okdp-selected-projectId` | selected project (cleared on logout) | session |
| `auth_return_url` | deep link to restore after login | session |
| `okdp-sql-query:{projectId}` | SQL editor draft per project (swept on logout) | session |
| `okdp-theme` | theme mode — also read by the `index.html` pre-paint script | local |
| `okdp-sidebar-collapsed`, `okdp-nav-expanded`, `okdp-nav-hidden`, `okdp-nav-size` | sidebar/nav preferences | local |
| `okdp-project-colors` | project accent colors (cross-tab synced) | local |
| `okdp-env-bar`, `okdp-typed-delete` | env-bar & typed-delete preferences | local |
| `okdp-custom-views` | user-created launchers per project (local-only) | local |

`oidc-client-ts` additionally persists the OIDC user/tokens in sessionStorage
under library-managed keys.

## Dynamic schema forms

`src/shared/components/dynamic-schema-form.tsx` renders deploy/edit forms from
a JSON Schema fetched from the API (service deploy/edit flows are built on it,
via the `useServiceSchema` hook in `service-utils.ts`). `x-ui-*` extension
keys:

| Key | Effect |
|-----|--------|
| `x-ui-order` | sort position within the form |
| `x-ui-group` | titled section grouping (icon per `GROUP_ICONS`) |
| `x-ui-widget` | explicit widget: `password`, `textarea`, `select`, `stepper`, `number`, `toggle`, `url`; `profile-editor` excludes the field (rendered by `profile-list-editor.tsx` instead) |
| `x-ui-condition` | `{ field, value }` — render only when `values[field] === value` |
| `x-ui-advanced` | moves the field behind the per-group "Show advanced options" expander |
| `x-ui-columns` / `x-ui-col-span` | group grid columns / per-field span |
| `x-ui-placeholder` | input placeholder |
| `x-okdp-connection-ref` | `{ contract }` on an object-list column: a dropdown of the project's connections of that contract. `x-kubocd-connection-ref` is read the same way, the `x-okdp-` key wins when both are set |

Without `x-ui-widget`: `enum` → select, `boolean` → toggle, numbers → number
input, else text. Validation checks Kubernetes `resource.Quantity` format on
cpu/memory/request/limit-looking string fields (enum fields excluded), skips
fields hidden by `x-ui-condition`, and omits hidden fields' values from the
emitted parameters; overall validity is reported through `onValidityChange`.

## Navigation & the views world

`src/features/project-console/nav-config.tsx` exports `NAV_CATEGORIES` — the
**single source of truth** for the sidebar, shared by the project console
(renderer) and the settings page (show/hide toggles). Item flags: `disabled`
(inert "exploration" placeholder), `defaultHidden` (off until the user enables
it), category `fixed` (exempt from hide preferences). Brand logos come from
`simple-icons` or vendored `BrandGlyph` objects rendered through `BrandIcon`.

The **views world** (`/projects/:projectId/views`, `src/features/custom-views/`)
renders a different sidebar inside the same shell and hosts:

- **UI service launchers** (`views-config.tsx` `UI_SERVICE_VIEWS`) — one tile
  per deployed instance exposing a URL (Airflow, JupyterHub, Superset + its SQL
  Lab, Spark History Server).
- **Built-in views** (`BUILT_IN_VIEWS`) — rich technology pages that don't fit
  the "one service, one instance list" shape: Spark Applications and the SQL
  Editor.
- **Custom views** — user-created launcher tiles, stored locally per project.

## SQL editor

`/projects/:projectId/views/sql-editor`
(`src/features/custom-views/sql-editor-page.tsx`) runs SQL on a deployed query
engine through the control plane's SQL proxy (`sql-api.ts`); the proxy forwards
the statement to the engine with the caller's bearer token. Engines are the
project's `trino` instances (`SQL_SERVICES`), fed from the shell's shared
`useViewServices` subscription via outlet context.

Mechanics worth knowing: the page state is remounted per project
(`key={projectId}`), so drafts/results can't leak across projects; the draft
persists per project in sessionStorage (swept on logout); in-flight queries are
aborted on unmount or engine switch (`AbortController` + supersede guard);
Ctrl/Cmd+Enter runs the query; engine-reported errors (`SqlQueryResult.error`)
render with line/column info, transport errors separately.

## Styling

- **Single CSS entry point** `src/styles.css`, which declares the cascade-layer
  order up front:
  `@layer theme, base, primereact, primereact-overrides, components, utilities;`
  This line is **load-bearing**: the PrimeReact theme ships inside
  `@layer primereact`, and without the declared order Tailwind v4 preflight (in
  `base`) would strip PrimeReact components bare. The app's PrimeReact re-skins
  live in `primereact-overrides`. Don't reorder or remove it; keep the import
  order intact.
- **Design tokens** are `--db-*` CSS variables in `src/styles/variables.css`
  (light values in `:root`, dark overrides in `body.dark-mode`), surfaced as
  Tailwind utilities via `@theme inline` (`text-fg`, `bg-surface`,
  `border-border-light`, radius/shadow scales…). **Prefer tokens over raw
  hex/px.**
- **Dark mode is class-based** (`body.dark-mode`), not media-query based,
  applied by an inline script in `index.html` **before first paint** to avoid a
  light flash. That script intentionally duplicates the key/resolution logic of
  `theme-context.tsx` — keep the two in sync.
- The brand font (DM Sans) is loaded via `<link>` tags in `index.html`, not a
  CSS `@import` (a remote `@import` after the Tailwind import gets stripped
  from the production bundle).
- PrimeReact 10 runs in styled mode (lara theme). Re-skins are per-component
  `.p-*` overrides in the `primereact-overrides` layer.

## Build, test & deployment

- **Dev server**: `npm start` → Vite on **port 4200**. The port is
  load-bearing: the OIDC redirect URIs registered with the IdP point at
  `localhost:4200`. Do not change it. Development talks to the control plane at
  `http://localhost:8093` (`src/config/environment.ts`, statically branched on
  `import.meta.env.PROD`).
- **Build**: `npm run build` = `tsc -b && vite build` → `dist/`. Strict TS with
  `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns`;
  `vite.config.ts` is included in type-checking. The app version rendered in
  the footer comes from `package.json` via the `__APP_VERSION__` Vite define
  (declared in `src/vite-env.d.ts`). `npm run size-check` builds and then fails
  if a bundle exceeds the budgets in `scripts/check-bundle-size.mjs`.
- **Tests**: Vitest + Testing Library (`jsdom`), configured in
  `vite.config.ts`; tests are co-located `*.test.ts(x)`. External SDKs
  (e.g. `oidc-client-ts`) are mocked with `vi.hoisted` + `vi.mock` — see
  `src/core/auth/auth-context.test.tsx` for the pattern.
- **Docker** (`Dockerfile`): two-stage — `node:22-alpine` builds the bundle,
  `nginx:1.27-alpine` serves `dist/` on port 4200. `nginx.conf`: immutable
  caching for hashed `/assets/`, `no-cache` for `index.html` (so deploys are
  picked up), SPA fallback, and `/api/` answered with 404 — **an ingress in
  front of the container is expected to route `/api` to the control plane**.

## Directory layout

```
index.html               # SPA shell; pre-paint dark-mode script; font links
vite.config.ts           # Vite + React + Tailwind plugins; port 4200; Vitest; __APP_VERSION__
Dockerfile / nginx.conf  # two-stage build; nginx static serving on 4200
scripts/                 # check-bundle-size.mjs (npm run size-check)
src/
  main.tsx               # entry: StrictMode, createRoot, styles.css
  App.tsx                # provider tree, AuthGate, ScrollToTop
  app-routes.tsx         # route table, lazy pages, serviceRoutes() helper
  styles.css             # single CSS entry: layer order, theme mapping, overrides
  styles/variables.css   # --db-* design tokens (light + dark)
  config/environment.ts  # dev/prod switch (apiBaseUrl, OIDC)
  core/
    api/                 # http.ts, sse.ts, ui-cache.ts, domain clients (*-api.ts)
    auth/                # auth-context, auth-redirector, require-auth/admin
    capabilities/        # bootstrap capabilities cache, deployment-capabilities resolver
    context/             # project-context, capabilities-context
    guards/              # project-route (ProjectRouteSync)
    hooks/               # use-live-services (REST + SSE instance hook),
                         # use-polled-resources (poll a list while any row is transient)
    models/              # service.model.ts, spark.model.ts
    preferences/         # localStorage-backed preference contexts
    services/            # logger.ts, project-colors.ts
    storage-keys.ts      # ALL web-storage keys
    theme/               # theme-context
  features/
    landing/ start/      # /login landing, /home entry
    admin/               # admin page, identity (users/groups), project list,
                         # connections (platform-wide external connections)
    custom-views/        # views world: launchers, SQL editor
    settings/            # global user settings
    project-console/     # console shell, nav-config, home dashboard,
                         # services (generic pages), spark, secret-stores,
                         # connections (external + internal tabs), settings
  shared/
    components/          # page-header, status-tag, empty-state, dynamic-schema-form,
                         # profile-list-editor, console-shell, brand-icon, …
    hooks/               # use-toast-messages, use-row-actions-menu, use-route-notice
    utils/               # k8s-names, safe-url
```

Conventions: feature code under `src/features/<area>/`, cross-cutting infra
under `src/core/`, reusable presentational pieces under
`src/shared/components/`. Use the `logger`, never `console`.

## Known limitations & open decisions

- **OIDC config is read at startup, not baked into the bundle.** The container
  entrypoint writes `/config.js`, which `index.html` loads before the bundle:
  authority, client id, the claim carrying the roles, and the role granting
  administration. One image therefore runs against any cluster. The values in
  `src/config/environment.ts` act only as local development defaults when
  `/config.js` is absent.
- **Production API base path.** `environment.apiBaseUrl` is `''` in production
  so requests leave the browser as `/api/...` on the same origin as the console
  (routed by ingress to the control plane server).
- **SSE reconnect does not trigger a full REST resync.** `subscribeJsonStream`
  reconnects after 3 s without notifying the caller, so a `DELETED` event missed
  during a disconnect window requires a manual refresh (or revisiting the view).
