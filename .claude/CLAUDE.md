# ReQraft AI Coding Agent Instructions

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

### General Development Practices

- Focus on user experience and performance first; complexity and tech debt are secondary
- Follow existing code patterns; refer to similar hooks/components for guidance
- Check if a helper or utility already exists before writing a new one
- Use TypeScript with strict typing; prefix interfaces with `I` and types with `T`
- Always use named exports for React components and hooks
- Use functional components with React hooks; wrap in `memo()` unless there's a reason not to
- Wrap callbacks in `useCallback()` and computed values in `useMemo()` unless there's a reason not to

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

- Interfaces: `I` prefix (e.g., `IReqraftUseFetch`)
- Types: `T` prefix (e.g., `TReqraftMenu`)
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

## Task & design docs workflow

This repo uses **three complementary doc surfaces** for tracking
in-flight work. Keeping them in sync is part of every meaningful
change. The convention was introduced during the SmartEditor UX
batch (`design/SMART_EDITOR_UX.md` is the worked example).

### The three surfaces

| Surface | Location | Committed? | Lifetime | Purpose |
|---|---|---|---|---|
| **Design doc** | `design/<TOPIC>.md` | yes | persistent | *What we decided* — locked design + rationale. Updates are explicit revisions. |
| **Task file** | `.tasks/<TOPIC>.md` | yes | persistent (kept as history) | *What we're doing* — phases / checklists, status header, surface area, tests |
| **Verify file** | `VERIFY.local.md` at repo root | **no** (gitignored via `*.local.md`) | per-batch (overwrite each batch) | *What to check before push* — story-by-story click-through for the current uncommitted work |

Plus the dashboard:

- **`.tasks/INDEX.md`** (committed) — one-glance table across every
  task file with status, target release, sequence rationale.

### When to update each

**Design doc** (`design/<TOPIC>.md`)
- On creation: a non-trivial feature batch. Locks the decisions
  *before* code is written.
- On revision: when a decision changes mid-implementation. Update
  with a "Revised <date>" note in the affected section AND the
  doc's status footer. Don't silently rewrite — leave the audit
  trail.
- Example: `design/SMART_EDITOR_UX.md` was locked 2026-05-25,
  revised 2026-05-26 to add item 7 (LSP semantic tokens) after
  research surfaced that the regex highlighter was a copy-paste
  artifact.

**Task file** (`.tasks/<TOPIC>.md`)
- On creation: when starting a new batch of work. Must include:
  - `**Status:**` line at the top
  - Reference to the design doc (if applicable)
  - Surface-area table (which files this touches)
  - Phase breakdown with checklist items
  - "STOP — user verifies in browser before commit" gates
- On every meaningful transition: update the `**Status:**` line.
  Vocabulary listed in `.tasks/INDEX.md`.
- On checklist item completion: tick the box. Use `[x]` not
  emojis. Multi-task batches may use sub-section markers like
  `### 7a` / `### 7b` for grouping.
- On commit: append the commit sha to the relevant phase's status.

**`.tasks/INDEX.md`** (the dashboard)
- On every status transition that affects a task row, update both
  the task file's `**Status:**` header AND the index row.
- On new task creation: add a row before merging the task file
  itself.
- On task completion: don't delete the row — mark it `committed
  <sha>` or `shipped <tag>`.
- On task supersession: mark `superseded by <file>` rather than
  deleting; the row is history.

**`VERIFY.local.md`** (verification companion)
- On creation: at the start of a verification cycle (e.g. after a
  batch of work is done and before commit). Overwrite any
  previous content — this file is not historical.
- Contents: per-story click-through, what to type / hover /
  expect, plus test status snapshots and known issues.
- After verification passes: the file can stay (will be
  overwritten next batch) or be deleted. It's gitignored either
  way.
- **Do NOT** put any of this content in `.tasks/` or `design/` —
  those are committed and would create noise. The verify file
  exists exactly to keep batch-specific click-throughs out of
  history.

### The STOP-before-commit rule

Established workflow rule (originated in the SmartEditor UX batch
after several premature commits): **never commit a feature batch
until the user has verified it in their own browser.**

The agent's responsibility:
- Leave the work uncommitted (or on a feature branch, never
  merged) when implementation completes.
- Update `VERIFY.local.md` with the verification checklist.
- Surface a clear "STOP — user verifies" message in the response.

The user's responsibility:
- Open the running storybook (`yarn storybook`, port 6008).
- Walk the checklist in `VERIFY.local.md`.
- Either approve the commit OR report issues for iteration.

### File-naming conventions

- `design/<TOPIC>.md` — uppercase, kebab-case OK
  (e.g. `SMART_EDITOR_UX.md`)
- `.tasks/<TOPIC>.md` — same
- `.tasks/INDEX.md` — fixed name, top-level dashboard
- `<ANYTHING>.local.md` — gitignored; the `*.local.*` family is
  in `.gitignore` for non-committed scratch files (verify notes,
  agent prompts, screenshots checklists, etc.)

### What NOT to do

- **Don't put status / progress in design docs.** Design is
  *what we decided* — orthogonal to *where we are*.
- **Don't put click-through verification steps in `.tasks/`.**
  Those go in `VERIFY.local.md` so they stay out of history.
- **Don't delete completed task files.** They become institutional
  knowledge — refer back during reviews and post-mortems.
- **Don't track granular line-item status in `INDEX.md`.** The
  index is a dashboard; line items live in the task file.
- **Don't update one of the three surfaces without checking the
  others.** A status flip in the task file means a row update in
  the index. A design revision means a note in the task file
  pointing at it.

## Other

- You may need to source zsh to get some commands (like `gh`) working: `source ~/.zshrc`
- Branch naming convention: `feature/<issue-number>_<short-description>` (e.g., `feature/49_pooled-connections`)
- This library is a **peer-dependency consumer** of ReQore — do not copy ReQore internals here; import from `@qoretechnologies/reqore` instead
- `yarn update-reqore` updates ReQore to the latest beta
