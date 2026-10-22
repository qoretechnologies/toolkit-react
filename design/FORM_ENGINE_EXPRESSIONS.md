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

**Field paths (qorus#646).** The server reads a field path written with accessors (`@orders[*].id`, `@prices{*}`, `@items[0].id`, or the same inside `$record:{…}`) into accessor operations: `list_wildcard`, `hash_wildcard`, `wildcard_item`, `index` and `key` over record fields. An expression made only of those is read as the path it is (`fieldPath.ts`). The Visual tab draws it as one display-only chip, the chip a record-field operand has (`record: orders[*].id`), not as an operation with a source and a body. It is edited on the Expression tab, and the operand's menu replaces or removes it. The row summary, the Text view's text of an unfinished expression, and the server's rendering (Explain, the Preview, the read view) read it the same way: the server is asked to render the path as the reference it reads as. What is stored is not changed.

**Never offered for picking.** A catalogue entry flagged `internal` (`wildcard_item`, which DPQL does not write: it is drawn only inside the wildcard that makes it) is left out of the operation list and the Wrap list (`isOfferedForPicking`). The flag is the server's, with no rule by name in reqraft.

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
   need a space on at least one side, so a date or a path never triggers a
   probe.
2. `dpql/parse` on the shared probe document (below), debounced 400 ms.
3. `classifyTypedText` — `switch` when the text could not be a literal of
   the field's declared type (the form's own `validateField` answers that),
   `offer` when it could, `none` otherwise.

