# Compact FormEngine → "Focus" redesign — migration plan

**Goal:** make the real Compact FormEngine *look* like the `Focus` variant
prototype (`src/components/form/engine/variants/VariantFocus.tsx`) while keeping
**100% of its current functionality** and a **green story/test suite**.

**Principle (the user's, and the right one):** _bring our design to the engine,
not the engine's functionality to our design._ We re-skin the working engine. We
do **not** rebuild validation, dependent-reset, templates/`on_change`, operators,
`arg_schema` nesting, focused editing, or draft/commit into the prototype.

The engine is already visually sophisticated and already owns every hard piece:

| Capability | Where it already lives |
|---|---|
| Status/intent per row | `CompactRow.tsx` `worstIntent` / `intentColor` / `rowStripeColor` (≈L533, L996) → painted via `--readfirst-stripe` |
| Sticky glass header | `compactRowStyles.ts` `StyledCompactPanel` + FormEngine scroll-wrap `position: sticky` (≈L193) |
| Revert-to-loaded | `CompactRow` `revertButton` `.options-readfirst-revert` (L423) |
| Clear value | `CompactRow` `clearValueButton` `.options-readfirst-clear` (L460) |
| Focused (fullscreen) editing | `CompactRow` `.options-readfirst-fullscreen` → `setFocusedEditing` → `<FocusedEditing>` (L820, L852) |
| Dependency lock + nav | `CompactRow` `dependsOnChip` `.options-readfirst-lock-deps` (L922) |
| Required one-of groups | rail + cluster nodes (`readfirst-cluster-*`, `.options-readfirst-node`) |
| short_desc inline | `.options-readfirst-label-desc` (revealed by ⓘ `.options-readfirst-info-toggle`) |
| long desc | `?` help `.options-readfirst-help` + `<Description>` inside `FocusedEditing` |

So this redesign is mostly **subtractive** (flatten the recessed value surface +
intent stripe → calm flat rows) plus **one structural move** (re-group fields
into the Needs-attention / Set / Optional boxes, each carrying thin schema-group
labels) plus **one viz swap** (the required-group rail → the "One of the below is
required" cluster box).

---

## Answers to the five questions

### 1. How do we show `desc` (long description)?
Unify the two existing description affordances:

- **`short_desc`** → the toolbar **Descriptions toggle** (icon-only, `info`
  intent when active — exactly the prototype's button), mapped to the engine's
  existing `showAllDescriptions`. Renders inline under the field name via
  `.options-readfirst-label-desc`. The per-field ⓘ stays as a local override.
- **`desc` (long, markdown)** → stays where you actually read/edit the field:
  rendered by `<Description longDescriptionShownByDefault>` inside
  **FocusedEditing**, plus the quick `?` help (`.options-readfirst-help`). No
  second always-on description button in the row.

### 2. Dependent fields / fields with dependents?
Engine already models both — we restyle, not rebuild:

- **Disabled-by-dependency** (`depends_on` unmet): keep the **lock + "Depends on"
  navigable chip** (`.options-readfirst-lock-deps`); clicking a blocker flashes
  it (`readfirst-row-flash`). These are a distinct **blocked** state — neither
  todo/set/optional — so they render **dimmed in place in their schema group**
  (not pulled into Needs-attention; you can't act on them yet).
- **Fields with dependents**: no read-first badge needed (the engine resets
  dependents on change). Optional later nicety: an "affects N fields" hint while
  editing.

### 3. Optional fields wrapper (basic dark)
The `optional` group (everything `getOptionGroup` routes there — non-preselected,
non-required, unset) renders in a **collapsible box like the others but a neutral
/ dark tint** (not amber/green), collapsed by default. Same `ReqorePanel`
treatment as Set, different intent.

### 4. Focused editing / reset-to-default / clear
Keep the engine's existing edit-card actions, restyled to match:
- **Focused editing** (`.options-readfirst-fullscreen` → `<FocusedEditing>`) — unchanged.
- **Clear value** (`.options-readfirst-clear`) — unchanged.
- **Revert** (`.options-readfirst-revert`) reverts to the *loaded* value.
- **NEW: reset-to-default** — `handleValueChange(name, schema.default_value)`,
  shown only when `default_value` exists and differs. Small addition.

### 5. Sticky header (search + progress)
Already sticky (`StyledCompactPanel` + the owned scroll context). The redesign
keeps it; the `CompactToolbar` (completion meter + filter + Descriptions toggle +
Fields menu) stays pinned. Only its contents/skin change.

---

## Visual-delta map (Focus feature → engine change → test impact)

Legend: **🟢 safe** = CSS-only / additive, no tested DOM·text·interaction change.
**🟡 needs test updates** = changes asserted text/structure; update listed play
functions and re-run `test:stories`.

| # | Focus feature | Engine change | File · symbol | Impact |
|---|---|---|---|---|
| 1 | Calm flat rows (no recessed surface, no intent stripe) | drop/soften the value-surface `::before` + `border-left` stripe | `compactRowStyles.ts` `StyledGroupBody > *::before` | 🟢 safe |
| 2 | Status **dot** (one mark, colour = severity) | render a dot from `rowStripeColor`/`worstIntent`; additive element | `CompactRow.tsx` (row label cell) + styles | 🟢 safe (additive class, no removed hooks) |
| 3 | Thin uppercase group labels | restyle the group header (name → 10px/upper/letter-spaced; drop hairline+chip or calm them) | `FormEngine.tsx` group render + `StyledGroupHeader`/`StyledGroupHeaderLine` | 🟢 mostly (verify no story asserts the chip text) |
| 4 | Empty value shows `—` not "Not set" | swap the empty-value copy | `CompactRow.tsx` value render | 🟡 7 assertions use `Not set` |
| 5 | Needs-attention / Set / Optional **boxes** (status grouping, schema labels inside) | regroup: bucket rows by status across schema groups; render 3 `ReqorePanel`s; thin schema labels within | `FormEngine.tsx` group-render loop | 🟡 group-structure & badge ("N to resolve") assertions |
| 6 | "One of the below is required" **cluster box** | replace rail + cluster nodes with the cluster box | `CompactRow.tsx` cluster nodes/rail + `compactRowStyles.ts` `readfirst-cluster-*`, `StyledClusterNode` | 🟡 `Covered by` / `Covers` / `One of` assertions |
| 7 | Neutral/dark Optional wrapper | intent/skin on the optional `ReqorePanel` | `FormEngine.tsx` | 🟢 safe |
| 8 | reset-to-default action | new button calling `handleValueChange(name, default_value)` | `CompactRow.tsx` | 🟢 additive |

**Use Reqore throughout** — `ReqorePanel` (boxes/collapsible), `ReqoreControlGroup`,
`ReqoreInput`, `ReqoreButton`, `ReqoreTag`, `ReqoreIcon`, `ReqoreCollapsibleContent`,
`useReqoreTheme` for every colour. No bespoke widgets where a Reqore one fits.

---

## Phased plan (each phase ends green)

- **P1 — Calm re-skin. ✅ DONE + validated.** Flattened the recessed value
  surface + intent stripe (`StyledGroupBody > *::before` now transparent) and
  added the trailing **status dot** (`StyledStatusDot`, derived from
  `worstIntent`/`empty`/`required`/`coveredByLabel`/`groupResolved`). CSS +
  additive DOM only — every test hook preserved. **Validated: `FormEngine.stories.tsx`
  = 68 pass / 1 pre-existing fail ("Option With Any Type"), no new failures;**
  `build:test` + `eslint` green; visually confirmed on :6008. *(Thin group labels
  deferred to P3, where the group headers change anyway.)*

  > **Validation harness (important):** `vitest run --project storybook <file>`
  > runs stories in headless chromium and does **NOT** spawn a server on :6008 —
  > a live `yarn storybook` is untouched. So every phase below is validatable
  > without disturbing a running Storybook.
- **P3 — Status boxes. ✅ DONE + validated.** Regrouped into **Needs attention /
  Set / Optional** boxes (intent-tinted `ReqorePanel`s), each with thin schema
  sub-labels (`StyledStatusBoxGroupLabel`); neutral Optional. Key decisions:
  - **One shared status helper** (`getReadFirstStatus`/`getReadFirstBucket` in
    `readFirst.ts`) drives BOTH the row dot and the box bucket — they can't disagree.
  - **One-of required-group members travel together** (bucket the whole group by
    its satisfaction) so the existing rail + "One of"/"Covers"/"Covered by" chips
    stay intact. Rail→cluster-box swap deferred to P4.
  - **Freeze-while-editing** (`settledBucket` ref keyed by option, gated on
    `expandedOptions`): an edited field — or any member of an edited one-of group —
    keeps its box until the edit ends, so a status flip can't remount it mid-edit
    and steal focus. (This fixed a real regression the suite guards.)
  - Only **one** test legitimately changed (sort order is now status-first).
  - **Validated: 68 pass / 1 pre-existing fail.** Visually confirmed on :6008.
- **P2 — Copy + empty state (🟡).** `Not set` → `—  <reason>`. Update the ~10
  assertions (`Not set` ×7, `Required — not set`, `Not in form — add`, covered-by).
- **P4 — Required cluster (🟡).** Rail → cluster box. Update `Covered by`/`Covers`/
  `One of` assertions.
- **P5 — Polish.** reset-to-default action, depends-on dimmed-in-place styling,
  responsive pass, qlip/Chromatic re-baseline.

---

## Test-impact appendix (the audit)

`test:stories` runs `vitest run --project storybook`, and the storybook-vitest
plugin's `storybookScript` is `yarn storybook --no-open` → it wants **:6008**,
which collides with a running `yarn storybook`. **To validate without disturbing a
live :6008**, run the suite against a separate port (temporarily point the dev
script / `storybookScript` at e.g. :6010, or stop the live instance first).

Asserted strings that constrain changes (must be preserved, or the test updated):
`Not set` (×7), `Required — not set`, `Covered by "…"`, `Covers`, `Draft`,
`Focused Editing`, `Description`, type labels (`<string>`, `<rgbcolor>`),
`N to resolve` group badges, `1 unsaved change`, plus the class/`data-field`
hooks listed in the table above. Preserve every `options-readfirst-*` /
`readfirst-*` class that a play function queries; restyle via CSS rather than
renaming.
