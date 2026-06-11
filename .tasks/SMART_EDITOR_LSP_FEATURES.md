# SmartEditor — unused LSP methods

Follow-up to the `0.10.0` UX batch (see
[`SMART_EDITOR_UX_POLISH.md`](./SMART_EDITOR_UX_POLISH.md)). The Qorus
LSP server advertises 13+ standard LSP methods we don't consume from
the client. This task triages each, lands the ones with real value
for DPQL / Qonsole today, and documents why the rest are deferred or
permanently out of scope.

**Status:** done — committed in `d54597e`. Wires `textDocument/signatureHelp`; other 12 LSP methods deferred per the per-method rationale below. **Awaiting browser verification (mock + live story exist; live story confirmed against the real Qorus DPQL LSP).**

**Live-verification notes (captured after the initial implementation):**

- Real server signature shape differs from the hypothetical one
  documented in §"Design decisions → 1." below. The Qorus DPQL handler
  emits a single `→ <type>` return annotation in the `label`, and uses
  **human-friendly capitalized parameter names** (`"String Value"`,
  `"Start Character"`) rather than identifier-style (`"value1"`,
  `"start"`). Both are valid LSP `SignatureInformation`; the render
  path handles both.
- **`coalesce` and `concat` are single-variadic-parameter on the
  server.** Both return one parameter (`"Value"`). Typing more commas
  does NOT advance the active parameter — the server semantically
  treats all args as the same conceptual slot. The original task plan
  used `coalesce` as the demo case; the live story uses `substr`
  instead because it has three distinct positional parameters and
  visibly demos active-parameter advancement.
- Server-probed shapes for functions with distinct positional params:
  - `substr(String Value, Start Character, Length) → string`
  - `round(Number, Precision) → auto`
  - `format_date(Date To Format, Format String) → string`
  - `nullif(Value, Compare Value) → auto`
  - `split(String To Split, Separator) → list<auto>`
- Real server **also pushes a `textDocument/publishDiagnostics`** for
  incomplete input — `substr("hello", ` flags as "Unexpected token ''
  in value position". The diagnostic clears once the syntax is
  complete. The editor's existing diagnostic panel renders it.
  Expected behavior.
- Capability advertisement: real server advertises 22 LSP providers
  in `initialize`, but per the per-method rationale below, most return
  null/empty for `languageId: 'dpql'`. The capability gate on
  `session.capabilities?.signatureHelpProvider` is the right check
  before wiring features.
**Scope:** one new feature (signatureHelp), one capability-detection
helper, eight explicit "rejected — defer" decisions.
**Estimated size:** ~250 lines + tests, ~1.5 days.

## Goal

The DpqlEditor should feel like a real code editor when you're inside
a function call — typing `coalesce(@a, ` should show a popover with
the signature `coalesce(value1, value2, …, default)`, the current
argument highlighted. This is the single highest-leverage LSP feature
we don't yet use.

## Research findings (server)

Full audit at the foot of this file. Summary:

The server (`qorus/Classes/QorusLspWebSocketHandler.qc`)
unconditionally advertises every LSP provider it knows about in the
`initialize` response (line 841-907), but **most of them early-return
`[]` or `null` for DPQL and Qonsole** — the handlers branch by
`languageId` and only the Qore / TypeScript / Python paths do
meaningful work. DPQL is implemented only for `completion`, `hover`,
`semanticTokens`, `formatting`, `signatureHelp`. Qonsole is
implemented for `completion`, `hover`, `semanticTokens`, `codeAction`.

| Method | DPQL | Qonsole | Value for DPQL |
|---|---|---|---|
| `textDocument/signatureHelp` | **yes** (`dpql-get-signature-help`) | yes | **HIGH** ← this task lands this |
| `textDocument/codeAction` | no | yes | LOW (no DPQL impl) |
| `textDocument/documentHighlight` | no | no | LOW |
| `textDocument/inlayHint` | no | no | LOW |
| `textDocument/prepareRename` + `rename` | no | no | LOW |
| `textDocument/selectionRange` | no | no | LOW today; MEDIUM if DPQL gains AST-driven |
| `textDocument/onTypeFormatting` | no | no | LOW (single-line) |
| `textDocument/definition` | no | no | LOW (hover covers it) |
| `textDocument/references` | no | no | LOW (single-line) |
| `textDocument/foldingRange` | no | no | LOW (single-line) |
| `textDocument/documentSymbol` | no | no | LOW (no symbols) |
| `textDocument/codeLens` | no | no | LOW (no top-level decls) |
| `workspace/executeCommand` | no | no (rejects `qonsole.*`) | LOW |

**Only one method is worth implementing now for the DPQL story we
ship.** The rest are documented as known not-supported-server-side
and revisited if/when the server gains support.

## Design decisions

### 1. `textDocument/signatureHelp` — implement

**Server contract:**
- Triggers: `(`, `,`, ` `, `-`, `=` (advertised by
  `signatureHelpProvider.triggerCharacters`)
