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

**Revised 2026-09-14 — an untyped field is typed into, never asked for a
type.** No field shows the type picker's *"Please select data type"*
anymore. It asked a question about storage ("is this Text or a Number?")
that an author writing a value often cannot answer, before they could write
anything, and it replaced a typable field with a pick-only one.

- **`AutoFormField`**, for a type that is still `auto` / `any`, renders the
  long-string editor and stores what is typed as untyped — exactly what
  template mode stores. The picker appears only where there is a real
  choice: the schema allows several concrete types (`allowed_types`), or
  the field already holds a value of a concrete type.
- **An explicit type** is chosen from the field's ⋮ menu — the per-type
  entries under *Set Custom Value* (see `engine/typeChoices.ts`).
- **`TemplateField`** opens an empty untyped field that may hold a custom
  value in template mode, whose editor is typable and offers the templates.
  It decides that from the field's props, not from whether the template list
  has arrived: on a cold load the type-filtered list does not exist at
  mount, and a landing chosen from it put every such field on the picker.
- A field that may NOT hold a custom value (FormEngine passes
  `allowCustomValues={false}` for `any`) still opens on its template menu —
  a pick-only control because the schema made it one, not a type question.
- Emptying that editor leaves the field in template mode, where an empty
  field lands. Switching to custom mode mounted a different editor in place
  of the one being typed in, so the last backspace lost the cursor.

Guarded by `__tests__/untypedFieldNeverAsksForAType.test.tsx` and the
`AutoFormField` / `TemplateField` stories (`Empty`, `ViaFormEngine`,
`AutoComponent`, `EmptyAnyOpensOnTemplates`).

**Revised 2026-09-15 — template mode draws references as named chips.**
Template mode's typable editor (a string or untyped field that may also hold
a custom value) is `RichTextFormField` with `valueFormat: 'text'`, not a
textarea. The field still stores the plain string; each template reference in
it (`TEMPLATE_TOKEN_SOURCE`) is drawn as a chip, so a chosen template reads as
the name it was chosen by — in the Visual builder's operands and in every
string field that takes templates. A textarea spelled it `$local:name`.

- The chip's label is `templateChipLabel`: the catalogue's name for the
  reference, else the reference as the DPQL Text view labels it
  (`local: name`), so one reference reads alike in both views. Its hover and
  colour are the collapsed row's (`ReadOnlyTemplateTag`).
- The editor keeps its own document and rebuilds it only when the stored
  string changes from outside: rebuilding from the echo of what was typed
  would hand the editor a new tree per keystroke, which moves the cursor.
- `string` holds one line: Enter adds none, and a pasted break is flattened.
- A value that is exactly one braced reference (`$data:{…}`, machine-written)
  keeps its pick-only chip selector, unchanged.
- Only a value that STARTS with a reference enters template mode, so
  `AutoFormField`'s text editor — `string`, `long-string` and untyped — is the
  same chip editor whenever the field offers templates: text like
  `Interface $local:id failed` reads with its references named too. `data`
  and `binary` keep the textarea (encoded content), as does a field with no
  templates to offer. Guarded by `__tests__/textFieldDrawsTemplateChips.test.tsx`
  and the `TemplateField` stories *Template References In Text* (+ *On Phone*).

This reverses the 2026-08-27 choice (`85ba6ec`) to keep plain tokens as raw
text: that review rejected a *pick-only* chip because it could not be typed
into, and this editor is both. Conversion lives in `helpers/templateText.ts`
(`__tests__/templateText.test.ts`, `__tests__/richTextTextValue.test.tsx`).

**Revised 2026-09-16 — a field offers a template list only when it has one,
and template mode has a way out.** Two rules about the menu, both reported
from the stories:

- **No empty menu.** `TemplateField` hands its editor `undefined` — not an
  empty list — when there is nothing to offer: the field's schema does not
  allow templates (a `FormEngine` option without `supports_templates`), or the
  type filter emptied the catalogue. An editor GIVEN a list draws the control
  that opens it, so a list with no items opened a menu onto nothing. Guarded
  by `__tests__/noEmptyTemplateMenu.test.tsx`.
