# SmartEditor + DpqlEditor + QonsoleSmartInput — UX polish

Locked design for the user-facing polish work on top of the `0.9.0`
foundation. Mirrors the Phase 5 / Phase 6 sections of the original
`qorus-ide/.design/DPQL_RICHTEXT.md` (carried forward here as the
component now lives in Reqraft) and absorbs the issues found while
testing against the live `wss://hq.qoretechnologies.com:8092/lsp`
endpoint.

The execution checklist lives at
[`.tasks/SMART_EDITOR_UX_POLISH.md`](../.tasks/SMART_EDITOR_UX_POLISH.md).

## Goal

Turn the working-but-rough editor from `0.9.0` into a component that
**feels finished** when dropped into a real form: predictable
completion triggering, polished dropdown, visible error feedback, and
graceful loading state. Same scope as the original design, just
deferred until after the extraction was proven.

## Out of scope (separately tracked)

- ExpressionBuilder rewiring (qorus-ide side, separate consumer task)
- Alert Rule editor integration (`dpql-expression` field type — needs a
  Qorus server change; tracked in `qorus-ide/.tasks/ALERT_RULES_AND_SILENCES.md`)
- The Reqore-side `Function components cannot be given refs` warning
  in `ReqoreTooltipComponent` (pre-existing, file as a Reqore follow-up)
