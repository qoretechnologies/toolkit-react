# SmartEditor visual polish — Reqore vocabulary alignment

Follow-up to the `0.10.0` UX batch (see
[`SMART_EDITOR_UX_POLISH.md`](./SMART_EDITOR_UX_POLISH.md)). The editor
stack ships visually minimal — bare `ReqoreMenu` chrome, no effects,
no `customTheme`, hand-rolled CSS overlays. The rest of the Qore IDE
uses a rich Reqore styling vocabulary (gradients, intents, frost,
glow, relative-darken sub-surfaces). This task brings the editor up to
parity.

**Status:** done — committed in `c006a79`. Reqore styling vocabulary applied across completion / hover / signature popovers, kind chips, diagnostic messages, dividers, focused-row, loading overlay. **Awaiting browser verification.**
**Scope:** styling-only — no behaviour or API changes.
**Estimated size:** ~150 lines, 1 day.

## Goal

The completion popover, kind chips, diagnostic messages, hover popover,
and loading overlay should be visually indistinguishable from a Qonsole
chat sub-surface or an FSM detail panel. A consumer dropping the editor
into the IDE should not need a single `<style>` block to make it
"feel right".

## Research findings

Catalogued by the research pass at
`design/SMART_EDITOR_UX.md` is not the right home for this — kept
inline below. Source files (qorus-ide, since Reqraft has no design
constants of its own yet):

### Reusable effect constants

In `qorus-frontend/qorus-ide/src/components/Field/multiPair.tsx`
(lines 20-124):

| Constant | Direction / colors |
|---|---|
| `FancyColorEffect` | plum `#12002f` lighten-2 → `#12002f` |
| `QorusColorEffect` | `#6e1977:lighten:3` → `#6e1977` |
| `SynthColorEffect` | `#13163a` → `#6e1977` (AI buttons) |
| `PositiveColorEffect` | `info` → `info:darken:3` |
| `WarningColorEffect` | `warning:lighten:2` → `warning:lighten:3` (animate: always) |
| `PendingColorEffect` | `pending:lighten:3` → `#160437` |
| `NegativeColorEffect` | `danger:lighten:3` → `danger:darken:3` |
| `SaveColorEffect` | `success:lighten:3` → `success:darken:3` |
| `SelectorColorEffect` | `main:lighten:3` → `main:darken:3` |

In `qorus-frontend/qorus-ide/src/constants/util.ts`:

```ts
DRAWER_OPACITY = 0.6;
DRAWER_CONTENT_EFFECT = { backgroundBlur: 20 } as const;
DRAWER_STYLE = { opacity: DRAWER_OPACITY, contentEffect: DRAWER_CONTENT_EFFECT };
QorusPurpleIntent = ReqoreIntents.CUSTOM1;
AttentionIntent = ReqoreIntents.CUSTOM2;
```

Theme intents (from `defaultReqoreTheme`):
- `success: '#4a7110'`
- `custom1: '#762f7e'` (Qorus purple)
- `custom2: '#b34e1d'` (attention orange)

### `customTheme` palette in current use

| Use | Token |
|---|---|
| Page card | `'#0a0a0a'` |
| Metrics / history panels | `'#1a1a1a'` |
| Focused editing overlays | `'#111111'` |
| Header bars / tabs | `'#000000'` |
| Dashboard status | `'#181818'` |
| Sidebar | `'#262626'` |
| Qonsole panel main | `'#190819'` |
| Qonsole UI-component frames | `'#190e1955'` (note 55 alpha) |
| Qonsole tables | `'#351e3556'` |
| Qonsole input minimal | `'#1b1525'` |
| Qonsole assistant bubble | `'#9a749a'` |
| Sub-surface (nested form) | `'main:darken:1:0.5'`, `'main:darken:2'`, `` `main:darken:${level}` `` |

### Reqore Effect / theming API confirmed

`<ReqoreMenu>`, `<ReqoreMenuItem>`, and `<ReqorePopover>` all accept
`effect`, `customTheme`, `intent`. `ReqorePopover` also accepts
`blur: boolean`, `backgroundBlur: number`, `transparent: boolean`.
Color tokens support `<base>:<lighten|darken>:<1-30>:<alpha 0-1>`.

