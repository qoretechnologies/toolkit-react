# SmartEditor / DpqlEditor / QonsoleSmartInput — UX polish

Active task list for the UX work specified in
[`design/SMART_EDITOR_UX.md`](../design/SMART_EDITOR_UX.md). Mirror
of the qorus-ide `.tasks/*.md` convention: one task file per body of
work, check off items as they land.

**Workflow rule:** code changes land as **uncommitted** changes for
user verification first. No commits until the user has confirmed the
change behaves correctly in their own browser.

## Status

- **Phase 0 — design** done (locked 2026-05-25)
- **Phase 1** done — typing-trigger fix + Replace-mode chip click
- **Phase 2** ready to start (visual polish)

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

## Phase 2 — Dropdown visual polish

Reference: design doc §2. Surface area:
`useLspAutocomplete.ts` (positioning), `SmartEditor.tsx` (JSX).
~120 lines. Depends on Open Question A.

### 2a. Caret positioning

- [ ] Move popover positioning math from "relative to editor container"
      to "relative to caret DOM rect"
- [ ] Use `ReactEditor.toDOMRange(editor, editor.selection)` for accurate position
- [ ] Test by typing at different positions — popover follows the caret

### 2b. Markdown rendering of documentation

- [ ] Add `react-markdown` import to SmartEditor (already a Reqraft dep
      via Reqore — verify before adding to direct deps)
- [ ] Render `item.documentation.value` as markdown when
      `documentation.kind === 'markdown'`
- [ ] Plaintext fallback for `kind: 'plaintext'` or string-typed
      `documentation`
- [ ] New story: `WithMarkdownDocs` for SmartEditor — mock with rich
      markdown descriptions, visual check that they render

### 2c. Visual treatment (depends on Question A)

- [ ] Apply chosen style (Reqore-native or code-editor)
- [ ] Tighten row heights to match the chosen vocabulary
- [ ] Add kind chips on the right (Field / Method / Keyword / etc.)
- [ ] Focused row highlight respects theme
- [ ] Verify against light + dark theme

### 2d. Grouping + filtering

- [ ] Honor `item.filterText` for filter matching (currently ignored)
- [ ] When `groupMap.size > 1`, render with `ReqoreMenuDivider`s
      (already partially done — verify it works with rich items)
- [ ] Test with multi-kind mock data

- [ ] Run all checks
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit

## Phase 3 — Diagnostics surface

Reference: design doc §3. Surface area: new
`useLspDiagnosticDecorations.ts`, edits to `SmartEditor.tsx`,
`DpqlEditor.tsx`. ~150 lines + 1 test file.

### 3a. Decorate-function hook

- [ ] Create `src/components/smartEditor/useLspDiagnosticDecorations.ts`
- [ ] Function: `(diagnostics, converter, nodes) => Range[]`
- [ ] For each diagnostic, convert LSP range start/end to Slate points
      using the converter (need to add `pointToOffset` inverse helper
      or use existing `lspPositionToOffset` + walk-to-Slate-point)
- [ ] Emit `{ anchor, focus, error: true, errorMessage }` ranges
- [ ] Unit tests for position mapping

### 3b. Inline render

- [ ] In `customRenderLeaf` for both DpqlEditor and QonsoleSmartInput
      (if it has one) — when `leaf.error`, apply `text-decoration:
      underline wavy red` style
- [ ] Verify under both Reqore themes

### 3c. Error message panel

- [ ] Add a `<ReqoreControlGroup vertical>` of `<ReqoreMessage>`
      components below the editor in SmartEditor.tsx
- [ ] Renders only when `session.diagnostics.length > 0`
- [ ] Each diagnostic: `intent='danger'` for severity 1, `'warning'`
      for 2, `'info'` for 3-4
- [ ] Icon: `'ErrorWarningLine'` for danger, `'AlertLine'` for warning
- [ ] Verify with mock invalid input

### 3d. DpqlEditor composes both decorators

