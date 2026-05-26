# SmartEditor — context handling, debounced loader, README

Follow-up to the `0.10.0` UX batch (see
[`SMART_EDITOR_UX_POLISH.md`](./SMART_EDITOR_UX_POLISH.md)). This is
the catch-all for smaller correctness / polish items surfaced by the
post-`0.10.0` audit: a startup race in DPQL context binding, a
loader-flash on fast LSP responses, the missing FSM and Alert-payload
context props (required for the upcoming Alert Rule editor in
qorus-ide), and the README drift across this batch.

**Status:** items 1/2/4 done — committed in `5e94fd7` (item 1, `isContextReady` race), `8e6fe0f` (item 2, debounced loader), `2a53a1a` (item 4, FSM + alert-payload props). Item 3 (README catch-up) deferred to the final release-prep step at the end of the full batch — single README pass against the complete post-batch API. **Awaiting browser verification.**

**Scope:** four items, all small-to-medium. README update is
non-optional given how many props have been added.
**Estimated size:** ~150 lines, 1 day.

## Items

### 1. Initial DPQL context race

**Symptom.** `session.isReady` flips true when the LSP `initialize`
and `didOpen` complete (`useLspSession.ts:106`). `useDpqlSession`
THEN fires `dpql/setContext` in a separate effect — adding a second
roundtrip before the document has its provider context bound. If
the user types `@` in the first ~50–200ms after mount, the
completion request hits the server context-less; server returns
zero items; dropdown opens then closes silently.

**Server behaviour.** Tolerates context-less requests structurally
(no error), but returns empty results — exactly what makes the bug
hard to diagnose.

**Decision.** Add a `isContextReady?: boolean` field to
`IUseLspSessionResult`, defaulting to `true` (generic primitive has
no context concept). `useDpqlSession` overrides it: starts `false`,
flips `true` only after the `dpql/setContext` promise resolves, OR
flips `true` immediately if no `provider` is configured (no context
binding to do).

In SmartEditor, gate LSP-driven hooks
(`useLspAutocomplete`, `useLspHover`, `useLspSemanticTokens`) on the
combined signal `session.isReady && (session.isContextReady ?? true)`.
The loading overlay's copy becomes "Loading schema…" when
`isReady && !isContextReady`.

**Edge cases:**
- `provider` is set but `dpql/setContext` ERRORS — flip `isContextReady` true anyway (best-effort; the editor still works without provider-driven completions).
- `provider` changes after initial mount — flip `isContextReady` back
  to `false` until the new context resolves.

**Surface area:**
- `src/components/smartEditor/useLspSession.ts` — add `isContextReady` (default `true`)
- `src/components/dpqlEditor/useDpqlSession.ts` — track and expose
- `src/components/smartEditor/SmartEditor.tsx` — combined gate; loading-overlay copy switch
- `src/components/smartEditor/useLspAutocomplete.ts` — accept `isReady` (no API change; the caller passes the combined gate)

**Tests:** Storybook story that delays the mock's `dpql/setContext`
response by 500ms; play test types `@` in first 200ms and asserts
the dropdown does NOT appear; assert overlay copy is "Loading schema…".

**Complexity:** small.

---

### 2. `isFetching` loader debouncing (anti-flash)

**Symptom.** `useLspAutocomplete.ts:335` sets `isFetching=true`
synchronously when the LSP request fires. For sub-100ms mock
responses the user never sees the "Loading completions…" stub.
For ~200–500ms live responses, the stub flashes briefly then swaps
for items — visible jitter.

**Decision.** Mirror VS Code's "delay progress" pattern. Don't set
`isFetching=true` synchronously; schedule it via
`setTimeout(() => setIsFetching(true), LOADER_DELAY_MS)` where
`LOADER_DELAY_MS = 250`. Clear in the `finally` of the request and
in `close()`. Net effect: fast responses never set the flag; only
genuinely slow roundtrips do.

`setIsOpen(true)` stays synchronous — opening an items-less popover
is fine for ~250ms; renders nothing visible until either items
arrive (popover populates) or the timer elapses (loading stub shows).

**Surface area:**
- `src/components/smartEditor/useLspAutocomplete.ts` —
  `performCompletionRequest`, add a `fetchingTimerRef`, clear in
  `close()` and in the unmount-cancel effect
- Named constant `LOADER_DELAY_MS = 250` next to `DEBOUNCE_MS = 150`

**Tests:** Unit test with `jest.useFakeTimers()`:
- Fire request → advance 240ms → `isFetching === false`
- Advance to 260ms → `isFetching === true`
- Resolve request → `isFetching === false`
- Fire request, resolve in 80ms → `isFetching` never sets true

**Complexity:** small.

---

### 3. README drift across the `0.10.0` batch

**Symptom.** The published README (`toolkit-react/README.md`) hasn't
been updated since `0.9.0`. Six new SmartEditor / DpqlEditor props
landed across phases 4–7, none documented. The Components section
also doesn't mention diagnostics, hover, semantic tokens, or the
chip-replace flow.

