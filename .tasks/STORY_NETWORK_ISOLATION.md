# Story network isolation — ExpressionField stories fail off-network

**Status:** done pending user verify — folded into `fix/per-field-templates`
(PR #115) so every open reqraft fix ships in one PR; not yet pushed.
Originally built and verified on `develop` (stories 479/479, unit 930/930,
off-network), then re-verified on the combined branch.

## Symptom

`yarn test:stories ExpressionField` failed 6 of 8 on `develop` locally, while the
same file passed in CI (run 34250300001, 2026-09-08). Siblings failed the same
way: FormEngineRemote 11/11, AutoFormField 1, SchemaDefinitionField 2,
useWebsocket 3, TemplateField 1.

## Root causes

1. **An LSP connection outlived the story that opened it.** `useRenderExpression`
   holds the endpoint's `LspSharedConnection` for the page lifetime. `Default`
   (no mock LSP) dialled the real instance; `Empty` / `Text Mode` then joined that
   connection's never-settling handshake, so their mock LSP was never dialled
   ("Connecting to language server…" forever). Each passes when run alone.
2. **The shared connection had no way out of a dead socket** (product bug). No
   `onReconnectFailed` handling: a first handshake whose socket gave up stayed
   pending forever for every later client; one that had completed kept reporting
   the dead socket as ready. `close()` also abandoned an in-flight handshake, and
   `release()` could evict a connection that had replaced its own after a reset.
3. **Requests components make on their own were unmocked.** FormEngine gates on
   `system/qorus-type-info`; TemplateField's "Use Expression" waits on the
   expression catalogue; every `ReqraftWebSocket` reconnect awaits a `system/pid`
   probe. Against an unreachable instance none settles — the form stays a
   skeleton, the menu entry never appears, the socket never reconnects or gives
   up. CI's live instance answered all three, which is why CI stayed green.
4. **Mock URLs hard-coded the hq host.** Both mock layers match on host, so
   overriding `REACT_APP_QORUS_INSTANCE` silently disabled every mock.

## Fix

- `src/utils/lspClient.ts` — give-up / close settle the handshake and forget the
  socket; retry paths guarded by identity; `release()` only evicts itself.
  4 new unit tests + the disconnect-mid-handshake test now asserts the rejection.
- `src/stories/storyNetwork.ts` — `STORY_QORUS_INSTANCE`, `storyApiUrl`,
  `storySocketUrl`, `GLOBAL_STORY_MOCK_DATA` (types catalogue, empty expression
  catalogue, reconnect probe),
  `TStoryMockResponse` (the addon silently ignores non-object responses).
- `.storybook/preview.tsx` — `mockAddonConfigs.globalMockData`, per-story LSP
  reset in a project `beforeEach`; `.storybook/vitest.setup.ts` mirrors the
  addon's global + story merge.
- All mock URLs moved to the helpers; FormEngine's duplicate types mock and
  DpqlEditor's ad-hoc `closeAll()` removed.

### Reconciled with `fix/per-field-templates`

- That branch had already met the leak from the fixture side:
  `createMockLspServer` reset the shared connections on create and close. The
  project-level `beforeEach` covers the same ground plus stories that never
  create a mock server (and the render client), so the fixture resets were
  dropped in favour of the one mechanism.
- Its `query()` strips a path's leading slash and uses a `noApiPrefix` url
  verbatim; `buildReqraftApiUrl` follows those rules, so the doubled-slash mock
  spellings are gone.
- **A page-freezing render loop in the row menu** (from `a21640b`), reachable
  only once FormEngine rendered offline: `FormEngine › Compact Expressions`
  froze the tab and hung the whole suite with no output. The row kept ONE
  `{key, items}` slot, and an expression's operands — separate TemplateFields
  in the same row — published different keys into it, each overwrite
  re-rendering the row and both operands. The same slot also kept an unmounted
  editor's handlers when a reopened row offered the same key. Fixed in
  `rowMenuContext.ts` (per-publisher registration via `useId`, withdrawn on
  unmount, clicks delegated to the latest handler) and `TemplateField` (claims
  the channel and hides it from what it renders, so operands keep their own
  menu). Unit tests reproduce the loop and both stale-handler cases.
- `ExpressionField › Field Menu Stays In The Toolbar` had gone stale on that
  branch: `a21640b` moved a row field's menu into the row's ⋮ (one menu per
  control) after the story was written. The story now asserts that single
  menu — the row's `.options-readfirst-more`, with no `.template-more` beside
  it — still sits level with the toolbar.

## Not causes (checked)

- "No Preview" in failure output: addon-vitest injects Storybook's hidden preview
  body into every test page; a failed query's DOM dump prints it.
- A `+` in the checkout path hangs `yarn test:stories` before any test runs
  (mechanism not traced); unrelated to the stories.

## Follow-ups (not done)

- `users?action=current` is still unmocked for most stories — harmless today
  (`waitForStorage={false}`), but CI renders a real user while local runs render
  none. Candidate for a default mock once permission-gated snapshots are checked.
- Unmocked requests still pass through to the network. Failing them loudly for
  non-live stories would make this class impossible rather than documented.
- `ReqraftWebSocketsManager.closeAll()` deletes entries by `socket.url` rather than
  the pool key, and closing a CONNECTING socket reports code 1006, which schedules
  a reconnect. Not exercised by this fix.
- ~~`tests.yml` runs only on `pull_request`~~ — done on this branch: it now also
  runs on pushes to `develop` (the push trigger had been dropped in 2021 with no
  recorded reason). Conflicting PRs still get no `pull_request` runs until they
  merge up.