- Response shape:
  ```json
  {
    "signatures": [
      {
        "label": "coalesce(value1, value2, ..., default)",
        "documentation": { "kind": "markdown", "value": "..." },
        "parameters": [
          { "label": "value1", "documentation": {"kind":"markdown","value":"..."} },
          ...
        ]
      }
    ],
    "activeSignature": 0,
    "activeParameter": 1
  }
  ```
- Empty case: `{ "signatures": [], "activeSignature": 0, "activeParameter": 0 }`

**Client UX:**
- Small pinned pill **above** the caret (above, not below, so the
  completion popover and signature pill don't overlap; they coexist
  side-by-side or stacked)
- Shows the active signature's `label` with the parameter at
  `activeParameter` highlighted (bold + accent color from the
  `info` intent)
- Below the label: the active parameter's `documentation.value` as
  markdown (capped at ~2 lines, scrollable past)
- Dismisses on: Escape, closing paren, cursor moves outside the
  call (heuristic: cursor offset < open-paren position), or
  `session.diagnostics` reports an error covering the call site

**Trigger logic:**
- Fire on the server-advertised triggers via the existing
  `onSlateChangeImpl` path (`useLspAutocomplete.ts:443`)
- Also re-fire on any cursor move while a signature is currently
  open — `activeParameter` advances when the user types a comma or
  moves between args
- Debounce ~100ms (a bit faster than completions — feels snappier
  for "where is my cursor inside this call")

**Position:**
- Anchor at the caret's DOM rect like the completion popover, but
  `top: rect.top - 4` (above the line, with a 4px gap)
- Re-use the same "measure-after-debounce" pattern that fixed the
  completion popover positioning bug from Phase 5

### 2. Generic LSP capability detection

The completion handler already captures the semantic-tokens legend
from initialize. Extend the same pattern so consumers can check
whether the server supports a given provider:

```ts
// lspClient.ts
public capabilities: ILspServerCapabilities | null = null;
// ILspServerCapabilities — minimal shape; just the providers we care about
//   signatureHelpProvider?: { triggerCharacters?, retriggerCharacters? }
//   hoverProvider?: boolean
//   completionProvider?: { triggerCharacters? }
//   semanticTokensProvider?: { legend, full?, range? }
//   codeActionProvider?: { codeActionKinds? }
//   ... (only what we read)
```

Surface as `session.capabilities` (and `session.semanticTokensLegend`
becomes a thin alias for `capabilities?.semanticTokensProvider?.legend`).

This gives wrappers a clean way to test "does this server support
signature help?" before wiring the trigger — no hardcoded server
assumptions.

### 3. Rejected — defer with rationale

For each LOW-value method, explicitly land a "we considered this and
declined" note in the README or design doc rather than leaving them
silently unimplemented. Future contributors should not have to redo
this research.

The rationale per method is in §research-findings below. The README's
Components section gains a short subsection "LSP methods supported"
that lists `completion`, `hover`, `formatting`, `semanticTokens`,
`diagnostics`, `signatureHelp` (after this task) and a one-line "Why
not X / Y" pointer.

## Surface area

