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
| **Server-handled expressions** (server decides field/template acceptance per function) | `ExpressionField` → `serverHandled` + `expressionsUrl` (already plumbed) | The live `expressionsUrl`; set `serverHandled` | Offline catalogue only — **silent, degraded** |

## Notes

- "Silent" markers are the dangerous ones — they compile clean and only
  surface as a missing feature in the running IDE. Tick each row.
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
- **Open product call (B4):** whether reqraft should ALSO ship a *native*
  saved-values (so non-IDE consumers get it without wiring the seam). The
  storage primitive exists (`useReqraftStorage` mirrors the IDE's
  `useQorusStorage` exactly), so it's ~1 day if wanted — but the seam
  above already keeps the IDE whole, so native is a scope question, not a
  blocker.
