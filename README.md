# OKDP Console

The OKDP Console is the web interface for managing OKDP projects and resources.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Build

To build the project run:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Tests

To run the unit tests:

```bash
npm test
```

## Architecture

- **Framework**: React 19 (built with Vite)
- **UI Library**: PrimeReact
- **Routing**: react-router
- **Authentication**: OIDC via oidc-client-ts
- **Styling**: CSS with CSS Variables for theming
- **Tests**: Vitest + Testing Library
