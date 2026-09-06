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

## Detecting an expression typed as plain text

*Added 2026-09-06. As-built.*

An author who never opens the expression view still types DPQL into the
ordinary editor. `TemplateField` notices, and what it does next depends on
the field's own type.

**A successful parse means nothing.** This is the finding the whole design
rests on, and it is counter-intuitive enough to be worth stating plainly.
Verified against the live LSP: `dpql/parse` returns `success: true` for
`hello`, for `42`, for `2026-09-06` and for `@a`. A bare literal is a valid
DPQL program, so "does it parse?" cannot separate an expression from a
value. What separates them is the shape of the AST that comes back:

| typed text | `exp` | verdict |
|---|---|---|
| `hello`, `42`, `2026-09-06`, `@a` | `value` | a literal |
| `$local:count` | `template` | a template |
| `@a > 5`, `"a" + "b"`, `toInt("5")`, `@n LIKE "a%"` | `>`, `+`, `toInt`, `like` | an expression |

Text that is not DPQL at all is safe on its own: `hello world`, `x@y.com`,
`a - b test` and `{"a":1}` all fail to parse outright.

**Three stages, in `helpers/dpqlDetection.ts`:**

1. `mightBeDpqlExpression` — a cheap lexical pass whose ONLY job is to keep
   a server round-trip off every keystroke. It decides nothing. `-` and `/`
   require surrounding spaces so a date or a path never triggers a probe.
2. `dpql/parse` on the shared probe document (below), debounced 400 ms.
3. `classifyTypedText` — `switch` when the text could not be a literal of
   the field's declared type (the form's own `validateField` answers that),
   `offer` when it could, `none` otherwise.

**Why the asymmetry.** Rewriting the string `a + b` into a concatenation on
a `string` field would destroy a value the author meant, so a type that
accepts any text is only ever OFFERED the switch. Text that could not be a
literal there was already an error the moment it was typed, so switching
costs nothing and explains the error. Every switch carries an Undo that
restores the exact text, and a declined text is never asked about again.

**Reachability.** The auto-switch only applies where the editor accepts free
text — a constrained `string` (identifier / `validation_regex`), `binary`,
`hash`. `int` and `float` render `input[type=number]`, which drops `@`, `>`
and spaces before any handler runs, so detection there is unreachable by
design of the editor and the ⋮ menu remains the way in. Pinned by a test.

**Template precedence.** `isValueTemplate` is deliberately loose (starts
with `$`, contains `:`), so `$local:count + 1` was being swallowed into
template mode with its arithmetic as dead text. A value that is not one
complete template token and carries an operator now stays in the plain
editor, where detection can reach it. A token standing alone
(`$local:count`, `$data:{1.field}`) still flips, unchanged.

**The probe document** (`components/dpqlEditor/dpqlProbe.ts`). One shared,
lazily-opened DPQL document for the whole app, reference-counted by
`useDpqlProbe` and closed when the last field using it unmounts. It is
cheap: `ReqraftLspClient` multiplexes every document over ONE socket per
endpoint and `initialize` runs once for it, so a probe is one extra
`didOpen` plus one server-side session — not a connection. It is still
shared rather than per-field, because a form with forty expression-capable
options would otherwise open forty sessions to ask the same question.

The document binds NO provider context; verified live, a context-less
`didOpen` still builds a session that `dpql/parse` answers on. It sends no
`target_type` either: detection asks whether the text is an expression, not
whether it is the right type — a mismatch is something to show the author
inside the editor, never a reason to refuse to open it. A probe never
throws; an unreachable instance simply leaves the typed text alone.

## Return-type checking

*Added 2026-09-06. As-built.*

`dpql/parse` has always been able to answer "can this expression's result
satisfy type X?" — it takes a `target_type` and returns `inferred_type`,
`type_compatible`, `auto_coercible` and a `suggested_fix`. Nothing in the
front end ever sent one, so it never answered.

`ExpressionField` now sends the field's own type with every parse, and
shows what comes back. Three outcomes, not two:

| the expression | shown |
|---|---|
| already fits | nothing |
| converts, and the conversion is TOTAL (a number used as text) | nothing |
| converts, but the conversion may FAIL (text used as a number) | a warning, with the conversion offered |
| cannot convert at all | a danger message, with the conversion offered |

The middle row is why the server grew `coercion_may_fail`: `canAutoCoerce()`
admits both kinds, and reporting a conversion that cannot fail is what
teaches authors to ignore the reports that matter.

`auto` and `any` are never sent as a target — they accept anything, so the
answer would always be "compatible" and the round trip would buy nothing. A
field offering a CHOICE of return types sends nothing either, rather than
asking about one of them arbitrarily.

**What the field cannot decide.** Whether text really denotes a number
depends on the text, which does not exist until the expression runs. So the
warning is a warning, not a refusal, and the value is checked again
server-side at run time — see `design/test-interface-object.md` in the qorus
repo. For that to be possible the FormEngine's stored envelope carries the
field's `type` beside `is_expression` and the AST, which is the type the
author was shown.

The same analysis lives in two server handlers (the LSP's `dpql/parse` and
the Creator WS equivalent); both were changed together. Deduplicating them
is a separate cleanup.

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
