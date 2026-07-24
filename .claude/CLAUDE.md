@~/Projects/instruction-files/CLAUDE.md
@~/Projects/instruction-files/stacks/frontend/FRONTEND.md

# ReQraft (toolkit-react) — Claude entry point

## Shared Qore rules (READ FIRST)

The two `@`-imports above load the shared rules from the **instruction-files**
repo: the org-wide baseline (`CLAUDE.md`) and the frontend ruleset
(`stacks/frontend/FRONTEND.md`) — git safety, commit conventions, CI
monitoring, `/audit`, the Reqore-first rule, the Storybook + Qlip visual-change
flow, story descriptions, and more. Those files point on to
`stacks/frontend/BRAND_DESIGN.md` for brand / UI-design decisions (read it
before building any visual surface). **Everything below this section is
specific to ReQraft (toolkit-react).**

**If the imports above did not load** — you don't see the shared rules because
this repo is cloned somewhere other than `~/Projects/instruction-files` — find
the shared repo before doing any frontend work:

1. Check for a gitignored **`.instruction-files-path`** file at this repo's
   root. If it exists, read the path `P` from it, then read `P/CLAUDE.md` and
   `P/stacks/frontend/FRONTEND.md` (+ `P/stacks/frontend/BRAND_DESIGN.md` for
   UI work) and follow them.
