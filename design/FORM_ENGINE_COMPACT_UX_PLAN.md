# FormEngine Compact — UX Improvement Plan

> Status: **proposal / for review.** Nothing here is implemented yet.
> Scope: the compact ("read-first") `FormEngine` that will replace the classic
> engine in the IDE. Goal: keep its density but make it feel **calm, scannable,
> and guiding** instead of crowded and alarming.

---

## 0. TL;DR

The compact engine's *information architecture is right* (read-first rows you
drill into). What's wrong is **visual signal management**: it currently runs
**five overlapping status systems at once** and treats *untouched draft fields*
as **hard red errors**. The result reads like a form that's on fire when it's
actually just unfinished.

Three changes do ~80% of the work:

1. **Collapse the 5 status systems into 1.** One global completion signal at the
   top; demote/remove the redundant red banner and the per-group/per-row status
   pills.
2. **Reframe "errors" as "to-dos."** Don't show red validation errors on fields
   the user hasn't touched. *Unset ≠ error.* Validate on interaction/submit.
3. **Lock a strict one-line row template** and push everything variable
   (descriptions, error reasons, nested previews, default hints) **behind
   progressive disclosure**. One scannable line per field by default.

Everything else (calmer value chips, less chrome, smarter ordering, a "what's
next" path) compounds these.

---

## 1. North star

> A configuration **summary you can read top-to-bottom in seconds**, that quietly
> tells you *what's done, what's left, and what to do next* — and gets out of the
> way when you're just scanning.

The audience is technical (developers configuring Qorus interfaces). They *want*
density — the model is a **good data table / code editor**, not a consumer
wizard. So the goal is **"calm density,"** not fewer fields. Think: the
difference between a well-set spreadsheet and a ransom note.

---

## 2. What's wrong today (diagnosis)

Grounded in the screenshots + the implementation
([`CompactToolbar.tsx`](../src/components/form/engine/CompactToolbar.tsx),
[`CompactRow.tsx`](../src/components/form/engine/CompactRow.tsx),
[`FormEngine.tsx`](../src/components/form/engine/FormEngine.tsx),
[`compactRowStyles.ts`](../src/components/form/engine/compactRowStyles.ts)).

### 2.1 Five competing status systems
At one glance the user is shown completeness/validity **five different ways**:

| # | System | Where | Code |
|---|--------|-------|------|
| 1 | Draft badge + `12/21 fields set` + progress bar + `57%` | header | `CompactToolbar` `StyledCompletion` |
| 2 | Red banner: "6 fields are not valid… click to only show invalid" | header | `CompactToolbar` invalid banner |
| 3 | Per-group pills: `4 OPTIONAL`, `5 TO RESOLVE` | group headers | `FormEngine.tsx:1973` |
| 4 | Per-row red stripe + red ⓘ button + inline red message box | each invalid row | `CompactRow` tier-1 `StyledInfoPanel` |
| 5 | Per-row Draft chip / required asterisk / ⓘ toggle | each row | `CompactRow` `draftChip`, asterisk |

These don't reinforce — they **compete**. The user can't tell which is the
"real" status, so the whole UI reads as urgent. (NN/g *Aesthetic & minimalist
design*: every extra unit of status dilutes the rest.)

### 2.2 Premature, alarmist validation
The form is in **DRAFT**, yet untouched fields show **hard red errors** —
"Text value is empty," "Hash arguments are invalid," "Required — not set." Two
problems:

- **Unset is not an error.** Showing red on fields the user hasn't even reached
  punishes them for not-yet-doing-something. This is the single biggest driver
  of the "overwhelming" feeling. (Baymard / NN/g on inline validation: validate
  **on blur or on submit**, not aggressively on load; reserve red for *wrong*,
  not *empty*.)
- **The error chrome is layout-disruptive.** Full-width dark-red `ReqoreMessage`
  boxes render *between rows*, shoving content down and shattering the table
  rhythm that makes the form scannable. Six of them = a wall of red.

### 2.3 No focal point / flat hierarchy
Every row carries roughly equal visual weight; labels, values, blue chips,
swatches, nested trees and error boxes all shout at the same volume. There's no
"look here first," no obvious **next action**. The eye bounces. (Visual
hierarchy via size/weight/colour/space is absent within the row grid.)

### 2.4 Inconsistent row anatomy breaks scannability
Rows are one line (`Option with value · 123`), or two (label + sub-description),
or three+ (label + value + inline error box), or have an embedded object tree
with "Show more." The **grid rhythm** — the thing that makes a dense list
scannable — is constantly broken by inline variants rendered **by default**.

### 2.5 The value column has no consistent visual language
Plain text, **saturated-blue template chips** (`Test (local)`, `Richtext
Template`), colour swatch + hex, file pill, nested data tree — each a different
weight and colour. The blue chips in particular are *louder than the field
labels*, so decoration outshouts meaning. (Tufte: colour should encode data, not
ornament.)

### 2.6 Heavy non-data "chrome"
Recessed value surfaces, intent stripes, group spines, required-group rails,
dividers, hover fills — a lot of subtle lines/fills create a **busy texture**
before any content is read. (Tufte *data-ink ratio*: most separators could be
whitespace.)

### 2.7 Weak grouping semantics
"General" is a vague catch-all; "Optional/General" isn't a meaning the user
reasons with. 21 fields in 2 buckets, ordered by schema, with no
prioritisation. Findability relies on the filter box.

---

## 3. Principles we'll design to

| Principle | Source | Applied here |
|---|---|---|
| **One primary status channel** | NN/g *Visibility of system status* + *Minimalist design* | Collapse 5 status systems → 1 meter |
| **Validate at the right time** | Baymard; NN/g *Error prevention* | Unset ≠ error; validate on blur/submit |
| **Severity = colour, not area** | Tufte; Material/Carbon error patterns | Replace red boxes with a dot/accent |
| **Progressive disclosure** | NN/g | One line per row; reveal the rest on demand |
| **Data-ink ratio** | Tufte | Whitespace > borders for separation |
| **Recognition over recall** | NN/g | Read-first rows (already good) — keep |
| **Chunking ~5–7** | Miller's law | Smaller, purpose-named groups |
| **Ask only what's needed** | GOV.UK *question protocol* | Defer/hide rarely-used optional fields |
| **Error summary + adjacent message** | GOV.UK Design System | A navigable "needs attention" section, not a red bar |

The throughline: **the IDE audience tolerates density but not noise.** Cut
*ink*, not *information*.

---

## 4. The redesign — concrete moves

### 4.1 Collapse 5 status systems into 1

**Keep** the top completion strip as the *single* global status. **Evolve it** so
it carries everything the other four systems were saying:

- Segment the bar into **set-&-valid / needs-attention / unset** (e.g. green /
  amber / track), so "57% done, 6 need attention" is legible in one glance —
  no separate red banner needed.
- The **"6 need attention"** count becomes a quiet, clickable affordance *on the
  meter* ("→ 6 to resolve") that filters to those fields. This replaces the
  red banner (system #2) with a calm, constructive control.
- **Drop the per-group `4 OPTIONAL` pill entirely** (the group is already
  labelled "Optional"). Keep a per-group "N to resolve" **only when > 0**, muted
  and right-aligned — or better, a thin per-group progress underline.
- **Demote the per-row Draft chip**: the *global* Draft state is enough; per-row,
  "changed" is better shown by the revert ↺ affordance alone.

Net: the user has **one** place to read status, and **one** click to act on it.

### 4.2 Errors → To-dos (validation timing & severity)

Introduce a 3-state model for a field's status, and **stop conflating them**:

| State | Meaning | Default treatment |
|---|---|---|
| **Unset** | No value, not required | Muted `—` / "Not set". **No alarm.** |
| **To-do** | Required (or required-group) but unset, untouched | **Quiet amber** dot + "Needs a value". Not red, not a box. |
| **Invalid** | User entered something that fails validation | **Red**, but only **after the field is touched** or **after a submit attempt**. |

Rules:
- **Untouched required fields are to-dos, not errors.** In a DRAFT, "Required —
  not set" should be a calm amber hint, not a red error with a full-width box.
- **Validation fires on blur / on submit**, not on load. Track a per-field
  `touched` flag (or a form-level `submitAttempted`).
- **The error reason moves off the default row.** Show at most a 1-word/short
  inline hint after the value ("empty", "invalid"); the full message appears
  **only when the row is focused/expanded** (where the editor's own message strip
  already lives) or in the "needs attention" summary.

This one change removes the wall of red in the screenshot: those six boxes become
calm amber to-dos until the user engages or hits Submit.

### 4.3 The row: one strict template + progressive disclosure

Lock a **constant 3-zone row** and keep it one line by default:

```
[ icon? · Label · req-dot ]   [ value summary ……………… ]   [ status · actions ]
            label col                 value col (ellipsis)        fixed right
```

- **Constant height, constant alignment, constant zones.** The current grid is
  already close (`StyledGroupBody .readfirst-row`); the fix is *what we allow to
  break it.*
- **Move out of the default row, behind disclosure (ⓘ / focus / expand):**
  - field **descriptions / subtitles** (currently inline under the label),
  - **error/validation messages** (currently full-width boxes),
  - **default-value hints**,
  - **nested object/hash previews** (the `schemaOption2 → Show more` tree) →
    collapse to the "Object · 1 field" summary; reveal the tree only on expand.
- Result: a 21-field form is **21 scannable lines**, each of which *can* expand —
  rather than a variable-height stack you have to parse.

### 4.4 Value language: calm & consistent

- **Desaturate the template chips.** `Test (local)` / `Richtext Template`
  currently use saturated blue and outshout the labels. Use a quiet, low-contrast
  chip (subtle surface + the `$` template glyph) so the **label leads** and the
  value supports. Reserve saturated colour for *state* (to-do/invalid), not for
  *value type*.
- **One muted weight for all "set" values** (text, hex, filename, count). The
  swatch/file-icon/`$`-glyph carry the type; the text stays uniform.
- **"Not set" gets the lightest possible treatment** (muted, no italics arms-race
  with errors) so empty rows visually *recede* rather than read as problems.

### 4.5 Reduce chrome (data-ink)

- Replace the **red left stripe + red box + red ⓘ** trio with a **single status
  dot** in the right-hand status slot (colour = severity). One mark, not three.
- **Whitespace over borders.** Drop the recessed value-surface fill and the
  group spine where they don't encode meaning; let alignment + a little more
  vertical rhythm do the grouping. (Keep the **required-group rail** — that one
  *does* encode a real relationship.)
- Audit every line/fill in `compactRowStyles.ts` against "does this encode data?"
  If not, it's a candidate for removal.

### 4.6 Grouping, ordering, findability

- **Default sort within a group = needs-attention → set → optional-unset.** Put
  what the user must act on at the top of each group automatically (the existing
  `invalid`/`unset` sort modes, but as the smart default for a draft).
- **Name groups by purpose.** "General" is a non-answer; if the schema gives no
  meaningful group, prefer a single **Required / Optional** split over a vague
  "General" bucket.
- **A pinned "Needs attention (6)" section** at the very top when there are
  unresolved fields — the form's built-in answer to "what do I do next," and the
  constructive replacement for the red banner (GOV.UK error-summary pattern, but
  calm and always-navigable).
- Keep optional-but-unset fields **collapsed by default** behind the existing
  "Optional (N)" disclosure, so the default view is "what's set + what's needed."

### 4.7 The "what's next" path

The form should always answer *what's left?* and make it one click to get there:

- Meter → click "6 to resolve" → filter to unresolved (reuse `showInvalidOnly`,
  but renamed to *"needs attention"* and including required-unset to-dos).
- On **Submit** with unresolved fields: scroll-to + focus the first, and *now*
  promote to-dos to errors (the flash machinery already exists).
- Optional niceties: keyboard `n`/`p` to jump between unresolved fields; a sticky
  "Next: <field> →" hint while editing.

---

## 5. Phased roadmap (impact × effort)

### P0 — quick wins (high impact, low effort): "stop shouting"
1. **Unset ≠ error.** Don't render red boxes/stripes for untouched required/empty
   fields; downgrade to quiet amber to-dos. *(biggest single win)*
2. **Remove the red invalid banner**; fold the count into the meter as a quiet
   "→ N to resolve" control.
3. **Drop the `N OPTIONAL` group pill**; show "N to resolve" only when > 0, muted.
4. **Move field descriptions + error messages off the default row** (behind ⓘ /
   focus). One line per row.
5. **Desaturate template chips.**

> P0 alone should resolve "crowded and overwhelming" for the screenshot case.

### P1 — structural (medium effort): "calm density"
6. Segmented completion meter (set / to-do / unset).
7. Strict row template + collapse nested previews to summaries by default.
8. Single status-dot system; remove redundant stripes/boxes/ⓘ-buttons.
9. Validation timing: per-field `touched` + `submitAttempted`.
10. Smart default ordering (needs-attention first) + purpose-named groups.

### P2 — ambition (higher effort): "truly great"
11. Pinned **"Needs attention"** navigator section + keyboard jump.
12. Reduce the "edit card" modality — inline-first editing everywhere it fits.
13. **Density toggle** (comfortable / compact) for newcomers vs power users.
14. Per-group progress underline; section-level "all set" collapse.
15. Telemetry-driven defaults (collapse rarely-touched optional fields).

---

## 6. Component-level change list (where the work lands)

| Area | File | Change |
|---|---|---|
| Status consolidation | `CompactToolbar.tsx` | Segmented meter; remove invalid banner; "N to resolve" control |
| Group header | `FormEngine.tsx:1968` `StyledGroupHeader` | Drop `N OPTIONAL`; muted "to resolve"; optional progress underline |
| Row template & disclosure | `CompactRow.tsx` | Move desc/error/default-hint behind disclosure; single status dot; calm chips |
| Validation model | `FormEngine.tsx` validity data + `CompactRow` | `touched`/`submitAttempted`; unset→to-do vs invalid |
| Visual chrome | `compactRowStyles.ts` | Remove non-data stripes/fills; whitespace rhythm; keep required rail |
| Ordering / sections | `FormEngine.tsx` group + sort | Needs-attention-first default; "Needs attention" section |
| Value language | `readFirst.ts` + `CompactRow` `renderReadFirstValue` | Uniform muted weight; desaturated template/richtext chips |

None of this changes the schema/value/`onChange` contract — it's all
presentation, consistent with the compact mode's existing "purely presentational"
design.

---

## 7. Open questions (to decide / validate with users)

1. **Validation timing**: blur-only, or also a gentle "you skipped a required
   field" on navigate-away? (Lean: blur + submit.)
2. Is **"General"** a real schema group or a fallback bucket? If fallback, can we
   suppress the group chrome entirely for single-group schemas?
3. How often are the **nested object/hash previews** actually read at a glance vs
   noise? (Telemetry / quick user check before investing in them.)
4. Do power users want the **density toggle**, or should we just ship one
   well-tuned density?
5. Should **optional-unset** fields be collapsed by default (cleaner) or visible
   (discoverable)? Likely collapsed with a strong "+ N optional" affordance.

---

## 8. How we'll know it worked

- **Time-to-first-meaningful-scan** (qual): can a new user say "what's left?" in
  < 5s?
- **Perceived calm** (5-pt survey before/after on the same schema).
- **Error-recovery**: time from Submit-blocked to all-resolved.
- **Eye-bounce** (optional): fewer fixations to locate the next action.
- Objective: **default view height** for the screenshot schema should drop
  substantially once errors/descriptions move behind disclosure.

---

## 9. References

- Nielsen Norman Group — *10 Usability Heuristics* (esp. Aesthetic & minimalist
  design, Visibility of system status, Error prevention); *Progressive
  Disclosure*; *Inline Validation in Web Forms*.
- Baymard Institute — form usability research (inline validation timing;
  required vs optional).
- GOV.UK Design System — *Error summary* + *error message* patterns; *question
  protocol* ("only ask what you need").
- Edward Tufte — *The Visual Display of Quantitative Information* (data-ink
  ratio).
- Miller (1956) — chunking (~7±2).
- Design-system form guidance: Material 3, IBM Carbon, Shopify Polaris
  (error/state colour conventions, one-column dense forms).

---

### Appendix — mapping the screenshot to the fixes

| In the screenshot | Why it feels heavy | Fix (section) |
|---|---|---|
| Red banner "6 fields are not valid…" | System #2, alarmist | 4.1 / P0-2 |
| `4 OPTIONAL` / `5 TO RESOLVE` pills | System #3, competes with titles | 4.1 / P0-3 |
| Red box "Text value is empty" (untouched) | Premature error | 4.2 / P0-1 |
| Red box "Hash arguments are invalid" inline | Layout-disruptive error | 4.2 / 4.3 |
| Saturated blue `Test (local)` chip | Decoration outshouts label | 4.4 / P0-5 |
| `schemaOption2 → Show more` tree inline | Breaks row rhythm | 4.3 / P1-7 |
| Per-row red stripe + red ⓘ + red box | Three marks for one state | 4.5 / P1-8 |
