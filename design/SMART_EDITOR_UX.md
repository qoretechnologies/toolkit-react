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

### 7. Server-driven syntax highlighting via LSP semantic tokens

**Added 2026-05-26 — design doc revision.** Surfaced during Phase 5
verification. The original design omitted this item under the
assumption that the existing client-side regex highlighter was
adequate. Closer research showed it is fundamentally wrong.

**Problem.** Our `useDpqlSyntaxHighlighting.ts` was copy-pasted from
qorus-ide's `services/dpqlMonacoSetup.ts`, which itself was a
"placeholder until LSP semantic tokens are wired" that never got
replaced. The keyword list is **SQL**, not DPQL:

- DPQL has no `SELECT` / `FROM` / `WHERE` / `JOIN` / `GROUP BY` / etc.
- DPQL uses `&&` / `||` / `!`, **not** `AND` / `OR` / `NOT`.
- DPQL has no `--` or `/* */` comments — both currently coloured by
  our regex.
- The `COUNT` / `SUM` / `AVG` / `MIN` / `MAX` aggregates aren't DPQL
  built-ins.
- DPQL has unique constructs the regex doesn't even attempt to
  handle: `=~` / `!~` regex match, `..` range, `between … and …`,
  `in (…)` / `not in (…)`, `<deadbeef>` binary literals, ISO-8601
  date literals.

The authoritative grammar lives in
[`qore-2/design/dpql-syntax.md`](../../QoreTechnologies/qore-2/design/dpql-syntax.md)
and the tokenizer in
[`qore-2/qlib/DataProvider/DpqlTokenizer.qc`](../../QoreTechnologies/qore-2/qlib/DataProvider/DpqlTokenizer.qc).
Reproducing this in JS bug-for-bug compatible would be a non-trivial
maintenance burden.

**Fix.** Drive syntax highlighting from the LSP's
`textDocument/semanticTokens/full` response. Confirmed during the
Qonsole spike (`QONSOLE_LSP_RESPONSES.txt`, section 9) that the
shared `/lsp` endpoint already advertises and serves semantic tokens
with the LSP-standard 16-type / 6-modifier legend — both DPQL and
Qonsole benefit identically.

Concrete plumbing:

- **`LspClient`** captures `semanticTokensProvider.legend` from the
  initialize response and exposes it as a public field
  (`semanticTokensLegend: ILspSemanticTokensLegend | null`).
- **`useLspSession`** surfaces the legend in its return.
- **New `useLspSemanticTokens(session, converter, nodes, options?)` hook**
  in `src/components/smartEditor/`:
  - Debounces document changes (~250ms idle)
  - Calls `session.client.getSemanticTokens()` (we already have it)
  - Decodes the flat int-5-tuple array (deltaLine, deltaStart,
    length, tokenType-idx, tokenModifiers-bitmask) per LSP spec
  - Maps each token's `{line, character, length}` to a Slate `Range`
    via the converter
  - Emits ranges with marks `tokenType: string` and `tokenModifiers: string[]`
  - Returns a stable `decorate` function composable into
    `SmartEditor`'s `composedDecorate`
- **`SmartEditor.tsx` customRenderLeaf** extends the leaf renderer
  to honour the LSP-standard semantic-token types with
  theme-appropriate colours (keyword, function, method, class,
  property, string, number, comment, operator, regexp, variable,
  parameter, etc.).
- **`useDpqlSyntaxHighlighting.ts` is removed** as a copy-paste
  artifact. A thin offline fallback (`useDpqlFallbackHighlighting`)
  may be added later if needed; for now, no highlighting until the
  LSP connects is acceptable (the loading overlay from item 4
  signals this).
- **DpqlEditor stories** — the misleading `WithPlainText` value
  `SELECT * FROM users WHERE name = "Alice"` is replaced with a
  valid DPQL expression (e.g. `1 == 1` or `2026 - 2024 == 2`).

**Surface area.**
`src/utils/lspClient.ts` (legend capture, ~10 lines),
`src/utils/lspClient.types.ts` (new `ILspSemanticTokensLegend` /
`ILspSemanticToken` types, ~10 lines),
`src/components/smartEditor/useLspSession.ts` (expose legend,
~5 lines),
`src/components/smartEditor/useLspSemanticTokens.ts` (new, ~150
lines including the LSP int-array decoder),
`src/components/smartEditor/SmartEditor.tsx` (compose into
decorate, extend renderLeaf colours, ~30 lines),
`src/components/dpqlEditor/DpqlEditor.tsx` (drop the
`useDpqlSyntaxHighlighting` import + caller, ~5 lines net removal),
removed `src/components/dpqlEditor/useDpqlSyntaxHighlighting.ts`,
fixed `src/components/dpqlEditor/DpqlEditor.stories.tsx` (one
example value).

**Tests.** Unit tests for the LSP int-array decoder (delta
re-basing, modifier bitmask). Mock-socket extension to return a
synthetic semantic-tokens payload for a known expression. New story
`WithSemanticTokens` on DpqlEditor demonstrating highlighting on
`@status == "active" && @age >= $config:min_age`.

