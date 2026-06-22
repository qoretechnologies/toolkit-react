# FormEngine — compact (read-first) mode

## What it is

`FormEngine` ([`src/components/form/engine/FormEngine.tsx`](../src/components/form/engine/FormEngine.tsx))
renders an options schema (`IQorusFormSchema`) as a form. It has two layouts:

- **Classic** (default) — every option's editor is expanded at once.
- **Compact (read-first)** — pass `compact` to render each option as a **row showing its current
  value**; clicking a row expands the real editor inline, and a **Done** action collapses it again.
  The form reads as a "configuration summary you drill into" rather than a wall of inputs.

Compact mode is purely presentational — editing flows through the **same** machinery as the classic
layout (templates, `on_change`, validation, dependents). Nothing about the schema, value shape, or
`onChange` contract changes.

## What `compact` adds

- **Read-first rows.** Each option shows a formatted summary of its value (`formatOptionValue`):
  booleans as Yes/No, `allowed_values` as their display label, lists as joined item names, rich text
  flattened to plain text, **colours** as their hex/`rgba()` string (with a swatch preview),
  **files** as their filename (with a file icon + muted size), and **hashes** as an "N fields" count.
  Empty options show **Not set**, or **Required — not set** (warning intent) when required.
- **Hash "view more" preview.** A hash row keeps its "N fields" summary and renders the hash's
  contents beneath it with the **structured tree** (`StructuredDataView` → `ReqoreDataView` — see
  the dedicated section below); whether a row gets a preview at all is gated by `getHashEntries`,
  which recognises `arg_schema` structured forms, serialized-YAML/free-hash values, and schema-less
  hashes whose entries are the server's typed envelopes (`{ type, value }` unwrapped by its strict
  shape, so an entry counts as `value1` rather than "2 fields"). The preview is wrapped in a
  reusable **`ReqraftCollapsibleContent`**: a short hash shows in full, a tall one is clipped behind
  a **gradient "Show more" fade** (a reveal button that surfaces on hover; expanding adds a
  "Show less"). Clicking a value chip (or the row itself) opens the full nested editor — the
  preview is read-first, with the tree's expand/collapse summaries owning their own clicks.
  `ReqraftCollapsibleContent` ([`src/components/collapsible/CollapsibleContent.tsx`](../src/components/collapsible/CollapsibleContent.tsx))
  is a standalone, exported, theme-aware toolkit component (extracted from the IDE's chat-bubble
  `CollapsibleContent` fade-reveal) so the same affordance can be reused elsewhere; the fade colour
  defaults to the Reqore theme surface (overridable via `fadeColor`).
- **Inline editing for scalars, card for complex fields.** Clicking a row mounts the real field
  (`renderOption`) — the editor is **not** mounted while collapsed, and multiple rows can be open at
  once. *Scalar* fields (string, number, bool, date, colour, selects/allowed-values, …) edit **in
  place inside the row**: the editor replaces the value cell, with a per-row **↺** (when changed) and
  a **✓** to collapse; Escape or clicking the label also collapses. *Complex* fields — anything in
  `COMPACT_COMPLEX_TYPES` (hash, list, file, richtext, any/auto, schema editors, …) plus any field
  with `arg_schema` or operators — still open the expanded **edit card** with a Done button, per the
  agreed fallback ("big fields still render a form"). Changes flow through the same
  `handleValueChange` → debounced `onChange` pipeline in both paths — the engine never persists;
  *when* to apply the emitted value (immediate vs batched commit) is the consumer's contract.
- **Completion meter + Draft/Ready badge.** A single inline bar at the top — Draft/Ready badge |
  `N / M fields set` | track (fills remaining) | `%` — matching the IDE's restyled completion strip.
  The badge is the IDE restyled-hero convention (`RestyledFields`): a minimal small `ReqoreTag`,
  **Draft** (warning, `EditLine`) while any field is invalid/required-unset, **Ready** (success,
  `CheckLine`) once everything validates — driven by the same validity data as the invalid-fields
  banner; hidden in `readOnly`. Like the IDE's, it signals form *readiness*, not unsaved changes —
  unsaved-change state is the per-row **↺** / "Revert all changes". (Product save convention for
  context: creator forms auto-save to a *draft* via the IDE's `useInterfaceDraft` — debounced
  auto-draft + explicit Submit — so compact inline edits are draft-persisted by the consumer with no
  extra engine work.)
