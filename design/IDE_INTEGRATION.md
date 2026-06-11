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
| **AI assistance** in the ExpressionBuilder | `ExpressionBuilder` → `extraActions` (panel-action array or `({selectedExpression, value}) => actions`) | The IDE's AI action button | No AI action in the builder header — **silent** |
| **Server-handled expressions** (server decides field/template acceptance per function) | `ExpressionField` → `serverHandled` + `expressionsUrl` (already plumbed) | The live `expressionsUrl`; set `serverHandled` | Offline catalogue only — **silent, degraded** |

## Notes

- "Silent" markers are the dangerous ones — they compile clean and only
  surface as a missing feature in the running IDE. Tick each row.
- Most seams are story-tested in reqraft EXCEPT `componentOverrides`,
  which has no coverage yet (tracked as B3 in
  `.tasks/BRANCH_REMEDIATION.md`) — worth a seam smoke-test before the IDE
  relies on it.
- **Open product call (B4):** whether reqraft should ALSO ship a *native*
  saved-values (so non-IDE consumers get it without wiring the seam). The
  storage primitive exists (`useReqraftStorage` mirrors the IDE's
  `useQorusStorage` exactly), so it's ~1 day if wanted — but the seam
  above already keeps the IDE whole, so native is a scope question, not a
  blocker.
