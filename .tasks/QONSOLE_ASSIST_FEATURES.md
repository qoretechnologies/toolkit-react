# QonsoleSmartInput — assist response features

Follow-up to the `0.10.0` UX batch (see
[`SMART_EDITOR_UX_POLISH.md`](./SMART_EDITOR_UX_POLISH.md)). The Qorus
LSP server's Qonsole assist response carries fields the client either
silently discards or — in the case of `mode` — type-mistypes. This
task triages each field, lands the generic ones in `useLspAutocomplete`,
and lands the Qonsole-specific wizard / starter-suggestion flow in
the `QonsoleSmartInput` wrapper.

**Status:** done — committed in `189fe52`. Generic LSP wins (commitCharacters, sortText, warning) + Qonsole-specific (wizard launch via `qonsole.startWizard`, mode-type fix). **Awaiting browser verification.**
**Scope:** seven items, three of them generic-LSP wins (commit chars,
sortText, warning), four Qonsole-specific (relatedWizards, wizard
command, natural-language mode, mode-type fix).
**Estimated size:** ~200 lines + tests, ~1.5 days.

## Goal

A Qonsole consumer typing `/li ` should auto-accept `list` on space.
Typing `/list ` should rank the resource list per server intent
(group rank + match rank). Selecting a `Start wizard ...` item should
launch the wizard flow, not insert the text. Typing free text (NL
mode) should show the server's starter suggestions if available.
Destructive verbs (`delete`, `drop`) should flag themselves in the
dropdown so users see the warning before pressing Enter.

None of these are blocking for the `0.10.0` release — the editor
works without them. They're the difference between "Qonsole input
typing works" and "Qonsole input feels like the IDE wrote it".

## Research findings

Source: `qorus/Classes/QonsoleAssistService.qc`,
`qorus/Classes/QorusLspWebSocketHandler.qc`,
`QONSOLE_LSP_REFERENCE.md`, plus a code search across our
`useLspAutocomplete.ts`, `useQonsoleSession.ts`,
`lspClient.types.ts`.

### Generic LSP fields (apply to all languages, not Qonsole-only)

These already exist on `ILspCompletionItem`:

| Field | Server emits | Client uses | Severity |
|---|---|---|---|
| `commitCharacters: string[]` | yes (verbs/resources `[" "]`, non-bool flags `["="]`, bool flags `[" "]`) | **no** — typed but never read | Small but visible win |
| `sortText: string` | yes (`<group_rank>_<match_rank>_<label>` shape, sorted server-side) | partial — preserved in items array, but grouping by kind in `useLspAutocomplete.ts:282` re-orders across groups | Medium — affects rank order |
| `data: Record<string, unknown>` | yes (verb/resource/flag metadata; for wizard items: `{action: 'start-wizard', name, start_path, ...}`) | accessible via `item.raw.data` but no client codepath reads it | Small in isolation; required for wizard launch |

### Qonsole-specific (only on this server / this language)

| Field | Server emits | Client uses | Severity |
|---|---|---|---|
| `warning: string` | yes — only on mutating verbs (`create`, `delete`, `update`, …) | no — not in our type | Small but useful safety affordance |
| `command: {command, arguments, title}` | yes — only on wizard completion items (`kind === 15`) | no | Required to make wizard items actionable |
| `relatedWizards` (top-level on `qonsole/assist` response) | yes — when canonical command has both verb+resource AND user can access matching wizards | no — `IQonsoleAssistResult.related_wizards` exists in types but the field is never rendered | Small (wizards already surface as completion items via `makeWizardCompletionItems`) |
| `mode: 'command' \| 'nl' \| 'empty'` | yes — server inferred from input | type bug: declared as `'command' \| 'natural-language'` in our types; server returns the literal `"nl"` | Tiny but correctness |

### Server protocol details we need to know

- **`workspace/executeCommand` is REJECTED for `qonsole.*`** — confirmed in `QorusLspWebSocketHandler.qc:2188-2207`. Wizard launch must go through REST: `POST {apiHost}{start_path}` from `command.arguments[0].start_path`, then drive the returned `QonsoleWizardSession` via `POST /api/latest/qonsole/wizards/sessions/{id}/step` and `/abort`. Documented in `QorusQonsoleRestClass.qc:7770-7950`.