- `QonsoleSmartInput` integration into qorus-ide's `QonsoleInput.tsx`
  (separate qorus-ide branch — issue [toolkit-react#61](https://github.com/qoretechnologies/toolkit-react/issues/61))

## Items locked in this batch

### 1. Dropdown opens only on user-initiated typing

**Problem.** Currently the autocomplete trigger fires on every Slate
`onChange`, including selection-only changes. Clicking into
`/list services ` lands the cursor after a space (a trigger
character) and immediately opens the dropdown with no user action.

**Fix.** Track the previous plain-text in `useLspAutocomplete`. In
`onSlateChange`, bail early when the text didn't change vs the
previous tick (selection-only change). Trigger detection only runs on
actual content mutations.

**Surface area.** `src/components/smartEditor/useLspAutocomplete.ts`
only. No prop changes. ~10 lines.

**Tests.** Extend the `BasicMock` play test for QonsoleSmartInput:
load with `/list services ` initial value, click into the editor,
sleep 500ms, assert the dropdown is **not** present. Then type `-`,
assert the dropdown **is** present.

### 2. Dropdown visual polish

**Problem.** Current dropdown is bare `ReqoreMenu` rendered in a
`ReqorePopover` positioned relative to the editor container. Looks
sparse, ignores LSP metadata (markdown documentation, sortText,
filterText, kind grouping), and floats far from the caret.

**Fix.**
- **Position under the caret.** Use the Slate selection's DOM rect
  (`ReactEditor.toDOMRange(editor, selection).getBoundingClientRect()`)
  to position the popover with pixel-accurate `top`/`left`. The trigger
  span pattern from the original `.design/DPQL_RICHTEXT.md` §4 is the
  reference.
- **Render `documentation` as markdown.** LSP returns
  `{kind: 'markdown', value: '...'}`. Use `react-markdown` (already a
  Reqraft transitive dep) for the description column. Plaintext
  fallback when `kind: 'plaintext'`.
- **Visual treatment.** Tighten row heights, monospace label,
  right-aligned kind chip (Field / Method / Keyword / Snippet), focused
  row highlight that respects the Reqore theme. Decision pending — see
  Open question A.
- **Group by kind when there are multiple.** Use LSP CompletionItemKind
  groups (we have the map already at `useLspAutocomplete:14`). Skip
  grouping when only one kind is present (current behavior).
- **Respect server sort/filter.** Sort items by `sortText` (already
  done), filter against `filterText` when present (NEW — currently
  unused).

**Surface area.** `src/components/smartEditor/useLspAutocomplete.ts`
(positioning + filter/sort), `src/components/smartEditor/SmartEditor.tsx`
(dropdown JSX). No prop changes. Medium — ~120 lines added.

**Tests.** Visual stories only (a new "WithMarkdownDocs" story for
SmartEditor; existing play tests still pass with the canned mock items).

### 3. Diagnostics surface

**Problem.** Invalid syntax produces no visible feedback. The LSP
already pushes `publishDiagnostics` (we capture in
`session.diagnostics`) and we silently store but never render them.

**Fix.** Two surfaces, both driven by `session.diagnostics`:

- **Inline wavy red underline** on offending tokens. New hook
  `useLspDiagnosticDecorations(diagnostics, converter)` returns a
  Slate `decorate` function that emits `{ error: true, errorMessage }`
  ranges over diagnostic spans. Compose with the language-specific
  `decorate` in the same component (e.g. DpqlEditor combines syntax +
  diagnostic decorations).
- **Error panel below the editor** — `ReqoreMessage` stack with
  `intent='danger'` / `'warning'` per diagnostic, ordered by position.
  Renders as a sibling to the editor's `ReqoreControlGroup`. Hidden
  when `diagnostics.length === 0`.

**Surface area.** New `src/components/smartEditor/useLspDiagnosticDecorations.ts`,
edits to `src/components/smartEditor/SmartEditor.tsx` (panel render),
edits to `src/components/dpqlEditor/DpqlEditor.tsx` (compose decorate
fns). Both DPQL and Qonsole get diagnostics. Medium — ~150 lines + 1
test file.

**Tests.** Unit test for the decorate hook (LSP positions → Slate
ranges). Storybook story `WithDiagnostics` for QonsoleSmartInput
that mocks an invalid syntax response.

### 4. Connection / loading state

**Problem.** Editor mounts and accepts typing before `session.isReady`
is true. The autocomplete logic short-circuits on `!isReady` so
completions silently fail until the LSP handshake completes (~300ms in
practice).

**Fix.** While `!session.isReady`, render a small overlay or
disable-and-spinner state. Two reasonable presentations:
- (a) `ReqoreSpinner` overlay inside the editor body with text
  "Connecting to language server…"
- (b) Greyed-out + disabled editor until ready (`readOnly` flicker)

(a) is friendlier — the user sees it's loading but doesn't think it's
broken. Default to (a). The editor body still shows the initial value.

**Surface area.** `src/components/smartEditor/SmartEditor.tsx` only.
~20 lines + a new prop `loadingIndicator?: React.ReactNode` so
wrappers can override the default.

**Tests.** Visual stories. Existing play tests need a wait-for-ready
assertion before typing — currently they sleep blindly and hope the
session is ready.

### 5. Hover info via `textDocument/hover`

**Problem.** Hovering a token in `/list services ` should show the
markdown hover content the server already supplies (the live spike
captured `**/list**\n\nList resources`). Currently nothing happens on
hover.

**Fix.** New helper `useLspHover(session, converter, editorRef)` that:
- Listens for `mousemove` on the editor's contenteditable element
- Debounces to 300ms idle
- Converts mouse position → Slate point → LSP position
- Calls `session.client.getHover(line, character)`
- Renders a small `ReqorePopover` with the markdown content next to
  the cursor

**Surface area.** New `src/components/smartEditor/useLspHover.ts`
(~80 lines), small wire-in inside `SmartEditor.tsx`. Opt-in via
`enableHover?: boolean` prop (default `true`).

**Tests.** Unit test of the position-mapping math. No play test —
hover behaviour is hard to drive in jsdom and Playwright reliably.

### 6. `dpql/toRichtext` opt-in for accurate plain-text → Slate parsing

**Problem.** Our `plainTextToSlate` in `dpqlEditor/dpqlHelpers.ts` is a
client-side regex. It handles `$prefix:value` and `@field` but misses
nested expressions, function calls with templates inside, and quoted
edge cases. The server's `dpql/toRichtext` does this correctly.

**Fix.** Add an opt-in `useServerParse?: boolean` prop on
`DpqlEditor`. When true:
- On mount and on every external `value` change, call
  `client.customRequest('dpql/toRichtext', { text: value })` asynchronously
- Show the loading state (item 4) while parsing
- Use the server's richtext output for Slate's initial value
- Falls back to client regex if the server call fails or times out

Default `false` for backward compatibility — current consumers keep the
synchronous-render behaviour.

**Surface area.** `src/components/dpqlEditor/DpqlEditor.tsx` and
`useDpqlSession.ts`. Small wrapper around an existing custom method.
~40 lines.

**Tests.** Storybook story `WithServerParse` against the live LSP.
Add mock for `dpql/toRichtext` in DpqlEditor's BasicMock if needed.

## Locked decisions

### Theme — Reqore-native, borrowing from qorus-ide

Match the visual vocabulary of the rest of the IDE. Concretely:
- Use `ReqoreMenu` chrome (already in place) — rounded, theme-tinted.
- Lift styling cues from qorus-ide's existing conventions documented in
  `qorus-frontend/qorus-ide/design/SHARED_COMPONENTS.md` and
  `design/REQORE_REQRAFT.md` (drawer/menu opacity, `INTERFACE_TABLE_TAG_EFFECT`
  for chips, the `DRAWER_STYLE` opacity vocabulary where applicable).
- Concrete improvements still scoped per item 2 (tighter rows, kind chips
  on the right, focused-row highlight, markdown documentation).

### Decorate composition — merge in the wrapper

When DpqlEditor combines syntax highlighting + diagnostic underlines,
the wrapper exposes a single combined `decorate` function to
`SmartEditor`. SmartEditor stays unchanged. Implementation:

```typescript
// In DpqlEditor.tsx
const syntaxDecorate = useDpqlSyntaxHighlighting();
const diagnosticDecorate = useLspDiagnosticDecorations(dpql.diagnostics, dpqlSlateConverter);
const decorate = useCallback((entry) => [...syntaxDecorate(entry), ...diagnosticDecorate(entry)], [syntaxDecorate, diagnosticDecorate]);
```

### Hover popover position — token center

When the user hovers a token, the popover anchors to the geometric
center of the token's DOM rect. Matches VS Code.

### Loading state — overlay spinner

While `!session.isReady`, render a `ReqoreSpinner` with copy
"Connecting to language server…" as an absolutely-positioned overlay
on top of the editor body. The editor itself stays mounted (initial
value visible) so the user sees what's loading. Editor is not
explicitly disabled — typing into it is a no-op until the session is
ready (existing autocomplete short-circuit handles this).

### Version bump — single `0.10.0` after all items land

Per user preference: no incremental versions per phase. All of items
1–6 ship together as `0.10.0-beta`. Reqraft `package.json` bumps
once, at the end of the batch (Phase 8 release prep).

## Test plan

| Phase | Coverage |
|---|---|
| Item 1 | Extended BasicMock play test asserts no-dropdown-on-mount, dropdown-after-typing |
| Item 2 | New stories: WithMarkdownDocs, WithGroupedKinds. Visual only. |
| Item 3 | Unit test for `useLspDiagnosticDecorations`. New story WithDiagnostics with mock invalid input. |
| Item 4 | Adjust existing play tests to wait for ready signal before typing |
| Item 5 | Unit test of position-mapping math. No play test (jsdom limitation) |
| Item 6 | Story WithServerParse against live LSP |

All items together: TS clean, lint clean, all jest tests pass, all
storybook play tests pass (147 currently in our scope, expected +5).

## Migration impact

`0.9.0` consumers (DpqlEditor, QonsoleSmartInput) get all items 1–5
automatically — no prop changes. Item 6 is opt-in. No breaking
changes; this can ship as `0.9.0` (still pre-release) or `0.10.0` if
we want a "feature-complete" version bump.

## Status

**Design locked 2026-05-25.** All open questions resolved (see "Locked
decisions" above). Ready for Phase 1 implementation per
[`.tasks/SMART_EDITOR_UX_POLISH.md`](../.tasks/SMART_EDITOR_UX_POLISH.md).

Any new issues discovered during implementation get added to the task
list as they surface — design doc updates only with explicit revision.
