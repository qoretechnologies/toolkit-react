# TASK — ExpressionField seams: carry `extraActions` through the shell and into operand rows

**Status:** committed `f5fb2ee`, pushed to `origin/bugfix/116_expression-field-seams` (user-verified in the browser 2026-09-07) — no PR yet; CI here runs on pull requests only

Issue: [toolkit-react#116](https://github.com/qoretechnologies/toolkit-react/issues/116).
Design: [`design/IDE_INTEGRATION.md`](../design/IDE_INTEGRATION.md) (seam table; revised 2026-09-07 in this task).
Consumer that surfaced it: qorus-ide [PR #275](https://github.com/qoretechnologies/qorus-ide/pull/275) — the IDE swapped its
legacy builder for `ExpressionField` and its AI-assist button vanished from every expression card.

## Why

`IDE_INTEGRATION.md` names `extraActions` as the seam the IDE re-attaches its AI button through. The
seam existed on `ExpressionBuilder`, but (a) hosts mount the `ExpressionField` shell, which neither
declared nor forwarded it, and (b) the builder's two operand `TemplateField` mounts passed nothing
host-injected, so an operand that is itself an expression lost it again. The group recursion
(`&&` / `||`) already forwarded it, which is why the existing builder story stayed green while the
IDE regressed. Not a gap: `expressionsUrl` — the shell resolves it in its own `useExpressions` and
hands the merged catalogue down (an earlier draft of #116 claimed otherwise; corrected).

## Surface area

| File | Change |
|---|---|
| `src/components/form/expressions/ExpressionField.tsx` | declare `extraActions?: IExpressionBuilderProps['extraActions']`, forward to the builder mount |
| `src/components/form/fields/template/TemplateField.tsx` | declare + destructure `extraActions` (so it never rides `rest` into a leaf input); forward to both editors expression mode renders |
| `src/components/form/expressions/builder/index.tsx` | pass `extraActions` into both operand `TemplateField` mounts; rest-argument mount takes the catalogue's declared `ui_type` when the argument is empty (qlip #189 rejection) |
| `src/components/form/fields/select/SelectCollection.tsx` | `className='reqraft-select-dialog'` on the picker modal — a library-owned hook for hosts' tests |
| `src/components/form/expressions/ExpressionField.stories.tsx` | `NestedOperandKeepsInjectedActions` — shell hop + operand hop, assertion scoped to the nested card; the injected action is the IDE's `AiButton` presentation verbatim (`ReqoreButton` + the resolved `SynthColorEffect`), click stubbed |
| `design/IDE_INTEGRATION.md` | AI-assist row revised; dead `BRANCH_REMEDIATION.md` reference removed; "the shell is the host's component" note |
| `package.json` | `0.10.50` → `0.10.51` (single bump from the current `develop` tip `4860e6e`, after #114 merged and published 0.10.50; CI's PR job accepts exactly one patch over the base, so #115 and #117, both still at 0.10.50, must re-bump before they can merge) |

## Phases

### 1 — seams
- [x] `ExpressionField`: declare + forward
- [x] `TemplateField`: declare, destructure, forward to `<ExpressionField>` and `<ExpressionBuilder>`
- [x] builder: both operand mounts
- [x] picker modal class
- [x] `yarn build:test` + `yarn lint` clean

### 2 — coverage
- [x] story written (description in the mandated shape)
- [x] `yarn test:stories ExpressionField` green (8/8); qlip PNG of the new story read — the magic-wand action sits in BOTH card headers, the nested operand's included; capture dir deleted

### 3 — docs
- [x] design doc revised with dated notes
- [x] `.tasks/INDEX.md` row
- [x] `VERIFY.local.md` written for the click-through

### 4 — gate
- [x] **STOP — user verified in the browser** (2026-09-07, on :6009)
- [x] `/audit` — run by following `instruction-files/skills/audit-frontend/SKILL.md` directly (the skill is not linked into `~/.claude/skills/` on this machine); re-run after the last story edit; clean
- [x] commit `f5fb2ee` (no attribution trailer), pushed
- [ ] open the PR (CI + qlip build only run on a pull request), `ci-monitor`, qlip review

### 5 — qlip #189 rejection (Foxhoundn)
- [x] empty rest argument rendered as untyped `auto` under a "true or false" label; empty `any` never reached the template-selector default → declared-type fallback in the rest-argument mount; both expression story files 30/30; verified in the browser on `NestedOperandKeepsInjectedActions`, `WithComplexValue`, and `DefaultBoolean` → Logical Equals
- [x] design note in `design/EXPRESSION_BUILDER_REPORT_STRATEGY.md` (Revised 2026-09-08)
- [ ] rejection table shown to the user → push → CI → qlip re-review

## Out of scope (no designed seam yet — needs a design decision first)

Saved values at operand level (the builder owns operand `menuItems` for its type picker → additive
seam required; the feature is switched off in every IDE surface today), translations, tour
registration, the guided server-expression flow, dropdown search copy, the picker's action-name
badge. Listed in #116.
