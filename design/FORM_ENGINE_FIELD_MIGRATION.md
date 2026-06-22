# Form engine — field migration from qorus-ide

Locked design + rationale for closing the gap between Reqraft's form
engine (`src/components/form/`) and qorus-ide's older `Field` system
(`qorus-frontend/qorus-ide/src/components/Field/`). The first concrete
deliverables are (1) a Reqraft **`auto` field** and (2) the migrated
**DataSchema editor** (`schema-definition`).

Execution checklists live at:
- [`.tasks/REQRAFT_AUTO_FIELD.md`](../.tasks/REQRAFT_AUTO_FIELD.md) — phase 1
- [`.tasks/SCHEMA_DEFINITION_FIELD.md`](../.tasks/SCHEMA_DEFINITION_FIELD.md) — phase 2

## Background — why fields are "missing"

There are **two parallel field systems**:

| | qorus-ide `Field/` | Reqraft `form/` |
|---|---|---|
| Origin | 2024-01 — the original | 2024-04 — a cleaner rebuild |
| Field types | ~68 | ~15 |
| Dispatcher | `Field/index.tsx` → `auto.tsx` | `form/fields/Field.tsx` (`FormField`) |
| Polymorphic core | **`AutoField`** (1017 lines) | `TemplateField` → `FormField` (thin) |

New field types land in **qorus-ide first** (that's the live product
surface) and get migrated to Reqraft incrementally — the DPQL / Smart
editors (`0.10.0`) were the most recent example. "Missing fields" =
Reqraft is younger and still catching up, not a deliberate omission.

The full gap (qorus-ide types absent from Reqraft) breaks into three
buckets:

1. **Generic data fields** — portable, belong in a toolkit:
   `auto`, `schema-definition`, `data-provider`, `options`,
   `option_hash`, `byte-size`, `url`, `code-editor`, `array-of-pairs`,
   `multi-select`/`select-array`, `enum`-as-radio, `collection-documents`.
2. **Server-driven `ui_type` editors** — `tool-catalog`,
   `processor-mappings`, `test-cases`, `active-windows` (`dpql` already
   migrated).
3. **App-coupled / IDE-specific** — the ~20 `InterfaceSelector` types
   (`workflow`, `service`, `job`, `mapper`, `fsm`, the `schema`
   *interface picker*, …), plus `class-array`, `fsm-list`,
   `service-events`, `processor`, `api-manager`, `tree`, etc. These
   depend on qorus-ide app context (`InitialContext`, `TextContext`,
   `qorus_instance`, the `interfaceToPlural` domain map) and are **out
   of scope** for the generic toolkit.

This batch tackles bucket 1, in the order dictated by the dependency
below.

## The keystone — `auto` is a prerequisite, not an option

qorus-ide's `AutoField` is the polymorphic renderer **most fields
funnel through.** Reqraft has no equivalent: `FormField` /
`TemplateField` collapse `auto`/`any`/`binary` → `long-string` (a
plain textarea) via `mapQorusTypeToFormFieldType`
([`TemplateField.tsx:49-77`](../src/components/form/fields/template/TemplateField.tsx)),
and there is no type-picker UI at all.

This blocks the schema editor directly. The DataSchema catalogue's
leaf-type adapter falls back to `auto` for anything that isn't a plain
primitive ([`catalog.ts` `catalogTypeToFieldType`](../../qorus-ide/src/components/Field/schemaDefinition/catalog.ts)):

```ts
default:
  // `*auto`, `auto`, and anything unrecognised fall back to the
  // free-form `auto` field so no catalogue value is ever undroppable.
  return { fieldType: 'auto' };
```

So **"migrate the schema field" and "use the auto field for most
fields" are the same thread.** Build the `auto` field first; the
schema editor (and the rest of bucket 1) render their fields through
it.

## Goal

1. Give Reqraft a real `auto` field: a type-picker + polymorphic
   dispatcher that mirrors qorus-ide's `AutoField`, wired into the
   existing `FormField` / `TemplateField` / `FormEngine` stack so every
   consumer (including `FormEngine`-driven nested forms) gains it for
   free.
2. Migrate `SchemaDefinitionEditor` onto Reqraft's `FormEngine` as the
   first complex, server-catalogue-driven field — proving the pattern
   for buckets 1 & 2.

## Phase 1 — the Reqraft `auto` field

### What `AutoField` does in qorus-ide (the spec to port)

From [`qorus-ide/src/components/Field/auto.tsx`](../../qorus-ide/src/components/Field/auto.tsx):