- **`completionItem/resolve` is NOT supported** by the server (`completionProvider.resolveProvider` is not in capabilities). `data` is fully populated up front — not for lazy resolution. So clients don't need to implement a resolve-roundtrip.

- **Natural-language mode is detection-only.** The `nl` response has empty `completion.items`, empty `diagnostics`, optional `starter_suggestions` when the server's `isCannedWelcomeIntent` matches. Actual execution goes through `/qonsole/exec` SSE — out of scope for this task (it's the chat-runner, not the editor).

## Design decisions

### 1. `commitCharacters` — generic, lands in `useLspAutocomplete`

VS Code semantics: when the focused item has `commitCharacters` and
the user types one, accept the completion AND insert the typed
character. The typed character is preserved in the document; the
completion is what would have been typed had they pressed Tab/Enter.

Special case `space` → bool flags: server emits `[" "]` for bool
flags. After accepting `--verbose` on space, the server's
`textEdit` already includes the space-after, so we'd double-space.
**Decision:** on commit-char accept, check whether the inserted
text from the completion already ends in the typed character — if
so, suppress the verbatim re-insert. Confirmed by reading
`QonsoleAssistService.qc:982`: flag insertText is `"--name="`
(no trailing space) for `=`-committed flags, `"--name"` (no trailing
char) for space-committed bool flags. So always re-insert is
*almost* right, but the user types `--verbose ` and gets
`--verbose ` (one space). For `=` flags, user types `--name=` and
gets `--name=` (no double-equals because the completion's `newText`
ends with `=`).

Actually re-examining: the server's `textEdit.newText` is what the
completion produces. For bool `--verbose`, server's `newText`
is `--verbose` (without trailing). User types space → we accept →
`--verbose` is inserted → we re-insert the typed space → final
text is `--verbose ` (with one space). Correct.

For `=` flag `--limit`, server's `newText` is `--limit=`. User
types `=` → we accept → `--limit=` is inserted → we re-insert
`=` → final is `--limit==`. **Wrong.** So we DO need the
deduplication: if the just-inserted text ends with the commit
character, swallow the second one.

Implementation: peek at the completion's `textEdit?.newText ?? insertText ?? label`.
If it ends with the typed key, suppress the re-insert.

### 2. `sortText` — generic, lands in `useLspAutocomplete`

Server already sorts; we re-order via kind-grouping which violates
server intent.

**Decision:** drop the kind-grouping for items whose `sortText` is
present. Instead, group only when no `sortText` is supplied (legacy
fallback). The server's `sortText` already encodes the group order
(`group_rank` is the first segment). So we render as a flat list,
ordered by `sortText`, with the server's headers implicit in the
rank steps.

This is a behaviour change for the dropdown when consuming Qonsole.
For DPQL (which doesn't populate `sortText` consistently per server
audit), groups remain. We branch on the presence of `sortText` on
any item.

Alternative we considered: keep groups but order group headers by
the smallest `sortText` per group. Rejected — `sortText`'s first
segment is `group_rank` exactly so a flat sort is equivalent and
simpler.

### 3. `warning` — generic field on `ILspCompletionItem`

**Decision:** add `warning?: string` to `ILspCompletionItem`. Add
`warning?: string` to `ICompletionDropdownItem`. Render as a small
right-aligned warning chip + the row's `tooltip` payload extended
with the warning. Visual: `<ReqoreTag intent='warning' icon='AlertLine' size='small'>` in the row's `rightAction` or as a second badge.

Doesn't conflict with the kind-chip badge — Reqore allows `badge` to be an array.

### 4. `data` — generic field on `ILspCompletionItem`

**Decision:** add `data?: Record<string, unknown>` to
`ILspCompletionItem`. No special rendering — it's a pass-through
for inserters and external callers. The wizard-launch path (next
item) reads `data.action === 'start-wizard'` to branch.

### 5. Wizard launch via `command: 'qonsole.startWizard'` — Qonsole-specific

