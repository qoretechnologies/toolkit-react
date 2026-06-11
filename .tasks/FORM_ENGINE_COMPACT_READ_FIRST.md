# Form Engine — Compact (read-first) mode

> **Master plan.** Spans three repos. Lives in the toolkit-react worktree because Phase 1 (the
> bulk of the work) ships here. Phases 2–3 land in `qorus-ide`; Phase 4 is an incremental
> `qorus` server change. Treat this file as the single source of truth and keep it updated as we go.

---

## 0. Ground rules (agreed with the user)

1. **Worktree + branch (done).** All Phase-1 work happens in the dedicated worktree, not the main checkout.
   - Worktree: `/Users/nick/Projects/qorus-frontend/toolkit-react--form-engine-compact`
   - Branch: `feature/form-engine-compact-read-first`, created off **latest** `origin/develop` (`04ecdcf`).
2. **No commits, no pushes until the user explicitly says so.** Implement, run tests/stories locally, show diffs — wait for the go-ahead before any `git commit`/`git push`.
3. **Design-doc driven.** Every decision below is grounded in the existing design docs across the three repos (cited inline). When we change a documented surface we update its doc + `AI-DOCS` in the same change.
4. **Proper Storybook stories and tests.** New behaviour ships with stories + `play` interaction tests (toolkit-react Storybook test-runner + jest), and the IDE phases extend the existing creator stories. No trivial/self-asserting tests.
5. **No shortcuts.** Reuse the real engine, contribute reusable UI upstream, no forks/stopgaps left behind. "Correct and proper" over "fast."

---

## 1. Goal

