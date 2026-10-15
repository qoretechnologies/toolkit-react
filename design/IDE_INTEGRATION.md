# IDE → reqraft integration checklist

When qorus-ide swaps its field stack to reqraft's ported components
(the "Phase E" consumption that the FIELD_STACK / EXPRESSION_BUILDER
batches were built for), the components are drop-in **except** for a set
of features that reqraft deliberately did not absorb — each because it
couples to an IDE-only system (app registry, live catalogues, per-user
saved state). Every one of these has an **injection seam** already in the
ported code; the IDE re-attaches its own implementation through that prop.

Nothing here is broken in reqraft. The risk is **silent regression** — a
feature disappearing because a seam wasn't wired. This file is the
checklist the IDE-integration PR ticks off so that can't happen.

## The seams

| Feature that regresses if skipped | Seam (reqraft prop) | What the IDE passes | If skipped |
|---|---|---|---|
| **Saved values** (Save-Value button + saved-value suggestions) | `TemplateField` / `AutoFormField` → `menuItems` | The IDE's existing `SaveValueButton` (it carries its own `useQorusStorage('savedValues')` context, so it works as-injected). The inert `allowSaving` / `showSavedValues` props stay for call-site parity. | Field renders, no save button, saved values unreadable — **silent** |
| **IDE-only field editors** for types reqraft doesn't port: `data-provider` (ConnectorField), `processor-mappings`, `tool-catalog`, `test-cases`, `active-windows`, `collection-documents`, `code-editor`, `option_hash`, the InterfaceSelector family (`mapper`…`value-map`), `connection` | `AutoFormField` → `componentOverrides={{ <type>: Editor }}` (dispatch at AutoFormField.tsx:340) | The IDE's editor component per type | The type renders the `Unknown type!` danger tag — **loud-ish** (visible, not a crash) |
| **Connection management** (inline create/edit on `connection` fields) | same `componentOverrides` entry for `connection` | The IDE's connection editor (it owns the CRUD/dialog/permissions) | No inline connection actions — **silent** |
| **App-action badges** (app logos/icons on template dropdown rows) | `buildTemplates` payload (`logo` field flows through to `image:` — templates.ts:192) | Nothing extra — feed templates from `system/getContextData` through `buildTemplates`; logos ride along for free | Templates render without app logos — **silent, cosmetic** |
| **AI assistance** in the ExpressionBuilder | `ExpressionField` → `extraActions` (panel-action array or `({selectedExpression, value}) => actions`) — forwarded to the builder and into every operand row. *Revised 2026-09-07:* the seam was declared on `ExpressionBuilder` only, but hosts mount the `ExpressionField` shell, and the builder's two operand `TemplateField` mounts did not pass it on — so it was unreachable from the component actually used and lost again inside any operand that was itself an expression. Both hops now forward it ([#116](https://github.com/qoretechnologies/toolkit-react/issues/116)). | The IDE's AI action button | No AI action on any expression card — **silent** (this is exactly what happened when qorus-ide adopted the shell) |
| **Markdown in descriptions** (field descriptions, the template list, and every description's card: a template chip's, a choice's, a schema section's, a DPQL reference's) | `FormEngine` → `markdownRenderer`; outside a form, `MarkdownRendererContext` (exported from the barrel) around the surface | The IDE's own markdown renderer (`renderIdeMarkdown`), so a description reads as the IDE draws markdown everywhere else | Descriptions and their cards show the markdown as written: `**`, backticks - **silent** |
| **Server-handled expressions** (server decides field/template acceptance per function) | `ExpressionField` → `serverHandled` + `expressionsUrl` (already plumbed) | The live `expressionsUrl`; set `serverHandled` | Offline catalogue only — **silent, degraded** |

## Notes

- "Silent" markers are the dangerous ones — they compile clean and only
  surface as a missing feature in the running IDE. Tick each row.
- What a `componentOverrides` editor is handed: `value`, never its own report coming back as a change
  (`useHostEditorValue`, `src/components/form/fields/auto/hostEditorValue.ts`). A host editor's last report,
  or one still on its way back, is handed down as the editor reported it - the same object - with `''` and
  `undefined` read as one empty value (`null` is a value of its own); anything else is a change from outside
  and is handed down as it is. Its `onChange` is one function for the life of the field. A host editor that
  replaces what it holds with any value it is handed that differs - the IDE's rich text does - otherwise lost
  what was typed after an emptied value came back a second way (qorus#646; story *Components/Form/Auto ›
  Host Editor Keeps What Is Typed When Its Report Comes Back*).
- A host's own debounced field tracks its reports as reqraft's fields do: `EmittedValues` / `useEmittedValues`
  (and the `TEmittedValuesEquals` type) are exported from the package root. `record` each report, ask
  `isEcho` once where an incoming `value` is committed (an echo is no change; anything else is), `includes`
  from a render, `settled` for what the parent will hold. Which values are the same is the caller's `equals`
  (default `Object.is`, under which `''`, `undefined`, `null` and an empty document all differ); the IDE's rich
  text passes one that reads them as one empty value (qorus-ide f1c58c2d0).
- A host's own debounced field keeps the edit it has not reported yet for whoever closes its editor:
  `usePendingEdit(send)` (and the `IPendingEdit` type) is exported from the package root. `hold(value)` where
  the edit is typed, `release()` where it is reported at once, by the pause or by a clear, and where a value
  from outside replaces it; `send` is called with what is held, and decides itself whether it is still a
  change. A read-first row's Done (and closing the row by its label) sends it before the row closes, Cancel
  and Escape drop it, and any other way out sends it as the field goes away. Without it, a value typed and Done
  pressed inside the field's pause was lost: the pause's timer died with the field (qorus#646; story
  _Form/Engine/FormEngine › Done Straight After Typing Keeps The Edit_).
- Most seams are story-tested in reqraft EXCEPT `componentOverrides`,
  which has no coverage yet — worth a seam smoke-test before the IDE
  relies on it. *Revised 2026-09-07:* this used to point at B3 in
  `.tasks/BRANCH_REMEDIATION.md`, a file that no longer exists; the
  `extraActions` seam is now covered end to end by
  `ExpressionField.stories.tsx` › `NestedOperandKeepsInjectedActions`.
- **Revised 2026-09-07 — the shell is the host's component.** Every seam in
  the table must be reachable through `ExpressionField`, not only through
  `ExpressionBuilder`; and anything meant for "every card" must also cross
  the operand `TemplateField` boundary, because an operand that is itself an
  expression mounts its own builder. A seam that stops one hop short reads
  as wired and is not — which is the silent-regression class this checklist
  exists to prevent.
  *Revised 2026-09-08:* a host that mirrors this rule needs the bare builder
  from the barrel; it is exported next to the shell as of 0.10.53 (#119) — no
  deep import of `dist/…/expressions/builder` required.
- **`inheritedFromParent` is stable by identity.** A host editor (and any
  `arg_schema` sub-form) is handed the inheritance bag as a prop, and the
  engine guarantees the SAME object back for as long as nothing in it changed:
  a field that declares no `inherit_props` forwards the bag it was handed
  unwrapped, a form with no inherited scope forwards one shared frozen object,
  and a field that does declare `inherit_props` gets one merge per schema /
  sibling-value change (`inheritedScopeFor`, memoised per field). A host editor
  may therefore use it in a dependency list or a `memo` comparison. Built
  inline, as it was before 0.10.55, it re-rendered every field of every form on
  every render — the console read `Template field <name> Updated because:
  {inheritedFromParent}` forever. The same treatment exists in qorus-ide's
  `systemOptions.tsx`, which must stay in step until FormEngine replaces it.

- **Open product call (B4):** whether reqraft should ALSO ship a *native*
  saved-values (so non-IDE consumers get it without wiring the seam). The
  storage primitive exists (`useReqraftStorage` mirrors the IDE's
  `useQorusStorage` exactly), so it's ~1 day if wanted — but the seam
  above already keeps the IDE whole, so native is a scope question, not a
  blocker.