- [ ] In DpqlEditor.tsx — call `useDpqlSyntaxHighlighting()` AND
      `useLspDiagnosticDecorations(diagnostics, dpqlSlateConverter, ...)`
- [ ] Compose into a single `decorate` fn that returns the union of
      ranges from both
- [ ] Test that syntax highlight + error underline can coexist on the
      same token (e.g. an unknown keyword)

### 3e. Story

- [ ] New `WithDiagnostics` story for QonsoleSmartInput
- [ ] Mock server returns `publishDiagnostics` after didOpen
- [ ] Assert red underline + error message panel both render

- [ ] Run all checks
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit

## Phase 4 — Loading state

Reference: design doc §4. Surface area: `SmartEditor.tsx`. ~20 lines.

- [ ] Render a `ReqoreSpinner` with "Connecting to language server…"
      overlay when `!session.isReady`
- [ ] Position: absolutely positioned over the editor body, doesn't
      replace the input itself (so the initial value stays visible)
- [ ] Add `loadingIndicator?: React.ReactNode` prop for wrapper overrides
- [ ] Update existing play tests to wait for `isReady` (poll for the
      spinner to disappear) before typing
- [ ] Run all checks
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit

## Phase 5 — Hover info

Reference: design doc §5. Surface area:
`src/components/smartEditor/useLspHover.ts` (new). ~80 lines + small
wire-in.

- [ ] Create `useLspHover(session, editorRef, converter, options)` hook
- [ ] mousemove listener on the editor's contenteditable
- [ ] Debounce 300ms
- [ ] On idle: compute Slate point under mouse, convert to LSP position,
      call `session.client.getHover(line, character)`
- [ ] State: `{ hoverContent: ILspMarkupContent | null, hoverPosition }`
- [ ] Render: `<ReqorePopover>` with markdown content at the mouse
      position when `hoverContent` non-null
- [ ] Opt-in `enableHover?: boolean` prop, default `true`
- [ ] Unit test for position mapping
- [ ] Run all checks
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit

## Phase 6 — `dpql/toRichtext` opt-in

Reference: design doc §6. Surface area: `DpqlEditor.tsx`,
`useDpqlSession.ts`. ~40 lines.

- [ ] Add `useServerParse?: boolean` prop to `DpqlEditor`
- [ ] When `true`: on mount + external `value` changes, call
      `client.customRequest('dpql/toRichtext', { text: value })`
- [ ] Convert server's richtext output to Slate `ISlateElement[]`
- [ ] Show loading state (Phase 4) while parsing
- [ ] On timeout or error: fall back to client-side
      `plainTextToSlate`
- [ ] New story `WithServerParse` exercising this against live LSP
- [ ] Run all checks
- [ ] **STOP — user verifies in browser before commit**
- [ ] Commit

## Phase 7 — User's additional DpqlEditor concerns

To be filled once user provides the list. Tracker:

- [ ] (TBD — placeholder for user's items)
- [ ] (TBD)
- [ ] (TBD)

## Phase 8 — Release prep

- [ ] Bump Reqraft `package.json` version (decide 0.9.x patch or 0.10.0)
- [ ] Update Reqraft `README.md` Components section to mention
      diagnostics, hover, loading state, server-parse
- [ ] Carry the user's list into the README too
- [ ] Update `qorus-frontend/DPQL_EXTRACTION_PROGRESS.md` execution log
- [ ] Final test pass: jest + storybook + manual smoke
- [ ] **STOP — user does final review before push**

## Notes

- Workflow change effective from this batch: code changes are left
  uncommitted for user verification. The agent does not commit until
  the user has confirmed the change in their own browser.
- Each phase produces one commit. The order is the order of impact
  (items 1, 2, 3 first — the visible-quality wins).
- If any phase reveals a Reqore-side issue (e.g. the existing
  `ReqoreTooltipComponent` ref warning), don't fix in Reqraft —
  flag as a Reqore follow-up.
