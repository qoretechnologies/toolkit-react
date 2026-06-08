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
  flattened to plain text, hashes as a generic "Set". Empty options show **Not set**, or
  **Required — not set** (warning intent) when required.
- **Click to edit, Done to collapse.** Clicking a row mounts the real field (`renderOption`); the editor
  is **not** mounted while collapsed. Multiple rows can be open at once.
- **Completion meter.** A single inline bar at the top — `N / M fields set` | track (fills remaining) |
  `%` — matching the IDE's restyled completion strip.
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
- **Search spans hidden fields.** The top search matches *all* schema fields, not just the listed ones: a
  match that is an optional field not yet in the form is surfaced as a dimmed **"Not in form — add"** row;
  activating it adds the field and opens its editor.
- **Sticky add bar.** Once the toolbar scrolls out of view, a sticky **"Additional options (N)"** dropdown
  pins to the bottom (when there are optional fields left to add), so the add list stays reachable without
  scrolling back up. Driven by an `IntersectionObserver` on a sentinel under the toolbar.
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
  it renders its own flat two-column rows (label | value | action, thin dividers) so it reads like the
  IDE's restyled creator rather than a wall of cards. The classic always-expanded path is untouched.

Interface-specific chrome (status hero, value chips, "Edit code", the help Hint) is intentionally **not**
in the engine — a consumer wraps `FormEngine` and supplies that around it. The **server does not define
group display metadata** (only the bare `group` string per field; no label/icon/order), so each UI owns
it — hence the engine takes group display via the `groups` prop rather than hardcoding it.

## Where the logic lives

- [`readFirst.ts`](../src/components/form/engine/readFirst.ts) — pure, unit-tested helpers:
  `formatOptionValue`, `getOptionGroup` (raw key), `getOptionGroupLabel` (key → display label, honouring
  the `groups` prop), `getReadFirstCompletion`, `isOptionValueEmpty`.
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

## Tests

- **Unit:** [`__tests__/readFirst.test.ts`](../__tests__/readFirst.test.ts) — value formatting, grouping,
  completion.
- **Interaction:** the 17 `Compact*` stories in
  [`FormEngine.stories.tsx`](../src/components/form/engine/FormEngine.stories.tsx), using the shared
  `_tests*` helpers. They mirror the classic story matrix: read-first edit (`CompactReadFirstEditing`), the
  Fields menu / search / search-hidden / sticky bar, revert + show-types, on_change/refetch + dependents,
  and parity scenarios — field types, `required_groups`, `any` type, readonly-default-fix,
  non-existent-filtered, the help dialog, and render stability.

Interface-specific chrome the IDE still wraps around the engine (Phase 3): the status hero, value chips
(e.g. the language logo), "Edit code", and the "Editing this form" Hint.
