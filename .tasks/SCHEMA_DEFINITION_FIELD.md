# DataSchema editor — migrate `schema-definition` to Reqraft

Phase 2 of the field migration (see
[`design/FORM_ENGINE_FIELD_MIGRATION.md`](../design/FORM_ENGINE_FIELD_MIGRATION.md)).
Ports qorus-ide's `SchemaDefinitionEditor` into the Reqraft form engine
as the first complex, server-catalogue-driven field. **Depends on
phase 1** ([`REQRAFT_AUTO_FIELD.md`](./REQRAFT_AUTO_FIELD.md)) — the
catalogue's leaf adapter emits `auto` for non-primitive fields.

**Status:** done pending user verify — implemented 2026-06-09 (still
uncommitted, on top of the also-uncommitted phase 1). 8/8 story play
tests pass via `test-storybook` (was 5/5; Sandboxed + WithValidationBanner
added via FIELD_STACK phase 3, the ReadOnly zero-inputs play restored in the
remediation batch); prod typecheck + eslint clean. Verified
live: catalogue-driven tabs, the Tables inline panels, the table editor
with sub-tabs + `ReqoreTable`, and the **column drawer rendering the
`FormEngine`-driven leaf form** (the `<Options>`→`FormEngine` seam) — name
field, allowed-value select, bool toggle, comment, "More Options 5".
No runtime errors reference the ported code.

**Scope:** copy the generic catalogue machinery near-verbatim; the real
work is the one integration seam (`<Options>` → Reqraft `FormEngine`)
plus porting two bespoke layout tabs and swapping qorus-ide-only deps.
**Estimated size:** 16 source files (~3,280 lines, incl. mocks) ported;
net new Reqraft code modest because most is copy + import-repoint.
~1 week incl. tests/iteration.

## Reference

Source dir: `qorus-frontend/qorus-ide/src/components/Field/schemaDefinition/`

| File | Role | Port difficulty |
|---|---|---|
| `types.ts` (185) | `ISchemaOptionCatalog`, `ICatalogNode`, `IDataSchemaDefinition` | copy verbatim |
| `catalog.ts` (238) | node discriminators + `catalogLeafToFieldSchema` | copy verbatim |
| `helpers.ts` (110) | `SECTION_ICONS`, `sectionCount` | copy verbatim |
| `useSchemaOptionCatalog.ts` (49) | `useFetch('schemas?action=options')` | repoint `useFetch` import |
| `referenceSuggestions.tsx` (151) | FK/PK contextual suggestion resolvers | copy verbatim (self-contained) |
| `catalogContext.tsx` (32) | catalogue provider | copy verbatim |
| `CatalogLeafForm.tsx` (242) | **leaf renderer → `<Options>`** | **rewrite leaf render to `FormEngine`** |
| `CatalogNodeEditor.tsx` (730) | group/map/list dispatch + drawer editors | port; swap `QorusTable`, `Hint` |
| `TablesTab.tsx` (138) + `TableEditor.tsx` (155) | inline-panel tables, nested tabs | port (bespoke layout) |
| `MigrationsTab.tsx` (187) | version timeline | port (bespoke layout) |
| `InlineValidationBanner.tsx` (138) | name-mismatch / version hints | port |
| `starterTemplate.ts` (68) | `createEmptyDefinition` | copy verbatim |
| `mockCatalog.ts` (325) + `mockDefinition.ts` (111) | story/test fixtures | copy verbatim |

Server contract: `GET schemas?action=options` → `ISchemaOptionCatalog`
(`{ fields, definition, actions }`; editor uses `definition`). 100%
server-driven, no FE field fallbacks. Catalogue → tabs mapping is
hardcoded `PRIMARY_SECTIONS = [schema, tables, sequences,
reference_data, migrations]` + an Advanced bucket for trusted users
(`index.tsx:65-71, 156-174`).

## Surface area

| File | Change |
|---|---|
| `src/components/form/fields/schema-definition/*` | **new** — ported dir (see Reference table) |
| `src/components/form/fields/schema-definition/CatalogLeafForm.tsx` | leaf render uses Reqraft `FormEngine`, not `<Options>` |
| `src/components/form/fields/schema-definition/SchemaDefinitionField.stories.tsx` | **new** — mock-catalogue stories |
| `src/components/form/fields/Field.tsx` | add `case 'schema-definition':` (+ `ui_type === 'schema-definition'`) → editor |
| `src/components/form/index.tsx` | export `SchemaDefinitionField` |
| `__tests__/form/schemaDefinition/*` | **new** — catalogue walk + leaf adapter |

## Items

### 1. Port the catalogue-generic machinery