- **A way back to a custom value.** Template mode's chip editor draws no `×`
  of its own, so a field that entered template mode from the ⋮ ("Use Template")
  offered nothing to leave it with. The ⋮ now carries "Use Custom Value"
  whenever the field is in template mode and accepts custom values; leaving
  clears the value only when it holds a reference (which would put the field
  straight back into template mode) and keeps anything the author typed.
- **A lone group in the ⋮ opens itself.** Two of the menu's groups are
  collapsed sections (`MenuActionsSection`, `CustomMenuItems`), so a menu
  holding nothing but one of them asked for a click to reach the only thing on
  offer — on an untyped field, "Set Custom Value" hiding the data types behind
  it. It now starts expanded when it is the menu's only group; it keeps its
  label, so the rows still say what they are, and can still be collapsed. Where
  the menu holds more than one group the sections stay shut: there the click is
  the choice. The same rule the template list follows for a lone category, and
  the row menu already publishes these rows flat. Guarded by
  `__tests__/loneMenuSectionOpensItself.test.tsx` (the section's own contract)
  and the story *Auto · Via Form Engine Menu Opens Its Only Group* (the rule, in
  a real browser — the menu lives in a popover jsdom never opens).
- **No document toolbar on a form field.** `RichTextFormField` asked Reqore
  for undo and redo but not styling, and Reqore draws that bar as a panel as
  wide as the tag list: an empty 600px box under the field holding two greyed
  icons — they are disabled until there is history to walk. It is off for every
  form use now; both still work from the keyboard, where every other text
  field's do. The `richtext` type (the "Text" row of the data-type submenu) is
  where this was reported. Guarded by
  `__tests__/richTextFieldHasNoToolbar.test.tsx`.

**Revised 2026-09-16 — a field says what it takes, and an untyped one is
checked as the type it was given.** Two rules from the same report (picking
"Binary" and being told nothing about the value):

- **A binary field names its encodings.** Its placeholder reads
  `Base64 — or 0x-prefixed hex, or a data:…;base64 URL`, which is what the
  server actually decodes: Qorus `lib/misc.ql`
  (`_priv_parse_ui_hash_value_intern`) reads base64 unless the value starts
  `0x` or `data:<mime>;base64,`, symmetric with the `toBase64()` it encodes
  with (`Classes/UserApi.qc`). Bare hex is the trap — it is not rejected, it is
  read as base64 and corrupts. `validateField`'s `binary` branch already
  accepted exactly these three spellings; the placeholder is that rule said
  before the fact instead of after. A caller's own placeholder still wins, and
  `data` is left alone — it is not base64. Guarded by
  `__tests__/binaryFieldSaysWhatItTakes.test.tsx`.
- **An untyped option is validated as the type its VALUE carries.** `auto` and
  `any` declare no type: the author picks one and it is recorded beside the
  value. `getOptionFieldMessages` read the schema first, so a binary value was
  validated as `auto` — which auto-detects from the value and accepts whatever
  is there — while the form's own check prefers the stored type
  (`getOptionFieldStorageType`). The two disagreed, so the form said "a field
  is not valid and requires attention" while the field it meant gave no reason.
  The messages now use the same precedence; a schema that names a concrete type
  still wins, because the schema is what the field accepts.
  `isUntypedOptionType` (`helpers/optionUiTypes.ts`) is the shared spelling.
  Guarded by `__tests__/untypedFieldReportsItsChosenType.test.ts`.

Note that a `FormEngine` option only offers templates when it declares
`supports_templates` — a field with no ⋮ template entry is that option's
schema speaking, not a defect.

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
   real type-picker instead of a textarea. (Revised 2026-09-14: an empty
   `auto` leaf is a typable editor again, with the type on its ⋮ menu — see
   phase 1.)
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
