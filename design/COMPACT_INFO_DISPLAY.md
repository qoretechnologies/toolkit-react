# Compact mode — descriptions, short descriptions & messages

**Status: DECIDED — `stripe-expand` (variant C), 2026-06-11.** Promoted to be *the* compact
info display: an intent edge-stripe on rows carrying Tier-1 messages plus a per-row expandable
panel (short_desc + all messages; auto-open on Tier 1, ⓘ toggle in the fixed info slot
otherwise). The losing variants (subtitle-inline, icon-cluster, adaptive), the temporary
`compactInfoDisplay` prop, and the Compare sidebar folder (`FormEngineCompare.stories.tsx`)
were deleted per the `compactHashView` lifecycle. The stress coverage lives on as the regular
stories **CompactShowcase** and **CompactShowcaseMobile** (360 px) in
`FormEngine.stories.tsx`. While a row is being edited inline, the editor suppresses its own
schema-message strip — the panel below the editing row is the single renderer.
Tier-1/Tier-2 computation is shared with the editor via the extracted
`getOptionFieldMessages` helper (`OptionFieldMessages.tsx`) — one source of truth.
(The 360 px finding from the evaluation — value cells truncating in the three-column grid —
was resolved by the responsive pass: rows stack below 480 px measured form width.)

Before this work the compact (read-first) form hid almost all field *information* until a row
was expanded. This doc inventories what a field can carry, classifies how urgently each piece
must be seen, and sets the acceptance criteria the shipped display meets. The four-variant
evaluation that drove the pick is archived in §5 (the `compactHashView` lifecycle: build as
knobs → compare in stories → pick → delete the losers).

## 1. Inventory — what information a field can carry

Grounded in the engine/schema (`FormEngine.tsx`, `OptionFieldMessages.tsx`, the Basic fixture):

| Information | Source | Intent | Today in compact (read row) |
|---|---|---|---|
| Schema **messages** | `schema.messages[]` `{intent, title, content}` | success / info / warning / **danger** | **Invisible** — only rendered inside the expanded editor (`renderOption`) |
| **Validation / required** | `isOptionValid`, `required`, `required_groups` | danger / warning | `Required` tag on the row; group context invisible |
| **Dependency state** | `OptionFieldMessages`: "disabled because dependencies are not fulfilled: X", required-group hints | warning / danger | **Invisible** until expanded |
| **Short description** | `schema.short_desc` | neutral | Hover `title` tooltip — useless on touch |
| **Long description** | `schema.desc` (markdown) | neutral | `?` icon → help dialog (works, incl. touch) |
| **Default-value note** | `default_value_desc`, `default_value_display_name` | neutral | Invisible |
| Read-only / disabled reason | `readonly`, `disabled` flags | neutral | Lock icon only (readonly); disabled rows look normal |

## 2. Criticality tiers (the actual decision behind "what must show before open")

- **Tier 1 — visible without any interaction:** danger/warning messages, validation state,
  "disabled because of unmet dependency". If a user never expands the row, they must still see
  these. *(Today: mostly invisible — the real gap.)*
- **Tier 2 — glanceable, one tap away at most:** `short_desc`, info/success messages,
  default-value note, required-group membership ("one of: …").
- **Tier 3 — on demand:** long markdown `desc` (the existing `?` dialog is fine).

## 3. Acceptance criteria (pass/fail per variant)

1. Works at **~360 px** width (phone) — no horizontal overflow, everything reachable by tap.
2. **No hover-only affordances.** Tooltips/popovers must open on tap (reqore supports
   `handler: 'click'`).
3. A field with **no** Tier-1 info and **no** short_desc stays a **single ~38 px row** — "doesn't
   crowd the view", made measurable.
4. Tier-1 info is readable **without any interaction** (colour alone is not enough — icon/text too).
5. Uses existing product language: `ReqoreMessage` intents, `ReqoreTag` badges, the muted-subtitle
   style the IDE restyled creator already uses for field descriptions
   (`RestyledFields.tsx` renders desc as a muted 12 px line under the label).

## 4. Research notes

**In-product conventions (consistency first):**
- The IDE restyled creator shows the field description as a **muted line under the label** — the
  exact pattern is already shipped in the form this compact mode replaces.
- `ReqoreMessage` (small/minimal/opaque=false) is the established intent-strip; the engine already
  uses it inside editors and for the invalid-fields banner.
- Intent-tinting (Draft/Ready badge, DataView value chips) is the established "severity at a
  glance" language; reqore popovers support `handler='click'` for touch.

**External (design systems / UX research):**
- Helper text belongs **below/beside the field, persistently visible**, not in placeholders or
  hover tooltips; long hints must wrap — key for mobile
  ([UX Collective](https://uxdesign.cc/text-fields-forms-design-ui-components-series-2b32b2beebd0),
  [UI Content](https://uicontent.co/designing-help-text-for-form-fields-real-examples/),
  [NN/g on placeholders](https://www.nngroup.com/articles/form-design-placeholders/)).
- Inline validation: show the indicator **next to the field**, with the message adjacent
  ([Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/inline-validation-ux/),
  [NN/g error guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/)).
- **Alert icons alone are easy to miss in dense UIs** — a badge/icon-only variant risks failing
  Tier 1; severity colour coding (ok/warning/critical) works when paired with text.

## 5. Decision record

The four-variant evaluation (proposals A–D, the comparison matrix, and the review
checklist) lived here while the pick was open. `stripe-expand` (variant C) won on
2026-06-11; the losing variants and the temporary `compactInfoDisplay` prop were
deleted. The full pre-decision analysis is preserved in the task log
([.tasks/FORM_ENGINE_COMPACT_READ_FIRST.md](../.tasks/FORM_ENGINE_COMPACT_READ_FIRST.md),
"Info-display variant evaluation (archived)").
