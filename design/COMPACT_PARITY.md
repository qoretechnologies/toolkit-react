# Compact mode — options-schema parity matrix

Answers the call's requirement: *"we have to make sure that we support everything that the
options support"* (Filip, 2026-06-10). Capability list is taken from the authoritative schema
type (`@qoretechnologies/ts-toolkit` `forms.d.ts` — `TQorusFormFieldSchema`) plus engine-level
props; IDE usage was verified by grepping `qorus-ide` (file counts in brackets where relevant).

Legend: ✅ works + covered · 🟡 works, coverage thin/indirect · 🔴 gap (not supported or untested)

## Identity & display

| Capability | Compact behaviour | Coverage |
|---|---|---|
| `display_name` | row label | ✅ everywhere |
| `short_desc` | hover title + the row's ⓘ info panel (stripe-expand display, **decided 2026-06-11**: losers + `compactInfoDisplay` prop deleted) | ✅ `CompactShowcase`, `CompactFieldTypes` "Descriptions & messages" |
| `desc` (markdown) | `?` → help dialog | ✅ `CompactHelpDialog` |
| `group` + `groups` prop | collapsible group panels + badges | ✅ `Compact`, `CompactBasic` |
| `sort` | ✅ fields sort by `schema.sort` (`availableOptions`) — verified | ✅ `CompactSortOrder` (declared out of order, renders 1-2-3) |
| `icon` / `image` / `badge` / `actions` / `intent` / `tags` (field-level chrome) | ✅ **decided + built** (2026-06-10): rows render `icon`/`image` before the label and `intent` as the edge stripe (card border tints too); `badge` / `actions` / `tags` render on the expanded edit card header — nothing the schema sends is silently dropped | ✅ `CompactFieldTypes` "Field chrome" group (incl. a full-chrome combo) |

## Types & values

| Capability | Compact behaviour | Coverage |
|---|---|---|
| full `TQorusType` union | read-first values per family | ✅ `CompactFieldTypes` catalog |
| colour / file / hash read-first | swatch+hex · filename+size · count + structured tree | ✅ `CompactFieldTypes`, `CompactBasic`, unit tests |
| `arg_schema` (nested form) | card editor + structured preview | ✅ `CompactBasic`, `CompactHashStructuredView` |
| YAML-serialized values | summarised, not raw `%YAML` | ✅ `CompactListYamlField`, unit tests |
| `default_value` (+`_desc`, `_display_name`) | seeded by engine; `default_value_desc` note surfaces in the row's info panel (Tier 2, behind ⓘ) | ✅ `CompactReadonlyDefaultFix`, `CompactShowcase` (toggle journey) |
| `element_type` / typed lists | read-first join | 🟡 display via `CompactFieldTypes`; editing untested |

## Validation & requirements

