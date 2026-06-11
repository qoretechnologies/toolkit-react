# Reqraft `auto` field — type-picker + polymorphic dispatch

Phase 1 of the field migration (see
[`design/FORM_ENGINE_FIELD_MIGRATION.md`](../design/FORM_ENGINE_FIELD_MIGRATION.md)).
Ports qorus-ide's `AutoField` polymorphic renderer into Reqraft's
existing `FormField` / `TemplateField` / `FormEngine` stack. This is
the **keystone** — the schema editor (phase 2) and most of the
remaining field gap depend on it.

**Status:** done pending user verify — implemented 2026-06-09. 8/8 story
play tests pass (run via `test-storybook`), prod typecheck + eslint clean,
verified in an isolated Storybook (picker, type inference, null toggle,
live dropdown→Integer→number field, and the full FormEngine→…→AutoFormField
chain). Uncommitted on `feature/dpql-editor` per the STOP-before-commit rule.

**Scope:** one new field component + small dispatcher wiring. Delegates
all concrete-type rendering back to the existing `FormField` switch;
does **not** re-implement per-type fields.
**Estimated size:** ~250–350 lines + 1 story file + 1 test file. ~1–2 days.

## Reference

- Source to port: `qorus-frontend/qorus-ide/src/components/Field/auto.tsx`
  (type resolution ~`195-268`, type picker ~`933-1014`, soft-types list
  ~`945`, null toggle ~`308-317`).
- Reqraft dispatcher: [`src/components/form/fields/Field.tsx`](../src/components/form/fields/Field.tsx)
  (the `FormField` switch + `renderAllowedValues`).
- Reqraft type map (two copies to update):
  `Field.tsx:34-46` and
  [`TemplateField.tsx:49-77`](../src/components/form/fields/template/TemplateField.tsx).
- Existing helper to reuse: `getTypeFromValue` from
  `src/helpers/validations` (already imported by `TemplateField`).
- Type-picker UI: reuse `SelectFormField`
  (`src/components/form/fields/select/Select.tsx`).

## Surface area

| File | Change |
|---|---|
| `src/components/form/fields/auto/AutoFormField.tsx` | **new** — type-picker, `auto`/`any` resolution, null toggle, delegates concrete render to `FormField` |
| `src/components/form/fields/auto/AutoFormField.stories.tsx` | **new** — picker, inferred-type, null, allowed-values stories |
| `src/components/form/fields/Field.tsx` | add `case 'auto': case 'any':` → `AutoFormField`; stop mapping `auto`→`long-string` |
| `src/components/form/fields/template/TemplateField.tsx` | same map fix so `auto`/`any` no longer collapse to `long-string` |
| `src/components/form/index.tsx` | export `AutoFormField` |
| `src/types/Form.ts` | ensure `'auto'` / `'any'` are valid `TFormFieldType` members (they derive from `TQorusType`; confirm) |
| `__tests__/form/AutoFormField.test.tsx` | **new** — type resolution + picker behaviour |

## Items

### 1. `AutoFormField` component

**Decision.** New component that owns *type selection*, then hands the
resolved concrete type to the existing `FormField`. It is the Reqraft
analog of `AutoField` but thin — `FormField` already knows how to
render every concrete type, so `AutoFormField` must not duplicate that
switch.

**Behaviour.**
- Resolve an internal type: `defaultType` if given, else
  `getTypeFromValue(value)`; `auto`/`any` stay unresolved until the
  user picks.
- When unresolved (or `allowedTypes.length > 1`), render the
  type-picker (item 2), then render the chosen type's field by
  delegating to `<FormField type={resolved} value onChange ... />`.
- When resolved, render `<FormField>` directly for that type.
- Reuse `FormField`'s allowed-values rendering rather than
  re-implementing it (either render `<FormField>` which already calls
  `renderAllowedValues`, or lift the helper — prefer the former).

**Props.** Mirror the relevant subset of `IAutoFieldProps`:
`type` (`'auto'`/`'any'` or a concrete type), `value`, `onChange`,
`defaultType?`, `allowedTypes?: { name/value }[]`, `canBeNull?`,
`disabled`, `readonly`, `size`, plus the allowed-values props already
on `IFormFieldProps`. **Stub but do not wire** `requestFieldData` /
`type-depends-on` (IDE-only).

**Surface area.** `AutoFormField.tsx` (~150–200 lines).

**Tests.** Unit: given `value=42` + `type='auto'` resolves to a number
field; given `defaultType='hash'` renders the hash branch; picking a
type from the picker swaps the rendered sub-field.

### 2. Type picker

