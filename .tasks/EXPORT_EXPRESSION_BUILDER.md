# TASK — export the bare `ExpressionBuilder` from the form barrel

**Status:** done pending user verify (uncommitted, branch `feature/119_export-expression-builder`)

Issue: [toolkit-react#119](https://github.com/qoretechnologies/toolkit-react/issues/119).
Design: [`design/IDE_INTEGRATION.md`](../design/IDE_INTEGRATION.md) (the shell-at-root / bare-builder-nested rule;
revised note added in this task).

## Why

The library's own `TemplateField` renders the `ExpressionField` shell for a root field (FormEngine sets
`allowTextExpressions`) and the bare `ExpressionBuilder` for nested operands — the June 11 "top-level
re-wrap" decision in `FIELD_STACK_REPORT.md`. The barrel exported the shell but not the builder, so a host
mirroring that rule (qorus-ide's `template.tsx`) had to deep-import `dist/components/form/expressions/builder`.

## Surface area

| File | Change |
|---|---|
| `src/components/form/index.tsx` | `export { ExpressionBuilder }` + `export type { IExpressionBuilderProps }` next to the shell |
| `__tests__/formBarrelExports.test.ts` | asserts both come from the barrel — fails if the export is removed |
| `design/IDE_INTEGRATION.md` | one-line revision under "the shell is the host's component" |
| `package.json` | `0.10.52` → `0.10.53` (single bump) |

## Phases

- [x] export + type export
- [x] unit test through `yarn test`
- [x] `build:test:prod` green
- [ ] `yarn precheck` (lint + unit + prod tsc)
- [ ] **STOP — user verifies before commit** (no visual surface: nothing to click; the test is the proof)
- [ ] `/audit`, commit, push, PR, CI, qlip (expect 0 changed snapshots)

## Not this task

toolkit-react#120 was filed alongside this and closed as invalid: both operand mounts have forwarded
`expressions_url` since the port (5905e52); the symptom was qorus-ide's raw-catalogue override on its own
legacy builder, fixed there.
