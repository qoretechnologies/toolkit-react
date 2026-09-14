# Story network isolation — ExpressionField stories fail off-network

**Status:** done pending user verify — branch `bugfix/expressionfield-stories`
(LSP fix `4e49e2a`, story network in the commit after it), not yet pushed.
Full story suite 479/479 and unit 930/930 locally, off-network.

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
- `tests.yml` runs only on `pull_request`: a conflicting PR stops getting runs and
  `develop` pushes are never tested.
