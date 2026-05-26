# SmartEditor / DpqlEditor / QonsoleSmartInput — UX polish

Active task list for the UX work specified in
[`design/SMART_EDITOR_UX.md`](../design/SMART_EDITOR_UX.md). Mirror
of the qorus-ide `.tasks/*.md` convention: one task file per body of
work, check off items as they land.

**Workflow rule:** code changes land as **uncommitted** changes for
user verification first. No commits until the user has confirmed the
change behaves correctly in their own browser.

## Status

- **Phase 0 — design** done (locked 2026-05-25, revised 2026-05-26 for item 7)
- **Phase 1** done — typing-trigger fix + Replace-mode chip click (committed)
- **Phase 2** done pending user-verify — visual polish
- **Phase 3** done pending user-verify — diagnostics surface
- **Phase 4** done pending user-verify — loading state
- **Phase 5** done pending user-verify — hover info
- **Phase 7** done pending user-verify — LSP semantic tokens (replaces broken regex)
- **Phase 6** done pending user-verify — server parse opt-in
- **Phase 8** ready to start (release prep)

## Phase 0 — design acceptance (DONE)

- [x] User read `design/SMART_EDITOR_UX.md` end-to-end
- [x] User confirmed no additional DpqlEditor concerns at this point — anything found during execution lands as new task items
- [x] Theme direction — Reqore-native, borrow from qorus-ide conventions
- [x] Decorate composition — merge in the wrapper (DpqlEditor combines)
- [x] Hover positioning — token center
- [x] Loading state — overlay spinner
- [x] Version — single `0.10.0-beta` at end of batch
- [x] Design doc locked — no further changes without explicit revision

## Phase 1 — Trigger-on-typing-only fix (DONE)

Reference: design doc §1. Surface area:
`src/components/smartEditor/useLspAutocomplete.ts`,
`src/components/smartEditor/SmartEditor.tsx`,
`src/components/dpqlEditor/dpqlInserter.ts`,
`src/components/dpqlEditor/DpqlEditor.tsx`.

Ended up substantially larger than the original ~10-line estimate
because the user reported chip-click bugs that required Replace mode,
plus a stale-closure bug in Reqore's `renderElement`.

- [x] Trigger-on-content-change (not selection-only) via
      `editor.operations.some(op !== 'set_selection')`
- [x] `slateValueRef` cache in SmartEditor — avoid round-trip
      re-tokenisation while user types `@s`
- [x] Replace mode for chip clicks — chip stays visible, popover
      anchors at chip rect, atomic node swap on accept
- [x] `openAtChip` + `pendingChipRequestRef` + deferred-request effect
- [x] `popoverKey` bump per `openAtChip` to force `ReqorePopover`
      remount (sync with internal open state)
- [x] `handleExternalClose` filter — suppress popover-close events
      within 300ms of `openAtChip` (mousedown-vs-click race)
- [x] Same-chip click toggles closed
- [x] "Connecting…" / "No alternatives available" stub in Replace mode
- [x] Stable `onTagClick` via ref (Reqore `renderElement` memoizes over
      deps that omit `onTagClick`)
- [x] Removed space from `DPQL_TRIGGERS` (no more dropdown after `@chip<space>`)
- [x] Reqore node_modules patch — `Textarea.handleBlur` null-check on
      `relatedTarget.closest` (also filed as Reqore PR follow-up)
- [x] Reqore PR follow-up filed — `renderElement` deps fix
- [x] Run `yarn build:test:prod && yarn lint && yarn test` (252 pass)
- [x] Run `yarn test-storybook --url http://localhost:6008` (148 pass)
- [x] **User verified in browser**
- [ ] Commit

## Phase 2 — Dropdown visual polish (DONE pending user verify)

Reference: design doc §2. Surface area:
`useLspAutocomplete.ts` (kindLabel + documentation mapping),
`SmartEditor.tsx` (badge + tooltip render + monospace),
`SmartEditor.stories.tsx` (new stories),
`DpqlEditor.stories.tsx` (enriched mock).

### 2a. Caret positioning

- [x] Popover anchored at caret via `ReactEditor.toDOMRange` + viewport
      `position: fixed` (landed in Phase 1)
- [x] Verified across single-line, multi-line, and chip-relative anchoring

### 2b. Markdown rendering of documentation

- [x] `react-markdown` imported (already a Reqraft direct dep — confirmed
      in package.json: `^9.0.1`)
- [x] `documentation` surfaced on `ICompletionDropdownItem`; `SmartEditor`
      renders it via `buildDocTooltip`, branching on `kind: 'markdown'` vs
      `kind: 'plaintext'` vs string
