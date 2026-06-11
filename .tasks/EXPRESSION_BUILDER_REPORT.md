# TASK — Expression Builder verbatim re-port

**Status:** Phases A + B + C DONE & verified (uncommitted), including the
follow-ups (shell-chrome polish, the `validations` `'expression'` case — both
ticked in Phase C below; the `'expression'` validator gained jest coverage
2026-06-11). The ported, IDE-matching builder is live in `ExpressionField` /
FormEngine. Phase D (server render-expression) + E (IDE consumes reqraft) are
out of scope.
Design:
`design/EXPRESSION_BUILDER_REPORT_STRATEGY.md`. Supersedes the from-scratch
visual builder in `.tasks/FORM_ENGINE_EXPRESSIONS.md` (plumbing retained).

Method (Filip): copy IDE components **and their tests** verbatim → get them
1:1 + green → then improve. Compare to qorus-ide Storybook **:6007** between
phases. **No commits until user verifies.**

## Surface area

| Area | reqraft path | IDE source |
|---|---|---|
| Type-compat helpers | `src/helpers/expressions.ts` (NEW) | `qorus-ide/src/helpers/expressions.ts` |
| `areQorusTypesCompatible` | `src/helpers/…` | `qorus-ide/src/helpers/functions.tsx` |
| `validateField` export | `src/helpers/validations.ts` | (export the existing `_validateField`) |
| Select flat/intent | `src/components/form/fields/select/Select.tsx` | `qorus-ide` Field/select |
| TemplateField expr path | `src/components/form/fields/template/TemplateField.tsx` | `qorus-ide` Field/template |
| ExpressionBuilder | `src/components/form/expressions/builder/**` (NEW) | `qorus-ide/src/components/ExpressionBuilder/**` |
| Builder tests | `…/builder/*.stories.tsx` | `qorus-ide/src/stories/Components/ExpressionBuilder.stories.tsx` |

## Phase A — Field-stack parity (leaf) — DONE & verified (2026-06-10)

- [x] `src/helpers/expressions.ts` — verbatim port of getArgumentType,
      argumentMatchesType (from IDE expressions.ts) + areQorusTypesCompatible
      (from IDE functions.tsx); imports adapted (getQorusTypes/defaultQorusTypes
      from reqraft `useQorusTypes`). Typechecks.
- [x] `validateField` — already exported from validations.ts (no change needed)
- [x] `SelectFormField` — `flat` + `intent` now forwarded (additive; defaults
      preserve current look). This is the fix Filip named: "make it flat and
      small and it looks the same." The chip can now go borderless.
- [x] **GATE:** jest 267/267, full storybook **188/189** (pre-existing flaky
      only). No regression from the shared Select change.
- Note: `TemplateField`'s `allowFunctions`/`isFunction` mechanism moved to
  Phase B — it's circularly dependent with the ExpressionBuilder (TemplateField
  renders the builder; the builder renders TemplateField), so they land
  together. Phase B builds in a NEW dir so the current build stays green.

## Phase B — Verbatim ExpressionBuilder + tests — DONE & verified (2026-06-10)

- [x] 9 IDE files copied verbatim into `src/components/form/expressions/builder/`
      (index.tsx ~1260 LOC + item/argumentWrapper/argumentLabel/argumentDetail/
      argumentInfo + the two confirm modals + renderTemplate). JSX/markup/props
      preserved; only imports/hooks/types/seams changed.
- [x] Seams: AiAssistanceAction **removed**; `renderTemplate` rewritten to use
      reqraft `useRenderExpression` (client-side, no Creator-WS);
      `useRegisterHintView` **stubbed**.
- [x] `TemplateField` — additive `allowFunctions`/`isFunction`; when set, renders
      the ported builder. Absent → unchanged (field migration safe).
- [x] Adaptations: `Select` `defaultItems`→`items`; `Select.onChange` single-arg;
      catalogue passed as `override` (replaces fetch) **and threaded through the
      group recursion** so offline/CI is deterministic (badge = mock count, not
      the live 121). `auto`/`Select`/`TemplateField` import aliases.
- [x] Ported `ExpressionBuilder.stories.tsx` (the IDE play tests) — offline via
      `mockExpressions`. **10/10 pass.**
- [x] **GATE:** renders **1:1 vs :6007** (verified by screenshot — chips, underline
      fields, operator words, group nesting, type-pickers, collapse/Explain all
      match). eslint clean, jest 267/267, full suite **198/199** (pre-existing
      flaky only). Old from-scratch builder left intact; build green.
- Open follow-ups (Phase C / refinements): wire into `ExpressionField`;
      `validations` has no `'expression'` type case yet (per-expression validity
      tag always "valid"); `useRenderExpression` is the client-side approximation.

## Phase C — Re-wrap reqraft features — DONE & verified (2026-06-10)

