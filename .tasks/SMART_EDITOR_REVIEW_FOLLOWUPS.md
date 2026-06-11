# SmartEditor / DpqlEditor — review follow-ups (PR #62)

Source: reviewer feedback on toolkit-react PR #62 (the `0.10.0` editor batch).
Four work items.

**Status:** all 4 items done pending user verify (uncommitted)

- **Task 1** ✅ removed the client "Templates" button + `templates`/`stateId`
  props (our work, unreleased, server-redundant). Mock now position-aware:
  `$`→templates, `@`→fields. `WithTemplates` story reworked to demo the
  `$`-server flow.
- **Task 2** ✅ play tests added: DPQL `WithSignatureHelp` (pill on mount),
  `WithTemplates` (`$`/`@` routing), Qonsole `WithCommitCharacters`
  (`=` commit, no `==`), `WithWizardItems` (`onWizardStart` fires),
  SmartEditor `WithMarkdownDocs` + `WithGroupedKinds` (open dropdowns).
- **Task 3** ✅ theme-transparency: popovers inherit the ambient theme
  (no more hardcoded `#1a1a1a`); focused row uses `custom1` (QorusPurple);
  `#160437` → semantic `pending:darken`. Storybook decorator applies
  qorus-ide's theme (`#121212` + Qorus intents) so snapshots show the
  in-IDE look.
- **Task 4** ✅ the look-alike SmartEditor stories now open their
  dropdowns via `play` (combined with Task 2).
- **Bonus** ✅ two live stories: `LiveDpqlEditorWithAlertPayload` (verify
  `@` fields live) + `LiveDpqlEditorWithFsmContext` (verify `$data:`).

**Verification:** 263 jest pass; 161/162 storybook play tests pass (the 1
is the pre-existing unrelated `FormEngine.OnValidityChange` flake). Design
verified in browser — dropdown on `#121212`, purple focused row.

---

Reviewer's message (verbatim):
> Because I think the idea was that when you type `$` it should show you
> templates, when you write `@` it should show you fields etc.
>
> can you please go back and also add more storybook play tests, so that
> if the story is wrong we can detect it in the CI?
> Also the design could be improved I think as well, so that it matches
> the IDE more (eg the screenshot)
> There are multiple stories that look the same in the SmartEditor (just
> an empty input box)

---

## Task 1 — `$` → templates, `@` → fields (fix the trigger model)

**Intended UX (per reviewer):** typing `$` surfaces templates; typing `@`
surfaces field references. Both through the same on-typing completion
dropdown — NOT a separate button, NOT on-focus.

**Current state (the mismatch):**
- `$` IS already a trigger char: `DPQL_TRIGGERS = new Set(['@', '$', '.', ':'])`
  (`DpqlEditor.tsx:52`). So typing `$` fires `getCompletions` → the LSP
  **server**. Whether the server returns templates for a `$` context is a
  server-side question we haven't confirmed.
- The client-supplied `templates` prop (static items like `$local:input`,
  `$timestamp:now`) is rendered as a **separate "Templates" dropdown
  button above the editor** (`DpqlEditor.tsx:241` `topActions` →
  `ReqoreDropdown`). This is redundant with the `$`-trigger idea and is
  the thing the reviewer is questioning.

**Important nuance discovered while scoping** — there are *two different*
trigger models in play, and they're not the same:
- **Native `ReqoreTextarea`/`ReqoreRichTextEditor` `templates` prop**
  (inherited via `IReqoreRichTextEditorProps extends IReqoreTextareaProps`)
  → opens the templates popover on **click/focus** of the editor
  (`ReqoreDropdown` with `closeOnTargetClick: false`). This is the "click
  in → popup shows" behaviour the reviewer first referenced for the other
  fields.
- **Reviewer's stated intent now** → `$` (typing) shows templates.

These differ. For an LSP-backed editor where `@` already opens fields
**on typing**, the **`$`-on-typing** model is the consistent one — a
click/focus popup would compete with the `@` completion overlay and
reverse the deliberate "trigger-on-typing-only" design (commit
`6fb9bf3`). So Task 1 = the `$`-on-typing model, not the native
click-popup.

**ANSWER — confirmed from the qorus server source** (`Classes/QorusLspWebSocketHandler.qc`):

The server is the **single authoritative source for both** `@` fields and
`$` templates. It is **position-aware** — one `dpql-get-completions` call
returns the right items based on the cursor context. So `$`→templates and
`@`→fields is **already the server's design**; the client does NOT branch.

Evidence:
- Triggers advertised: `"dpql": {"@": True, "$": True, ".": True, " ": True}`
  (`:269`).
- The completion handler (`:1260-1294`) calls a single
  `DpqlActionSession.handleAction("dpql-get-completions", {text, position,
  template_context, fields})` and maps the unified result to LSP items. The
  server parses text+position and returns fields after `@`, templates after
  `$`, plus functions/keywords/operators (`:7910` fallback comment:
  "functions, keywords, operators, templates").