**Missing — DpqlEditor:**
- `useServerParse` (Phase 6)

**Missing — SmartEditor:**
- `loadingIndicator?: React.ReactNode` (Phase 4)
- `enableHover?: boolean` (Phase 5)
- `isLoading?: boolean` (Phase 6)
- (After item 4 in this task) `alertPayloadContext?: boolean`,
  `fsmContext?: ...` on DpqlEditor
- (After SMART_EDITOR_LSP_FEATURES item 1)
  `enableSignatureHelp?: boolean`

**Missing behaviours:**
- LSP-driven syntax highlighting (semantic tokens) — referenced in
  the features list but no API documentation. Add an "LSP methods
  supported" subsection
- Diagnostics surface (inline wavy underlines + ReqoreMessage panel)
- Markdown documentation on completion rows (hover-tooltip)
- Chip click → Replace mode flow
- Loading overlay states (connecting, parsing, fetching)

**Wrong:**
- `triggerCharacters` is described as "Characters that open the
  completion dropdown" with no mention of language defaults or that
  the generic SmartEditor's default (`{., :, space}`) differs from
  both DPQL (`@$.:`) and Qonsole (`/-.:=` + space)

**Decision.** A focused README update that documents every prop
landed since `0.9.0`, adds an "LSP methods supported" section, and
corrects the misleading trigger-characters description.

**Surface area:** `README.md` only.

**Complexity:** small (writing time).

---

### 4. `dpql/setFsmContext` + `dpql/setAlertPayloadContext` props

**Background.** The server supports two additional context-binding
methods we don't expose:

- **`dpql/setAlertPayloadContext`** — binds the document's field set
  to the canonical alert-payload schema (severity, alert_type,
  alert_code, alert_class, interface_type, interface_name,
  alert_object, …). Required for the Alert Rule / Silence editor to
  produce correct completions and diagnostics on `@payload.field`
  references.
- **`dpql/setFsmContext`** — binds an FSM context (by inline
  definition, draft id, or published fsm id) so `$data:` /
  `$fsminput:` template namespaces resolve against the FSM's state
  graph. Required for FSM-state-aware completions when DpqlEditor is
  used inside an FSM state editor.

**Source confirmation.** `qorus-ide/.tasks/ALERT_RULES_AND_SILENCES.md`
explicitly calls out the alert-rule editor's `match` field as
"DPQL completions — genuinely new". This task is the gating piece
of Reqraft work.

**Decision.** Two new props on `DpqlEditor`:

```ts
interface IDpqlEditorProps {
  // ...
  /**
   * When true, bind the document's field set to the canonical
   * alert-payload schema instead of (or in addition to) the
   * `provider`/`recordType` context. Required for the Alert Rule
   * / Silence editor. Sends `metadata.dpql_context: "alert-payload"`
   * on `didOpen` so the binding lands at open-time without an
   * extra roundtrip. When toggled off later, falls back to the
   * `provider` / `recordType` context via `dpql/setContext`.
   */
  alertPayloadContext?: boolean;

  /**
   * FSM context for state-aware template completions. Exactly one
   * of `fsm` / `draftId` / `fsmId` must be provided; pass
   * `undefined` (or no FSM source) to clear. Fires
   * `dpql/setFsmContext` whenever the object identity changes.
   */
  fsmContext?:
    | { fsm: Record<string, any>; currentState?: string }
    | { draftId: string; currentState?: string }
    | { fsmId: number; currentState?: string };
}
```

These compose with each other: a DPQL editor can have BOTH a
provider context AND an FSM context. Provider gives field
completions, FSM gives template completions. `alertPayloadContext`
REPLACES the provider context (server treats them as mutually
exclusive — one binding per URI).

`isContextReady` (from item 1) covers all three context types — we
flip it false until whichever binding the editor is configured for
resolves.

**Surface area:**
- `src/components/dpqlEditor/types.ts` — `IDpqlEditorProps` gains
  `alertPayloadContext`, `fsmContext` (discriminated union)
- `src/components/dpqlEditor/useDpqlSession.ts` — new effects firing
  `dpql/setAlertPayloadContext` / `dpql/setFsmContext`; update
  `isContextReady` logic
- `src/components/dpqlEditor/DpqlEditor.tsx` — pass through
- `src/components/dpqlEditor/DpqlEditor.stories.tsx` — mock handlers
  for both methods; new stories `WithAlertPayloadContext`,
  `WithFsmContext`
- `README.md` — document both props (done via item 3)

**Tests:** Storybook play tests:
- `WithAlertPayloadContext` — asserts `didOpen` metadata includes
  `dpql_context: "alert-payload"` and a `dpql/setAlertPayloadContext`
  call happens
- `WithFsmContext` — asserts `dpql/setFsmContext` fires with the
  configured `fsmId` and `currentState`; asserts that switching
  `fsmId` re-fires
- Both should assert `isContextReady` gates correctly

