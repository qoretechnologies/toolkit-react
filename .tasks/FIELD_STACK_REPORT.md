# TASK — TemplateField + auto verbatim re-port

**Status:** done pending user verify (uncommitted), branch
`feature/dpql-editor` — stacked on the uncommitted
EXPRESSION_BUILDER_REPORT batch (user chose to proceed without
committing the baseline first, 2026-06-10). Full storybook suite
**232/232**, jest 268/268, `yarn precheck` clean. Click-through in
`VERIFY.local.md`.

Continuation of the field-stack re-faithful-ization started in
[EXPRESSION_BUILDER_REPORT](./EXPRESSION_BUILDER_REPORT.md) Phase A.
Design rationale: `design/EXPRESSION_BUILDER_REPORT_STRATEGY.md`
(Filip's method: copy IDE components **and their tests** verbatim →
1:1 + green → then improve). reqraft's `TemplateField` and
`AutoFormField` are from-scratch reimplementations — the operand layer
under the ported ExpressionBuilder — and this task replaces them with
verbatim ports of `qorus-ide/src/components/Field/template.tsx` (774
LOC) and `Field/auto.tsx` (1017 LOC).

**No commits, no pushes. STOP for user browser verification at the end.**

## Surface area

| Area | reqraft path | IDE source |
|---|---|---|
| TemplateField | `src/components/form/fields/template/TemplateField.tsx` (REPLACED) | `Field/template.tsx` |
| Auto field | `src/components/form/fields/auto/AutoFormField.tsx` (REPLACED) | `Field/auto.tsx` |
| AllowedValues | `src/components/form/fields/allowed-values/AllowedValues.tsx` (NEW) | `components/AllowedValues/index.tsx` |
| `getValueOrDefaultValue` | `src/helpers/validations.ts` (ADD export) | `helpers/validations.ts:1353` |
| FormEngine expression model | `src/components/form/engine/FormEngine.tsx` | `Field/systemOptions.tsx` (4-arg `handleValueChange`) |
| Field dispatch | `src/components/form/fields/Field.tsx` (auto/any call site) | — |
| Template stories | `…/template/TemplateField.stories.tsx` (NEW) + fixtures | `stories/Fields/Template.stories.tsx` |
| Auto stories | `…/auto/AutoFormField.stories.tsx` (extended) | `stories/Fields/Auto.stories.tsx` |

## Seam map (replace, don't copy — same classes as the builder port)

**template.tsx:**
- `useGetAppActionData` (app-action badge on the template dropdown) —
  IDE-only app catalogue; **dropped** (badge omitted).
- `SaveValueButton` (`canSaveValue` menu item) — depends on IDE
  saved-values/modal infra; **dropped**. `menuItems` seam remains for
  consumers needing extra menu entries.
- `useExpressions(allow, {url, expressions})` → reqraft
  `useExpressions({allow, expressionsUrl, extraExpressions})`;
  `.value/.valueForSelect` dep keys → `.expressions`.