**Always an offer.** Since 2026-10-22 (David's review: "@pos + @bezeichnung"
became an expression without asking) a detected expression is only ever
OFFERED - "Use as expression", or the cross to keep the text - whichever
the verdict: text that cannot be a literal of the field's type stays, and
the field says it refuses it, beside the offer. The author chooses. An
accepted offer carries an Undo that restores the exact text, and a declined
text is never asked about again. (Before, text that could not be a literal
switched at once, and on a form's tabs every detection did.)

**Where it runs.** Wherever a field takes free text and can hold an
expression: a `string` (constrained or not), `binary`, `hash`, and the numbers,
which are typed freely now (`int` and `float` no longer render
`input[type=number]`; text that is not a number is offered). On a form's Value ·
Expression · Visual tabs it runs on the Value tab whenever that tab is written
as text, the untyped `any` / `auto` options included: before 2026-10-22 an
untyped option's Value tab was left out, because the form forbids it custom
values, and an expression typed there was kept as text (story
`ExpressionTypedOnAnUntypedValueSwitchesToo`). Expression-builder operands and
list items do not detect: they are parts of an expression already.

**On tabs too.** The offer is under the Value tab's text; accepted, the field
moves to the Expression tab, with an Undo there that puts the text back on
Value.

**An undone switch is asked about again when the text cannot stay.** Undo is
the author keeping the text as a value. Text that can be a value of the field's
type (`a + b` on a `string`) is then left alone, as any declined text is. Text
that cannot (`12 + 2` on a whole number) is a value the field refuses: put back,
it shows the refusal and the "Use as expression" offer beside it, in every
layout (2026-10-22, David on `ExpressionTypedOnValueSwitchesWithUndo`: the user
is to be prompted). The offer's cross keeps the text, and nothing asks again.

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

## What can be written at the caret: one completion list

*Added 2026-10-22. As-built (qorus#646, David's decision on the Text view's
two lists).*

The Text view has one list for what can be written at the caret: the
completion list (`CompletionMenu`). Typing opens it, as before, and so does
a click, a tap or Tab into the text (`completeOnClick`: `SmartEditor` reads
the caret the page put there and asks at it, `openAtCaret`). reqore's
browse list (`tags`) is not used in a DPQL editor that completes on a click;
a `DpqlEditor` with templates does by default, and the expression Text view
always does.

What the list offers is the server's answer at the caret with the field's
templates merged in where a value can be written (`dpqlCompletionsWith`):
where the server offers values (anything but keywords and operators), or,
where it offers nothing or there is no server, where the text says a value
can go (`dpqlExpectsValue`: an empty text, after an operator, a bracket or a
comma, or a reference being written). The server answers nothing in an
empty document, and operators after a value (`12 |`, `$record:{pos}|`), so a
pick is always a value where one can stand: `12 pos` cannot be written. Rows
are flat, the template's group and type on its detail line; after an `@`,
only the templates that are the record's fields, and a field the server and
the catalogue both offer is listed once. Where nothing is offered after an
`@`, the list says "No record fields here" (`dpqlEmptyCompletionMessage`;
not with no server, which might know a record).

It offers only what makes a value: not a template's context alone
(`$data:`, `$qore-expr:` - the server offers every one "requires argument",
offers nothing after it, and refuses it, DPQL-E033); after a `$` with
nothing to offer it says "No templates here". A click or tap on a chip lists
what can stand in its place (asked at the chip's place, the chip taken out)
and the pick replaces it. What a pick takes the place of is only what was
typed in the text the caret is in, never across a chip, and an operator goes
in apart from the value before it (`pos == `).

The templates beside the text (`.expression-text-template-picker`) stay, to
browse a catalogue as it nests. Their pick goes at the end of the text, so
they cannot be used where a value cannot be written there, and say why
(`NO_VALUE_AT_THE_END`).

A template picked takes the place of the reference being written where it
goes: a `$` or `@` with no more than part of a name after it
(`dpqlReferenceBeingWritten`; not an `@` in a string, which is text, nor a
whole reference). The completion list's inserter does this; `SmartEditor`
also has a Slate plugin on its editor's `insertNodes` that does it for any
chip put in at the caret, in the same change.

What does not parse is said in the server's words, under the text: the
server publishes what `dpql-parse` says of a document on every open and
change (`publishDiagnostics` in `QorusLspWebSocketHandler`). Two things are
said otherwise:

- A reference half-typed at the caret is not a mistake while its list is
  open or on its way: its error (a `$` alone, an `@` alone) is held, and
  said once the list is put away (`SmartEditor`, by its converter's
  `referenceBeingWritten`).
- An unfinished expression is written with a placeholder for each part not
  chosen yet (`… > …`). The server refuses each ("Unexpected character
  '…'"); the editor says once what to do instead: "Fill in each … (the
  parts not chosen yet)." (`presentDpqlDiagnostics`).

The stories' stand-in server answers as the server does, captured on
professor: the diagnostics (DPQL-E030 and E031 for a `$`, E003 for an `@`,
E001 for what follows a whole expression and each unexpected character),
and completion by where the caret is (nothing in an empty document, the
record's fields and the template contexts where a value can go, operators
after a value, nothing in a word being typed, and no fields for a document
with no record).

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

## A condition field's tabs

A field its host marks as a condition (`metadata.condition`, `isConditionOption`) keeps the tab names every
field has: Value · Expression · Visual. A condition is written as an expression, so the Expression tab's
hover says so ("Write the condition as an expression", `conditionTooltip`) and the Visual tab's hover says
"Build the condition visually". The tab was called "Condition" for a while, which read as a fourth way to
enter a value (qorus#646, David: "what is "Condition"? Is it meant to be an expression?"). Without tabs, the
classic field's More menu still offers "Write a condition", a verb that says what the item does. Stories:
`ConditionOptionTabsSayExpression` (+ `OnAPhone`).

## A field that takes templates and no expression

A field that takes templates but not expressions (`supports_templates` without `supports_expressions`, which
servers turn on by default, so mostly code and contract editors) has no Expression or Visual tab. Where its
value is written as text (text, a whole number, a number, an untyped value), the text takes templates as
chips from the lists it opens, so it has no tabs at all: a Template tab beside it was a second way to do the
one thing (qorus#646, David's decision). What it holds is read from the text, as on any Value tab: a lone
template in an untyped field takes the template's type. A field whose value has its own control (a yes/no, a
date, fixed choices) keeps Value · Template, since the Template tab is the only place it takes one.

Where a template comes from, as the host says (`templateBadge`, e.g. the IDE's "the app action that captures
it"), is shown in every list a template is picked from: first in the row's detail in the list a `$` opens
(`templateCompletionItems`), and leading the row's description in the list a click opens (`useTemplateTags`);
`withTemplateSources` marks the catalogue. It was shown only beside the template held on the Template tab.
Stories: `TemplateOnlyOptionIsItsValue` (+ `OnAPhone`), `OptionWithAnyType`, `TemplateBadgeFromTheHost`;
tests: `__tests__/templateSources.test.tsx`.

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