- [x] Tooltip max-width 360px, max-height 240px, scrollable
- [x] Tooltip placed right of the row (so it doesn't obscure the list)
- [x] New story: `WithMarkdownDocs` on SmartEditor

### 2c. Visual treatment (Reqore-native, per locked decision)

- [x] Monospace label per row (matches editor body, makes `@field` /
      `--flag` token shapes line up)
- [x] Right-aligned kind chip via Reqore's `badge` (small + minimal)
- [x] Tightened row heights via `compact`
- [x] Focused row highlight via `ReqoreMenuItem.selected` (theme-aware)
- [ ] Light + dark theme verification (deferred to in-browser visual
      verification — no automated test)

### 2d. Grouping + filtering

- [x] `item.filterText` honored — `filteredItems` matches against
      `item.raw.filterText ?? item.label` (already in Phase 1)
- [x] `ReqoreMenuDivider` between groups when `groupMap.size > 1`
- [x] New story: `WithGroupedKinds` (3 kinds → 3 sections with dividers)

- [x] Run typecheck, lint, jest (252 pass)
- [x] Run storybook play tests (149 pass — 2 added)
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit (per user preference — may accumulate into a single
      end-of-batch commit instead)

## Phase 3 — Diagnostics surface (DONE pending user verify)

Surface area landed: new `useLspDiagnosticDecorations.ts`,
`SmartEditor.tsx` (compose decorate + renderLeaf wrap + panel),
new `__tests__/smartEditor/diagnosticDecorations.test.ts`,
new `WithDiagnostics` story on QonsoleSmartInput.

### 3a. Decorate-function hook

- [x] `src/components/smartEditor/useLspDiagnosticDecorations.ts`
- [x] Returns `(entry: NodeEntry) => Range[]`, intersects each
      diagnostic with the leaf's plain-text span via the converter
- [x] Emits `{ error, errorMessage, severity }` marks on the range
- [x] 11 unit tests covering empty diags, non-text nodes, single span,
      clamping, multiple overlapping, cross-line skip, severity default

### 3b. Inline render

- [x] `SmartEditor.tsx` exposes `renderLeafWithDiagnostics` that wraps
      the caller's `customRenderLeaf` and draws a wavy underline +
      `title` tooltip when `leaf.error`
- [x] Severity drives colour: 1 red, 2 amber, 3+ blue

### 3c. Error message panel

- [x] Below the editor: `ReqoreControlGroup vertical` of
      `ReqoreMessage`s, one per diagnostic
- [x] Intent from `severityToIntent` (1 danger, 2 warning, 3+ info)
- [x] Icon: ErrorWarningLine / AlertLine / InformationLine

### 3d. DpqlEditor composes both decorators

- [x] SmartEditor's `composedDecorate` combines the caller's `decorate`
      (e.g. DPQL syntax-highlighting) with the diagnostic decorate from
      `useLspDiagnosticDecorations` — no DpqlEditor changes needed; the
      composition lives in SmartEditor.

### 3e. Story

- [x] `WithDiagnostics` on QonsoleSmartInput — mock pushes
      `textDocument/publishDiagnostics` after didOpen with one Error
      + one Warning span

- [x] Typecheck, lint, jest (267), storybook play (151) all pass
- [ ] **STOP — user verifies in browser before commit**

## Phase 4 — Loading state (DONE pending user verify)

- [x] `ReqoreSpinner` overlay with "Connecting to language server…"
      while `!session.isReady` — absolutely positioned over the
      editor body, semi-transparent backdrop, pointer-events: none
- [x] `loadingIndicator?: React.ReactNode` prop — pass `null` to
      suppress, pass any node to override
- [x] Editor stays mounted underneath so the initial value is visible

(Existing play tests pre-date this overlay and still pass — they
sleep ≥200ms before typing which is enough for the mock LSP's
`initialize` to complete and `isReady` to flip true. If we add play
tests later that need the spinner to be gone, a `waitForElementToBeRemoved`
pattern would work.)

## Phase 5 — Hover info (DONE pending user verify)

- [x] `src/components/smartEditor/useLspHover.ts` — new hook
- [x] mousemove listener attached via `ReactEditor.toDOMNode(editor, editor)`
- [x] Debounce 300ms (configurable via `debounceMs` option)
- [x] On idle: `caretRangeFromPoint` → Slate `Point` → plain-text
      offset (`selectionToOffset`) → LSP position
      (`offsetToLspPosition`) → `client.getHover(line, character)`
- [x] State: `{ hoverContent, hoverPosition, clearHover }`
- [x] Stale-response guard via `requestIdRef` — a slow in-flight
      request can't overwrite a newer one
- [x] Pure-math `slatePointToLspPosition` extracted + unit tested
      (4 tests covering offset 0, mid-line, multi-paragraph, end-of-leaf)
- [x] Rendered as a `ReqorePopover` (placement `top`, markdown via
      `react-markdown`, plaintext fallback)
- [x] `enableHover?: boolean` prop on SmartEditor, default `true`
- [x] Typecheck, lint, jest (267), storybook play (151) all pass
- [ ] **STOP — user verifies in browser before commit**

(Token-center positioning per design doc §5 deferred — currently
anchors at the mouse cursor coordinates. Iterate if user wants the
exact VS-Code-style center-of-token anchoring.)

## Phase 6 — `dpql/toRichtext` opt-in (DONE pending user verify)

Reference: design doc §6. Surface area: `DpqlEditor.tsx` (state +
effect + custom converter), `dpqlHelpers.ts` (response decoder),
`types.ts` (new prop), `SmartEditor.tsx` (new `isLoading` prop +
overlay condition), `DpqlEditor.stories.tsx` (mock + new story).

- [x] `useServerParse?: boolean` prop on `DpqlEditor` (default `false`)
- [x] Effect: on mount + external `value` changes + session-ready,
      call `client.customRequest('dpql/toRichtext', { text: value })`
- [x] `richtextResponseToSlate()` helper in `dpqlHelpers.ts` decodes
      the server's `{type: "richtext", value: [...]}` response into
      `ISlateElement[]`; returns `null` for unknown shapes (caller
      falls back)
- [x] Custom converter in `DpqlEditor.tsx` overrides `toSlateNodes`
      to return cached server-parsed nodes when text matches; falls
      through to client `plainTextToSlate` otherwise
- [x] `SmartEditor.isLoading` prop — overlay shows while either
      `!session.isReady` OR `isLoading` is true; wrapper passes
      `isLoading={isParsing}`
- [x] Stale-response guard via `parseRequestIdRef` — slow responses
      can't overwrite newer state
- [x] On error / unrecognised shape → silently falls back to
      client-side regex parser
- [x] Mock `dpql/toRichtext` handler in DpqlEditor stories
      (matches `$prefix:value` templates as tags, mirrors the real
      server's regex)
- [x] New story `WithServerParse` (`$static:input == "Alice" && $config:min_age > 18`)
- [x] Typecheck (clean), lint (clean), jest (263 pass), storybook
      play tests (152 of 153 pass; remaining failure is the
      pre-existing FormEngine flake)
- [ ] **STOP — user verifies in browser before commit**

## Phase 7 — LSP semantic tokens replace the broken regex highlighting (DONE pending user verify)

Reference: design doc §7 (revised 2026-05-26). Surface area: new
hook + decoder, edits to `LspClient`, `useLspSession`, `SmartEditor`,
removal of `useDpqlSyntaxHighlighting.ts`, fixed DPQL story values.

### 7a. Surface the semantic-tokens legend

- [x] `src/utils/lspClient.types.ts` — `ILspSemanticTokensLegend` +
      `ILspSemanticToken` types
- [x] `src/utils/lspClient.ts` — capture legend from initialize
      response, expose as `semanticTokensLegend` public field
- [x] `useLspSession.ts` — surface in result

### 7b. The LSP int-array decoder

- [x] `decodeSemanticTokens(data, legend) → ILspSemanticToken[]` —
      delta re-base, type-index lookup, modifier-bitmask unpack
- [x] 10 unit tests: null/empty, bad alignment, single token, live
      spike sample, line-jump re-base, modifier bitmask, invalid
      index skip, realistic DPQL expression

### 7c. `useLspSemanticTokens` hook

- [x] `src/components/smartEditor/useLspSemanticTokens.ts` — Slate
      decorate function backed by debounced LSP request
- [x] Watches document changes, 250ms debounce
- [x] Stale-response guard via `requestIdRef`
- [x] Keeps last-known tokens on error (no highlighting flash)
- [x] Returns empty decorate while `!isReady || !legend`

### 7d. Compose into SmartEditor

- [x] `composedDecorate` now merges caller + semantic + diagnostic
- [x] Renamed `renderLeafWithDiagnostics` → `renderLeafWithMarks`;
      handles `tokenType`-based colours + `tokenModifiers` (italic
      for `declaration`, dimmed for `deprecated`) + diagnostic
      wavy-underline
- [x] `SEMANTIC_TOKEN_COLORS` palette mapped to LSP-standard 16
      types (keyword purple, operator cyan, string green, number
      orange, variable/parameter/property red-pink, function/class
      yellow, regexp cyan, comment grey, namespace/decorator/modifier
      yellow/purple)

### 7e. Remove the broken DPQL regex highlighter

- [x] Deleted `src/components/dpqlEditor/useDpqlSyntaxHighlighting.ts`
- [x] Deleted `__tests__/dpqlEditor/syntaxHighlighting.test.ts`
- [x] `DpqlEditor.tsx` — dropped `useDpqlSyntaxHighlighting` import,
      `decorate` prop, `customRenderLeaf` (SmartEditor handles it)
- [x] `index.ts` — removed re-export

### 7f. Fix misleading DPQL story values

- [x] `WithPlainText` value `SELECT * FROM users WHERE name = "Alice"`
      → `1 == 1 && "hello" != "world"` (valid DPQL)
- [x] `WithMixedContent` `… AND …` → `… && …` (DPQL uses `&&`)

### 7g. Story + mock for semantic tokens

- [x] DpqlEditor mock: extended `initialize` response with
      `semanticTokensProvider.legend` (standard LSP 16/6)
- [x] DpqlEditor mock: handles `textDocument/semanticTokens/full`
      by tokenizing `lastDocumentText` (tracked from
      didOpen/didChange) with a minimal DPQL-correct regex
- [x] New story `WithSemanticTokens` rendering a representative
      DPQL expression touching every coloured token category
- [ ] Mirror to QonsoleSmartInput stories — deferred; works
      automatically against the live `/lsp` endpoint, so adding a
      mock-side story isn't blocking for `0.10.0`

### 7h. Documentation

- [x] Design doc revised (item 7 added, decorate-composition
      decision revised)
- [x] Task file Phase 7 fleshed out
- [ ] `README.md` — to be updated in Phase 8 (release prep)

### 7i. Checks

- [x] Typecheck (clean), lint (clean), jest (263 pass), storybook
      play tests (152 pass — +1 for `WithSemanticTokens`)
- [ ] **STOP — user verifies in browser before commit**

## Phase 8 — Release prep

- [ ] Bump Reqraft `package.json` version (decide 0.9.x patch or 0.10.0)
- [ ] Update Reqraft `README.md` Components section to mention
      diagnostics, hover, loading state, server-parse
- [ ] Carry the user's list into the README too
- [ ] Update `qorus-frontend/DPQL_EXTRACTION_PROGRESS.md` execution log
- [ ] Final test pass: jest + storybook + manual smoke
- [ ] **STOP — user does final review before push**

## Follow-up batches (post-`0.10.0`)

Four separate planning documents were drafted after the `0.10.0`
research pass. They are NOT part of `0.10.0` itself — they ship as
later patches.

- [`SMART_EDITOR_VISUAL_POLISH.md`](./SMART_EDITOR_VISUAL_POLISH.md) —
  Reqore styling-vocabulary alignment (effects, customTheme, frost
  on popovers, intent-coloured chips, native loading overlay)
- [`SMART_EDITOR_LSP_FEATURES.md`](./SMART_EDITOR_LSP_FEATURES.md) —
  unused LSP methods, primarily wiring `textDocument/signatureHelp`
  (the one high-value gap)
- [`QONSOLE_ASSIST_FEATURES.md`](./QONSOLE_ASSIST_FEATURES.md) —
  `commitCharacters`, `sortText`, `warning`, `data`, wizard launch
  via `command: qonsole.startWizard`, mode-type fix
- [`SMART_EDITOR_CONTEXT_AND_POLISH.md`](./SMART_EDITOR_CONTEXT_AND_POLISH.md)
  — `isContextReady` race fix, debounced loader, FSM /
  alert-payload context props (gating for qorus-ide alert-rule
  editor), README catch-up

Sequence them per user direction; some have natural ordering inside
themselves (see each file's "Sequencing" section where present).

## Notes

- Workflow change effective from this batch: code changes are left
  uncommitted for user verification. The agent does not commit until
  the user has confirmed the change in their own browser.
- Each phase produces one commit. The order is the order of impact
  (items 1, 2, 3 first — the visible-quality wins).
- If any phase reveals a Reqore-side issue (e.g. the existing
  `ReqoreTooltipComponent` ref warning), don't fix in Reqraft —
  flag as a Reqore follow-up.