- `ExpressionBuilder` import → `../../expressions/builder` (the ported
  builder). `effectiveIsFunction` renders the **bare builder** like the
  IDE — the Phase-1 `supports_expressions`/`is_expression`-prop toggle
  mechanism (which rendered `ExpressionField`) is **removed**; the IDE
  model wins (accepted drawback #2 in the strategy doc).
- `TemplatesListProps` defined locally (IDE keeps it in `Field/richText`).
- ComponentMap leafs (`LongStringField`, `Number`, `BooleanField`,
  `DateField`, `RichTextField`, `FileField`) — local 2-arg
  (`onChange(name, value)`) wrappers around reqraft's leaf fields.
- `isValueTemplate`/`getTemplateKey`/`getTemplateValue` — re-exported
  from `helpers/templates` (IDE defines them inline).

**auto.tsx:**
- **Dropped IDE-only types** (fall through to the verbatim `default:`
  "Unknown type!" tag, recoverable via `componentOverrides`):
  `processor-mappings`, `tool-catalog`, `test-cases`, `active-windows`,
  `collection-documents`, `data-provider` (ConnectorField), the
  InterfaceSelector family (`mapper`…`value-map`), `connection` (+
  `renderConnectionManagement` removed), `option_hash`, `code-editor`
  (SmartEditor needs an LSP `session` — too heavy for this seam).
- **`componentOverrides?: Record<string, React.FC>`** — one additive
  seam prop (same class as the builder's `extraActions`): checked
  before the switch so the IDE can re-inject its own editors at
  Phase E (dedupe).
- `fetchData('/dataprovider/arg_schemas/…')` → reqraft `query()`
  (same `{data, ok, error}` shape).
- `FieldAllowedValues`/`CheckGroup` → NEW port (see below).
- `Options` (hash + arg_schema) → `FormEngine` (it IS the ported Options).
- Leaf fields → reqraft equivalents with inline `onChange` adaptation
  per call site (reqraft leafs are single-arg `onChange(value)`; the
  builder port set this precedent): LongString, RichText, Boolean
  (`checked` prop), Date, Number, ByteSize, Url, Select, MultiSelect,
  Color, File, Object(hash/list), RadioGroup (enum), ArrayAutoField
  (renderItem = `TemplateField component={auto}` — mirrors IDE
  arrayAuto internals), SchemaDefinitionEditor, DpqlEditor.
- `Loader` → minimal `ReqoreSpinner` (same stand-in as schema-definition's).
- `IField` (FieldWrapper) → folded into `IAutoFieldProps` locally
  (`requestFieldData` kept — drives `type-depends-on`).
- `console.log` debug calls removed; `useWhyDidYouUpdate` kept
  (reqraft has the hook).
- `allowSaving`/`showSavedValues` props **kept in the interface** but
  inert (saved-values infra is IDE-only) — documented as a seam.

**AllowedValues port seams:** `useSavedValues` → empty list (prop kept,
inert); `useSubscriptionEvents` (CONNECTION_DELETED) → dropped;
`ConnectionManagement` per-item actions → dropped (actions = []);
`Select` → `SelectFormField` (`items`, single-arg onChange adapter).

## Consumer reconciliation (the swap's blast radius)

- `Field.tsx` auto/any case → new API (`defaultType`, 2-arg onChange
  adapter).
- `FormEngine` → IDE Options model: `allowFunctions` from
  `supports_expressions`, `isFunction={other.is_expression}`,
  `isDefaultFunction` from `default_view`, 4-arg `handleValueChange`
  where the **4th arg** (not a value wrapper) drives `is_expression`.
- `builder/index.tsx` — call sites already verbatim-IDE-shaped
  (`component={auto}`, 4-arg onChange); stale `as any` casts removed
  where signatures now match.
- `ExpressionField` stays exported with its stories (the NET-NEW DPQL
  text mode shell) but is no longer rendered by TemplateField.
  **Follow-up decision for verification:** whether FormEngine-level
  expression fields should regain the Text/DPQL mode via ExpressionField
  chrome, or stay IDE-verbatim (bare builder).

## Phases

### Phase 1 — verbatim port + ported tests — DONE (2026-06-10)

- [x] `getValueOrDefaultValue` exported from validations
- [x] AllowedValues ported
- [x] auto.tsx ported verbatim (seams above)
- [x] template.tsx ported verbatim (seams above)
- [x] Field.tsx + FormEngine + builder reconciled
- [x] IDE Template stories ported (offline: `templates.json` +
      `multiLevelTemplates.json` fixtures copied; `_tests*` helpers
      inlined per the builder-stories pattern)
- [x] IDE Auto stories ported (offline; saved-values/connection
      stories adapted or dropped per seams)
- [x] **Drift fixes surfaced by the ported tests** (the whole point of
      porting the IDE tests):
      - `filterTemplatesByType` — reqraft used naive badge equality;
        replaced with the IDE verbatim (`areQorusTypesCompatible`
        compat + top-level groups always kept). String fields now see
        ALL templates (string accepts `any`), int sees int, etc.
      - `NumberFormField` — gained the IDE's templates-dropdown wrap
        (focus-opened template list); plain input unchanged without
        templates.
      - IDE `arrayAuto` ported verbatim as `ArrayAuto`
        (`fields/array/ArrayAuto.tsx`) — panel-per-item with
        `TemplateField component={auto}` per item + "Add new item"
        button; the ported auto uses it. reqraft's compact
        `ArrayAutoField` (renderItem seam) stays for `Field.tsx`.
- [x] GATE: ported play tests **37/37**; 1:1 screenshots vs :6007
      (TemplateWithFunctionValue, nested-function, type-picker 14,
      ListWithElementType, allowed values — differences are
      mock-vs-live catalogue content only). jest 268/268, eslint
      clean, `build:test:prod` clean.

### Phase 2 — regression reconciliation — DONE (2026-06-10)

- [x] jest suite green (268/268)
- [x] full storybook suite green — **230/230, including the usually
      flaky `OnValidityChange`** (the 14/9 type-picker badges and
      `auto` + "Please select data type" assertions kept)
- [x] Reconciliation fixes:
      - auto gained a `long-string` alias in the string case (reqraft
        FormField vocabulary; the only reqraft-only `ui_type` in real
        use — evidence: story grep).
      - `OnValidityChange` play now awaits the textarea (the IDE-style
        auto resolves its type in a mount effect, one tick after
        validity is first reported) — also de-flakes the known flake.
      - Ported builder: `?.` hardening on `filterTemplatesFunc`'s
        `items.filter` — with no templates at all (FormEngine,
        templates off) the IDE original crashes on `{}.items.filter`
        (latent IDE bug; it always has fetched templates).
      - `ExpressionField` stays exported with its stories (DPQL text
        mode); FormEngine now routes expressions through the IDE
        model (bare builder via TemplateField `isFunction`) — its
        `ViaFormEngine` story passes through the new path.

### Phase 3 — small-fields audit — DONE (2026-06-10)

- [x] `byte-size` — already structurally verbatim (Number + unit
      Select); aligned the unit list to the IDE's exact `KiB`/`MiB`
      (GiB/TiB were a FORM_FIELD_EXTRAS addition — trimmed for 1:1,
      can be re-added post-parity) and unfixed the unit select so it
      stretches like the IDE's. The IDE's field-level `useMount`
      default-value push stays out (defaults are FormEngine-level in
      reqraft). IDE ByteSize stories are smoke-only — no play tests
      to port.
- [x] `url` — **replaced verbatim**: protocol Select + `://` + address
      (with the IDE's `getProtocol`/`getAddress` splitting). The
      FORM_FIELD_EXTRAS single-input version is superseded per this
      batch's mandate. Seams: the `qorus_instance`-gated remote
      protocols fetch dropped (`protocols` prop kept, IDE default
      list); the `://` label rendered as the muted paragraph the IDE's
      StringField produces. `Field.stories` Url play updated to the
      new structure. No IDE play tests exist for url.
- [x] `multi-select` — portable IDE behaviours brought over: selected
      values missing from the allowed list still render as chips, `*`
      wildcard collapses the selection + disables other items,
      wrap/tooltip item props, `showNoItemsMessage={false}`,
      `selectorProps={{useTargetWidth:false}}`, `selectedItemSize`.
      The IDE's editor dialog / FieldEnhancer `reference` machinery is
      app-coupled — not ported. IDE MultiSelect stories are smoke-only.
- [x] `schema-definition` — drift-checked; the Options→FormEngine
      adaptation stays. Ported the two applicable IDE play tests:
      **Sandboxed** (untrusted caller → no Advanced tab) and
      **WithValidationBanner** (name mismatch banner + "Sync name").
- [x] GATE: full storybook suite **232/232**, jest 268/268, eslint +
      `build:test:prod` clean.

### Follow-up — top-level ExpressionField re-wrap — DONE (2026-06-11)

Resolves the "DPQL text mode unrouted" open decision (user picked
re-wrap). One additive seam, default = IDE-verbatim:

- [x] `TemplateField` gained **`allowTextExpressions`** — when set, the
      expression branch renders the `ExpressionField` shell (Visual =
      the same ported builder, Text = the DPQL editor) instead of the
      IDE's bare builder. `handleExpressionChange` serves both (the
      shell now emits the identical `(value, remove)` contract).
- [x] `FormEngine` sets it on its TemplateField (opt out per form via
      `templateFieldProps={{ allowTextExpressions: false }}`). Nested
      operands (builder arguments, ArrayAuto items) never receive the
      prop — they stay IDE-verbatim bare builder, so the ported
      Template/Auto stories remain 1:1 vs :6007.
- [x] `ExpressionField` upgrades: `onChange` threads the builder's
      `remove` (exit-expression-mode now works from the shell);
      `localTemplates` + `serverHandled` pass through to the builder.
- [x] **Live stories** (mock LSP): `ViaFormEngineTextMode` (serialize
      direction — switching to Text seeds the editor from the stored
      AST) and `ViaFormEngineTextTyping` (parse direction — typing
      DPQL lands in the form value with `is_expression` via the 4-arg
      flow). `ViaFormEngine` extended to assert the Visual/Text toggle.
      Play-test note: synthetic keystrokes only land in an EMPTY Slate
      document — hence the typing story starts from an empty
      expression; the seeded story asserts content, not keystrokes.
- [x] GATE: full storybook suite **234/234 twice in a row**, jest
      268/268, eslint + `build:test:prod` clean. Mock-fidelity note:
      entering Text mode re-parses the serialized text (parse-on-edit
      design); the mock's echo-parse makes the preview look degraded —
      the real `dpql/parse` round-trips the AST losslessly.

### STOP — user verifies in browser before commit

`VERIFY.local.md` gets the story-by-story click-through; reqraft
storybook on :6011 side-by-side with qorus-ide :6007.