### Precedent for "intellisense" feel

`qorus-frontend/qorus-ide/src/components/Qonsole/QonsoleCompletionPopup.tsx`
is the existing precedent — a styled wrapper at `#1a1a1a` with a
hairline border + custom scrollbar. Our SmartEditor popover is a
candidate to subsume it (or at minimum match it).

## Design decisions

1. **Reqraft mirrors the qorus-ide constants — not imports them.**
   Reqraft is meant to be standalone-usable. Cloning the constants
   (with attribution comments) into `src/components/smartEditor/styling.ts`
   keeps Reqraft a tier-1 library. Constants to mirror:
   - `SMART_EDITOR_OVERLAY_EFFECT` (= `DRAWER_CONTENT_EFFECT` shape: `{ backgroundBlur: 20 }`)
   - `SMART_EDITOR_OVERLAY_OPACITY` (= `0.6`)
   - `SmartEditorIntents` map with `purple: 'custom1'`, `attention: 'custom2'` (caveat: only meaningful when the consuming app has registered those intents in its `ReqoreUIProvider` theme; we document this)

2. **Pick a tone family for the popover container.** The completion
   popover is "code-editor adjacent" — match the page-card tone
   (`#0a0a0a` / `#1a1a1a`) rather than the Qonsole purple. Reason: the
   editor lives inside arbitrary host pages (Alert Rule, FSM, ad-hoc
   forms) — purple would clash. Use `customTheme={{ main: '#1a1a1a' }}`.

3. **Use `backgroundBlur: 20`** on the popover and the hover popover
   so they sit on the host page like a Reqore drawer would. Combined
   with a `transparent` flag, it gives the frosted-glass feel.

4. **Kind chips** — keep `badge` shape but stop using `minimal: true`
   alone. Replace with subtle per-kind `intent`:
   - `keyword` → `intent: 'info'`
   - `function` / `method` / `class` → `intent: 'success'`
   - `variable` / `field` / `property` → no intent (default chip)
   - `constant` / `value` → `intent: 'warning'`
   - `wizard` (Qonsole-specific) → `intent: 'pending'` + icon
   Per-kind intent reads better against the dark surface than uniform
   muted badges.

5. **Diagnostic `ReqoreMessage`s** — always pair with `opaque={false}`
   so they blend with the surface (matches every existing Qonsole
   message). Apply a gradient effect:
   - severity 1 (Error) → `NegativeColorEffect`
   - severity 2 (Warning) → `WarningColorEffect`
   - severity 3+ (Info) → `PendingColorEffect`

6. **Loading overlay** — drop the hand-rolled `<div>` with `rgba(0,0,0,0.06)`.
   Replace with `<ReqorePanel transparent backgroundBlur={20} ...>`
   wrapping `<ReqoreSpinner>`. Native Reqore composition.

7. **Focused row highlight** — use `intent='info'` on the focused
   `ReqoreMenuItem` (instead of the default `selected={true}` purple)
   for better contrast on the `#1a1a1a` surface.

8. **Hover popover** — same frost treatment as the completion popover.
   Border-radius and shadow inherited from Reqore — no overrides.

9. **Group dividers** — `<ReqoreMenuDivider>` already accepts an
   `intent` — set `intent='muted'` and reduce the label opacity so
   sections separate visually but don't shout.

## Surface area

| File | Change |
|---|---|
| `src/components/smartEditor/styling.ts` | **new** — exports `SMART_EDITOR_OVERLAY_EFFECT`, `SMART_EDITOR_OVERLAY_OPACITY`, `SMART_EDITOR_POPOVER_CUSTOM_THEME`, kind-to-intent map, severity-to-effect map |
| `src/components/smartEditor/SmartEditor.tsx` | apply: popover `customTheme` + `backgroundBlur` + `transparent`; per-kind chip intent; diagnostic message `opaque={false}` + per-severity effect; loading overlay rewritten via Reqore primitives; focused row `intent='info'`; divider `intent='muted'` |
| `src/components/smartEditor/useLspAutocomplete.ts` | extend `ICompletionDropdownItem` with optional `kindIntent` resolved from the kind-to-intent map |
| `src/components/dpqlEditor/DpqlEditor.tsx` | (no change — visual polish lands generic in SmartEditor) |
| `src/components/qonsoleSmartInput/QonsoleSmartInput.tsx` | optional: add a `tone?: 'card' \| 'qonsole'` prop so the Qonsole wrapper can request the purple-tinted theme (`#190819`) when embedded in the chat panel instead of the default card tone |