| File | Change |
|---|---|
| `src/utils/lspClient.types.ts` | new `ILspSignatureHelp`, `ILspSignatureInformation`, `ILspParameterInformation`, `ILspServerCapabilities` types |
| `src/utils/lspClient.ts` | capture full `initialize` `capabilities` (not just the semantic-tokens legend); new `getSignatureHelp(line, character): Promise<ILspSignatureHelp \| null>` |
| `src/components/smartEditor/useLspSession.ts` | surface `capabilities: ILspServerCapabilities \| null` in the result |
| `src/components/smartEditor/useLspSignatureHelp.ts` | **new** — hook returning `{ signature, activePill, position, clear }`. Same skeleton as `useLspHover` (mousemove → here it's cursor-position-aware) |
| `src/components/smartEditor/SmartEditor.tsx` | render the signature pill `<ReqorePopover>` above the caret; trigger via the existing `onSlateChangeImpl` based on capability's `triggerCharacters` |
| `src/components/smartEditor/types.ts` | new `enableSignatureHelp?: boolean` prop (default `true`) |
| `__tests__/smartEditor/signatureHelp.test.ts` | **new** — unit tests for position mapping + active-parameter advancement |
| `src/components/dpqlEditor/DpqlEditor.stories.tsx` | mock `textDocument/signatureHelp` handler (return a synthetic `coalesce(...)` signature); new `WithSignatureHelp` story |
| `README.md` | document `enableSignatureHelp`; "LSP methods supported" subsection |

## Tasks

### Setup

- [ ] Read the Qore-spec dpql signature-help test fixtures to capture
      a realistic signature shape (`/Users/nick/Projects/QoreTechnologies/qore-2/test/...` if any) — falls back to the `coalesce` example if no fixture exists

### Types + LspClient

- [ ] `src/utils/lspClient.types.ts` — add `ILspParameterInformation`,
      `ILspSignatureInformation`, `ILspSignatureHelp`,
      `ILspServerCapabilities` (minimal — only fields we read)
- [ ] `src/utils/lspClient.ts` — store the full `capabilities` hash
      from `initialize` response (currently we only extract the
      semantic-tokens legend). Backwards-compat: keep the existing
      `semanticTokensLegend` field as a derived getter
- [ ] `LspClient.getSignatureHelp(line, character)` — sends
      `textDocument/signatureHelp` with the URI + position; returns
      the response or `null` on no signatures

### Session hook

- [ ] `useLspSession` — expose `capabilities` in the result
- [ ] Re-capture in the connect-effect alongside the existing legend
      capture

### `useLspSignatureHelp` hook

- [ ] New file: `src/components/smartEditor/useLspSignatureHelp.ts`
- [ ] Signature: `useLspSignatureHelp(session, editorRef, converter, options?)`
- [ ] State: `{ signature: ILspSignatureHelp | null, position: { left, top } | null, clear: () => void }`
- [ ] Debounce 100ms; cancel on cursor moves outside any open paren
- [ ] Stale-response guard via `requestIdRef` (same pattern as hover)
- [ ] Skips if `!session.capabilities?.signatureHelpProvider`

### SmartEditor wiring

- [ ] New prop `enableSignatureHelp?: boolean` (default `true`)
- [ ] Call `useLspSignatureHelp(...)` alongside the other LSP hooks
- [ ] Trigger from `onSlateChangeImpl` when the typed character is in
      the server's advertised `signatureHelpProvider.triggerCharacters`
      AND `enableSignatureHelp` is true
- [ ] Render the signature pill `<ReqorePopover>` anchored at
      `{ top: rect.top - 4, left: rect.left }` with `placement='top-start'`
- [ ] Pill content: signature label with active parameter bolded,
      below it the active parameter's documentation rendered via
      `react-markdown`
- [ ] Dismiss on Escape (extend the existing keyboard handler), on
      cursor moves out of the call, on close-paren

### Stories + tests

- [ ] DpqlEditor mock: handle `textDocument/signatureHelp` by
      returning a synthetic `coalesce(value1, value2, default)`
      signature
- [ ] New story `Components/DpqlEditor → WithSignatureHelp` — initial
      value `coalesce(@name, ` so the pill is visible on mount
- [ ] Play test: assert the pill appears, `activeParameter` is 1
      (`value2`), advances to 2 (`default`) on typing a comma
- [ ] Unit tests for `getSignatureHelp` request shape, the
      capability gate (no request when provider absent)

### Documentation

- [ ] README.md — add `enableSignatureHelp` to SmartEditor props
      table; add an "LSP methods supported" subsection that lists
      what's wired and includes a one-line "Why not X" entry for
      each of the 12 deferred methods
- [ ] Inline TSDoc on `enableSignatureHelp` explains it's gated on
      server capability — turning it on with a non-supporting server
      is a silent no-op

### Checks

- [ ] Typecheck, lint, jest, storybook play tests all pass
- [ ] **STOP — user verifies in browser** before commit

## Research findings — per-method deferral rationale

(For the README's "Why not X" pointers. Sourced from the deep server
audit; full notes in research transcript.)

| Method | Why deferred |
|---|---|
| `textDocument/codeAction` | Server has no DPQL handler. For Qonsole it works but our editor primitive isn't where quick-fix UI belongs — that's qorus-ide-side. Add later if a Qonsole-specific consumer needs it. |
| `textDocument/documentHighlight` | Server returns `[]` for both DPQL and Qonsole. |
| `textDocument/inlayHint` | Server returns `[]`. Single-line DPQL would crowd ghost-text. |
| `textDocument/prepareRename` + `rename` | Server returns `null`. DPQL field names aren't user-renameable (server-owned schema). |
| `textDocument/selectionRange` | Server returns `[]`. Could become useful if DPQL parser exposes AST ranges, but no current consumer asks for it. |
| `textDocument/onTypeFormatting` | Server returns `[]`. DPQL is single-line, no `{}` blocks. |
| `textDocument/definition` | Server returns `[]`. Field "definitions" already surfaced via hover. |
| `textDocument/references` | Server returns `[]`. Short expressions; no cross-reference scope. |
| `textDocument/foldingRange` | Server returns `[]`. Single-line. |
| `textDocument/documentSymbol` | Server returns `[]`. Server comment: "command buffers are single-line and do not expose symbols". |
| `textDocument/codeLens` | Server returns `[]`. No top-level declarations in DPQL/Qonsole input. |
| `workspace/executeCommand` | Server rejects `qonsole.*` (wizard launch is REST-based — see Qonsole task). No other commands defined. |

## Out of scope

- Wiring code-actions for Qonsole only (would land in the Qonsole
  features task, not here)
- Implementing client-side rename UI even if the server stays no-op
- Adding signature help to QonsoleSmartInput (covered by the
  Qonsole-features task; signature help for natural-language input
  doesn't make sense the same way it does for DPQL function calls)