2. Otherwise locate the `instruction-files` repo on disk (try
   `~/Projects/instruction-files`, then your other project roots). If found at
   `P`, write `P` into `.instruction-files-path` (create it — it's gitignored)
   so future sessions skip the search, then read the files above.
3. If it isn't cloned anywhere, **STOP and ask the user to clone it**:
   `git clone git@github.com:qoretechnologies/instruction-files.git ~/Projects/instruction-files`
   Do not proceed with frontend work until the shared rules are loaded.

# ReQraft (toolkit-react) — project-specific rules

## Project Overview

ReQraft (`@qoretechnologies/reqraft`) is a **React hooks and components toolkit** for Qore Technologies' products. It sits on top of the [ReQore](https://github.com/qoretechnologies/reqore) component library and provides higher-level primitives: data fetching, WebSocket management, user/storage state, and shared form fields.

**Key Facts:**

- **Package name:** `@qoretechnologies/reqraft`
- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** TypeScript compilation to `/dist` via `tsconfig.prod.json`; exports `.js` + `.d.ts`
- **Styling:** styled-components (inherited from ReQore); no CSS modules
- **State Management:** zustand (stores) + React Context (`use-context-selector`)
- **Data Fetching:** `@tanstack/react-query` v4 (via `query()` util + `useFetch` hook)
- **Testing:** Jest + React Testing Library (tests in `__tests__/`)
- **Documentation:** Storybook (stories co-located in `src/` with `.stories.tsx` suffix)
- **Storybook port:** `6008` (not 6007 — that's reqore)

## Architecture Essentials

### Provider Stack (`src/providers/`)

The app must be wrapped in `ReqraftProvider` (or initialized via `initializeReqraft()`):

```
ReqraftContext.Provider (appName)
  └── QueryClientProvider (react-query)
        └── ReqraftFetchProvider (fetch context: get/post/put/del methods)
              └── ReqraftUserProvider (loads currentUser + storage, handles waitForStorage)
```

- **`initializeReqraft(options)`** — call once at app boot to set `instance`, `instanceToken`, `instanceRbacDisabled`, and `unauthorizedRedirect`; returns `ReqraftProvider`
- **`waitForStorage`** (default `true`) — delays rendering children until user storage is loaded from the server

### Fetch System (`src/utils/fetch.ts`)

- **`fetchConfig`** — mutable global config: `instance`, `instanceToken`, `instanceRbacDisabled`, `unauthorizedRedirect`
- **`setupFetch()`** — sets `fetchConfig`; called by `initializeReqraft`
- **`query<T>(config)`** — core async fetch using react-query under the hood; caches GET responses for 5 minutes (`CACHE_EXPIRATION_TIME`); POST/DELETE bypass cache
- All requests go to `${instance}api/latest/${url}`
- 401 responses trigger `fetchConfig.unauthorizedRedirect` (default: `/?next=<current-path>`)
- Auth: token via `Authorization: Bearer` header, but production uses cookies (`credentials: 'include'`)

### WebSocket System (`src/utils/websocket.ts`)

Two classes work together:

- **`ReqraftWebSocketsManager`** (static) — connection pool keyed by URL; shared `WebSocket` instances for `pooled: true` (default)
- **`ReqraftWebSocket`** — wraps a pooled or dedicated socket; handles reconnect logic, heartbeat (`ping` every 3s), handler registry

**Pooling:** By default (`pooled` not set to `false`), sockets with the same URL share one underlying `WebSocket`. Use `pooled: false` for dedicated connections. The pool key becomes `${url}::${nanoid()}` for non-pooled.

**Reconnect:** Triggered on close (unless code `4999` = intentional). Immediate first try, then `reconnectInterval` (default 5s) up to `maxReconnectTries` (default 10).

**Heartbeat:** Sends `"ping"` every 3s; ignores `"pong"` in message handlers.

### `useReqraftWebSocket` Hook (`src/hooks/useWebSocket/useWebSocket.ts`)

Key options:
- `openOnMount` / `closeOnUnmount` — lifecycle management
- `useState` — accumulate messages in local state
- `includeSentMessagesInState` — also store sent messages
- `includeLogMessagesInState` — store connect/disconnect/reconnect log entries
- `onMessage` — raw message callback (pong filtered automatically)

Returns: `{ messages, status, open, close, send, clear, on, pause, resume, addMessage, removeMessage, socket }`

Status enum: `OPEN | CLOSED | CONNECTING | PAUSED`

### `useFetch` Hook (`src/hooks/useFetch/useFetch.tsx`)

- Wraps `query()` via `FetchContext`; supports GET/POST/PUT/DELETE
- `loadOnMount` — triggers load immediately on mount
- `load({ body?, mergeBodies? })` — imperative trigger; `mergeBodies` merges call-time body with hook-defined body
- Returns: `{ data, loading, load, error, errorData, response }`

### Storage System (`src/hooks/useStorage/useStorage.ts`)

- `useReqraftStorage<T>(path, defaultValue?, includeAppPrefix?)` — returns `[value, setter, remover]`
- Backed by `ReqraftStorageContext` → `StorageProvider` → persisted to server via user storage API
- `includeAppPrefix` namespaces the key under the current `appName` from context
- Storage loads from `currentUserStore` (user's `storage` field from `/users?action=current`)

### Current User Store (`src/stores/currentUser/currentUser.tsx`)

- Zustand store: `{ currentUser, loading, error, load, hasAnyPermission, updateStorage }`
- `load()` — fetches `/users?action=current` (no cache); rejects on error
- `hasAnyPermission(permissions[])` — checks against `currentUser.permissions`
- Loaded automatically by `ReqraftUserProvider` on mount

### Form Fields (`src/components/form/fields/`)

Shared form field components built on ReQore, exported from `src/components/form/index.tsx`:

| Component     | Field Type                        |
|---------------|-----------------------------------|
| `Boolean`     | Toggle/checkbox                   |
| `Color`       | Color picker (`react-color`)      |
| `Cron`        | Cron expression editor            |
| `File`        | File upload (`react-dropzone`)    |
| `LongString`  | Multi-line text                   |
| `Markdown`    | Markdown editor/preview           |
| `Number`      | Numeric input                     |
| `Object`      | YAML/JSON object editor           |
| `RadioGroup`  | Radio group with optional images  |
| `String`      | Single-line text                  |

A generic `<Field>` component dispatches to the appropriate field by type.

### Menu Component (`src/components/menu/Menu.tsx`)

- `ReqraftMenu` — navigation menu built on ReQore components
- Types: `TReqraftMenu` (array), `TReqraftMenuItem`, `IReqraftMenuItem`, `IReqraftMenuProps`

### Log Component (`src/components/log/Log.tsx`)

- Displays streaming log messages; typically fed by `useReqraftWebSocket`

## Development Workflows

### Quick Start

```bash
yarn install
yarn storybook          # Dev mode on http://localhost:6008
yarn test:watch         # Jest watch mode
yarn lint               # ESLint check
yarn build              # TypeScript compilation (tsconfig.prod.json)
yarn build:test         # Type-check without emit
```

### Pre-commit Checks

- `yarn precheck` runs: lint → test → build:test:prod
- `pre-push` hook enforces: `build:test:prod`, `lint`, `test`
- Branch naming: always start with the issue number, e.g. `feature/49_pooled-connections`

### Versioning

- The package is in **beta** (pre-1.0): bump the **patch** for a PR — e.g. `0.10.4` → `0.10.5`. Do NOT bump minor/major for ordinary feature/fix PRs while in beta.
- Bump in `package.json` only (no git tag): `npm version patch --no-git-tag-version`, and include it in the PR's commit.

### Testing Patterns

- Tests live in `__tests__/` (mirror `src/` structure)
- Wrap tests with `ReqraftProvider` (or at minimum `QueryClientProvider`)
- Use `mock-socket` for WebSocket testing
- Run: `./node_modules/.bin/jest --passWithNoTests`

### Storybook Stories

- Stories are co-located alongside source: `src/hooks/useFetch/useFetch.stories.tsx`
- Storybook port: **6008**
- Visual testing via Chromatic (`yarn chromatic`)

## Code Patterns & Conventions

### Naming

- Enums: PascalCase (e.g., `ReqraftWebSocketStatus`)
- Hooks: `useReqraft*` prefix
- Providers: `Reqraft*Provider`
- Stores: `*Store` suffix

### Context Access

- Use `useContextSelector` (from `use-context-selector`) for fine-grained re-renders
- Use plain `useContext` only when consuming the full context is acceptable

### Adding a New Hook

1. Create `src/hooks/useMyHook/useMyHook.ts`
2. Add a story at `src/hooks/useMyHook/useMyHook.stories.tsx`
3. Export from `src/index.tsx`

### Adding a New Form Field

1. Create `src/components/form/fields/myfield/MyField.tsx`
2. Add a story at `src/components/form/fields/myfield/MyField.stories.tsx`
3. Register in `src/components/form/fields/Field.tsx` dispatch
4. Export from `src/components/form/index.tsx`

## Key Integration Points

### Fetch Auth Flow

1. `initializeReqraft({ instance, instanceToken })` sets `fetchConfig`
2. All `query()` calls prepend `${instance}api/latest/` and attach token if present
3. 401 → redirect via `unauthorizedRedirect` (configurable per app)

### WebSocket Auth

- Token appended as `?token=<instanceToken>` to the WS URL
- Override per-socket with `tokenOverride` option

### React Query Caching

- `ReqraftQueryClient` is a shared `QueryClient` instance (exported for reuse)
- GET requests cache for 5 minutes; failed responses are immediately invalidated
- Pass a custom `queryClient` to `query()` to use a different instance

## Common Pitfalls & Solutions

| Issue | Solution |
|---|---|
| Storage not loading | Ensure `ReqraftProvider` wraps the tree and `waitForStorage: true` (default) |
| WebSocket not reconnecting | Check close code — `4999` suppresses reconnect (intentional close) |
| Multiple sockets for same URL | Default is pooled; set `pooled: false` only when independent connections are needed |
| 401 loop | Verify `unauthorizedRedirect` is not pointing back to a protected route |
| `query()` returning stale data | Pass `cache: false`; POST/DELETE bypass cache automatically |
| Heartbeat noise in logs | Filter `ev.data === 'pong'` — already done inside `useReqraftWebSocket` |
| Storage path collisions | Use `includeAppPrefix: true` in `useReqraftStorage` to namespace per app |

## File Reference

| Path | Purpose |
|---|---|
| `src/index.tsx` | Main export barrel |
| `src/providers/ReqraftProvider.tsx` | Root provider + `initializeReqraft` |
| `src/providers/FetchProvider.tsx` | Exposes `get/post/put/del` via FetchContext |
| `src/providers/StorageProvider.tsx` | Loads user storage; wraps children |
| `src/utils/fetch.ts` | Core fetch + caching via react-query |
| `src/utils/websocket.ts` | `ReqraftWebSocket` + `ReqraftWebSocketsManager` |
| `src/utils/datetime.ts` | Datetime helpers (e.g., `getCurrentTimeWithMilliseconds`) |
| `src/hooks/useFetch/` | `useFetch` hook |
| `src/hooks/useWebSocket/` | `useReqraftWebSocket` hook |
| `src/hooks/useStorage/` | `useReqraftStorage` hook |
| `src/stores/currentUser/` | Zustand store for the authenticated user |
| `src/contexts/ReqraftContext.tsx` | App-level context (`appName`) |
| `src/contexts/FetchContext.tsx` | HTTP method context |
| `src/contexts/StorageContext.tsx` | User storage context |
| `src/components/form/` | Form field components |
| `src/components/log/` | Log display component |
| `src/components/menu/` | Navigation menu component |
| `src/types/` | Shared TypeScript types |
| `__tests__/` | Jest tests |

## Other

- This library is a **peer-dependency consumer** of ReQore — do not copy ReQore internals here; import from `@qoretechnologies/reqore` instead
- `yarn update-reqore` updates ReQore to the latest beta