## Visual-spec verification

Storybook is the verification harness. The following stories should
exercise every visual surface:

- `Components/DpqlEditor → WithSemanticTokens` — kind chips, popover container
- `Components/DpqlEditor → WithMixedContent` — chips on a richly-coloured doc
- `Components/QonsoleSmartInput → WithDiagnostics` — message panel + inline underlines
- `Components/QonsoleSmartInput → LiveQonsole` — full live look
- `Components/SmartEditor → WithMarkdownDocs` — hover doc tooltip

Manual checks:

- Light + dark theme — toggle in Storybook addon; the editor must
  remain legible in both
- Behind a Qonsole-tinted host (`'#190819'`) and behind a card host
  (`'#0a0a0a'`) — pop both into Storybook decorators to confirm

## Tasks

### Setup

- [ ] Create `src/components/smartEditor/styling.ts` with the constants
      table from §design-decisions §1, §3, §4, §5. Inline the source
      attribution as a comment pointing at the qorus-ide files.

### Popover container

- [ ] In `SmartEditor.tsx`, replace the bare `<ReqorePopover>` with
      one that takes `customTheme={SMART_EDITOR_POPOVER_CUSTOM_THEME}`,
      `transparent`, `backgroundBlur={20}`, `effect={{ glow: { color: 'custom1:darken:1:0.2', size: 0.05, blur: 30 } }}`
- [ ] Same treatment for the hover popover
- [ ] Verify the chip-anchored Replace-mode popover inherits

### Menu items

- [ ] Per-kind intent map — extend `ICompletionDropdownItem` with
      `kindIntent?: TReqoreIntent`
- [ ] Populate `kindIntent` in the mapping step of `performCompletionRequest`
- [ ] Pass `intent={kindIntent}` to `<ReqoreMenuItem>`
- [ ] Change focused-row to `intent='info'`
- [ ] `<ReqoreMenuDivider intent='muted'>`

### Diagnostic surface

- [ ] `<ReqoreMessage>` per diagnostic gains `opaque={false}` and
      `effect={severityToEffect(severity)}` from the new styling
      module
- [ ] Optional follow-up: hover on the inline wavy underline shows
      a rich `<ReqorePopover>` instead of native browser `title=` —
      defer if scope creeps

### Loading overlay

- [ ] Replace hand-rolled `<div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }}>`
      with `<ReqoreControlGroup vertical wrap='center'>` or a styled
      `<ReqorePanel transparent backgroundBlur={20} flat>` containing
      `<ReqoreSpinner>` — confirm the editor body shows through
- [ ] Confirm Phase 4's `loadingIndicator={null}` opt-out still works

### Qonsole tone override

- [ ] Add `tone?: 'card' | 'qonsole'` to `QonsoleSmartInput` props
      (default `'card'` — preserves current behaviour)
- [ ] When `'qonsole'`, pass `customTheme={{ main: '#190819' }}` to
      `SmartEditor` (requires a new pass-through prop `customTheme?`
      on `ISmartEditorProps`)

### Tests

- [ ] No new play tests required — visual-only
- [ ] All existing 263 jest + 152 storybook play tests still pass
- [ ] Run `yarn build:test:prod && yarn lint && yarn test`
- [ ] Run `yarn test-storybook --url http://localhost:6008`

### Verification

- [ ] **STOP — user verifies in browser**: each story listed under
      §visual-spec verification looks like the rest of the IDE
- [ ] Commit

## Out of scope

- Animation tuning (`animate: 'hover'` on items / `animationSpeed`) —
  saved for a separate pass if the user wants it
- Scrollbar styling for the popover — defer; Reqore's default
  scrollbar is fine
- Light-theme tuning specifically — current palette is dark-first;
  light-theme support is a separate batch
- Touching the `ReqoreRichTextEditor` panel chrome itself (the editor
  body) — that lives in Reqore upstream and any change should be a
  Reqore PR