- **Type resolution.** Derives a `currentInternalType` from
  `defaultType`, or infers it from the value via `getTypeFromValue`
  (Reqraft already has this helper at `helpers/validations`). Handles
  `auto` / `any` by inference.
- **Type picker.** When the type is `auto`/`any` (or `allowedTypes`
  has >1 entry), renders a `SelectField` of soft types —
  `bool, softbool, date, string, softstring, binary, float, softfloat,
  list, softlist, hash, int, softint, rgbcolor` (auto.tsx ~`945`) —
  letting the user pick the concrete type; the chosen type then renders
  the matching sub-field.
- **Concrete dispatch.** A switch over the resolved type → the right
  field component. In Reqraft this delegates back into the existing
  `FormField` switch (which already covers string/bool/int/float/
  rgbcolor/long-string/markdown/cron/richtext/date/file/select/hash/
  list) rather than duplicating it.
- **Null handling.** A "Set as null" / "Unset null" toggle when the
  field `canBeNull`.
- **Allowed values.** Already handled by `FormField.renderAllowedValues`
  — reuse it.

### Approach — a new `AutoFormField`, folded into the dispatcher

Create `src/components/form/fields/auto/AutoFormField.tsx`:

- Owns the type-picker UI and the `auto`/`any` → concrete-type
  resolution + null toggle.
- For the resolved concrete type, **delegates to the existing
  `FormField`** (pass the resolved `type` + `value` + `onChange`). No
  re-implementation of the per-type rendering — `FormField` stays the
  single source of truth for "how to render type X".
- Add `case 'auto': case 'any':` to `FormField`'s switch so the
  dispatcher routes to `AutoFormField` (mirrors how qorus-ide's
  `Field/index.tsx` routes `type="auto"` → `AutoField`). Because
  `FormEngine` → `TemplateField` → `FormField`, nested schema-driven
  forms gain `auto` automatically.
- Update both `mapQorusTypeToFormFieldType` copies (in `Field.tsx` and
  `TemplateField.tsx`) so `auto`/`any` route to `'auto'` instead of
  collapsing to `'long-string'`. **This is the one behaviour change for
  existing consumers** — see Migration impact.

### Out of scope for phase 1

- The `type-depends-on` / `requestFieldData` cross-field type
  resolution (qorus-ide auto.tsx `234-261`) — IDE-specific; stub the
  prop, don't wire it.
- `data-provider` / `connection` / `InterfaceSelector` branches inside
  qorus-ide's AutoField switch — those are bucket 3, not migrated.
- Expression / template values (`is_expression`) beyond what
  `TemplateField` already does.

## Phase 2 — the DataSchema editor (`schema-definition`)

### Why it fits Reqraft's form engine

`SchemaDefinitionEditor` is **a server-catalogue-driven nested form**,
which is exactly what `FormEngine` is. Concretely, the editor:

- Fetches one static catalogue: `GET schemas?action=options`
  ([`useSchemaOptionCatalog.ts`](../../qorus-ide/src/components/Field/schemaDefinition/useSchemaOptionCatalog.ts),
  uses Reqraft's own `useFetch`), shape `ISchemaOptionCatalog`. 100%
  server-driven — no FE field fallbacks.
- Walks the catalogue recursively (`CatalogNodeEditor`,
  `CatalogGroupBody`), discriminating each node as leaf / group / map /
  list ([`catalog.ts`](../../qorus-ide/src/components/Field/schemaDefinition/catalog.ts)).
- Renders each **leaf** by adapting it to an options-schema entry
  (`catalogLeafToFieldSchema` → `IOptionsSchema[string]`) and handing
  it to qorus-ide's `<Options>` field
  ([`CatalogLeafForm.tsx`](../../qorus-ide/src/components/Field/schemaDefinition/CatalogLeafForm.tsx)).
  **Reqraft's `FormEngine` consumes the same `IQorusFormSchema` shape**
  (`options` + `value` + `onChange`) — this is the single integration
  seam.

So the bulk of the editor (catalogue machinery, types, map/list drawer
editors, reference-suggestion logic) is generic code with zero
qorus-ide coupling and copies over near-verbatim. The real work is the
`<Options>` → `FormEngine` adapter and porting two bespoke tabs.

### Approach

1. Copy the catalogue-generic machinery into
   `src/components/form/fields/schema-definition/`: `types.ts`,
   `catalog.ts`, `helpers.ts`, `referenceSuggestions.tsx`,
   `catalogContext.tsx`, `useSchemaOptionCatalog.ts` (repoint `useFetch`
   import to the Reqraft barrel — already where qorus-ide imports it
   from).
2. **Replace the leaf renderer's `<Options>` with Reqraft `FormEngine`**
   in `CatalogLeafForm`. `catalogLeafToFieldSchema` already emits the
   right shape; the adapter wires `value`/`onChange`. This is where the
   phase-1 `auto` field pays off — leaves typed `auto` now render a
   real type-picker instead of a textarea.
3. Port `CatalogNodeEditor` (group/map/list dispatch + drawer editors),
   swapping qorus-ide's `QorusTable` for `ReqoreTable` (or a Reqraft
   table if one exists) and `Hint` for a Reqraft equivalent or nothing.