**Rationale for landing this BEFORE the `0.10.0` release.** The
current highlighting is *visibly* wrong on real DPQL — every `&&` /
`||` / `=~` is uncoloured while every typo like `AND` / `OR` is
mis-coloured green. Shipping `0.10.0` with this in place would mean
the FE consumer's first impression of the DPQL editor includes
visibly broken syntax highlighting. That bar is higher than "matches
the design doc as originally written" — it's "doesn't actively
mislead users about the language".

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

### Decorate composition — merge inside SmartEditor

**Revised 2026-05-26.** Originally specified the wrapper combining
`useDpqlSyntaxHighlighting` + `useLspDiagnosticDecorations`. With
the item 7 revision, `useDpqlSyntaxHighlighting` is gone — both
syntax highlighting (via LSP semantic tokens) and diagnostics are
session-driven, so they live in **SmartEditor** rather than the
wrapper. SmartEditor's `composedDecorate` merges:

```typescript
// SmartEditor.tsx
const diagnosticDecorate = useLspDiagnosticDecorations(session.diagnostics, converter, slateValue);
const semanticDecorate = useLspSemanticTokens(session, converter, slateValue);
const composedDecorate = useCallback(
  (entry) => [
    ...decorate?.(entry) ?? [],   // optional caller override
    ...semanticDecorate(entry),    // LSP-driven syntax highlighting
    ...diagnosticDecorate(entry),  // LSP-driven error underlines
  ],
  [decorate, semanticDecorate, diagnosticDecorate]
);
```

Wrappers can still inject extra decorations via the `decorate` prop
(e.g. embedding-specific overlays), but they no longer have to know
about LSP plumbing.

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

**Release strategy revised 2026-05-26.** After phases 1–7 + 6
shipped, post-batch research surfaced four follow-up task files
(`.tasks/SMART_EDITOR_CONTEXT_AND_POLISH.md`, `LSP_FEATURES.md`,
`QONSOLE_ASSIST_FEATURES.md`, `VISUAL_POLISH.md`) that are
sufficiently entangled with the original batch to share a release
tag rather than ship as `0.10.1` / `0.10.2` / `0.11.0`:

- **`CONTEXT_AND_POLISH` item 4** (`alertPayloadContext` /
  `fsmContext` props) is the actual qorus-ide alert-rule editor
  blocker. Without it, an immediate `0.10.0-beta` release has no
  consumer.
- **`VISUAL_POLISH`** styles surfaces introduced by the other
  follow-ups (signature pill, warning chips, wizard items) — landing
  it before they exist would mean a second polish pass.
- **The full README pass** is cheaper to do once at the end against
  the final API than to update incrementally after each release.
- **The Reqore patches** (Textarea null-check, renderElement deps)
  need to either ship upstream or be persisted via `patch-package`.
  A held release gives Reqore time to land the PRs.

Net: all five `.tasks/*.md` files (the original UX_POLISH plus the
four follow-ups) ship as a single `0.10.0` tag once every row in
`.tasks/INDEX.md` is `committed`. No `-beta` intermediate tag, no
incremental point releases between. The cost is "release happens
later"; the benefit is "the release tag corresponds to a real
consumer milestone".

## Test plan

| Phase | Coverage |
|---|---|
| Item 1 | Extended BasicMock play test asserts no-dropdown-on-mount, dropdown-after-typing |
| Item 2 | New stories: WithMarkdownDocs, WithGroupedKinds. Visual only. |
| Item 3 | Unit test for `useLspDiagnosticDecorations`. New story WithDiagnostics with mock invalid input. |
| Item 4 | Adjust existing play tests to wait for ready signal before typing |
| Item 5 | Unit test of position-mapping math. No play test (jsdom limitation) |
| Item 6 | Story WithServerParse against live LSP |
| Item 7 | Unit tests for LSP int-array decoder. Mock-socket returns a synthetic semantic-tokens payload. New WithSemanticTokens story. Fix the broken `WithPlainText` SQL example. |

All items together: TS clean, lint clean, all jest tests pass, all
storybook play tests pass (147 currently in our scope, expected +5).

## Migration impact

`0.9.0` consumers (DpqlEditor, QonsoleSmartInput) get all items 1–5
**and 7** automatically — no prop changes. Item 6 is opt-in. No
breaking changes; this can ship as `0.9.0` (still pre-release) or
`0.10.0` if we want a "feature-complete" version bump.

Item 7 carries one subtle behavioural change: until the LSP session
becomes ready, no syntax highlighting is rendered (the editor body
is plain monospace text). The loading overlay from item 4 signals
this. Consumers who need offline syntax colouring can pass a
`decorate` prop with their own fallback — but for the standard use
case (an LSP is reachable within ~300ms of mount), the gap is
imperceptible.

## Status

**Design locked 2026-05-25.**
**Revised 2026-05-26** to add item 7 (LSP semantic tokens) after
research surfaced that the SQL-style highlighting was a copy-paste
artifact incompatible with real DPQL syntax. All other items
unchanged.
**Revised 2026-05-26 (second)** to update the release strategy
section — `0.10.0` now bundles the four follow-up task files into a
single tag rather than shipping `0.10.0-beta` + incremental
releases. Rationale in the "Version bump" sub-section above.

Any new issues discovered during implementation get added to the task
list as they surface — design doc updates only with explicit revision.