| Capability | Compact behaviour | Coverage |
|---|---|---|
| `required` | `*`, Required tag, completion meter, Draft/Ready badge | ✅ several stories |
| `required_groups` | members are **linked** (2026-06-10): unmet members show a "One of: <group>" chip — tap-popover lists siblings (click → scroll + flash, works across panels), hover highlights all members; once satisfied, empty siblings show *"Not set — covered by …"* + Ready transition | ✅ `CompactRequiredGroups` (3 members across 2 panels, full journey) |
| invalid values | Required tag + banner + filter-to-invalid | ✅ `CompactBasic` (6 invalid) |
| `messages` (intent) | read rows: Tier-1 (danger/warning) → intent edge-stripe + auto-open info panel; Tier 2 behind the ⓘ toggle; the inline editor suppresses its own message strip (the panel below the editing row is the single renderer) | ✅ `CompactShowcase`, `CompactFieldTypes` "Descriptions & messages" |
| `rules: ['valid_identifier']` [47 IDE files] | ✅ **wired** (2026-06-10): `validations.ts` maps `rules` → the identifier check; `OptionFieldMessages` now spreads the *field* schema (was the whole map — pre-existing bug). Unknown rule strings are deliberately ignored (documented at the mapping site) | 🟡 `CompactValidIdentifierRule` shows the Draft badge + invalid banner (the rule's *rejection* is asserted in the 3 unit tests, not the play) |

## Selection & editing

| Capability | Compact behaviour | Coverage |
|---|---|---|
| `allowed_values` (+`_creatable`) | display label resolution + real dropdown inline | 🟡 `CompactBasic` asserts the resolved display label (incl. broken values); the inline dropdown *interaction* and the `_creatable` add-path are rendered but not driven by a play |
| `element_allowed_values` (+creatable) [8] | multi-select display join + card editor with the real multi-select | ✅ `CompactMultiSelectEditing` (open + selection labels; deep add/remove interaction still light) |
| `multiselect` | — | 🟡 covered via the same story |
| `supports_templates` / `$config:` | raw template shown in read row; toggle inline | ✅ `CompactBasic` (`$local:test`) |
| `supports_custom_values` | passed through to editor | 🟡 indirect |
| `sensitive` [21 IDE files] | read row + hover title mask `••••••` (leak fixed 2026-06-10). Known behaviour: the TemplateField *editor* reveals the value while editing (textarea path — same as the IDE; a `password`-input treatment would be a TemplateField change). Nested sensitive inside the structured hash preview NOT masked (ReqoreDataView has no sensitive concept — upstream candidate) | 🟡 `CompactSensitive` asserts the read-row mask + no page-text leak; the edit-state reveal and the hover-title mask are not asserted (+ unit tests) |
| `is_expression` values | read row shows "Expression" | 🟡 unit test; expression *editing* story still pending (transport live, deferred by Nick) |
| `supports_expressions` / `expressions_url` / `server_expression_handling` / `default_view` | passed to editor | 🔴 untested in compact (needs expression transport — now live per Nick) |
| `op` / operators | ✅ **`operators` prop wired** (2026-06-10 — was a dead internal `useState(undefined)`, unreachable in classic AND compact); operator-bearing fields always card-edit | ✅ `CompactOperators` (selector + WHERE/IS summary) |
| `app` / `action` (custom template menu for `any`) | `getCustomMenuTemplateItems` wired. **Empty-`any` affordance fixed** (2026-06-11, found via `CompactFieldTypesEditingAllRequired`): `allowCustomValues` is hard-false for `any` (the value's TYPE is picked from the template menu first), so an empty `any` card used to render only a bare ⋮ — read as broken. `TemplateField` now renders the menu trigger as a labelled **"Set value"** button whenever the menu is the field's only control (`hasInputAffordance`); valued fields keep the icon-only ⋮. Toolkit is canonical — the IDE inherits this at adoption. | ✅ `CompactFieldTypesEditingAllRequired` (Set value → Set Custom Value → Text → richtext editor mounts), `CompactAnyType` (valued: card opens) |

## Behaviour & lifecycle

| Capability | Compact behaviour | Coverage |
|---|---|---|
| `preselected` / hidden optionals | rows + search-add + Fields menu | ✅ `CompactFieldsMenu`, `CompactSearchHidden` |
| `depends_on` (incl. nested arrays) | unmet deps **lock the row**, and the linkage is **navigable** (2026-06-10): the lock's tap-popover lists each blocker with its state (✓/✗, handles `name=value` and any-of arrays; click → scroll + flash), lock hover highlights the blockers, and **fulfilling a dependency flashes the rows it unlocks** | ✅ `CompactBasic` (full lock → locate → fulfil → unlock-flash journey), `CompactOptionDependsOnOptionOrAnotherOption` (any-of), `CompactOptionDependsOnOptionInRequiredGroup` (dep × group interplay), `CompactOnChangeAndDependents`, `CompactShowcase` |
| `has_dependents` + `on_change: refetch` | dependents reset + refetch event | ✅ `CompactOnChangeAndDependents` |
| `disabled` / `readonly` | `disabled` **locks the row** (2026-06-10 — previously it opened a dead editor); form-level `readOnly` still opens in view mode (Close); readonly default-fix | ✅ `CompactBasic` (locked-row asserts), `CompactReadOnly`, `CompactReadonlyDefaultFix` |
| `focusedEditing` | ✅ compact edit cards now have the fullscreen affordance (2026-06-10): a Fullscreen button opens the same `FocusedEditing` modal as classic, with the field's descriptions | ✅ `CompactFocusedEditing` |
| `get_message` / `return_message` | **out of scope for FormEngine parity.** These keys belong to the IDE's *legacy Field system* (`components/Field/*`, VSCode-era message bus: `postMessage`/`addMessageListener`); the IDE's options form (`systemOptions.tsx` — what FormEngine is the port of) never uses them, and server options schemas don't carry them. They only appear in the schema *type* because it also models legacy field definitions. Porting them = the separate Field-system migration, where the message bus becomes transport-agnostic callbacks (the `optionsLoader` pattern). | n/a |
| `optionsLoader` (async schema) | loading/error lifecycle | ✅ `CompactOptionsLoader(+Error)` |
| narrow containers (mobile / drawers) | stacked rows < 480 px measured form width; inline editing full-width | ✅ `CompactShowcaseMobile` (360 px) |

## Remaining gaps (2026-06-10, after the coverage batch)

Closed in the batch: `rules` wiring (+ the `OptionFieldMessages` field-vs-map spread bug),
`sensitive` story, operators (prop wiring — it was dead engine-wide — + story), `focusedEditing`
on compact cards (feature + story), multi-select editing story, `sort` assert.

Still open:
1. **Expression-editing story** — transport is live (localhost:8012); deferred by Nick.
2. **Nested `sensitive` in the structured hash preview** — `ReqoreDataView` has no sensitive
   concept; upstream candidate. Related: the TemplateField editor reveals sensitive values while
   editing (IDE-parity behaviour; a password-input treatment would be a TemplateField change).
3. **Deep multi-select interaction** (add/remove via the dropdown) — the story asserts open +
   selection labels only.

(`get_message`/`return_message` was initially listed here as a gap — that was wrong; see the
behaviour table: it's legacy-Field-system scope, not options-form parity.)