4. Port the two bespoke layout tabs — `TablesTab` (inline-expandable
   panels) + `TableEditor`, and `MigrationsTab` (version timeline) —
   plus `InlineValidationBanner`. These are presentation wrappers
   around the generic renderer.
5. Expose as a Reqraft form field: add `case 'schema-definition':` to
   `FormField` (and `ui_type === 'schema-definition'`), mirroring
   qorus-ide's `auto.tsx` ui_type branch.
6. Stories + tests, mock catalogue (port `mockCatalog.ts` /
   `mockDefinition.ts`).

### Open question (resolve during phase 2)

- **`QorusTable` replacement.** qorus-ide's `QorusTable` adds search +
  sort over `ReqoreTable`. Decide: use `ReqoreTable` directly (and
  re-add search/sort only if a section is large), or port a thin table
  helper into Reqraft. Default: `ReqoreTable` directly; revisit if a
  catalogue map/list section is routinely large.

## Out of scope (whole batch)

- Bucket 3 (interface selectors incl. the `schema` *interface picker*,
  and all IDE-specific fields). The `schema` the user asked about is the
  **DataSchema editor**, not the interface picker — confirmed.
- The other bucket-2 editors (`tool-catalog`, `processor-mappings`,
  `test-cases`, `active-windows`). They follow the same pattern the
  schema editor establishes and can be separate task files later.
- `data-provider` / `options` / `option_hash` / `byte-size` / `url` /
  `code-editor` fields. Tracked for a later batch; several become much
  cheaper once the `auto` field exists.

## Locked decisions

- **`auto` first, schema editor second.** The schema editor's leaf
  adapter depends on `auto`; building the editor first would degrade
  every non-primitive leaf to a textarea.
- **Delegate, don't duplicate.** `AutoFormField` resolves the type and
  delegates to `FormField`; `FormField` remains the only place that
  knows how to render a concrete type.
- **One integration seam for the schema editor.** Everything funnels
  through `FormEngine` at the leaf — we do not port qorus-ide's
  `<Options>` (`systemOptions.tsx`, 1500+ lines, deeply IDE-coupled).
- **No app context in Reqraft.** Anything needing `InitialContext` /
  `TextContext` / `qorus_instance` stays in qorus-ide. The schema
  editor qualifies because it needs none of these.

## Migration impact

- **Phase 1 behaviour change.** Fields explicitly typed `auto` / `any`
  currently render as a `long-string` textarea. After phase 1 they
  render the type-picker + resolved sub-field. Any consumer relying on
  "auto == textarea" changes — but no existing Reqraft consumer sets
  `type="auto"` (Reqraft never advertised it), so the real-world blast
  radius is nil. New, additive `'auto'` handling otherwise; no other
  type's rendering changes.
- **Phase 2 is purely additive** — a new field type, new files, no
  existing-field changes.
- **Release.** Separate from the in-flight `0.10.0` SmartEditor batch;
  target a later minor (e.g. `0.11.0`). Tracked as new rows in
  [`.tasks/INDEX.md`](../.tasks/INDEX.md).

## Status

**Design locked 2026-06-09.** First two phases scoped (auto field,
schema editor). Buckets 2 (remaining `ui_type` editors) and the rest
of bucket 1 are acknowledged but not yet scoped — they get their own
task files when picked up. Revisions to this doc require an explicit
"Revised &lt;date&gt;" note per the repo workflow.

**Revised 2026-06-09 (same day, post-implementation).** Two items that
were deferred during implementation were then completed in a follow-up
pass and are no longer open: (a) bare `soft*` (and `binary`) types now
render through `FormField` directly, not only via the auto field; (b)
the `schema-definition` field is reachable via the `ui_type` /
`FormEngine` path, not only the direct `type` path. Both verified by
story play tests. Scope of the two phases is otherwise unchanged.