- **Templates are server-derived, NOT client-supplied.**
  `buildDpqlTemplateContext` (`:8648`) builds the template context from:
  - `state_data` from the **FSM context** (set via `dpql/setFsmContext` →
    `uriToFsmContext`), and
  - `record_fields` from the provider/recordType fields, and
  - global Qorus template namespaces via `QorusExpressionHandler::QorusExpressionMap`
    (`:7916` fallback path) — this is very likely where `$local:` /
    `$timestamp:` / `$config:` come from (the exact items our static
    `templates` prop hard-codes). **[verify: confirm QorusExpressionMap
    yields those namespaces]**

**Conclusion: it is NOT "both" — the proper source is the server.**
`$`→templates already works **today** via the existing `$` trigger +
`getCompletions`, *provided the editor's context is set* (`fsmContext`
and/or `provider`/`recordType`). The static client `templates` prop +
the "Templates" button **duplicate** what the server already returns on
`$`, and worse, present it as a button instead of the `$`-trigger flow.

**The most correct + proper implementation:**
1. **Remove the `topActions` "Templates" button** from `DpqlEditor`
   (`:241`). It duplicates the server's `$` completions.
2. Rely on the existing `$` trigger → `getCompletions` → server returns
   templates. No client branching, no injection in the normal path.
3. The `WithTemplates` story is demonstrating the **wrong mechanism** (the
   static button). Rework it to set an `fsmContext` (or provider) and a
   mock that returns templates on `$`, so it shows the real `$`→templates
   flow.
4. **Remove the static `templates` prop entirely (the "clean" version) —
   confirmed SAFE, no reviewer sign-off needed.** Rationale:
   - The prop is **our** addition (commit `6e11c7b`, this batch), not a
     reqore feature. Only the *type* `IReqoreFormTemplates` is reqore's.
   - `DpqlEditor` is **brand-new in the unreleased `0.10.0`** — the
     published `0.8.11` doesn't even export it, so there is **no external
     consumer** of the prop.
   - The qorus-ide wrapper does **not** pass `templates`.
   - **Server-confirmed redundant**: live `$` returned `$autovar:`,
     `$config:`, `$data:`, `$env:`, `$for:`, `$foreach:`, … — a *fuller*
     set than the prop's hard-coded `$local`/`$timestamp`/`$config`. The
     server (QorusExpressionMap + FSM `state_data` + record fields) is
     strictly better and always present for an LSP-backed editor.
   - No realistic DPQL case needs client-supplied templates.
   → Drop the prop + the button. (`IReqoreFormTemplates` import goes too.)

**EMPIRICALLY VERIFIED (live server):**
- `$` in `LiveDpqlEditorWithSignatureHelp` (no context) → server returns the
  global namespaces (`$autovar:`, `$config:`, `$data:`, `$env:`, `$for:`,
  `$foreach:`, …). ✓ confirms `$`→templates is server-driven + context-free.
- `@` in the same (no-context) story → **nothing**, which is **correct**:
  field refs come from `getDpqlFields(uri)`, which only exist once a context
  is bound (`provider`/`recordType`, `alertPayloadContext`, or FSM). The
  server's NO-CONTEXT fallback returns "functions, keywords, operators,
  templates" — **fields are deliberately not in that list**. So `@`-empty
  without a context is by design, not a bug.
- **Still to verify (needs a new live story with a real context):** `@`
  returning actual fields. Add `LiveDpqlEditorWithAlertPayload`
  (`alertPayloadContext: true`) and type `@` → expect real alert-payload
  fields. Optionally `LiveDpqlEditorWithFsmContext` for `$data:` state
  templates beyond the globals.

---

## Task 2 — Storybook play tests for CI regression detection

Reviewer wants CI to catch a broken story. Current coverage:
- 26 stories across DpqlEditor / SmartEditor / QonsoleSmartInput.
- Only **4 explicit `play` tests** (`CanTypeText`, `LspCompletionRoundtrip`,
  SmartEditor `BasicMock`, QonsoleSmartInput `BasicMock`). The rest are
  smoke-only (render-without-throw) — which is why "158/159 pass" sounded
  like more behavioural coverage than it is.

**Add deterministic play tests to the MOCK stories** (live stories stay
smoke-only — non-deterministic against real `/lsp`):
- DpqlEditor `WithSignatureHelp` (mock): pill on mount with `Start Character`
  highlighted → type `0, ` → `Length` highlighted → type `)` → pill gone.
- DpqlEditor `$`→templates and `@`→fields (after Task 1): assert the right
  dropdown opens per trigger.
- QonsoleSmartInput `WithCommitCharacters`: type `-`,`-`,`l`,`=` → no `==` dup.
- QonsoleSmartInput `WithWizardItems`: select wizard item → `onWizardStart`
  spy called with the descriptor.
- QonsoleSmartInput `BasicMock`: already has the `/l`→`/list` no-dup +
  slot-grammar assertions — keep / extend.

**Constraint already learned:** programmatic `execCommand`/synthetic
`InputEvent` do NOT reliably go through Slate's `beforeinput` pipeline —
use `@storybook/test` `userEvent.type` (the existing 4 play tests do this
successfully). Some assertions (signature param advance) were only verified
manually; codifying them is the point of this task.