**Complexity:** medium (multiple new effects, type discriminated
union, two new stories with mock handlers).

---

## Sequencing

Land in this order so each builds on the previous:

1. Item 1 (`isContextReady`) — establishes the readiness gate that
   item 4 reuses
2. Item 2 (debounced loader) — independent; can be parallel with 1
3. Item 4 (FSM + alert-payload props) — depends on item 1
4. Item 3 (README) — last, so it documents everything that just
   landed

## Surface area summary

| File | Items |
|---|---|
| `src/components/smartEditor/useLspSession.ts` | 1 |
| `src/components/smartEditor/SmartEditor.tsx` | 1 |
| `src/components/smartEditor/useLspAutocomplete.ts` | 1, 2 |
| `src/components/dpqlEditor/useDpqlSession.ts` | 1, 4 |
| `src/components/dpqlEditor/types.ts` | 4 |
| `src/components/dpqlEditor/DpqlEditor.tsx` | 4 |
| `src/components/dpqlEditor/DpqlEditor.stories.tsx` | 4 |
| `__tests__/smartEditor/loaderDebounce.test.ts` | 2 (new) |
| `__tests__/dpqlEditor/contextReady.test.ts` | 1 (new) |
| `README.md` | 3 |
| `QONSOLE_LSP_REFERENCE.md` | (covered by QONSOLE_ASSIST_FEATURES) |

## Tasks

### 1. `isContextReady`

- [ ] `useLspSession` — add `isContextReady: boolean` to result,
      default `true`
- [ ] `useDpqlSession` — track and expose. `false` initially, flips
      `true` after first context-binding resolves (or immediately if
      no context is configured)
- [ ] `SmartEditor` — combine `isReady && isContextReady` for the
      LSP-driven hooks
- [ ] Loading-overlay copy switches to "Loading schema…" when
      `isReady && !isContextReady`
- [ ] Storybook story with delayed-context mock; play test confirms
      no dropdown opens during the delay
- [ ] Unit-test the context-ready combinator

### 2. Loader debouncing

- [ ] `LOADER_DELAY_MS = 250` constant
- [ ] `performCompletionRequest` schedules `setIsFetching(true)` via
      `setTimeout`; clears in `finally`
- [ ] `close()` clears the pending timer
- [ ] Unit test the four timing cases (fast / slow / cancelled / on
      error)

### 4. FSM + Alert-payload props (land before 3, depend on 1)

- [ ] `IDpqlEditorProps` extended with `alertPayloadContext`,
      `fsmContext` (discriminated union)
- [ ] `useDpqlSession` — new effect for alert-payload: when
      `alertPayloadContext === true`, include
      `dpql_context: 'alert-payload'` in `initialMetadata` (no
      separate call needed); when it flips false later, fire
      `dpql/setContext` with the provider context to restore
- [ ] `useDpqlSession` — new effect for FSM context: fire
      `dpql/setFsmContext` whenever the `fsmContext` object identity
      changes (including identity-changed-to-undefined → clear)
- [ ] `isContextReady` flips false on context-config change, true
      when the resolution resolves
- [ ] Type-level enforcement: `fsmContext` is a discriminated union
      so consumers can't provide multiple sources
- [ ] Storybook mocks for both server methods
- [ ] Stories `WithAlertPayloadContext` and `WithFsmContext`
- [ ] Play tests verify the right requests fire

### 3. README update (land last)

- [ ] Update DpqlEditor props table: add `useServerParse`,
      `alertPayloadContext`, `fsmContext`
- [ ] Update SmartEditor props table: add `loadingIndicator`,
      `enableHover`, `isLoading`, `enableSignatureHelp` (if
      SMART_EDITOR_LSP_FEATURES landed)
- [ ] New section "LSP methods supported" — what's wired, with a
      one-line "why not X" pointer to each deferred method per
      `SMART_EDITOR_LSP_FEATURES.md`
- [ ] Fix the `triggerCharacters` description: clarify it's a
      per-wrapper concern with sensible language-specific defaults;
      show DPQL and Qonsole defaults
- [ ] Mention behaviours: semantic-token highlighting, diagnostics,
      hover, markdown docs, Replace-mode chip click, loading states
- [ ] Code example for `alertPayloadContext` use in an Alert Rule
      context

### Checks (final)

- [ ] Typecheck, lint, jest, storybook play tests all pass
- [ ] **STOP — user verifies in browser** before commit (per the
      design doc's workflow rule)

## Out of scope

- Hover-popover replacement of the native `title=` browser tooltip
  on inline diagnostic underlines (separate visual-polish concern)
- Editor body's own scroll behaviour when content exceeds height
  (Reqore-side)
- Schema reload triggers when provider changes — already handled by
  the existing `useDpqlSession` effect; no work
- Server-side bug: when no `provider` is set AND no
  `alertPayloadContext`, completions are effectively dead — this is
  expected per the server contract; the editor displays no
  completions and that's correct
