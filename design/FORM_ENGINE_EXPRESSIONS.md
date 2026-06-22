# Form engine — expression support (visual + DPQL text)

Locked design + rationale for adding **expression** values to the
ReqRaft form engine: any field can hold a Qorus expression, edited two
interchangeable ways — a **visual builder** (ported from qorus-ide) and
a **DPQL text editor** (ReqRaft's existing `DpqlEditor`) — plus an
**Explain** button.

Execution checklist: [`.tasks/FORM_ENGINE_EXPRESSIONS.md`](../.tasks/FORM_ENGINE_EXPRESSIONS.md).
Server contract reference (memory): "Qorus expression/DPQL contract".
Server ask for the Explain transport: `/tmp/render-expression-exposure.md`.

## Background — the one insight everything rests on

A Qorus **expression** is an AST: `{ exp, args }` (args are literals,
field refs, templates, or nested expressions; `&&`/`||` are AND/OR
groups). **DPQL is the text serialization of that same AST.** Verified
live (2026-06-09, `wss://localhost:8012/lsp`):

- `dpql/parse("1 == 1")` → `{ is_expression:true, value:{ exp:"==", args:[…] }, inferred_type:"bool" }`
- `dpql/serialize({exp,args})` → `{ dpql, richtext }`

So the **visual builder and the DPQL editor are two editors for one
value.** That value, stored on a field, is `is_expression: true` + the
AST. `parse`/`serialize` bridge text ↔ AST; the visual builder edits the
AST directly.

This is *new* integration: in qorus-ide the visual `ExpressionBuilder`
is purely visual (no DPQL), and DPQL is used only for alert-rule `match`.
ReqRaft unifies them.

## Goal

1. A field declared `supports_expressions: true` can be toggled from a
   literal/template into an **expression**.
2. The expression is editable in **Visual** mode (ported builder) and
   **Text** mode (DPQL via `DpqlEditor`), switchable, over the same AST.
3. An **Explain** button renders the expression to readable text.
4. Operands reuse what we already built — `AutoFormField` / `FormField`
   — rather than re-porting qorus-ide's field stack.

## Verified server contract

| Need | Transport | Status |
|---|---|---|
| Expression catalogue (operators/functions) | REST `GET /api/latest/system?action=expressions` | ✅ live; `useFetch` |
| Per-provider extra expressions | REST `…/apps/{app}/actions/{action}/expressions` (`expressions_url`) | ✅ merge with system list |
| Text ↔ AST | LSP `dpql/parse` · `dpql/serialize` · `dpql/validate` | ✅ live; `DpqlEditor` session |
| **Explain** (AST → readable text) | `render-expression` | ⚠️ **Creator-WS only** — see "Explain transport" |

Value shapes (from the live server):
- catalogue entry: `{ name, display_name, short_desc, desc, symbol, type, return_type, ui_return_type, args[], varargs, subtype, groups, role }`
- expression value: `{ is_expression:true, value:{ exp:string, args:IExpression[] } }`
- `IExpression` arg: `{ type, value }` (literal/template) **or** `{ is_expression:true, value:{exp,args} }` (nested)

## Locked decisions

- **Both modes, one AST.** Visual + text are views of the same
  `{exp,args}`; `parse`/`serialize` convert at the mode boundary.
- **Attach at `TemplateField`** (matches qorus-ide). A "Use Expression"
  entry sits beside the existing template toggle; FormEngine-driven
  forms get it for free. The field opts in via `supports_expressions`.
- **Operands render through `AutoFormField`/`FormField`**, not a
  re-port of qorus-ide's `TemplateField→auto`. An operand is "a value of
  a type" — exactly what `AutoFormField` (built this session, with the
  type picker) already does, and it recurses into expressions via
  `TemplateField` naturally.

  **Revised 2026-06-10 (EXPRESSION_BUILDER_REPORT / FIELD_STACK_REPORT):**
  superseded by the verbatim re-port — operands now render through the
  IDE's own `TemplateField → auto` recursion (`TemplateField
  component={auto}`), matching qorus-ide exactly. The architecture-table
  row below ("operands → `AutoFormField`") reflects the original decision;
  see `design/EXPRESSION_BUILDER_REPORT_STRATEGY.md` for the supersession
  rationale.
- **Explain behind a seam.** A `useRenderExpression` hook abstracts the
  transport so the Creator-WS decision doesn't gate the editor (see
  below).
- **Catalogue via `useFetch`**, cached (it's static per server version);
  merge `expressions_url` extras like qorus-ide's `useExpressions`.

## Architecture

New subsystem `src/components/form/expressions/`:

| File | Role |
|---|---|
| `types.ts` | `IExpression`, `IExpressionSchema`, arg types (ported) |
| `useExpressions.ts` | fetch `/system?action=expressions` (+ `expressions_url` merge) via `useFetch`; cached |
| `useRenderExpression.ts` | **the Explain seam** — `(ast) => Promise<string>`; transport swappable |
| `ExpressionField.tsx` | the shell `TemplateField` renders in expression mode: **Visual ⇄ Text toggle**, Explain button, owns the AST value |
| `ExpressionBuilder.tsx` (+ `argument*.tsx`, `group`, `confirm*Modal`) | the **visual** tree (port); operands → `AutoFormField` |
| `ExpressionBuilder.stories.tsx`, `ExpressionField.stories.tsx` | mock-LSP + mock-catalogue stories |

Touched: `TemplateField.tsx` (Use-Expression toggle + render `ExpressionField` when `is_expression`), `FormField`/`FormEngine` value plumbing for `is_expression`, the form barrel (exports).

**Flow:**
```
FormEngine option { supports_expressions:true }
  └ TemplateField  ── "Use Expression" ──►  is_expression:true
        └ ExpressionField  (value = { exp, args })
            ├ [Visual]  ExpressionBuilder ──► edits AST; operands = AutoFormField
            ├ [Text]    DpqlEditor ──► text; parse()→AST / serialize()←AST at the boundary
            └ [Explain] useRenderExpression(AST) → readable string