- [x] `ExpressionField` Visual mode now renders the **ported** builder
      (`./builder`); Text = `DpqlEditor`; Explain/Preview from the shell.
      Adapted: `onChange (value, remove?)`, `returnType` cast, and
      **`localTemplates={{ items: [] }}`** (the builder's `filterTemplatesFunc`
      does `templates.items.filter(...)` — undefined templates crashed it;
      caught via the error boundary during verify and fixed).
- [x] From-scratch `ExpressionBuilder.tsx` + its stories **retired** (deleted);
      no remaining references.
- [x] **GATE:** FormEngine field → ExpressionField → ported builder verified
      (ViaFormEngine + the toggle path). jest 267/267, full suite **193/193**
      (the flaky `OnValidityChange` even passed). HEAD unchanged.
- [x] **Shell cleanup (done 2026-06-10):** Visual mode now renders ONLY the
      ported builder (it has its own Explain). The shell's Explain + Preview +
      Explanation are scoped to **Text mode** (where the DpqlEditor has none).
      ExpressionField play tests updated to assert the builder rendered.
- [x] **Danger-border fix (done 2026-06-10):** three parts —
      (1) ported the IDE's `validations` **`'expression'` case** (reads the
      catalogue from `field.expressions`); (2) `FormEngine.isOptionValid` now
      passes `isFunction` from the field value's `is_expression` (the per-field
      red intent used the base-type check); (3) `ExpressionField` defaults
      `returnType` to `'auto'` so a valid expression card renders `muted` not
      `danger`. Verified: the FormEngine expression field is no longer red.
      eslint clean, jest 267/267, full suite 192/193 (pre-existing flaky only).
- [x] **Oversized chips/pickers fix (2026-06-10):** root cause — the IDE's
      `Select` spreads `{...rest}` into its rendered ReqoreButton/Dropdown/Tag,
      so the builder's verbatim `size='tiny'` reaches ReQore; reqraft's
      `SelectFormField` accepted `size` in its interface but **never forwarded
      it** (same class of bug as `flat`/`intent`). Forwarded `size` to all four
      render branches (bound as `componentSize` — plain `size` would shadow
      lodash's `size(items)` badge count). Chips now tiny, type pickers
      compact, operand rows no longer wrap — density matches the IDE.
      jest 267/267, full suite 192/193 (pre-existing flaky only).
- Known seam: reqraft's `SelectFormField` still doesn't rest-spread like the
      IDE's — `flat`/`intent`/`size` are forwarded explicitly; any other
      pass-through prop the verbatim IDE markup relies on needs the same
      treatment if a gap shows up.
- [x] **Type-picker parity (2026-06-10):** `AutoFormField` now matches the
      IDE's AutoField — unresolved type shows **`auto`** as the selected picker
      label (not a "Select a type" placeholder; `auto` is not a pickable item
      so the badge count stays identical to the IDE's 9/14), and the hint is
      the IDE's orange minimal `ReqoreTag` **"Please select data type"**
      (was a grey info tag). The 3 AutoFormField story assertions updated.
- [x] **AI-assist slot (2026-06-10):** the IDE's purple hover button on each
      expression card is `AiAssistanceAction` → `AiButton` (sends the selected
      expression's context to the IDE's AI chat). It was one of the three
      deliberate port seams — `AiButton` depends on IDE-only infrastructure
      (AI context, SystemStore, QonsoleStore, Creator-WS) that reqraft doesn't
      have. Added **`extraActions?: IReqorePanelAction[]`** to the ported
      builder (threaded through the group recursion, prepended exactly where
      the IDE renders the AI action) so the IDE injects its AiButton at
      Phase E. jest 267/267, full suite 192/193 (pre-existing flaky only).
- [x] **`extraActions` upgraded to a factory (2026-06-10):** a static array
      could not reproduce the IDE's button — the IDE builds
      `AiAssistanceAction({ context: selectedExpression })` *inline per card*.
      The seam now also accepts
      `(ctx: { selectedExpression?, value? }) => IReqorePanelAction[]`,
      resolved inside each `Expression` with that card's selected schema —
      so Phase E restores the AI button 1:1, per-card context included.
      Proven by the new `WithInjectedExtraActions` story (hover → injected
      action present; 11/11 ported play tests). Full suite **194/194**
      (even the flaky `OnValidityChange` passed), jest 267/267.
- Ops note: the Storybook dev server reliably wedges on HMR after edits to
      these files (symptom: play tests fail in ~2ms with
      `ReferenceError: __test is not defined`, preview stuck on spinner).
      A clean restart fixes it every time — restart before trusting failures.

## Phase D — Server (tracked, not in reqraft)

- [x] `render-expression` over LSP/REST; swap `useRenderExpression` —
      picked up 2026-06-10 in `.tasks/RENDER_EXPRESSION_LSP.md` (branch
      `feature/render-expression-lsp`): new LSP `dpql/renderExpression`
      (server code written, deploy pending) + server-first hook with
      client-side fallback. Design: `design/RENDER_EXPRESSION_TRANSPORT.md`.

## Phase E — Dedupe (not now)

- [ ] IDE consumes reqraft's builder