---

## Task 3 — Design polish to match the IDE

Reviewer: "the design could be improved … so that it matches the IDE more
(eg the screenshot)".

**The IDE's design tokens (confirmed — `qorus-ide/src/constants/util.ts`
`defaultReqoreTheme`, applied app-wide via `ReqoreUIProvider` in
`src/index.tsx`):**
- `main: '#121212'` (app surface)
- `header.background: '#000000'`
- intents: `success: '#4a7110'`, **`custom1: '#762f7e'` (QorusPurple)**,
  `custom2: '#b34e1d'` (Attention/orange)
- theme name `vscode`; options: button/dialog animations off, `glowingIcons`,
  tooltip delay 300, `closePopoversOnEscPress`.

**The mismatch:** our `styling.ts` **hardcodes** its own surfaces instead
of inheriting the ambient theme:
- `SMART_EDITOR_POPOVER_CUSTOM_THEME.main = '#1a1a1a'` (vs the IDE's
  `#121212`)
- gradient `#160437` etc.
- focused row / chips use generic `info` (blue) — the IDE's brand accent is
  **QorusPurple `#762f7e` (custom1)**, which is why our blue-accented
  dropdown reads as "not quite the IDE".

**The correct approach (per `qorus-ide/design/REQORE_REQRAFT.md`: "use
customTheme/effect/intent, don't hardcode"):** the editor is a **library**
component — it must NOT bake in qorus-ide's brand hexes (that couples
reqraft to one consumer). Instead:

1. **Make the editor theme-transparent** — stop forcing `#1a1a1a`; use
   `transparent` + inherit the ambient Reqore theme so the popover surface
   becomes whatever the host app's `main` is. Embedded in qorus-ide →
   automatically `#121212`; embedded elsewhere → that app's surface. This is
   the "matches the IDE" win AND keeps reqraft consumer-agnostic.
2. **Use semantic intents, not hexes** — let the focused-row / chip accent
   resolve through the theme's intent palette (so qorus-ide colours it with
   its `custom1` purple; the library ships a sensible default).
3. **Storybook preview** — add a decorator that wraps the editor stories in
   a qorus-ide-like theme (`main: '#121212'`, `intents.custom1 = '#762f7e'`,
   `custom2 = '#b34e1d'`) so the Chromatic snapshots show the in-IDE look.
   This is how we "see the match" without running the whole IDE — and it's
   what the reviewer's screenshot compares against.

**To do:**
- `styling.ts`: replace hardcoded `#1a1a1a`/`#160437` popover surfaces with
  `transparent` + ambient-theme inheritance; keep `backgroundBlur`.
- Audit `COMPLETION_KIND_INTENTS` + focused-row + chip intents → semantic
  intents that the host theme colours (not literal blue).
- Add the qorus-ide-theme Storybook decorator (global, in `.storybook` or a
  per-editor-story decorator) so stories render on `#121212` with the Qorus
  intents.
- Then eyeball row padding/height, chip style, type-caption treatment
  against the screenshot and nudge spacing.

**Why we can do this without reviewer back-and-forth:** the design target is
the IDE's own published theme tokens (`defaultReqoreTheme`) — not a
subjective choice. "Match the IDE" = "inherit the IDE's theme + use its
intent palette", which is objectively defined in `constants/util.ts`. The
only subjective polish (exact padding/row height) we tune against the
screenshot.

---

## Task 4 — Deduplicate / differentiate empty-looking SmartEditor stories

Reviewer: "multiple stories that look the same in the SmartEditor (just an
empty input box)".

**Confirmed:** the 3 SmartEditor mock stories all seed `initialValue: ''`:
- `BasicMock`, `WithMarkdownDocs`, `WithGroupedKinds` → all render as an
  identical empty box at rest, so their Chromatic snapshots are
  indistinguishable. (`LiveQonsole` seeds `/list services ` so it differs.)

**Options (pick per story):**
- Seed a representative `initialValue` so each looks distinct at rest, OR
- Add a `play` that opens the dropdown so the Chromatic snapshot captures
  the differentiated content (this doubles as Task 2 coverage), OR
- Consolidate stories that genuinely demo the same thing.

Recommendation: combine with Task 2 — give each a `play` that opens its
characteristic dropdown state, which both differentiates the snapshot AND
adds the CI assertion. Net: one pass covers Tasks 2 + 4 for SmartEditor.

---

## Suggested order

1. **Task 1** decision (ask reviewer: server `$` templates vs client-injected
   vs both) — blocks the implementation but not the others.
2. **Tasks 2 + 4 together** — play tests that open dropdowns differentiate
   the snapshots AND give CI coverage. Do the non-`$` ones now; add the
   `$`→templates assertion after Task 1 lands.
3. **Task 3** — needs the reviewer's design target; iterative.

All on `feature/dpql-editor` (PR #62) as follow-up commits **after** the
user verifies — no commits without explicit OK.