Spec: the server attaches a `command: { command, arguments, title }`
to completion items when `data.action === 'start-wizard'`. We need
to NOT insert text but instead fire a callback the consumer wires
to the wizard runner.

**Decision:**

- Generic addition to `ILspCompletionItem`: `command?: { command: string; title: string; arguments?: unknown[] }`.
- Generic addition to `TCompletionInserter` context: we already pass
  `replacementPath` etc. — add nothing; the inserter receives
  `item.command` via `item.raw.command` and decides what to do.
- Qonsole-specific addition: a new `onWizardStart?(args: unknown[])` prop
  on `QonsoleSmartInput`. The default `completionInserter` for
  Qonsole checks `item.raw.command?.command === 'qonsole.startWizard'`
  and calls `onWizardStart(args)` instead of inserting text.
- Reqraft provides NO wizard runner UI — that's qorus-ide-side
  (a new `<QonsoleWizardSessionModal>` component). Our job is the
  callback hand-off.

The dropdown visual for wizard items uses a distinctive icon and a
`Wizard` kind chip — extend the kindLabel map to map "snippet" kind
to "Wizard" when `data.action === 'start-wizard'`.

### 6. `relatedWizards` (top-level on assist response) — Qonsole-specific

The server appends each wizard ALSO as a synthetic completion item
(`makeWizardCompletionItems` at `QonsoleAssistService.qc:806`) — so
the items list already covers the wizard surface. The top-level
`related_wizards` array is the canonical source for an inline
"Suggested setup" callout panel below the input — useful when a
command is recognised but partially filled.

**Decision (v1):** rely on the synthetic items in the dropdown. Do
NOT build the inline callout panel. If we want it later, it's a
new ReqoreCallout below the editor body when
`session.lastAssist?.related_wizards?.length > 0`. Tracked as
deferred.

### 7. `mode` type fix

Trivial — change `'natural-language'` to `'nl'` in
`qonsoleSmartInput/types.ts:40`. Add `'empty'` as a third literal.

Also fix `QONSOLE_LSP_REFERENCE.md:150` which has the same wrong
literal documented.

### Not landing in this task

- Natural-language mode **starter suggestions** rendering — different
  surface (chips below the input). Add later if Qonsole NL becomes a
  Reqraft consumer's actual use case. The qorus-ide existing
  QonsoleInput.tsx doesn't even use `qonsole/assist` for NL — goes
  straight to `/qonsole/exec` SSE on submit.
- Attachment-mode UX — assist response carries `attachments` only in
  NL mode; out of scope.
- The wizard runner modal itself — qorus-ide work.

## Surface area

| File | Change |
|---|---|
| `src/utils/lspClient.types.ts` | `ILspCompletionItem` gains `warning?: string`, `data?: Record<string, unknown>`, `command?: { command, title, arguments? }` |
| `src/components/smartEditor/useLspAutocomplete.ts` | `ICompletionDropdownItem` gains `warning?`, surface `command` via `raw`; keyboard handler intercepts commit-char keys; sort by `sortText` (flat) when present; deduplication for commit-char re-insert |
| `src/components/smartEditor/SmartEditor.tsx` | render the `warning` chip on rows that have it (right-side, intent="warning", small) |
| `src/components/qonsoleSmartInput/types.ts` | fix `mode` literal (`'nl'`/`'empty'`); add `onWizardStart?(args: unknown[]) => void` prop |
| `src/components/qonsoleSmartInput/QonsoleSmartInput.tsx` | inject a custom `completionInserter` that branches on `item.command?.command === 'qonsole.startWizard'` and calls `onWizardStart` |
| `src/components/qonsoleSmartInput/qonsoleInserter.ts` | **new** — extracts the wizard-or-text branch into a named helper |
| `__tests__/smartEditor/commitCharacters.test.ts` | **new** — unit tests for commit-char accept logic incl. the deduplication |
| `src/components/qonsoleSmartInput/QonsoleSmartInput.stories.tsx` | enrich the mock to emit `warning` on destructive verbs and `command` on wizard items; add `WithCommitCharacters`, `WithWizardItems` stories |
| `QONSOLE_LSP_REFERENCE.md` | fix the `mode` literal (`nl` not `natural-language`) |

## Tasks