**Decision.** A `SelectFormField` of soft types, shown when the type is
`auto`/`any` or `allowedTypes` has >1 entry. Default soft-type list
(from auto.tsx ~`945`):
`bool, softbool, date, string, softstring, binary, float, softfloat,
list, softlist, hash, int, softint, rgbcolor`. When `allowedTypes` is
provided, use it verbatim instead of the soft list.

**Note.** Soft types (`softint`, `softstring`, …) resolve to their
hard counterpart for *rendering* (a `softint` renders the number
field) but the chosen type is preserved in the emitted value's `type`
metadata, matching qorus-ide. Confirm `FormField` tolerates a `soft*`
type by extending `mapQorusTypeToFormFieldType` (soft* → base type).

**Surface area.** Inside `AutoFormField.tsx`; small `mapQorus...`
extension for `soft*`.

**Tests.** Picker visible only for `auto`/`any`/multi-`allowedTypes`;
selecting `int` renders the number field.

### 3. Null toggle

**Decision.** When `canBeNull`, render a "Set as null" / "Unset null"
button (qorus-ide auto.tsx `308-317`). Setting null emits the server's
null sentinel and hides the field; unsetting restores the prior value.

**Surface area.** `AutoFormField.tsx` (~20 lines).

**Tests.** Toggle sets/clears null; field hidden while null.

### 4. Dispatcher wiring

**Decision.** Add `case 'auto': case 'any':` to `FormField`'s switch
returning `<AutoFormField ... />`. Fix **both**
`mapQorusTypeToFormFieldType` copies so `auto`/`any` no longer fall
through to `'long-string'`. Because `FormEngine` → `TemplateField` →
`FormField`, schema-driven nested forms gain `auto` with no further
work.

**Surface area.** `Field.tsx`, `TemplateField.tsx`, `index.tsx` export.

**Tests.** `FormEngine` story with an options schema containing a field
typed `auto` renders the picker (not a textarea).

## Sequencing

1. Item 1 (component skeleton, delegates to `FormField`)
2. Item 2 (type picker) — the core of the value
3. Item 3 (null toggle) — independent, small
4. Item 4 (dispatcher wiring + map fix) — last, flips the behaviour on

## Tasks

- [x] `AutoFormField.tsx` — type resolution via `getTypeFromValue` /
      `defaultType`; delegates concrete render to `FormField`
- [x] Type picker (`SelectFormField`) with soft-type list; `allowedTypes`
      override; gated on `auto`/`any`/multi-type; honours `noSoft`
- [x] `soft*` → base-type handling. In `AutoFormField.getRenderType`
      (`softX`→`X`, `binary`→`long-string`) AND, as a later pass, in
      `FormField` itself (`renderField` strips the `soft` prefix; `binary`
      added to the `long-string` case) and in both `mapQorusTypeToFormFieldType`
      copies. So a bare `<FormField type="softint" />` / `type="binary"` now
      renders correctly. Stories: `Field.stories.tsx` `SoftInteger` + `Binary`.
- [x] Null toggle gated on `canBeNull`
- [x] `case 'auto': case 'any':` in `FormField`; `auto`/`any` now map to
      `'auto'` in both type maps instead of falling through to `long-string`
- [x] Export `AutoFormField` from `form/index.tsx`
- [x] Confirm `'auto'`/`'any'` typecheck as `TFormFieldType`
      (`TFormFieldValueType` already maps them to `any`)
- [x] Stories: picker (`Empty`), inferred-from-value (`InferredInteger`,
      `InferredText`), concrete (`ConcreteString`), null (`Nullable`),
      allowed-types subset, no-soft, and `FormEngine`-with-auto-field
      (`ViaFormEngine`)
- [x] Tests: story play tests cover resolution + null + concrete + inference
      + the FormEngine chain (run via `test-storybook`, 8/8 pass). No
      separate jest file — fields are tested via stories in this repo.
- [x] Prod typecheck, eslint, storybook play tests pass
- [ ] **STOP — user verifies in browser** before commit

## Out of scope

- ~~Bare `soft*` types passed directly to `FormField`/`TemplateField`.~~
  **Done** (2026-06-09 follow-up): `FormField.renderField` strips the
  `soft` prefix, `binary` was added to the `long-string` case, and both
  `mapQorusTypeToFormFieldType` copies strip `soft`. Verified by
  `Field.stories.tsx` (`SoftInteger`, `Binary`).
- `type-depends-on` / `requestFieldData` cross-field resolution (IDE-only)
- `data-provider` / `connection` / `InterfaceSelector` branches from
  qorus-ide's AutoField (bucket 3)
- Expression/template handling beyond what `TemplateField` already does
- The remaining bucket-1 fields (`byte-size`, `url`, `option_hash`,
  `code-editor`, …) — separate task files; several get cheaper once
  this lands
