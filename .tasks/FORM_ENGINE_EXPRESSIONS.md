# Form engine — expression support

Design: [`design/FORM_ENGINE_EXPRESSIONS.md`](../design/FORM_ENGINE_EXPRESSIONS.md).
Adds expression values to the form engine — visual builder (ported) +
DPQL text editor (existing), one AST, plus an Explain button.

**Status:** all 5 phases DONE pending user verify — implemented 2026-06-09/10,
uncommitted. Foundation → TemplateField toggle + shell → DPQL text mode →
visual ExpressionBuilder → expression validation. jest 267/267, ~14 new
expression play tests pass, prod typecheck + eslint clean. One open item:
the Explain transport (server `render-expression` exposure) — held behind
`useRenderExpression` (interim client-side render works today). Builds on the
also-uncommitted field-migration batch.

**Server contract:** verified live (see design doc table + memory
"Qorus expression/DPQL contract"). Explain transport is the one open
server decision — held behind `useRenderExpression`, does not block.

## Surface area

| Path | Change |
|---|---|
| `src/components/form/expressions/types.ts` | **new** — `IExpression`, `IExpressionSchema`, arg types |
| `src/components/form/expressions/useExpressions.ts` | **new** — catalogue fetch (`/system?action=expressions` + `expressions_url`) |
| `src/components/form/expressions/useRenderExpression.ts` | **new** — Explain seam |
| `src/components/form/expressions/ExpressionField.tsx` | **new** — Visual⇄Text shell + Explain |
| `src/components/form/expressions/ExpressionBuilder.tsx` (+ argument/group/modal files) | **new** — ported visual tree |
| `src/components/form/expressions/*.stories.tsx` | **new** — mock catalogue + mock LSP |
| `src/components/form/fields/template/TemplateField.tsx` | edit — "Use Expression" toggle → render `ExpressionField` |
| `src/components/form/engine/FormEngine.tsx` / `fields/Field.tsx` | edit — thread `is_expression` value plumbing |
| `src/components/form/index.tsx` | edit — exports |

## Phases (each ends at a STOP — user verifies before commit)

### Phase 0 — Foundation (unblocked) — DONE pending verify (2026-06-09)
- [x] `types.ts` (`IExpression`, `IExpressionValue`, `IExpressionSchema`,
      `IExpressionSchemaArg`, `ExpressionDefaultValue`)
- [x] `useExpressions` — `useFetch('system?action=expressions&context=ui')`,
      `expressionsUrl` merge (marks `from_server`/`from_both`), `override`/
      `errorOverride` seams, cached