### Generic field surfacing

- [ ] `ILspCompletionItem` extended with `warning?`, `data?`, `command?`
- [ ] `ICompletionDropdownItem` extended with `warning?`; populate it
      in the mapping step of `performCompletionRequest`
- [ ] SmartEditor renders the warning chip on the row's
      `rightAction` when present

### Commit characters

- [ ] Extend the keydown handler in `useLspAutocomplete` to intercept
      single-character keys that match the focused item's
      `commitCharacters`; accept the completion via `selectItem`,
      then re-insert the typed char UNLESS the just-inserted text
      ended with it (server textEdit dedup)
- [ ] Confirm interaction with `metadata.retrigger` — `:` commit on
      a `$template:` item should re-trigger value completions; the
      timeout-based re-trigger already handles this
- [ ] Unit tests covering:
  - bool flag (`--verbose`, space commit) → final text ends with one space
  - `=` flag (`--limit`, `=` commit) → final text is `--limit=` (no double `=`)
  - retrigger interaction → completion re-fires after commit

### Sort

- [ ] In `useLspAutocomplete`, sort `items` by `sortText` (lexically)
      before grouping
- [ ] When ANY item has `sortText`, skip kind-grouping — render a
      flat list. When NO items have `sortText`, fall back to the
      existing kind-grouping (preserves DPQL behaviour)

### Qonsole-specific wizard flow

- [ ] `qonsoleSmartInput/qonsoleInserter.ts` — new file with the
      branch: wizard items call `onWizardStart`; everything else
      delegates to `defaultCompletionInserter`
- [ ] Add `onWizardStart?` prop to `IQonsoleSmartInputProps`
- [ ] Hook the inserter via the `completionInserter` prop on
      SmartEditor
- [ ] In `useLspAutocomplete`, extend `ICompletionDropdownItem`'s
      kindLabel resolver: when `kind === 15` (CIK_SNIPPET) AND
      `data?.action === 'start-wizard'`, label the chip "Wizard"
      and override the icon to `MagicLine`

### Mode type fix

- [ ] `qonsoleSmartInput/types.ts` — change `mode: 'command' | 'natural-language'` to `'command' | 'nl' | 'empty'`
- [ ] Update `QONSOLE_LSP_REFERENCE.md` to match (and add `empty`)
- [ ] No code change needed in `useQonsoleSession` — it passes the
      response through unchanged

### Stories + mock enrichment

- [ ] `QonsoleSmartInput.stories.tsx` mock — for the BasicMock
      completion response:
  - Add `warning: 'Mutates system state'` to verbs `create`, `delete`,
    `drop`, `update`
  - Add `command: { command: 'qonsole.startWizard', title, arguments: [{action: 'start-wizard', name: 'create-connection', start_path: '/api/latest/qonsole/wizards/create-connection/start'}] }` to one synthetic wizard item per response
  - Add `commitCharacters: ['=']` to flag completions like
    `--limit`, `--search`, `--app`
- [ ] New story `WithCommitCharacters` — initial value `/list services `,
      play test types `--li`, then `=`, asserts the editor shows
      `/list services --limit=` and the popover is open for values
- [ ] New story `WithWizardItems` — initial value `create con`, mock
      returns the wizard item, play test confirms selecting it fires
      the consumer-provided `onWizardStart` callback (via `fn()` spy)

### Documentation

- [ ] README: add a short Qonsole-features section under the
      QonsoleSmartInput entry mentioning commit chars, wizard launch,
      `onWizardStart` prop
- [ ] TSDoc on `onWizardStart` explains it's the consumer's
      responsibility to drive the REST `start_path`

### Checks

- [ ] Typecheck, lint, jest, storybook play tests all pass
- [ ] **STOP — user verifies in browser** before commit

## Out of scope

- Natural-language mode UX (starter cards, chat-style rendering) —
  separate task if Qonsole NL becomes a Reqraft consumer use case
- Wizard runner modal component — qorus-ide-side
- `relatedWizards` inline callout panel — deferred; synthetic items
  in the dropdown already cover the surface
- `completionItem/resolve` plumbing — server doesn't advertise the
  capability; no need
- Attachment-mode handling
