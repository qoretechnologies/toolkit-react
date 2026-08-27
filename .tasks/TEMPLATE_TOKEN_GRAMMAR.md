# Template token grammar — braced context refs rehydrate as chips

**Status:** done pending user verify (branch `bugfix/template-token-grammar`, worktree `~/Projects/qorus-frontend/reqraft-template-grammar`)

No standalone design doc — this is a two-repo bugfix; the qorus-ide twin
(`src/helpers/templateValue.ts` there) is the reference for the shared
grammar, and the drift analysis lives in the qorus-ide session that found
it. Short form below.

## Problem

A saved template value in the braced state-output form —
`$data:{W2n_BuSHbaNrbvV1MkfPF.filename}` — rehydrates as **raw token text
in a textarea** instead of a template chip. Two causes:

1. No strict token grammar existed here: `isValueTemplate` is loose
   (starts with `$`, has `:`), and nothing could distinguish a
   well-formed whole token from a user-typed dollar-string.
2. `TemplateField`'s template-mode-with-custom-values branch renders
   `LongStringField` — a plain textarea that can never chip, so ANY
   template value (word or braced) shows as its literal text there.

Reqraft's `TemplateField` is a near-1:1 extraction of qorus-ide's; the
same bug was fixed there the same day (grammar + wiring). The qorus-ide
IDE surface that exposed it: FSM draft 70, `split($data:{…filename}, …)`.

## Surface area

| File | Change |
|---|---|
| `src/helpers/templates.ts` | `TEMPLATE_TOKEN_SOURCE` (canonical grammar, braced segments allow `.: -` and spaces) + strict `isCompleteTemplateToken` |
| `src/components/form/fields/template/TemplateField.tsx` | auto-mode flip guard narrowed to complete tokens; whole-token template values render the `TemplateDropdownSelector` picker chip instead of the LongString textarea |
| `src/components/form/fields/template/TemplateField.stories.tsx` | new `BracedTemplateValue` regression story; `TemplateCanBeSelected` play updated to assert the chip (was asserting the raw-token textarea) |
| `__tests__/templates.test.ts` | strict-grammar cases (braced, colon-braces, dashed keys, spaced paths, negatives) |
| `package.json` | `0.10.36` → `0.10.37` (every-PR-bumps rule) |

Deliberately NOT done here: the qorus-ide-style rich-editor treatment for
template mode. Develop's `RichTextFormField` has no string mode — that is
the in-flight `bugfix/richtext-string-storage-serialization` work
(`returnValueType`) — and a nodes round-trip without it reintroduces the
reset-while-typing hazard. Mixed text+token strings therefore keep the
textarea until that lands; whole tokens (the overwhelmingly common case)
chip now.

## Phases

- [x] Grammar + strict helper in `helpers/templates.ts`, unit-tested
- [x] `TemplateField` guard + render wiring, story-tested
- [x] `yarn precheck` green (lint, 593/593 unit, prod tsc)
- [x] Qlip PNGs read for `BracedTemplateValue` + `TemplateCanBeSelected` (chips confirmed)
- [x] **STOP — user signed off 2026-08-27** (see `VERIFY.local.md`)
- [ ] Commit + PR to develop; verify version still above last published at push time (the richtext-string-storage branch also bumps `package.json` — whichever merges second rebases and re-bumps)
- [ ] Pin the CI prerelease (`0.10.37-pr.<N>.g<sha>`) in qorus-ide, lockfile committed; after merge, move qorus-ide to the released version