**Decision.** Copy `types.ts`, `catalog.ts`, `helpers.ts`,
`referenceSuggestions.tsx`, `catalogContext.tsx`, `starterTemplate.ts`,
`mockCatalog.ts`, `mockDefinition.ts` into
`src/components/form/fields/schema-definition/` with no logic changes.
These have **zero qorus-ide coupling** (only `react`, `react-use`,
`@qoretechnologies/reqore`, `@qoretechnologies/ts-toolkit`,
`styled-components`).

**Surface area.** New files; import paths only.

**Tests.** Unit-test the node discriminators (`isCatalogLeaf/Group/
Map/List`) and `catalogLeafToFieldSchema` against `mockCatalog`.

### 2. Repoint the catalogue fetch hook

**Decision.** `useSchemaOptionCatalog` already imports `useFetch` from
`@qoretechnologies/reqraft`; inside Reqraft it imports from the local
barrel/`hooks/useFetch`. Keep the `override` / `errorOverride` props
(stories inject a mock catalogue without a server).

**Surface area.** `useSchemaOptionCatalog.ts` import line.

**Tests.** Story passing `override={mockCatalog}` renders without a
network call.

### 3. Leaf renderer → `FormEngine` (the integration seam)

**Decision.** This is the crux. In `CatalogLeafForm`, the per-leaf
options schema (built by `catalogLeafToFieldSchema`, already an
`IOptionsSchema`) is currently rendered by qorus-ide's `<Options>`. We
**do not port `<Options>`** (`systemOptions.tsx`, 1500+ lines, heavily
IDE-coupled). Instead render with Reqraft `FormEngine`:

```tsx
// CatalogLeafForm.tsx (Reqraft)
<FormEngine
  name={name}
  options={schema}          // IOptionsSchema from catalogLeafToFieldSchema
  value={optionsValue}
  onChange={handleChange}
  flat
  wrapperPadding='none'
  minColumnWidth='300px'
  size='small'
/>
```