```

## Explain transport (open decision — does NOT block build)

`render-expression` is Creator-WS-only today. The editor is built behind
`useRenderExpression`; until the server exposes it over REST or LSP:
- **interim:** approximate via `dpql/serialize`'s `richtext`, or render
  Explain disabled-with-tooltip.
- **target:** server adds `dpql/explain` (preferred) or
  `?action=render-expression` (REST). Then `useRenderExpression` swaps in
  one place. Tracked in `/tmp/render-expression-exposure.md` (server ask).

## DPQL-context nuance (design item, resolve in Phase 2)

The `DpqlEditor`'s primary use (alert rules) binds a provider/record
context for `@field` completions. A *generic field expression* may have
no provider — its "fields" are the field's **templates** (`$local:…`).
Phase 2 decides how the text-mode editor binds context: pass the field's
templates/return-type, and bind a provider only when the field supplies
one. Worst case, text mode still parses/serializes correctly with no
provider; only completions are reduced.

## Out of scope

- `server_expression_handling` server-function-vs-qorus-function
  filtering subtleties (port if a consumer needs them).
- The AI-assistance button qorus-ide's builder has.
- Wiring specific consumers (alert-rule editor lives in qorus-ide).

## Migration impact

- Purely additive: a new opt-in field capability + new files. Fields
  without `supports_expressions` are unchanged.
- Stacks on the uncommitted AutoFormField / FormField / FormEngine work
  from the field-migration batch — must land/verify alongside it.

## Status

**Design locked 2026-06-09.** Server contract verified live. Scope: both
modes + Explain, attached at `TemplateField`, operands via
`AutoFormField`. Explain transport is an open server decision held behind
`useRenderExpression` and does not gate implementation. Revisions require
a "Revised &lt;date&gt;" note per the repo workflow.
