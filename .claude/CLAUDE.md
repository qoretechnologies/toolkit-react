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
- **Testing:** Vitest — a `unit` project (jsdom, tests in `__tests__/`) + a `storybook` project (every story run in a real Chromium browser via Playwright); React Testing Library for component assertions
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

**Reconnect:** Triggered on close (unless code `4999` = intentional, or the caller closed it: a socket closed while still connecting reports 1006) and when a handshake has not opened after `handshakeTimeout` (default 15s, `REQRAFT_WS_HANDSHAKE_TIMEOUT_MS`): a hung handshake sends no event at all, and Chromium queues every other socket to the same host and port behind it, so the socket is closed, its users get error + close 1006, and it is replaced. Immediate first try, then `reconnectInterval` (default 5s) up to `maxReconnectTries` (default 10). Each try first probes `system/pid`, aborted after `probeTimeout` (default 10s); the probe never gates the try. `remove()`/`close()` call off a pending try and its probe.

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
- A user the server marks `storage_writable: false` (an interactive support session, qorus#693) gets memory-only writes: the value updates for the page's lifetime and no `PUT users/_current_/` is sent (`storageIsWritable` in `StorageProvider.tsx`)

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
| `Color`       | Colour picker (`@uiw/react-color-saturation`, `-hue`, `-alpha`) with a preview, validated hex/RGB/opacity inputs, help and swatches |
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
yarn test               # Vitest unit tests (jsdom)
yarn test:watch         # Vitest unit watch mode
yarn test:stories       # Story / interaction tests in a real browser (+ Qlip capture)
yarn lint               # ESLint check
yarn build              # TypeScript compilation (tsconfig.prod.json)
yarn build:test         # Type-check without emit
```

### Pre-commit Checks

- `yarn precheck` runs: lint → test → build:test:prod
- `pre-push` hook enforces: `build:test:prod`, `lint`, `test`
- CI (`.github/workflows/tests.yml`) runs precheck, build and the full story suite for PRs into `develop` **and** for every push to `develop`. GitHub skips `pull_request` workflows while a PR has merge conflicts, so a conflicting PR gets no test runs until it is rebased or merged up
- Branch naming: always start with the issue number, e.g. `feature/49_pooled-connections`

### Versioning — every PR to `develop` MUST bump the version

`.github/workflows/beta_release.yml` runs on **every push to `develop`** and publishes to NPM using whatever `version` is in `package.json` at push time. A merge without a bump therefore tries to re-publish an already-published version and **fails** (NPM refuses to re-publish). This applies to **every** PR — features, fixes, chores, and docs-only changes alike. There is no exception.

- Bump the **patch** for an ordinary PR while in beta (pre-1.0) — e.g. `0.10.9` → `0.10.10`. Do NOT bump minor/major for ordinary feature/fix PRs.
- Bump **exactly once per PR**, not once per commit. If the branch has already bumped, leave it alone —
  a second bump does not make the merge any more publishable, it just burns a version that never ships.
  Check before you reach for it: `git diff $(git merge-base origin/develop HEAD) -- package.json`. A PR
  that walked 0.10.36 → 0.10.46 one commit at a time is what this line exists to prevent (#95), and its
  prereleases are stamped from `package.json`, so a base that moves every push hands consumers what look
  like ten different release lines instead of successive previews of one.
- Bump **exactly once per PR**, not once per commit. If the branch has already bumped, leave it alone —
  a second bump does not make the merge any more publishable, it just burns a version that never ships.
  Check before you reach for it: `git diff $(git merge-base origin/develop HEAD) -- package.json`. A PR
  that walked 0.10.36 → 0.10.46 one commit at a time is what this line exists to prevent (#95), and its
  prereleases are stamped from `package.json`, so a base that moves every push hands consumers what look
  like ten different release lines instead of successive previews of one.
- Bump in `package.json` only (no git tag): `npm version patch --no-git-tag-version`, and include the bump in the PR's commit.
- If another PR bumps to the same version before yours merges, rebase and bump again — the version at merge time must be strictly greater than the last published one.

### Testing Patterns

- Two Vitest projects (see `vitest.config.ts`): **unit** (jsdom; tests in `__tests__/`, mirroring `src/`) and **storybook** (every `*.stories.tsx` run in a real Chromium browser via Playwright). There is no Jest.
- Wrap unit tests with `ReqraftProvider` (or at minimum `QueryClientProvider`)
- Use `mock-socket` for WebSocket testing
- Run: `yarn test` (unit) · `yarn test:stories [file-substring]` (stories) · `yarn precheck` (lint + unit + `build:test:prod`)
- **The type catalogue comes from the server.** A data type's names (its display name, a label, and its
  sentence form, its name inside a sentence), descriptions and conversions (`types_accepted`, `exact_match`) are
  the Qorus server's (`QorusDataTypeCatalogue::Info`, served at `/system/qorus-type-info`): `defaultQorusTypes`
  (`src/helpers/qorusTypeCatalogue.ts`) is reqraft's copy until the server's list arrives, and the condition and
  type messages are worded with it. `__tests__/qorusTypeCatalogue.test.ts` compares it, field for field, with
  `__tests__/fixtures/qorusTypeInfo.json`, a recorded answer of the server. When the server's catalogue changes,
  record its answer again and fix the copy until the test passes:
  `qrest -j system/qorus-type-info | yarn -s record:type-info`

### Storybook Stories & visual testing

- Stories are co-located alongside source: `src/hooks/useFetch/useFetch.stories.tsx`
- Storybook port: **6008**
- Story + interaction tests run on **Vitest browser mode** (Playwright/Chromium): `yarn test:stories [file-substring]`. Run `yarn install-playwright` once first.
- **Story network — mocks must follow the instance, and stories must not share connections.**
  - Build every mock URL with `storyApiUrl(path)` / `storySocketUrl(path)` from
    `src/stories/storyNetwork.ts`, never a hard-coded `https://hq.qoretechnologies.com:8092/…`.
    Both mock layers match on host (storybook-addon-mock keys on `host + pathname`,
    mock-socket on the URL minus its query), so a hard-coded host silently stops matching
    when `REACT_APP_QORUS_INSTANCE` is overridden and the request goes to the real network.
  - Requests components make on their own (FormEngine's `system/qorus-type-info`, the
    expression catalogue `useExpressions` fetches whenever functions are allowed, the
    reconnect probe `system/pid`) are mocked for every story via `GLOBAL_STORY_MOCK_DATA`
    (`parameters.mockAddonConfigs.globalMockData`). Add new ones there, not per story file.
  - A mock `response` must be an object, array or function — a bare number or string fails
    the addon's validation and the entry is silently never matched (`TStoryMockResponse`
    enforces this at compile time). The addon compares query-parameter *keys* only, so
    `system?action=a&context=x` also answers `system?action=b&context=y`.
  - `.storybook/preview.tsx` resets the shared LSP connections and the expression render
    client before every story. Do not add per-file `ReqraftWebSocketsManager.closeAll()`
    calls for LSP isolation.
  - CI reaches the live hq instance with a valid token, so a story that leaks a real
    request can pass in CI and hang locally. When a story passes in CI but times out on
    your machine, look for an unmocked request before anything else.
  - The guard (`src/stories/realNetworkGuard.ts`) covers what an element loads as well:
    an `<img>`, `<source>` or `srcset`, a frame, a script, a stylesheet, a medium. Anything
    else loaded from another origin, such as a CSS `url()` or a font, is caught from the
    browser's resource timing. A story image is a local asset or a `data:` URI, never a
    server's URL. The template fixtures keep the URL the server gives an app's logo
    (`<instance>/api/public/apps/<app>/logo`) and swap in a local copy
    (`__fixtures__/templateFixtures.ts`, `src/stories/Data/qorusAppLogo.svg`), so import
    the fixtures from there, not from the JSON.
