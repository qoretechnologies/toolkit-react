# Template token grammar — braced context refs rehydrate as chips

**Status:** in PR #96 to develop — reworked per Foxhoundn's build-123 qlip review: chips only for BRACED context refs (`isBracedTemplateToken`); plain `$local:*` word tokens keep the template-offering input (his 14 denials), matching his accepted `BracedTemplateValue` baseline. Also added the requested SchemaDefinition Empty play (wait for form rows, not just tab chrome).

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
| `__tests__/templates.test.ts` | strict-grammar cases (braced, colon-braces, dashed keys, spaced paths, negatives) + alias resolution |
| `package.json` | `0.10.36` → `0.10.38` (every-PR-bumps rule; re-bumped after develop published `0.10.37`) |

### Second fix in this PR — the state-identity alias

An FSM state has TWO identities: its key in the `states` hash and its own
`id`. The IDE gives both the same nanoid, so nothing authored there can tell
them apart — but a **template** hand-writes numbered keys (`'1'`, `'2'`, …)
over meaningful ids (`dc_ai_reply`), its saved `$data:{…}` refs use the id,
and the server's catalogue (`sprintf("$data:{%s.%s}", state_id, name)`)
spells item values with the key. They never match as text, so every
template-derived Qog printed the raw token where a named chip belongs —
`$data:{dc_ai_reply.choices}` in the Discord assistant's Save Reply state.

`findTemplate` now also accepts an item's `metadata.aliasValues`. The
producer that holds the states (qorus-ide's `buildTemplates`) attaches the
alternate spelling; reqraft only consumes it. Nothing rewrites either
spelling, so a picked value still stores exactly what the catalogue says —
this is display-only. The alternative (emitting the id from the server, or
rewriting catalogue values FE-side) changes what new picks store and needs
the id's uniqueness enforced first; see the qorus-side write-up.

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
- [x] Commit + PR to develop — `0ef167c`; version re-checked at push time (beta `0.10.36`, ours `0.10.37` ✓; PR #95's prereleases ALSO sit at `0.10.37` — whichever merges second rebases and re-bumps)
- [ ] Pin the CI prerelease (`0.10.37-pr.<N>.g<sha>`) in qorus-ide, lockfile committed; after merge, move qorus-ide to the released version