The phase-1 `auto` field is what makes this correct: leaves typed
`auto` (the catalogue's catch-all) now render the type-picker instead
of a textarea. Verify the read-only branch (`ReqoreDescriptionList`)
and the reference-suggestion injection (allowed-values + `_creatable`)
still apply — both are independent of the renderer choice.

**Surface area.** `CatalogLeafForm.tsx` edit-mode render (~30 lines
changed). Confirm `FormEngine`'s `onChange(name, value)` signature maps
cleanly to the leaf `handleChange`.

**Tests.** Story with a leaf catalogue including `string`, `int`,
`select-string` (allowed_values), `list<string>`, and an `auto`
fallback leaf — all render correct fields; editing emits the right
value shape.

### 4. Port `CatalogNodeEditor` (group/map/list + drawers)

**Decision.** Port the recursive dispatcher and the map/list overview +
drawer editors. Swap two qorus-ide deps:
- `QorusTable` → `ReqoreTable` directly (see design Open question;
  re-add search/sort only if a section is routinely large).
- `Hint` → Reqraft equivalent or drop (cosmetic).

**Surface area.** `CatalogNodeEditor.tsx` (~730 lines, mostly copy).

**Tests.** Map section (e.g. `tables`) renders an entry table + opens
a drawer; list section (e.g. `migrations`) supports add/reorder.

### 5. Port the bespoke tabs + validation banner

**Decision.** Port `TablesTab` + `TableEditor` (inline-expandable
panels, nested `ReqoreTabs` per table section, wrapped in the
suggestion provider), `MigrationsTab` (version timeline of
`CatalogGroupBody` blocks), and `InlineValidationBanner`
(name-mismatch / version-bump / save-error hints). These are
presentation wrappers around the generic renderer.

**Surface area.** `TablesTab.tsx`, `TableEditor.tsx`,
`MigrationsTab.tsx`, `InlineValidationBanner.tsx`.

**Tests.** Visual stories per tab against `mockCatalog` +
`mockDefinition`.

### 6. Expose as a Reqraft field type

**Decision.** Add `case 'schema-definition':` to `FormField` (and the
`ui_type === 'schema-definition'` alias), mirroring qorus-ide's
`auto.tsx` ui_type branch — `value` is the `definition` hash,
`onChange(definition)`. Export `SchemaDefinitionField` from the form
barrel.

**Surface area.** `Field.tsx`, `form/index.tsx`.

**Tests.** `FormEngine` story embedding a `schema-definition` field
round-trips a full `IDataSchemaDefinition`.

## Sequencing

1. Item 1 (generic machinery) + Item 2 (fetch hook) — no UI yet
2. Item 3 (leaf → `FormEngine`) — unblocks everything visual; **needs
   phase 1 merged**
3. Item 4 (node editor) — groups/maps/lists render
4. Item 5 (bespoke tabs + banner) — full editor
5. Item 6 (field-type exposure) — wire into the dispatcher
6. Stories + tests throughout; full pass at the end

## Tasks

- [x] Copy generic machinery (`types`, `catalog`, `helpers`,
      `referenceSuggestions`, `catalogContext`, `starterTemplate`,
      `mockCatalog`, `mockDefinition`); fix imports. **Copied the whole
      dir verbatim** — sibling `./` imports stayed valid; only ~7 files
      had outside deps to repoint.
- [x] Repoint `useSchemaOptionCatalog` to Reqraft `useFetch`
      (`../../../../hooks/useFetch/useFetch`); kept `override`/`errorOverride`
- [x] `CatalogLeafForm` edit render → Reqraft `FormEngine`. Reqraft's
      `FormEngine` exports the **same** `flattenOptions` / `IOptionsSchema`
      / value+onChange contract as qorus-ide `<Options>`, so the seam was
      a near drop-in (`Options` default import → `FormEngine` named).
      Read-only viewer + suggestion-injection branches untouched (copied
      verbatim; drawer leaf form verified live).
- [x] Port `CatalogNodeEditor`; `QorusTable`→`ReqoreTable` (both map +
      list editors), `DRAWER_STYLE` inlined as a local const
- [x] Port `TablesTab` + `TableEditor`, `MigrationsTab`,
      `InlineValidationBanner` (verbatim; `Hint` repointed to a local shim)
- [x] `Hint`/`Loader` local shims (`Hint.tsx` → `ReqoreMessage`,
      `Loader.tsx` → `ReqoreSpinner`) replacing qorus-ide `../../Help` /
      `../../Loader`
- [x] `index.tsx` editor shell — tabs (`PRIMARY_SECTIONS` + Advanced),
      catalogue-load error callout, providers (verbatim; shim imports)
- [x] `case 'schema-definition':` in `FormField`; export
      `SchemaDefinitionEditor` from the form barrel. Both the direct `type`
      path AND the `ui_type` (FormEngine option) path are wired — the latter
      via the `schema-definition` pass-through in both
      `mapQorusTypeToFormFieldType` copies.
- [x] Stories: `Empty`, `Populated`, `ReadOnly`, `CatalogError`,
      `ViaFormField`, `ViaFormEngineUiType` (`SchemaDefinitionField.stories.tsx`).
      6/6 play tests pass; `Populated` opens Tables → asserts both table
      panels; `ViaFormField` is the direct dispatcher round-trip;
      `ViaFormEngineUiType` is the FormEngine `ui_type` round-trip.
- [x] Resolve the `QorusTable` open question — **used `ReqoreTable`
      directly**; search/sort not re-added (acceptable; revisit if a
      section grows large).
- [x] Tests: 5/5 story play tests pass via `test-storybook`; prod
      typecheck + eslint clean. (No separate jest file — fields are
      tested via stories here.)
- [x] 2026-06-11 follow-ups: now 8/8 plays (Sandboxed +
      WithValidationBanner via FIELD_STACK phase 3; ReadOnly zero-inputs
      play restored); the IDE's 3 schemaDefinition jest suites ported to
      `__tests__/schemaDefinition/` (~37 tests) — the "no separate jest
      file" note above is superseded.
- [ ] **STOP — user verifies in browser** before commit

## Out of scope

- ~~`ui_type: 'schema-definition'` via the FormEngine/TemplateField path.~~
  **Done** (2026-06-09 follow-up): both `mapQorusTypeToFormFieldType` copies
  pass `schema-definition` through (cast past `TQorusType`), so a `FormEngine`
  option declared `ui_type: 'schema-definition'` renders the editor.
  `catalogOverride` rides through `fieldProps` (FormEngine spreads the option
  → TemplateField `{...rest}` → FormField). Story: `ViaFormEngineUiType`
  (verified live — the value round-trips, populated schema renders).
- Suggestion-injection (FK/PK contextual `allowed_values`) is ported
  verbatim and **verified live** (2026-06-09): a table's Primary Key
  `columns` field offers the table's own columns as "Saved & Suggested
  Values". Not asserted by an automated play test (fiddly to drive), but
  confirmed by hand.
- Porting qorus-ide's `<Options>` / `systemOptions.tsx` (we use
  `FormEngine` instead)
- The `schema` *interface-selector* type (bucket 3 — app-coupled)
- Schema `actions` (validate/diff/align/drop) — the catalogue exposes
  them but the editor doesn't drive them; out of scope here
- Server-side catalogue changes — consume `schemas?action=options`
  as-is