- **Toolbar.** A search box (filter rows by label) plus a **Fields** dropdown (`ReqoreDropdown`,
  edit-mode only) that consolidates the field-set actions: **Required only** (toggle), **Show field types**
  (toggle — annotates each row with its type, e.g. `<string>`), **Select all** (add every optional field),
  **Default fields** (drop user-added optionals + clear the filter, keeping required/preselected/loaded
  values), **Revert all changes** (undo every edit back to the loaded values), and a searchable
  **add-optional** list. Filters only affect which rows are listed — the completion meter still reflects the
  full set. ("Edit code" is *not* here — that stays IDE-side.)
- **Revert.** A changed row shows a per-field hover **↺** that restores that field to its loaded value;
  **Revert all changes** in the Fields menu restores the whole form. (Distinct from **Default fields**,
  which resets to schema defaults + drops added optionals.)
- **Batched commit (`commitMode='batched'`).** The decided save model (Nick, 2026-06-10): edits
  stage as a **draft** — each changed row gets an always-visible warning **Draft** chip (the
  product's draft convention), and a **Save / Discard bar** docks **bottom-right as a sticky,
  floating card** while anything is dirty (`N unsaved changes`) — `position: sticky` (not fixed)
  so it stays inside the form's scroll bounds when the engine renders in a drawer/panel. **Save**
  fires the new **`onCommit`** callback with the
  staged form and is **disabled while any field is invalid**; **Discard** is the existing
  revert-all. `onChange` still fires on every staged edit, flagged **`meta.draft`**, so consumers
  can live-validate without persisting. Default stays `'immediate'` (today's behaviour — no
  consumer breaks). Stories: `CompactBatchedCommit` (full stage → save → discard journey),
  `CompactBatchedCommitInvalid` (Save gated on validity).
- **Search spans hidden fields.** The top search matches *all* schema fields, not just the listed ones: a
  match that is an optional field not yet in the form is surfaced as a dimmed **"Not in form — add"** row;
  activating it adds the field and opens its editor.
- **Sticky-top toolbar.** The completion meter + search + Fields menu are wrapped in a `position: sticky;
  top: 0` header (opaque background masks rows scrolling beneath), so filtering and adding optional fields
  stay reachable while scrolling a long form. (Replaced an earlier bottom "Additional options" bar that, as
  the last child of the scroll content, could never actually pin to the viewport.)
- **Zebra field blocks + spacing (no dividers) + mobile left rail.** Every field block (a row, or
  the wrapper carrying a row plus its message strips / hash preview) gets an alternating
  theme-derived tint — 3% on desktop, 5% on narrow forms — and blocks separate with an **8px gap**
  at all widths; the old hairline dividers were retired (zebra + space carry the separation). Each
  field owns a visible territory and strips never float ownerless. Narrow forms additionally indent
  content 12px under the label (left rail) and use slightly taller inner padding. Edit cards keep
  their own surface.
- **No horizontal overflow.** The row grid's value column is `minmax(0, 1fr)` and the value cell has
  `min-width: 0`, so a long unbroken value (e.g. a URL) ellipsis-truncates (full value on hover via `title`)
  instead of forcing a horizontal scrollbar.
- **Field info: intent stripe + expandable panel** (the decided "stripe-expand" display,
  2026-06-11 — see `COMPACT_INFO_DISPLAY.md`). Rows carrying critical (Tier 1: danger/warning)
  messages get a 3px intent edge-stripe and their info panel **auto-opens** below the row —
  short_desc plus all schema/validation/dependency messages as slim `ReqoreMessage` strips.
  Fields with only Tier-2 info (info/success messages, `default_value_desc` notes, short_desc)
  stay one line: a ⓘ toggle in the fixed info slot opens the panel on demand (the per-row
  override sticks either way). While a row is edited inline, the editor's own schema-message
  strip is suppressed — the panel below the editing row is the single renderer. Stories:
  `CompactShowcase` (+`Mobile`).
- **Accessibility.** Read-first rows are real controls (`role="button"`, `tabIndex={0}`, Enter/Space
  activate, visible focus ring), not just click handlers; the Done button and dropdowns are native buttons.
- **Grouping.** Rows are grouped by each option's raw `group` key into collapsible `ReqorePanel` sections,
  each with a `✓ all set` / `⚠ N to resolve` badge (the catch-all `optional` group shows `N optional`
  instead). Display per group (label / icon / subtitle / order) is
  supplied by the consumer via the **`groups`** prop (the server sends only the bare group key — see
  research below); anything omitted defaults to a title-cased key, no icon, and schema order. Ungrouped
  required/preselected fields fall back to `general`, everything else to `optional`
  (`getOptionGroup` / `getOptionGroupLabel`).
- **Dedicated layout.** Compact does **not** reuse the classic `ReqoreCollection` card-per-field layout —
  it renders its own flat rows (label | value | action, zebra blocks + spacing) so it reads like the
  IDE's restyled creator rather than a wall of cards. The classic always-expanded path is untouched.

Interface-specific chrome (status hero, value chips, "Edit code", the help Hint) is intentionally **not**
in the engine — a consumer wraps `FormEngine` and supplies that around it. The **server does not define
group display metadata** (only the bare `group` string per field; no label/icon/order), so each UI owns
it — hence the engine takes group display via the `groups` prop rather than hardcoding it.

## Where the logic lives

- [`readFirst.ts`](../src/components/form/engine/readFirst.ts) — pure, unit-tested helpers:
  `formatOptionValue`, `formatColorValue` / `colorToCss` (colour → hex/`rgba()` + swatch CSS),
  `formatFileValue` / `getFileSize` / `formatBytes` (file → filename + size), `getHashEntries`
  (hash → labelled sub-field summaries), `getOptionGroup` (raw key), `getOptionGroupLabel` (key →
  display label, honouring the `groups` prop), `getReadFirstCompletion`, `isOptionValueEmpty`.
- `FormEngine.tsx` — when `compact`, the component early-returns `renderCompact()` (the completion meter,
  invalid-fields message, grouped flat rows via `renderCompactRow`, and the "more options" adder) instead
  of the classic `ReqoreCollection`. Flat-row styling lives in module-level `styled-components`
  (`StyledCompactWrap`, `StyledGroupBody`, `StyledEditCard`) with theme-derived colours. The classic path
  is left exactly as it was.

## Usage

```tsx
<FormEngine
  name="my-form"
  compact
  options={schema}
  value={value}
  onChange={handleChange}
  // optional: per-group display, keyed by the raw `group` string
  groups={{
    info: { label: 'Info', icon: 'IdCardLine', subtitle: 'Identity and core settings', sort: 0 },
    scaling: { icon: 'BroadcastLine', sort: 1 },
  }}
/>
```

## Async schema (`optionsLoader`)

`FormEngine` normally renders a schema you hand it via `options`. `optionsLoader` lets the engine **fetch
the schema itself**, owning the loading / error / refetch lifecycle, while staying **transport-agnostic** —
the consumer supplies an async callback that resolves the schema however it likes (the engine never learns
about any backend). This is what lets a consumer converge an old "fetch-by-URL" form (e.g. the qorus-ide
`<Options url=…>` fork) onto the upstream engine without pushing app-specific fetch code into the library.

```tsx
const loadSchema = useCallback(() => fetchSchemaSomehow(url), [url]); // memoise → refetch only on change

<FormEngine
  name="protocol-options"
  compact
  value={value}
  optionsLoader={loadSchema}   // no `options` — the engine loads it
  onChange={handleChange}
/>
```

- While loading, the engine shows its skeleton; on rejection it renders the error message; on success it
  renders the schema and fires `onOptionsLoaded`.
- The loader re-runs when its **identity changes**, so memoise it (`useCallback`) keyed on its inputs — a
  fresh function every render would refetch on every render.
- Works in both compact and classic layouts. (Real consumer: qorus-ide's `useRemoteOptionsLoader` feeding
  the Connection creator's protocol-specific options panel.)

## Tests

- **Unit:** [`__tests__/readFirst.test.ts`](../__tests__/readFirst.test.ts) — value formatting (incl.
  colour hex/`rgba()`, file filename, hash field-count + `getHashEntries` expansion, `formatBytes`),
  grouping, completion.
- **Field-type catalog:** the `CompactFieldTypes` story is a literal catalog of the whole `TQorusType`
  union (grouped by family) — every renderable type plus the non-renderable/interface-reference types —
  asserting colour/file/hash read-first values and the hash "view more" sub-row reveal. Beyond the
  type families it carries one-capability-per-row groups for **field chrome** (icon / image / intent /
  badge / actions / tags), **descriptions & messages** (short_desc behind ⓘ, desc → `?` dialog,
  Tier-1 messages auto-open, Tier-2 behind ⓘ), and **meta** (sensitive / rules / default-value note);
  the combined worst-case stress form is `CompactShowcase` (the flagship "real form" story). Two everything-open variants:
  `CompactFieldTypesEditing` (every row activated — all ~70 real editors mounted at once) and
  `CompactFieldTypesEditingAllRequired` (same, but every field required and unset — each editor in
  its required/invalid state; the canary for editors that misbehave on empty required values).
- **Reusable disclosure:** `ReqraftCollapsibleContent` has its own
  [`CollapsibleContent.stories.tsx`](../src/components/collapsible/CollapsibleContent.stories.tsx)
  (tall content clips + fades with a hover "Show more"; short content shows whole; custom fade colour).
- **`optionsLoader`:** `CompactOptionsLoader` (async load → read-first rows + `onOptionsLoaded`),
  `CompactOptionsLoaderError` (rejection → error message), and `OptionsLoader` (classic-layout parity).
- **Interaction:** the `Compact*` stories in
  [`FormEngine.stories.tsx`](../src/components/form/engine/FormEngine.stories.tsx), using the shared
  `_tests*` helpers. They mirror the classic story matrix: read-first edit (`CompactReadFirstEditing`), the
  Fields menu / search / search-hidden / overflow + sticky-top header, revert + show-types,
  on_change/refetch + dependents,
  and parity scenarios — field types, `required_groups`, `any` type, readonly-default-fix,
  non-existent-filtered, the help dialog, and render stability.
- **Full-schema parity:** `CompactBasic` renders compact mode on the **exact** schema + value behind the
  classic `Basic` story (the shared fixture
  [`__fixtures__/basicFormOptions.ts`](../src/components/form/engine/__fixtures__/basicFormOptions.ts) —
  both stories import it, so they can never drift). Every option/state the classic layout exercises runs
  through the compact path: both hash options, file, auto, list, allowed-values (+creatable/broken), date,
  rgbcolor, richtext, templates, messages, disabled, readonly, depends_on. Running the full fixture
  immediately caught two real bugs: `richtextToString` crashing on scalar-valued richtext options, and
  `getHashEntries` mis-counting typed envelopes.
- **Workflow-orders hash view:** `StructuredDataView`
  ([`_structuredData/`](../src/components/form/engine/_structuredData/)) is a thin Qorus wrapper
  around **`ReqoreDataView`** (upstreamed in reqore ≥0.69 — the toolkit was bumped 0.64 → 0.69.2 for
  it), mirroring qorus-ide's wrapper of the same name: it plugs in the Qorus typed-envelope
  allow-list, the embedded-YAML/JSON string parser, and the Qorus date parser/formatter
  (`structuredData.ts`). Theme-driven (key chips = `info` intent, values intent-tinted by type),
  scalars stay on the same row as their key at any depth, objects/lists collapse to
  `Object · N fields` / `List · N items`. It is the **only hash preview** in the compact form —
  the earlier flat key → value sub-row view was removed after Filip signed off on the structured
  look (`getHashEntries` remains as the "is this an expandable hash?" gate and for value
  summaries). See the `CompactHashStructuredView` story (which also contrasts an
  envelope-encoded hash against a raw order-style payload) plus its own
  `Form/Engine/StructuredDataView` story. In the compact form the tree is wired up:
  the Fields-menu **"Show field types"** toggle also drives the per-scalar type chips inside it,
  clicking a **value chip opens the hash's editor** (parity with the flat sub-rows; section
  summaries keep their expand/collapse clicks), and `defaultExpandDepth={2}` keeps deep nests
  collapsed so the preview stays short before the fade. Known gap: key chips show raw keys, not
  `arg_schema` `display_name`s — suggested upstream as
  [reqore#568](https://github.com/qoretechnologies/reqore/issues/568) (`keyLabel` callback).

Interface-specific chrome the IDE still wraps around the engine (Phase 3): the status hero, value chips
(e.g. the language logo), "Edit code", and the "Editing this form" Hint.
