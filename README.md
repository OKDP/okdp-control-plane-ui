# OKDP Console

The OKDP Console is the web interface of the [OKDP](https://okdp.io) data
platform: it manages OKDP projects and their data-platform services — Spark
applications, JupyterHub, Airflow, Trino, Superset, Polaris, secret stores — by
talking to the OKDP control-plane API.

Built with React 19, Vite, TypeScript (strict), PrimeReact and Tailwind CSS v4.
See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design.

## Prerequisites

- Node.js 22+ and npm
- A running OKDP control plane on `http://localhost:8093` (the development API
  target)
- Access to the development OIDC identity provider (the dev build authenticates
  against the OKDP sandbox authority)

## Development server

```bash
npm install
npm start
```

Open `http://localhost:4200/`. The app reloads on source changes.

> **The port matters.** The OIDC redirect URIs registered with the identity
> provider point at `localhost:4200` — running on another port breaks login.
> The port is pinned in `vite.config.ts`; don't change it.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` / `npm run dev` | Vite dev server on port 4200 |
| `npm run build` | type-check (`tsc -b`) + production bundle → `dist/` |
| `npm run preview` | serve the production bundle locally |
| `npm test` | run the unit tests once (Vitest) |
| `npm run test:watch` | run the tests in watch mode |
| `npm run test:coverage` | tests with coverage report |
| `npm run lint` | ESLint over `src` (with `--fix`) |
| `npm run format` | Prettier over `src` |

Run a single test file or test name:

```bash
npx vitest run src/core/auth/auth-context.test.tsx
npx vitest run -t "logs out"
```

## Configuration

`src/config/environment.ts` switches on `import.meta.env.PROD`:

| | Development | Production |
|---|---|---|
| API base URL | `http://localhost:8093` | `/api` (same-origin, behind an ingress) |
| OIDC authority | OKDP sandbox | inherited from dev (see below) |
| OIDC client | `okdp-app` | `okdp-app` |

Authentication uses the OIDC authorization-code flow (`oidc-client-ts`) with
silent renew; tokens live in sessionStorage. Roles come from the OIDC `groups`
claim — members of `admins` get the admin pages.

> **Production note:** the OIDC authority is currently baked into the bundle at
> build time and inherits the sandbox value; deployments targeting another IdP
> need a build-time override or runtime config injection. The production image
> also expects a fronting ingress to route `/api` to the control plane — the
> nginx in the image serves only the static bundle. See
> [Known limitations](ARCHITECTURE.md#known-limitations--open-decisions).

## Docker

The production image builds the static bundle and serves it with nginx on
port 4200 (SPA fallback included, hashed assets cached immutably,
`index.html` served with `no-cache`):

```bash
docker build -t okdp-console .
docker run --rm -p 4200:4200 okdp-console
```

## Project structure

```
src/
  core/        # cross-cutting infra: auth, http/sse clients, contexts, theme
  features/    # one folder per functional area (admin, project-console, …)
  shared/      # reusable components, hooks and utils
  config/      # environment switch
```

Conventions in brief (details in [ARCHITECTURE.md](ARCHITECTURE.md) and
`CLAUDE.md`):

- strict TypeScript, no `any`; use the app `logger`, not `console`
- design tokens (`--db-*` variables / Tailwind utilities) over raw hex/px
- live lists follow the *initial REST fetch + SSE merge* pattern
- all web-storage keys are centralized in `src/core/storage-keys.ts`
- tests are co-located `*.test.ts(x)` (Vitest + Testing Library)

## Tests

```bash
npm test
```

Unit tests run with Vitest + Testing Library in `jsdom`. External SDKs such as
`oidc-client-ts` are mocked with `vi.hoisted` + `vi.mock`
(see `src/core/auth/auth-context.test.tsx` for the pattern).

## License

[Apache License 2.0](LICENSE)