The workflow/step interface creator was recently restyled into a **read-first** layout (a "configuration
summary you drill into" rather than a wall of inputs). That look currently lives as a **bespoke,
fields-based** component in the IDE. We want to:

1. **Move the read-first presentation into the Reqraft `FormEngine`** as a first-class **`compact`** mode,
   so any options form can render this way — not just the workflow/step creator.
2. **Drive it from the options schema, not the legacy `IField` list**, because options is the standard
   form model everywhere else in the app and is server-driven.
3. **Retire the IDE-local `RestyledFields` detour** once the engine covers it, leaving the IDE with a thin,
   interface-specific wrapper (hero copy + chips) and nothing duplicated.

---

## 2. Background — the two-engine reality (current state)

There are **not** two form philosophies. There is **one options form engine**, mirrored in two places, plus
**one legacy holdout**.

### 2a. The one engine, in two places
- **Reqraft `FormEngine`** — `toolkit-react/src/components/form/engine/FormEngine.tsx`. The upstream,
  published engine (`@qoretechnologies/reqraft`; the IDE depends on `^0.8.11`). Driven by
  `IQorusFormSchema` (options) from `@qoretechnologies/ts-toolkit`.
- **IDE `<Options>`** — `qorus-ide/src/components/Field/systemOptions.tsx`. An **in-repo twin** with
  byte-for-byte the same internals (`fixOptions`, `availableOptions`, `OptionsContext`,
  `showInvalidOptionsOnly`, the "More Options" adder, `flattenOptions`). Documented in
  `qorus-ide/design/SYSTEM_OPTIONS.md`. The IDE comment at `systemOptions.tsx:490` ("nested FormEngine
  emissions") shows the upstream engine is already nested in places.

Both consume the **same** schema type. `FormEngine` is the strategic home; `<Options>` is the legacy local
fork (convergence of the two is **out of scope** here — see §9).

### 2b. The legacy holdout — workflow/step creator
- The workflow/step creator renders via `qorus-ide/src/containers/InterfaceCreator/panel.tsx`, fed by the
  **legacy** WebSocket `creator-get-fields` → `IField[]` (array-based, `mandatory`, `items[]`). Type:
  `qorus-ide/src/components/FieldWrapper/index.tsx` (`IField`).
- The read-first look is `qorus-ide/src/containers/InterfaceCreator/restyled/RestyledFields.tsx`
  (documented in `qorus-ide/design/RESTYLED_CREATOR.md`): it re-implements rows, grouping, completion bar,
  and a "Ready/Draft" hero **by hand**, on top of `IField`. It's opt-in via the panel's `restyled` prop
  (workflow + step only).

### 2c. The modern surfaces already on options
Connection, FSM state/transition actions, pipeline processors, AI collection/endpoint/guardrail, ML model —
all render from the options schema. The IDE already has the options-fetch hook:
`qorus-ide/src/hooks/useInterfaceFields.tsx` calls **`creator-get-fields-as-options`** and returns an
`IOptionsSchema`. The connection view's own fields→options migration is fully designed in
`qorus-ide/design/connection-options-api.md` — this is the **precedent** for what we're doing for
workflow/step.

### 2d. What the server already provides
- The server **already** exposes the workflow/step form as an **options schema** via
  `creator-get-fields-as-options` (the same action the modern surfaces use). The options descriptor
  (`FieldInfo` in `qorus/Classes/QorusMapManager.qc`) **already carries `group`** (and `compact`,
  `sort_group`/`sort_key`, `display_name`, `short_desc`, `allowed_values`, `depends_on`, `on_change`, …).
- So: **no IDE-side `IField → options` adapter is needed, and we are not blocked on new server work.**
  qorus issue **#259** ("server assigns `group` to every field") is just *populating* `group` values on the
  existing schema — incremental, non-blocking (the FE already has a grouping fallback).

---

## 3. Design principles (doc-grounded)

| Principle | Source | Consequence for this work |
|---|---|---|
| Reusable UI belongs in the library; contribute upstream, don't wrap/patch locally. | `qorus-ide/design/REQORE_REQRAFT.md` §"When Something is Missing" (lines 5, 114–123) | The read-first presentation is a reusable form concern → it lives in **`FormEngine`** (`compact`), not in a new IDE component. |
| Don't fork `RestyledFields`; extend the descriptor API. Interface-specific copy is injected, the component stays interface-agnostic. | `qorus-ide/design/RESTYLED_CREATOR.md` (lines 39–65) | Interface-specific chrome (hero copy, language/`remote` chips, group labels) stays **IDE-side**, injected into the engine wrapper — not hardcoded in the engine. |
| Options is the standard; Fields is deprecated. The connection view migration is the template. | `qorus-ide/design/connection-options-api.md`; `qorus-ide/design/SYSTEM_OPTIONS.md` | Workflow/step move to `creator-get-fields-as-options`, same path the modern surfaces use. |
| Search before you build; don't fork a shared component to add one prop; every shared visual component gets a story. | `qorus-ide/design/SHARED_COMPONENTS.md` Rules 1, 4, 5 | Extend `FormEngine` in place (it already has a `compact` prop stub); ship stories; reuse Reqore primitives for grouping rather than hand-rolled wrappers. |
| Explain non-obvious features in-app. | `qorus-ide/CLAUDE.md` "Explaining features"; `SHARED_COMPONENTS.md` "Help & hints" | Keep the existing read-first `<Hint>` (or its engine equivalent) so users learn the click-to-edit interaction. |

---

## 4. Locked decisions (the two questions we researched)

### Decision A — Scope split: **engine owns the core, IDE wraps the chrome.**
- **`FormEngine` (generic, reusable):** read-first rows showing each option's formatted value; click-to-edit
  expand/collapse reusing the existing field editor; compact density; a completion/validity meter derived
  from data the engine **already computes** (`validityData` / `invalidFields`); grouping driven by the
  schema's `group` key.
- **IDE wrapper (interface-specific):** the "Ready/Draft" hero **copy**, the language-logo / `remote` value
  chips, and group-label overrides — injected exactly like today's `IRestyledDescriptor`. The Ready/Draft
  **derivation** is generic and moves into the engine; only the **wording/chips** stay in the IDE.
- Rationale: this is what `REQORE_REQRAFT.md` (upstream-or-nothing) + `RESTYLED_CREATOR.md` (descriptor
  injection, don't fork) jointly prescribe.

### Decision B — Data path: **use the existing server options path; no adapter.**
- Switch workflow/step off legacy `creator-get-fields` (`IField[]`) onto **`creator-get-fields-as-options`**
  (`IOptionsSchema`) via the existing `useInterfaceFields` hook, and render with `FormEngine` in `compact`
  mode.
- Rationale: the server already returns an options schema for these types (with `group`); the IDE already
  has the consumer + renderer; the modern surfaces already run this path. Building an `IField→options`
  converter would be a shortcut that entrenches the deprecated model — explicitly rejected.

---

## 5. Engine design — the `compact` (read-first) mode in `FormEngine`

**Naming.** The user framed this as "a `compact` flag that turns the form engine into the new look," and
`FormEngine` already has a `compact?: boolean` prop (`FormEngine.tsx:296`, currently a near-stub that only
hides the collection label and disables filter/sort at lines 1029–1036). We **extend `compact`** to be the
full read-first presentation. *(Open item 9d: confirm we want `compact` to mean read-first, or a separate
`readFirst`/`mode` prop with `compact` as density-only. Default assumption: extend `compact`.)*

**Where it hooks in.** Today each option is a `ReqoreCollection` item whose `content` is
`<FocusedEditing>…{renderOption(optionName, …)}</FocusedEditing>` (`FormEngine.tsx:1218–1239`), i.e. the
editor is always expanded. In `compact` mode the item `content` becomes **read-first**:

1. **Read row (default):** render the option's label + a formatted value summary (mirror
   `RestyledFields.formatValue`: `—`/"Not set" when empty, "Yes/No" for bool, joined names for lists,
   "Set" for hashes, the language image when the wrapper maps it). Hover reveals an edit affordance; the
   existing per-item actions (remove value, revert, remove optional, fullscreen) stay available.
2. **Edit (on click):** clicking the row reveals `renderOption(...)` — the **real, unchanged editor** with
   all existing wiring (templates, expressions, `on_change`, validation, dependents) — plus a "Done"
   collapse. Track per-item edit state alongside the existing `focusedEditing` state (`FormEngine.tsx:323`).
3. **Completion meter:** a thin "N / M set" + % bar derived from `availableOptions` + required completeness,
   reusing the engine's existing validity (`IFormValidityData`, surfaced via `onValidityChange`). No new
   validation logic.
4. **Grouping:** group options by their schema `group` key, ordered, with a default label/icon map and
   per-group override via the wrapper. **Spike first (Task 1.1):** confirm whether `ReqoreCollection`
   supports native grouping; if not, render one Reqore panel/collection per group using Reqore primitives
   (per `SHARED_COMPONENTS.md` Rule 6 — no hand-rolled gap `<div>`s). Keep the existing "More Options"
   adder and "show invalid only" behaviours working per-group or globally.
5. **Chrome injection:** add a minimal, typed way for the IDE wrapper to pass interface-specific group
   labels (and anything else genuinely needed). Hero copy + value chips are rendered **by the IDE around**
   `FormEngine`, not inside it — so they do **not** become engine props beyond what grouping needs.

**Non-goals for the engine:** the "Ready/Draft" hero strip, language-logo chips, and interface-specific
captions. Those stay in the IDE (Decision A).

---

## 6. Phase plan

### Phase 0 — Prerequisites ✅ DONE
- [x] Worktree + branch off latest `develop`.
- [x] `yarn install` **inside the worktree** (worktrees don't share `node_modules`).
- [x] Baseline verified clean on the untouched branch: **jest 163/163 pass** (~4s); **Storybook boots**
      and indexes `Form/Engine/FormEngine`.
- [x] Re-read cited sections of `FormEngine.tsx` / `FormEngine.stories.tsx`.

**⚠️ Environment gotcha — use Yarn Classic, not the global berry.**
- The repo commits a **Yarn 1.x** lockfile (`# yarn lockfile v1`), no `packageManager` pin. The machine's
  global `yarn` is **4.6.0 (berry)**, which on first `yarn install` **silently migrates** the project
  (creates `.yarn/` + `.yarnrc.yml`, rewrites `yarn.lock` +18k/−13k). That tracked `yarn.lock` change must
  **not** leak into the branch.
- **Always invoke yarn as classic in this worktree:** `npx --yes yarn@1.22.22 <cmd>` (install used
  `--frozen-lockfile`, passed, zero lockfile churn). Do **not** run a bare `yarn install` here.
- **Storybook port:** the main checkout (`feature/dpql-editor`) already runs Storybook on **6008**; don't
  kill it. The worktree Storybook runs on **6009** (`./node_modules/.bin/storybook dev -p 6009 --no-open`).
  Point `test-storybook` at `--url http://localhost:6009` in Phase 1.
- `storybook-static/` is **not** gitignored — if we ever `build-storybook`, delete the output afterward.

### Phase 1 — Implement `compact` read-first mode in `FormEngine` (toolkit-react) ✅ DONE
- [x] **1.1 Grouping spike** — `ReqoreCollection` (0.64.3, the installed version) renders native group
      headers from item `groups: string[]` (`CollectionGroupHeader`, both `sortByGroupFirst` branches). So
      grouping stays **100% in reqraft** — no reqore change. We set `groups: [getOptionGroup(schema)]` per
      item; ungrouped required/preselected → "General", else "Optional". (Native item `expandable` was
      rejected — it expands into a centered modal, not the inline row we want.)
- [x] **1.2 Read-first item content** — `renderReadFirstContent` swaps each item's `content` between a
      clickable value row (`ReqoreButton`, `.options-readfirst-value`) and the real `renderOption` editor +
      a "Done" collapse (`.options-readfirst-done`). All field wiring preserved. Inline expand state
      (`expandedOptions`), multiple rows open at once. Clickable value control (not item-level `onClick`)
      so header action buttons don't conflict.
- [x] **1.3 Completion meter** — `ReqoreProgress` "N / M fields set" from `getReadFirstCompletion`; no new
      validation.
- [x] **1.4 Grouping** — by schema `group`, title-cased, via native collection group headers.
- [x] **1.5 Density + a11y** — small/flat/minimal Reqore props; `readOnly` keeps rows viewable (eye icon,
      no edit affordance). **a11y completed in v5** (see below): the read-first rows became flat
      `styled-components` `<div>`s in the v2 rework and were initially mouse-only; v5 makes them real
      controls (`role="button"`, `tabIndex={0}`, Enter/Space, focus ring).
- [x] **1.6 Stories** — `Compact`, `CompactReadOnly`, `CompactEmpty`, `CompactReadFirstEditing` added to
      `FormEngine.stories.tsx` (grouped schema with bool/allowed_values/list + a required-empty field).
- [x] **1.7 `play` interaction test** — `CompactReadFirstEditing` asserts: value rows render (Yes/Python/
      "Required — not set") with **no editor mounted**; group headers (Info/Scaling); expand → pre-filled
      editor; edit → `onChange` with `name.value:'updated-name'`; Done → collapse → new value shown.
      Passes in-browser (test-storybook, ~400ms).
- [x] **1.8 Types/docs** — `compact` prop JSDoc on `IFormEngineProps`; new
      [`design/FORM_ENGINE_COMPACT.md`](../design/FORM_ENGINE_COMPACT.md); helpers extracted to
      `readFirst.ts` with unit tests (`__tests__/readFirst.test.ts`).
- [x] **1.9 Green check** — `yarn precheck` **green** (lint clean, **jest 180/180**, prod typecheck clean).
      `test-storybook` on :6009: all 4 compact stories pass.

**Files:** new `src/components/form/engine/readFirst.ts`, `__tests__/readFirst.test.ts`,
`design/FORM_ENGINE_COMPACT.md`; modified `src/components/form/engine/FormEngine.tsx` (compact-gated only)
and `FormEngine.stories.tsx`. **Not committed** (awaiting user go-ahead).

**Layout rework (v2) — after visual review vs the IDE.** The first cut reused the classic
`ReqoreCollection` card-per-field layout (`flat:false` + darkened `customTheme`), which looked heavy and
unlike the IDE's restyled rows. Reworked to a **dedicated compact render path** (`renderCompact` /
`renderCompactRow`, early-return before the collection): **flat two-column rows** (label | value | action,
thin dividers) inside collapsible `ReqorePanel` groups with `✓ all set` / `⚠ N to resolve` badges, the
completion meter, invalid message, and the more-options adder. Styling via theme-aware `styled-components`.
Classic path fully reverted/untouched. Re-verified: `precheck` green (jest 180/180), all 4 compact stories
pass in `test-storybook`. Still **engine-only** — the hero strip / chips / toolbar remain the IDE wrapper
(Phase 3).

**Polish + "Minimal" decision items (v3).** After visual review against the IDE:
- **Completion bar** → replaced `ReqoreProgress` with the IDE's inline `label | track | %` strip
  (`StyledCompletion*`).
- **Group display** → engine gained a `groups?: Record<string, IFormEngineGroup>` prop (label/icon/subtitle/
  sort), keyed by the raw `group` key. `getOptionGroup` now returns the raw key; new `getOptionGroupLabel`
  resolves the display label. Default = title-cased key, no icon, schema order. Research basis: the **server
  defines no group display metadata** — only the bare `group` string (`info`/`advanced`/`resources`/
  `scaling`/`other`/`files`); `sort_group`/`sort_key` exist but are unused; no per-field icon (only
  allowed-values carry `icon_filename`). So each UI owns group display → engine takes it via prop.
- **Toolbar** → search box (filter rows by label) + **Required only** toggle. Filters only affect listed
  rows; the meter reflects the full set.
- New story `CompactRequiredOnlyAndSearch` (play test) + `groups` config on the compact stories. Re-verified:
  `precheck` green (**jest 182/182**), **29/29** `test-storybook` (incl. the toolbar test).

**"Full" toolbar (v4) — the IDE "Fields" dropdown.** Consolidated the toolbar into a `ReqoreDropdown`
matching the IDE's Fields menu (edit-mode only): **Required only** toggle, **Select all** (`handleAddAllOptional`),
**Default fields** (`handleResetToDefaultFields` — drop user-added optionals, keep required/preselected/
loaded values, clear the filter; mirrors the IDE's `handleResetToDefault`), and a searchable add-optional
list (the standalone bottom adder was removed). Row search box kept. New play test `CompactFieldsMenu`
(Select-all adds an optional → Default-fields removes it); `CompactRequiredOnlyAndSearch` updated to toggle
via the dropdown. Verified: `precheck` green (**jest 182/182**), **30/30** `test-storybook`.

**Still deferred to Phase-3 (researched, not built):** allowed-value icons (language logo via
`icon_filename` — needs a filename→URL resolver, so consumer-side). The **hero strip, "Edit code", and the
help Hint stay IDE-only** (the IDE wraps the engine).

**a11y + UX polish (v5).**
- **Keyboard a11y** — read-first rows are now `role="button"` + `tabIndex={0}` with Enter/Space activation
  and a focus ring (they were mouse-only `<div>`s after the v2 rework; corrected the stale plan claim above).
- **`N optional` badge** — the catch-all `optional` group shows `N optional` instead of a misleading
  "all set".
- **Search spans hidden fields** — the top search now matches optional fields not yet in the form too; a
  match surfaces as a dimmed **"Not in form — add"** row that adds + opens the field when activated.
- **Sticky "Additional options (N)" bar** — once the toolbar scrolls off-screen (tracked via an
  `IntersectionObserver` sentinel), a sticky bottom dropdown keeps the add-optional list reachable.
- New stories/tests: `CompactSearchHidden` (search-hidden + keyboard-activate), `CompactScrollable`
  (no-play, for the sticky-bar/search screenshots). Verified: `precheck` green (**jest 182/182**), **30/31**
  `test-storybook` (the 1 failure is the pre-existing `OnValidityChange` flake; all 8 compact stories pass).
  Sticky bar is verified visually (IntersectionObserver/scroll behaviour isn't deterministically unit-testable).

### Verification items (two follow-ups raised by the team)

**(a) "add dpql render to make options support expressions" — a follow-up, NOT a Phase-1/compact task.**
Options can hold *expression* values (`supports_expressions`, `is_expression`, `default_view:'expression'`,
`expressions`, `expressions_url`); they're authored in **DPQL** via the Slate-based **`DpqlEditor`**. The
toolkit form engine **renders no expression editor today** — neither on `develop` nor on
`feature/dpql-editor` (`TemplateField` only does template/direct; `is_expression` is just a flag). The
`DpqlEditor` *component* exists on **`feature/dpql-editor`** (`src/components/dpqlEditor/`) but is **not
wired into the form fields** and not released (local reqraft 0.10.0).
- **Are we waiting on `feature/dpql-editor`?** For the **compact work: NO** — verified the branches are
  orthogonal: `feature/dpql-editor` (29 commits ahead of `origin/develop`, same `04ecdcf` base) **does not
  touch any form-engine file** (`FormEngine.tsx` / `TemplateField.tsx` / `Field.tsx` / form fields unchanged
  there; no `dpql` refs anywhere under `src/components/form`). Only shared file is `.storybook/preview.tsx`
  (the theme tweak, copied from that branch) — no functional dependency, no conflict. For the **expression
  feature: YES** — it needs `feature/dpql-editor` merged (to get `DpqlEditor` onto develop) **and** new
  wiring to render it for expression fields. Compact inherits it for free once wired into
  `renderOption`/`TemplateField` (compact reuses both). Today a compact read row shows "Expression" for
  `is_expression` values.

**(b) "verify the new compact works with all the options props (on_change/refetch, …)" — DONE.**
Compact reuses the shared `handleValueChange` (`on_change` → `meta.events`; `has_dependents` → reset
dependents + `onDependableOptionChange`) and `renderOption` (`depends_on` disabling, templates), so it
inherits all of it by construction. Now covered by a play test: **`CompactOnChangeAndDependents`** —
editing a `has_dependents` + `on_change:['refetch']` field in the expanded read-first editor fires the
`refetch` event **and** resets its `depends_on` dependent, exactly as classic. **33/33 `test-storybook`.**

### Classic-parity features brought into compact (v6 — decision (b))

Decision (b): user chose **per-field + global revert** and **show-field-types as a Fields-menu toggle**
(the two classic features compact lacked).
- **Revert (per-field + global)** — a changed row shows a hover **↺** (`.options-readfirst-revert`) that
  restores that field to its loaded value (`originalValue`); **Revert all changes** in the Fields menu
  (disabled when unchanged) restores the whole form (`handleRevertChangesClick`). Distinct from
  **Default fields** (schema defaults + drop added optionals).
- **Show field types** — a Fields-menu toggle (reuses the existing `showFieldTypes` state /
  `handleShowFieldTypesClick`); when on, each row is annotated with `<type>` (e.g. `<string>`, `<list>`).
- Test: **`CompactRevertAndShowTypes`** (edit → per-field revert restores; toggle show-types → `<string>`
  appears; edit again → Revert-all restores). **34/35 `test-storybook`** (the 1 failure is the pre-existing
  `OnValidityChange` flake; all 10 compact stories pass). `precheck` green (jest 182/182).

### Coverage parity (a) + house style (c) — DONE (v7)

- **(c) House style** — refactored all 6 existing compact play tests + the `clickFieldsMenuItem` helper to
  foxhoundn's shared `_tests*` helpers (`_testsWaitForText`, `_testsWaitForTextToNotExist`, `_testsClickText`,
  `_testsClickButton`, `_testsChangeStringField`, `_testsWaitForInputValue`, `_testsWaitForTextsCount`).
  `waitFor`/helpers are the gate; `sleep` only as a settle (the convention).
- **(a) Parity stories** — added compact stories mirroring the classic matrix: **`CompactFieldTypes`**
  (string/richtext/number/bool/list/hash/rgbcolor read-display + expand-to-edit), **`CompactRequiredGroups`**
  (`required_groups` one-of), **`CompactAnyType`** (`any` type), **`CompactReadonlyDefaultFix`** (schema
  `readonly` value≠default → fixed), **`CompactNonExistentFiltered`** (off-schema values dropped),
  **`CompactHelpDialog`** (new help affordance — a `?` on rows with a long `desc`, opens `OptionsHelpDialog`),
  **`CompactDoesNotCauseInfiniteRerenders`** (render stability). Small feature added: per-row help icon
  (`.options-readfirst-help`).
- **17 compact stories**, `precheck` green (**jest 182/182**), **40/41 `test-storybook`** (the 1 failure is
  the pre-existing `OnValidityChange` flake).
- **Minor residual gaps (covered at engine level by classic, not separately re-tested in compact):** the
  invalid-only filter toggle (`showInvalidOptionsOnly`) and the allowed-values+template warning — both reuse
  the same engine state/`renderOption` the classic stories exercise.
- **(d) real-server verification** remains Phase 2/3 (needs the IDE + a live Qorus) — out of scope for this
  worktree.

### Pre-existing `OnValidityChange` flake — FIXED (v8)

The long-standing intermittent failure (`OnValidityChange › play-test`, "Unable to fire a 'change' event —
please provide a DOM element") was a foxhoundn test querying `.system-option .reqore-textarea` **unguarded**
before the editor had mounted. Fixed by switching to `_testsChangeStringField` (waits for the element, then
fires) and dropping the fixed `sleep`. **The whole `FormEngine` `test-storybook` suite is now 41/41 green —
no remaining failures.** (This is the one foxhoundn-owned test I touched; it's a flake fix following the
house wait convention, not a behaviour change.)

**⚠️ Pre-existing unrelated failure:** `FormEngine.stories.tsx › OnValidityChange › play-test` fails in
`test-storybook` — it queries `.system-option .reqore-textarea` with **no `waitFor`** (a mount race).
**Proven pre-existing on bare `develop`** (fails identically with all Phase-1 code reverted; passes on the
older `feature/dpql-editor` checkout). Out of scope for this task; candidate for a separate one-line
`waitFor` fix.

**Run it:** worktree Storybook is on **http://localhost:6009** →
`/?path=/story/form-engine-formengine--compact` (and `--compact-read-only`, `--compact-empty`).

### Phase 2 — Parity spike on the workflow/step creator (qorus-ide)
- [ ] **2.1** Confirm `creator-get-fields-as-options` returns a workflow/step schema that the options
      renderer handles end-to-end (mount, edit, submit) — compare field-for-field against today's
      `creator-get-fields` (`IField[]`) output.
- [ ] **2.2** Enumerate IField-path machinery that must survive the swap and verify each has an options
      equivalent: **class connections / `resetClassConnections`**, the **"Edit code" handoff**, **drafts**,
      **`reference` (iface-kind links)**, **`on_change` actions**, `get_message`/`return_message`
      (already in `FieldInfo`), required/preselected semantics, removal-with-confirm.
- [ ] **2.3** Confirm whether the IDE consumes the **upstream** `FormEngine` from `reqraft` directly
      anywhere today (the `systemOptions.tsx:490` comment hints yes). Decide Phase-3 render path:
      upstream `FormEngine` vs. local `<Options>` (see §9a).
- [ ] **2.4** Capture every gap as a small, scoped follow-up (engine prop or schema field) — **not** a
      blocker. Update this plan with the gap list before starting Phase 3.

### Phase 3 — Swap workflow/step to options + `FormEngine`; retire the detour (qorus-ide)
- [ ] **3.1** Bump `@qoretechnologies/reqraft` in `qorus-ide` to the release containing Phase 1 (see §7).
- [ ] **3.2** Route the workflow/step creator through `useInterfaceFields` + `FormEngine` `compact`, with a
      thin IDE wrapper supplying hero copy + chips + group labels (descriptor-style, per `RESTYLED_CREATOR`).
- [ ] **3.3** Verify parity from Phase 2 holds in the real creator (drafts, code editor, class connections,
      submit) via the existing full-creator stories (`Step.stories.tsx`, `Workflow.stories.tsx`).
- [ ] **3.4** Delete `RestyledFields`, its descriptors, and the IField read-first scaffolding **only after**
      parity is proven. Confirm no other consumer via grep (`SHARED_COMPONENTS.md` Rule 3).
- [ ] **3.5** Update docs + `AI-DOCS`: rewrite `RESTYLED_CREATOR.md` (or fold into `SYSTEM_OPTIONS.md`) to
      describe compact mode as a `FormEngine` capability; update the `RestyledFields` entry in
      `SHARED_COMPONENTS.md`; refresh affected `AI-DOCS` blocks and run `yarn ai-docs:build`.
- [ ] **3.6** `yarn precheck` + Storybook test-runner green in `qorus-ide`.

### Phase 4 — `group` completeness (qorus server, incremental, non-blocking)
- [ ] **4.1** GitHub issue first (per `qorus-ide/CLAUDE.md` server workflow) → branch off latest `develop`
      → set `group` on every workflow/step `FieldInfo` so the FE grouping fallback can be removed.
      Tracks qorus issue #259. Can land anytime after Phase 3.

### Phase 5 — DPQL expression render for options (toolkit-react) — **GATED on `feature/dpql-editor` merge**
> Not part of the compact migration; a separate form-engine capability. **Does not block** Phases 0–3 (the
> compact work is orthogonal to `feature/dpql-editor` — verified: that branch touches no form-engine file).
> The compact layout **inherits this for free** once it lands, because it reuses `renderOption`/`TemplateField`.

- [ ] **5.0 Prereq** — `feature/dpql-editor` is merged to `develop` (and reqraft re-released) so `DpqlEditor`
      (`src/components/dpqlEditor/`) is available. Until then this phase is blocked. *(Branch state at time of
      writing: 29 commits ahead of `origin/develop`, local/unpushed, reqraft 0.10.0 local build.)*
- [ ] **5.1** Add an **expression render path** to the field renderer: when a field has
      `supports_expressions` (and/or `default_view: 'expression'`), render `<DpqlEditor>` (with a toggle
      between literal/template/expression) instead of the plain field. Hook it in at
      `TemplateField` / `FormField` (`src/components/form/fields/`) so **both** classic and compact get it —
      compact must change **nothing** (it calls the same `renderOption`).
- [ ] **5.2** Wire the schema's expression context through to `DpqlEditor` (`expressions`,
      `expressions_url`, `server_expression_handling`, provider/record context); persist the value as the
      `IQorusExpression` AST (`{ exp, args, type, is_expression }`) — `FormEngine` already tracks the
      `is_expression` flag in `fixOptions`/`handleValueChange`.
- [ ] **5.3** Improve the **compact read row** for expression values: show a short rendering of the
      expression (e.g. the DPQL text) instead of the generic "Expression" placeholder
      (`formatOptionValue` in `readFirst.ts`).
- [ ] **5.4** Stories + `play` tests: an options schema with a `supports_expressions` field — author an
      expression via the DPQL editor, assert the persisted `is_expression` value; one **compact** variant to
      prove the read-first row + expand-to-edit works with expressions.
- [ ] **5.5** Docs: extend `design/FORM_ENGINE_COMPACT.md` (and the engine's expression docs) to cover the
      expression/DPQL render.

---

## 7. Cross-repo sequencing & release

- Phase 1 lands in **`toolkit-react`** (published as `@qoretechnologies/reqraft`). The IDE can't consume it
  until it's **released and the version is bumped** in `qorus-ide/package.json` (currently `reqraft ^0.8.11`).
- Therefore Phases 2 (parity spike) can run **in parallel** with Phase 1, but Phase 3 (the swap) is gated on
  the reqraft release. Sequence: **1 + 2 in parallel → release/bump → 3 → 4 (anytime)**.
- We do **not** publish; the maintainer handles the reqraft release. We prepare the change and wait.

---

## 8. Testing & verification strategy

**toolkit-react (Phase 1)**
- **Stories + `play`** in `FormEngine.stories.tsx` (`@storybook/test`: `expect/within/waitFor/userEvent/fireEvent/fn`), reusing `src/stories/Tests/utils`. Selectors follow the existing `.reqore-collection-item.system-option` convention.
- **jest** (`yarn test`) for any pure helpers (e.g. value-formatting) extracted.
- **`yarn precheck`** (= `lint` + `test` + `build:test:prod`) must pass; **`yarn test-storybook`** against a running Storybook (port 6008). Chromatic visual review is maintainer/CI-run — flag diffs.
- Tests assert **real** behaviour (read-first → click → edit → onChange → collapse); removing the read-first code must break them.

**qorus-ide (Phases 2–3)**
- Extend the existing creator stories (`Step.stories.tsx`, `Workflow.stories.tsx`) to drive the
  options-backed compact creator (read-first rows, edit, submit, drafts, code editor).
- `yarn precheck`; Storybook test-runner; `yarn ai-docs:check` clean after doc regen.

**qorus server (Phase 4)**
- Extend the relevant `.qtest` (HTTP-driven only — no qorus-core linking), per `qorus-ide/CLAUDE.md`.

---

## 9. Open questions / risks

- **9a. `<Options>` vs upstream `FormEngine` convergence.** The IDE renders most options through its local
  `systemOptions.tsx` fork, not upstream `FormEngine`. Phase 1 correctly builds `compact` upstream; Phase 3
  must decide whether workflow/step render via **upstream `FormEngine`** (preferred — the actual goal) or the
  local fork (which would then also need `compact`). Fully converging the two engines is **out of scope** —
  track separately. Decided in Task 2.3.
- **9b. Grouping primitive — the one place Phase 1 could exceed reqraft.** `ReqoreCollection` already exposes
  item `groups?: string[]` + collection `sortByGroupFirst?: boolean` (confirmed in the installed
  `@qoretechnologies/reqore` dist types). Task 1.1 must confirm whether that renders **labeled group
  sections/headers** (what read-first needs) or merely sorts grouped items together. Preferred outcome: keep
  Phase 1 **100% in reqraft** by reusing those props or composing per-group Reqore panels inside `FormEngine`.
  Only if a genuine new capability is required does a change land in the **separate `reqore` repo** (checked
  out locally at `/Users/nick/Projects/qorus-frontend/reqore`) — an upstream contribution per
  `REQORE_REQRAFT.md`, with its own release. That would be the *only* cross-repo spill in Phase 1.
- **9c. Parity surface.** Class connections, "Edit code" handoff, drafts, `reference` links (Task 2.2) are the
  riskiest items — they're workflow/step-specific and not exercised by the modern options surfaces. Treat any
  gap as a scoped follow-up, never a silent shortcut.
- **9d. `compact` naming.** Extend `compact` to mean read-first, or split `readFirst`/`mode` from a
  density-only `compact`? Default: extend `compact` (matches the user's framing). Confirm before 1.2.
- **9e. `group` coverage.** Until Phase 4, some fields lack `group`; the engine needs the same sensible
  fallback `RestyledFields` uses (required/preselected → "General", else "Optional fields").

---

## 10. Definition of done

- `FormEngine` `compact` mode renders the read-first look from an options schema, with stories + passing
  `play`/jest tests and green `precheck` + Storybook test-runner (toolkit-react).
- Workflow/step creator renders via options + `FormEngine` `compact`, at parity with today (drafts, code
  editor, class connections, submit), with a thin IDE wrapper for hero/chips.
- `RestyledFields` and the IField read-first scaffolding are removed; no dead code, no duplicated logic.
- Docs + `AI-DOCS` updated across both FE repos; `ai-docs:check` clean.
- (Incremental) server `group` completeness issue filed/landed.
- Nothing committed or pushed without explicit user approval.

---

## 11. Key file map (reference)

**toolkit-react** — `src/components/form/engine/FormEngine.tsx` (engine; `compact` at :296/:316/1029–1036;
item `content` at :1218–1239), `…/FormEngine.stories.tsx`, `src/components/form/fields/template/TemplateField.tsx`,
`src/components/FocusedEditing.tsx`, `src/stories/Tests/utils`, `design/` (new compact doc).

**qorus-ide** — `src/components/Field/systemOptions.tsx` (`<Options>` twin), `src/hooks/useInterfaceFields.tsx`
+ `useInterfaceEditor.tsx`, `src/containers/InterfaceCreator/panel.tsx`, `…/workflowsView.tsx`,
`…/restyled/RestyledFields.tsx` + `descriptors.ts`, `src/components/FieldWrapper/index.tsx` (`IField`,
`IRestyledDescriptor`), `design/{RESTYLED_CREATOR,SYSTEM_OPTIONS,connection-options-api,REQORE_REQRAFT,SHARED_COMPONENTS}.md`.

**qorus (server)** — `Classes/QorusMapManager.qc` (`FieldInfo`/`MetaFieldInfo`, `group`,
`getUiFields`/`convertDataToUiOptionsFormat`), `Classes/{WorkflowMetadata,StepMetadata}.qc`,
`Classes/QorusCreatorWebSocketHandler.qc` (`creator-get-fields-as-options`), `design/connection-options-api`-equivalent
flow, qorus issue #259.

---

## Info-display variant evaluation (archived 2026-06-11)

This is the pre-decision analysis that drove the info-display pick. `stripe-expand`
(variant C below) was chosen; the other three and the temporary `compactInfoDisplay`
prop were deleted. Kept here as the decision record (moved out of
design/COMPACT_INFO_DISPLAY.md, which now documents only the shipped display).

## 5. Proposed variants (to build behind `compactInfoDisplay` after sign-off)

All variants keep: `?` → dialog for Tier 3, tap (not hover) for any popover, and the existing
`Required` tag. They differ in how Tier 1 + Tier 2 render.

### A — `subtitle-inline` (product-convention baseline)
- `short_desc` = muted line under the label (the RestyledFields pattern; truncated to 1 line,
  tap label area to un-truncate).
- Tier-1 messages = slim `ReqoreMessage` strips **always visible** directly under the row.
- Tier-2 messages/info = collapsed behind a small count badge on the row (`2 ⓘ`, tap-popover).
- Cost: +1 text line per described field, +1 strip per critical message. Most literal, most
  vertical growth.

### B — `icon-cluster` (minimal rows)
- Rows stay one line. Right-side cluster: ⓘ (tap-popover with short_desc + default note) and an
  intent-coloured badge with count for messages (tap-popover with the full strips).
- Cheapest vertically; **known risk:** fails criterion 4 for Tier 1 (badge-only critical info,
  flagged by research as easy to miss) unless paired with row tinting — kept as the
  control/contrast variant.

### C — `stripe-expand` (severity edge + disclosure)
- 2–3 px **intent stripe** on the row's left edge (worst intent wins) — zero vertical cost,
  glanceable severity; danger/warning also tint the row background slightly.
- An info affordance expands an in-row details area (`ReqraftCollapsibleContent`) holding
  short_desc, messages, default note; **auto-expanded when Tier 1 exists**.
- Middle ground: quiet until something matters, one tap for everything else.

### D — `adaptive` (tier-driven hybrid — expected recommendation)
- Tier 1 → always-visible slim strips under the row (as A) **plus** the intent stripe (as C).
- `short_desc` → muted subtitle line, only when present (as A).
- Tier 2 → count badge + tap-popover (as B).
- Narrow viewports: subtitle wraps, strips go full-width, badges grow to 40 px touch targets.
- Combines what each tier actually needs; slightly more rules to implement.

## 6. Story / comparison plan

- Temporary prop `compactInfoDisplay: 'subtitle-inline' | 'icon-cluster' | 'stripe-expand' | 'adaptive'`
  on `FormEngine` (default = current behaviour until the pick).
- One story per variant on the **Basic fixture** + story-level additions to stress the tiers: a
  field with two messages (warning + info), a long `short_desc`, a markdown `desc`, an unmet
  dependency, and a required-group pair.
- Each variant also rendered in a **narrow-viewport story** (mobile is pass/fail, not a follow-up).
- After the pick: losing branches and the prop are deleted (single renderer, like the hash view).

## 6b. Variant comparison at a glance

| | A · Subtitle Inline | B · Icon Cluster | C · Stripe Expand | D · Adaptive |
|---|---|---|---|---|
| **short_desc** | muted subtitle under the label (truncated, tap to expand) | inside the badge tap-popover | inside the expandable panel | subtitle under the label (as A) |
| **Tier 1 (danger/warning, deps)** | strips always visible under the row | behind the intent-coloured count badge (tap) | intent edge-stripe + panel **auto-opens** | strips always visible **+** edge-stripe |
| **Tier 2 (info/success, default notes)** | `ⓘ n` badge → tap-popover | same badge as Tier 1 | inside the panel (after Tier 1) | `ⓘ n` badge → tap-popover |
| **Row height (nothing to say)** | 1 line | 1 line | 1 line | 1 line |
| **Row height (described field)** | 2 lines (subtitle) | 1 line | 1 line (+stripe) | 2 lines |
| **Vertical cost of a warning** | +1 strip | none (hidden) | +panel (auto-open) | +1 strip |
| **Taps to read critical info** | **0** | **1** ⚠ fails criterion 4 | **0** (auto-open) | **0** |
| **Taps to read short_desc** | 0 (truncated) / 1 (full) | 1 | 1 | 0 / 1 |
| **Crowding risk** | highest (every described row grows; strips stack) | lowest | medium (auto-open panels can stack) | medium-high |
| **Mobile (360 px)** | strips go full-width, wrap | cleanest fit | stripes + panels fit | as A + stripes |
| **Story** | `SubtitleInline` (+`MobileSubtitleInline`) | `IconCluster` (+`MobileIconCluster`) | `StripeExpand` (+`MobileStripeExpand`) | `Adaptive` (+`MobileAdaptive`) |

All variants share: tap (never hover) for popovers, the `?` → markdown dialog for Tier 3, the
`Required` tag, field chrome (icon/image/intent), and the height-stable inline editing (the
editing row pins to the read row's measured height).

## 7. Decision checklist for the review

- [ ] Tier classification agreed (esp.: are info/success messages allowed to hide behind a badge?)
- [ ] Variant picked (or hybrid adjustments)
- [ ] short_desc truncation rule (1 line + tap vs always wrap)
- [ ] Does the picked variant change the **editor card/inline editor** too, or read rows only?
- [ ] Mobile behaviour approved on the narrow-viewport stories