- **Touch stories carry `tags: ['touch']`.** A story whose play calls `withTouchScreen`
  (`src/stories/touchScreen.ts`), directly or through a helper such as
  `playTapIsDrawnOnAPhone`, is tagged `touch`. `yarn test:stories` runs those stories in their
  own Vitest project (`storybook-touch`), whose browser context is a phone from the start
  (Playwright's `isMobile` and `hasTouch`, 390×844), and before the others; an untagged one fails
  with the reason. Never turn Chromium's touch emulation on or off over the DevTools protocol:
  turning it off leaves the page with the machine's hover and pointer, not the mouse Playwright
  launched it with, and a Linux CI runner has none, so every later story in the page finds
  `(hover: none)` (it never shows on a Mac, which always reports a mouse).
  `.storybook/vitest.setup.ts` checks every story's browser is its project's:
  `(hover: hover) and (pointer: fine)`, or on the phone `(hover: none) and (pointer: coarse)`.
- **Story clock — every story starts at the same instant.** Components write dates
  relative to the clock ("3 hours ago"), so a story dated against the real clock captured
  "1 month ago" in one build and "3 months ago" a few weeks later.
  - `.storybook/preview.tsx` starts every story at `STORY_NOW` (30 June 2026, 12:00 UTC,
    `src/stories/storyClock.ts`). Date story data from it with `storyMinutesAgo(n)`,
    never with `Date.now()`, `new Date()` or a literal date of its own.
  - The clock runs on in real time from `STORY_NOW`, because a stopped clock stops lodash's
    `debounce` and `throttle` (ControlGroup's resize, Slate's selection sync). A story is
    captured well inside the minute the shortest "… ago" takes to change.
  - `parameters.mockdate` stops the clock at an instant, for a story whose every reading
    must be the same (log lines stamped to the millisecond). `parameters.live` stories keep
    the real clock.
  - Every story also starts with an empty `ReqraftQueryClient`, as every unit test does: a
    story must pass when it is opened on its own, not only after an earlier story fetched
    what it needs. With the clock it is required too: an answer carries the time it was
    fetched, and the clock takes each story back to `STORY_NOW`, so the previous story's
    answers would read as fetched in the future and be served instead of its own mocks.
    Anything else a page keeps from story to story with a timestamp needs the same reset.
  - The capture browser runs in UTC and US English (`vitest.config.ts`), as CI does, so a
    date written in the viewer's zone or language captures the same on every machine.
- **Visual regression via Qlip** (not Chromatic): the story run captures snapshots through the `qlip` Vitest plugin. Upload is gated on `QLIP_UPLOAD_TOKEN` (`vitest.config.ts`), so **local runs capture but never upload** — PNGs land in `qlip/screenshots/<ts>/stories/auto/<StoryId>.png` (gitignored); read the PNG to verify a visual change. CI (`.github/workflows/tests.yml`) sets the token and uploads a build for dashboard review. The full visual-change flow + the `qlip` MCP review skill live in the imported `stacks/frontend/FRONTEND.md`.
- **Capture a look once, not a behaviour many times.** Qlip catches a change in how a component
  looks; a story's play assertions test what it does. A story is captured only when its end state
  looks different from every other capture of the same component: one capture per distinct look
  (the field holding chips, plain text, read-only, empty, the completion list open, the picker at
  its top level / drilled into a group / searched / on a phone, a hover or details card, each error
  or diagnostic state, long content, find and replace, signature help...). Every other story keeps
  its play and gets, per story (story parameters merge over the meta's):

  ```ts
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
  },
  ```

  naming the story that pictures its end state. Each capture is a baseline a human accepts by
  hand, and a look changed on purpose is then one diff to review, not thirty.
  - A capture shows what the story is about, or does not exist: a story about a list or a hover
    ends with it open if its look is distinct; otherwise it is skipped.
  - A "…On Touch" / "…On A Phone" story captured at desktop size is the desktop picture again:
    give it `qlip: { viewport: PHONE_VIEWPORT }` when its layout differs, otherwise skip it.
  - Before adding a story, check whether an existing capture of the component already shows its
    end state; a new capture needs a look no other has.

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
| Story shows FormEngine's loading skeleton / "Connecting to language server…" forever | An unmocked request or a connection inherited from an earlier story — see "Story network" above |
| "No Preview — Sorry, but you either have no stories…" in a story failure | Not a registration failure: addon-vitest injects Storybook's hidden preview body into every test page, and a failed query's DOM dump prints it. Read the assertion above the dump |
| A story run stops reporting and never times out (no failure, no output) | The page's main thread is blocked, so the in-page 30s test timer cannot fire — usually a synchronous render loop inside `act()`. Find the story with `--reporter=verbose` (the last ✓ is the one before it), then give Chromium `launchOptions: { args: ['--remote-debugging-port=9333'] }` in `vitest.config.ts` locally, enable `Debugger` over CDP BEFORE the freeze, and `Debugger.pause` once `Runtime.evaluate` stops answering to get the stack. Revert the config afterwards |
| `yarn test:stories` hangs before any test runs (the port message is incidental) | Seen when the checkout path contains `+` — e.g. an auto-named `.claude/worktrees/fix+name` — while the same tree at a `+`-free path runs normally. Use a path without `+` |

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
| `src/tracking/` | First-party tracking, consent and A/B testing (`core/` no DOM, `browser/`, `react/`, and `ui/`: the A/B test card and overlay on Reqore); how-to in `design/TRACKING.md` |
| `src/types/` | Shared TypeScript types |
| `__tests__/` | Vitest unit tests (jsdom) |

## Other

- This library is a **peer-dependency consumer** of ReQore — do not copy ReQore internals here; import from `@qoretechnologies/reqore` instead
- `yarn update-reqore` updates ReQore to the latest beta
