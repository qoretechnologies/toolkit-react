# Expression Builder — verbatim re-port strategy

**Status:** locked 2026-06-10. Supersedes the *from-scratch* ExpressionBuilder
in `design/FORM_ENGINE_EXPRESSIONS.md` (Phases 3/3b/3c/3d). The plumbing
(catalogue hook, FormEngine `is_expression`, DPQL bridge, validation
`isFunction` case) from that batch is retained; the visual builder is replaced.

## Why we are redoing it

The first attempt **reimplemented** the visual builder on reqraft's own
primitives. That diverged from the team's stated method (Filip, 2026-06-10
call): *copy the IDE component verbatim — with its dependencies and its tests —
get it looking and passing 1:1, **then** improve.* The from-scratch version
never looked like the IDE and cost days of "why does it look worse" iteration —
exactly the danger Filip named (you can't tell a port bug from a deliberate
change). Nick on the call: the port "wasn't a good job done."

## The blocking finding (why it's not a trivial copy)

A verbatim copy of the IDE's `ExpressionBuilder` (1,857 LOC / 9 files) does NOT
compile against reqraft today, because **reqraft's shared field stack drifted
from the IDE** ("reqraft wasn't kept up"). Specifically:

- **The recursion lives in `TemplateField`, not ExpressionBuilder.** Operands
  render via `<TemplateField component={auto} allowFunctions isFunction={…}>`,
  and TemplateField recurses back into ExpressionBuilder. reqraft's
  TemplateField has **no `allowFunctions`/`isFunction`** — it uses a different
  mechanism (the Phase-1 "Use Expression" menu toggle).
- Missing helpers: `helpers/expressions` (`getArgumentType`,
  `argumentMatchesType`), `areQorusTypesCompatible`.
- `validateField` is private (`_validateField`) in reqraft.
- `SelectFormField` hardcodes `flat={false}` + `intent='info'` (the chip
  problem) — not externally controllable.
- IDE-only seams that can't come along: `AiAssistanceAction` (AI),
  `render-expression` over the Creator WebSocket (Explain), the hints system.

So the proper port = **re-faithful-ize the field stack first, then copy the
builder.** Decision (user, 2026-06-10): **re-port (option 1)**, not augment.

## What is kept from the from-scratch batch

- `useExpressions.ts` (catalogue hook — close to the IDE's)
- `useRenderExpression.ts` (Explain seam — matches the planned `onExplain`/LSP)
- `types.ts`, FormEngine `is_expression` plumbing, validations `isFunction`
- **`ExpressionField` DPQL text mode** — NET-NEW (the IDE builder is
  visual-only; DPQL text editing is the whole point of this branch)

## What is replaced

- `ExpressionBuilder.tsx` (from-scratch) + its stories + the mock-styling work.

## Drawbacks (accepted)

1. Touches `TemplateField` — load-bearing for the entire form engine + the
   just-landed field migration. Highest-risk surface in the library.
2. Two expression-on-field models collide (IDE `allowFunctions`/`isFunction`
   vs the Phase-1 toggle); the IDE model wins.
3. Never truly verbatim — AI dropped, Explain → `onExplain`/LSP seam.
4. Brings the deferred machinery (type-mismatch modals, type-compat) — more
   surface to own.
5. Follow-on: the IDE must then *consume* reqraft's builder or they drift again.

## Phases (Filip's method: copy + tests → 1:1 → improve)

- **A — Field-stack parity.** Port verbatim into reqraft (with their IDE
  tests): `helpers/expressions`, `areQorusTypesCompatible`; export
  `validateField`; bring `SelectFormField` to forward `flat`/`intent`; bring
  `TemplateField` to the IDE's `allowFunctions`/`isFunction` mechanism.
  **GATE:** the field-migration stories + jest still pass.
- **B — Verbatim ExpressionBuilder.** Copy the 9 files + the IDE's stories &
  tests; fix import paths; seam out AI (off) / render-expression (`onExplain`
  prop) / hints (stub). **GATE:** 1:1 vs `:6007`, ported tests pass.
- **C — Re-wrap reqraft features.** Visual = ported builder, Text =
  `DpqlEditor`, Explain = seam, inside `ExpressionField`; reconcile FormEngine
  `is_expression` to the IDE model. **GATE:** field-holds-expression story.
- **D — Server (out of reqraft).** `render-expression` over LSP/REST; swap
  `useRenderExpression`. (Filip/Nick file the server issue.)
- **E — Dedupe (out of scope now).** IDE consumes reqraft's builder.

Between every phase: open Storybook, **compare to `:6007`**, fix, then proceed.
No commits until the user verifies.