- [x] `useRenderExpression` seam — `render(value, expressions) => Promise<string>`.
      **Interim impl is client-side** (`renderExpressionToText` walks the AST
      using the catalogue: infix for operators, join for `&&`/`||`, function
      form otherwise) — decoupled, no session needed; swaps to server
      `render-expression` in one place. (Design said `dpql/serialize`; chose
      client-side as it's session-free and gives a real string today.)
- [x] `mockExpressions.ts` fixture (real `==` / `&&` / `contains` entries)
- [x] `Foundation.stories.tsx` — catalogue count/names + rendered AST;
      play test passes; verified visually
- [x] prod typecheck + base typecheck clean

### Phase 1 — TemplateField expression mode + `ExpressionField` shell — DONE pending verify
- [x] `TemplateField`: "Use Expression" / "Use value" controls in the More
      menu, gated on `supports_expressions`; seeds `{ args: [] }`
- [x] When `isExpression`, render `ExpressionField` (main + disabled branches)
- [x] `ExpressionField` shell: holds the AST, **Visual ⇄ Text toggle**
      (placeholders for now), Explain button (`useRenderExpression`), live
      preview of the current expression
- [x] Value plumbing: `FormEngine.handleValueChange` detects an
      `is_expression` value and stores the canonical sibling shape
      `{ type, value:<AST>, is_expression:true }`; passes `is_expression`
      down to `TemplateField`
- [x] Stories: `Default`, `Empty`, `ViaFormEngine` (round-trip),
      `ToggleInFormEngine` (verified live: bool field → Use Expression →
      editor; → Use value → back). Barrel exports added.
- [x] Regression: jest 267/267, form play tests pass (only pre-existing
      `OnValidityChange` fails)
- Note: expression-aware **validation** deferred to Phase 4 (an empty
  expression currently shows the base-type validation error).

### Phase 2 — Text mode (DPQL) — DONE pending verify
- [x] `ExpressionField` Text mode renders `DpqlEditor` (via its ref for
      parse/serialize)
- [x] Boundary glue: parse-on-edit (debounced 300ms) `text→AST`;
      serialize-on-enter `AST→text`; flush-parse on switch-to-Visual
- [x] DPQL-context: optional `provider`/`recordType` passed through when
      supplied; parse/serialize work without a provider (only `@field`
      completions are reduced) — matches the design's worst-case note
- [x] `dpqlMockLsp.ts` — compact mock-socket LSP (initialize / parse /
      serialize / validate / completion); `dpql/parse` echoes the typed
      text into an `==` AST for deterministic verification
- [x] Story `TextMode` — types DPQL → parse → the Parsed preview reflects
      it (verified in real chromium). 5/5 ExpressionField play tests pass.
- Note: serialize-on-enter is best-effort if the LSP session isn't ready
      yet; matters mainly when coming from a Visual-built expression
      (Phase 3).

### Phase 3 — Visual ExpressionBuilder — DONE pending verify (core)
- [x] `ExpressionBuilder.tsx` — recursive tree: function `Select` (filtered
      by return type), operands, AND/OR groups, add/remove condition,
      recursion via `level`/`nested`
- [x] **Operands render through `TemplateField`** (→ literal / template /
      nested expression via the Phase 1 toggle) and `AutoFormField` for
      `any`-typed operands. No re-port of qorus-ide's operand stack.
- [x] `returnType` filters the function list; nested-expression ↔ value
      conversion (the operand "fx"/Use-Expression toggle + "use value")
- [x] Stories: `Default` (`==` + operands), `Empty`, `Group` (`&&` tree +
      Add condition), `ReadOnly`. 4/4 play tests pass; verified visually
      (nested AND tree with per-operand type pickers).
- [x] Regression: jest 267/267, form play tests pass (only pre-existing
      `OnValidityChange`)
- **Deferred to a polish pass** (documented): wrap/unwrap, the
  `types_mismatch` confirm modal + full type-compat filtering, varargs
  "add argument" for non-group expressions, fullscreen/focused editing,
  AI-assist button. The core build/edit/group/recurse flow is complete.

### Phase 3b — visual polish to match qorus-ide — DONE pending verify (2026-06-10)
- [x] Bumped ReQore **0.68.3 → 0.68.5** (matches the IDE; devDep + peer
      range). Full suite still green (188/189, jest 267).
- [x] Rebuilt `ExpressionBuilder` to mirror qorus-ide's layout: each
      expression is a dashed-border **card** titled by the function picker
      (`Σ` chip); operands laid **horizontally** (label on top, field below;
      `fluid` cards + 220px leaf width so they sit in a row and wrap
      responsively); tiny-uppercase `LABEL * [type]` labels; **AND/OR
      convert** buttons (`.expression-and`/`.expression-or`); `&&`/`||` as
      group cards (`IF group`/`AND group`/`OR group`, `.expression-group`)
      with AND/OR separators + Add condition + per-condition remove; per-
      level `main:darken:${level}` tint. Picker always keeps the selected
      expression even when its return type doesn't match the filter.
- [x] Stories rewritten to mirror foxhoundn's IDE stories using the
      **`.expression` count** convention + the `.expression-and/or`
      interaction (1→2→3). 11/11 play tests pass; verified visually vs `:6009`.
- [x] **Live story** (`ExpressionField › Live`, `tags: ['!test']`,
      `parameters: { live: true }`) — fetches the REAL catalogue (no
      `expressions` override), mirroring the DpqlEditor live stories.
      `.storybook/preview.tsx` instance is now env-configurable
      (`REACT_APP_QORUS_INSTANCE` || hq default). Full suite **189/189**
      (Live excluded from the offline runner; defaults to hq when env unset).
- Verification gap (honest): could NOT render-verify the Live story against
      real data — `localhost:8012` returns the catalogue to curl but sends no
      CORS header for the storybook origin (browser blocks the fetch), and I
      have no `hq:8092` token. The data path is proven via curl (121
      expressions) and the wiring mirrors the working DpqlEditor live pattern;
      the user verifies by running storybook with their token/instance.

### Phase 3c — faithful mock + offline parity with the IDE — DONE (2026-06-10)
- [x] **Rewrote `mockExpressions`** as a faithful subset of the LIVE catalogue
      (captured via curl): `==`, `<`, `>=`, `&&`, `||`, `contains`,
      `starts-with`, `ends-with` with the REAL arg types (`richtext` strings,
      `any` comparators), `label_after` operator words ("contains", "starts
      with", "=="), and the Ignore Case bool. This is why the offline stories
      were looking worse — the old 3-entry mock used `any` for `==` (→ bulky
      type-pickers) and omitted operator words.
- [x] **`WithComplexValue` now uses qorus-ide's EXACT value** (`&&[ ||[contains,
      &&[starts-with, starts-with], >=], ends-with, < ]`) → 6 expression cards
      across 3 groups; was a flat 2-card `&&`.
- [x] **Delete is now a card action** (`onRemove` prop → `expression-group-remove`)
      instead of a sibling button. The sibling stole flex width and forced
      operands to wrap vertically; as a card action the cards fill width and
      operands lay out **horizontally** — matching the IDE.
- [x] Verified side-by-side vs `:6009` at the same viewport: nesting, function
      chips, horizontal operands, operator words, group containers all match.
      12/12 expression play tests; full suite 188/189 (pre-existing flaky only).

### Phase 3d — operand layout: flex-fill (the real refinement) — DONE (2026-06-10)
- [x] Root cause of "old / crooked / unaligned": operands sat in **fixed
      220px boxes**, left-bunched with dead gaps, fields `fluid={false}`.
      Compared at full width (`:6007`) the IDE spreads operands across the
      whole row.
- [x] Reworked: flattened the operand row (label_before / column / label_after
      as flat siblings), each operand column `flex: 1 1 200px` (nested
      expressions `1 1 100%`), field now `fluid` (fills its column). Result:
      operands fill the row evenly with roomy fields, operator words centered
      in the gap — matches the IDE's refinement. eslint clean, 12/12 play
      tests, full suite 188/189.

### Phase 4 — Explain + validation + polish — DONE pending verify
- [x] Explain panel renders `useRenderExpression` output (done since Phase 1;
      works in Visual + Text modes)
- [x] **Expression-aware validation** — `_validateField` short-circuits on
      `field.isFunction`: an expression with a chosen `exp` is valid; an
      empty one reports "Expression operation is required". FormEngine passes
      `isFunction` from the field value's `is_expression`. Verified live (the
      FormEngine invalid banner clears for a valid expression) + a story guard.
- [x] Full pass: prod typecheck, eslint, jest 267/267, form play tests pass
      (only pre-existing `OnValidityChange`)
- [ ] When the server transport lands, swap `useRenderExpression` impl
      (one file) — awaiting the meeting decision
- Deferred (optional): fullscreen/focused-editing affordance

### Checks (final)
- [x] Typecheck, lint, jest, storybook play tests pass
- [ ] **STOP — user verifies in browser** before commit

## Open decisions

- **Explain transport** — REST `?action=render-expression` vs LSP
  `dpql/explain` vs interim approximation. Server ask in
  `/tmp/render-expression-exposure.md`; user raising it at the
  2026-06-10 meeting. Until then: interim seam impl.
- **DPQL text-mode context** (Phase 2) — how to bind a generic field
  expression's "fields" when there's no data provider.

## Out of scope

- `server_expression_handling` filtering nuances; AI-assist button;
  wiring concrete consumers (alert-rule editor is qorus-ide-side).
