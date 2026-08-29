# SmartEditor task index

One-glance status across every task file in `.tasks/`. **Update this
file whenever a task transitions between statuses** (per the
convention in `.claude/CLAUDE.md` § "Task & design docs workflow").

## Release strategy

**Revised 2026-05-26.** All `.tasks/` items below ship together as a
single `0.10.0` release — no incremental `-beta` / `0.10.1` / `0.10.2`
tags between. Rationale recorded in
[`design/SMART_EDITOR_UX.md` § "Release strategy"](../design/SMART_EDITOR_UX.md):
shipping incremental releases would mean cutting tags with no real
consumer (qorus-ide alert-rule editor needs `alertPayloadContext`/`fsmContext`
which are in the CONTEXT_AND_POLISH task, not in what was originally
scoped for `0.10.0`). Better to land everything in one coherent
release that an actual consumer can adopt.

| Release | Status | Tag / sha |
|---|---|---|
| `0.9.0` | shipped | (current published) |
| `0.10.0` | in progress | held until every task row below is `committed` |
| `0.11.0` (tentative) | planned | Form engine field migration (separate workstream, see below) |

## Tasks

All tasks ship as part of `0.10.0`. Sequence below is the suggested
implementation order; release happens after the last row commits.

| Task | Status | Sequence rationale |
|---|---|---|
| [SMART_EDITOR_UX_POLISH](./SMART_EDITOR_UX_POLISH.md) | Phase 1 committed `6fb9bf3` · Phases 2–7 + 6 committed `a9b7f1b` and **verified in browser 2026-05-26** · Phase 8 (release prep) deferred to end of batch | The original UX batch. All design-doc items (1–7) shipped and verified; Phase 8's "bump version + push" step now happens after every follow-up below also lands. |
| [SMART_EDITOR_CONTEXT_AND_POLISH](./SMART_EDITOR_CONTEXT_AND_POLISH.md) | items 1/2/4 committed (`5e94fd7`, `8e6fe0f`, `2a53a1a`); item 3 (README) deferred to release prep — **awaiting browser verification** | **1st** done |
| [SMART_EDITOR_LSP_FEATURES](./SMART_EDITOR_LSP_FEATURES.md) | committed (`d54597e`) — **awaiting browser verification** | **2nd** done |
| [QONSOLE_ASSIST_FEATURES](./QONSOLE_ASSIST_FEATURES.md) | committed (`189fe52`) — **awaiting browser verification** | **3rd** done |
| [SMART_EDITOR_VISUAL_POLISH](./SMART_EDITOR_VISUAL_POLISH.md) | committed (`c006a79`) — **awaiting browser verification** | **4th** done |
| [SMART_EDITOR_REVIEW_FOLLOWUPS](./SMART_EDITOR_REVIEW_FOLLOWUPS.md) | all 4 items done pending user verify (uncommitted) | **5th** — reviewer feedback on PR #62 (the `0.10.0` editor batch). |
| `0.10.0` release prep (Phase 8 of UX_POLISH) | ready to start once all above complete | **6th (final)** — bump `package.json` to `0.10.0`; final README pass against the final API; tag; push. |

## Form engine field migration (separate workstream)

Closing the gap between Reqraft's form engine and qorus-ide's `Field`
system. Design locked in
[`design/FORM_ENGINE_FIELD_MIGRATION.md`](../design/FORM_ENGINE_FIELD_MIGRATION.md).
Independent of the `0.10.0` SmartEditor batch above; targets a later
minor (`0.11.0` tentative). Sequence is a hard dependency — phase 2
needs phase 1.

| Task | Status | Sequence rationale |
|---|---|---|
| [REQRAFT_AUTO_FIELD](./REQRAFT_AUTO_FIELD.md) | done pending user verify (uncommitted) — 8/8 play tests pass | **1st (keystone).** Type-picker + polymorphic dispatch. The schema editor and most of the remaining field gap render their fields through it. |
| [SCHEMA_DEFINITION_FIELD](./SCHEMA_DEFINITION_FIELD.md) | done pending user verify (uncommitted, stacked on phase 1) — 8/8 play tests pass (2 added by FIELD_STACK phase 3, ReadOnly play restored in remediation) | **2nd.** DataSchema editor — catalogue-driven nested form on `FormEngine`. Its leaf adapter emits `auto`, so phase 1 must land first. |
| [FORM_FIELD_EXTRAS](./FORM_FIELD_EXTRAS.md) | done pending user verify (uncommitted) — `byte-size` / `url` / `multi-select` landed; rest triaged | **3rd (ongoing).** Portable bucket-1 fields, picked off one at a time. Contains the evidence-based triage of what's not a quick port. |
| [FORM_ENGINE_EXPRESSIONS](./FORM_ENGINE_EXPRESSIONS.md) | plumbing kept; **visual builder superseded by [EXPRESSION_BUILDER_REPORT](./EXPRESSION_BUILDER_REPORT.md)** | **4th (new feature, large).** Expression values in fields. The catalogue hook / FormEngine `is_expression` / DPQL bridge / validation are kept; the from-scratch visual builder is being replaced by a verbatim re-port. |
| [EXPRESSION_BUILDER_REPORT](./EXPRESSION_BUILDER_REPORT.md) | Phases A+B+C done & verified (uncommitted) | **5th.** Verbatim re-port of the IDE ExpressionBuilder + field-stack parity + IDE tests (Filip's method: copy → 1:1 → improve), replacing the from-scratch builder. Design: `design/EXPRESSION_BUILDER_REPORT_STRATEGY.md`. |
| [FORM_ENGINE_OPTIONS_SYNC](./FORM_ENGINE_OPTIONS_SYNC.md) | Phases 1+2+3 done pending user verify (uncommitted) — 6/6 new play tests | **6th.** Sync FormEngine with the IDE's Options drift since the 2026-03-18 extraction: the remote-fetch layer (`url`/`customUrl`/`onOptionsLoaded`/`operatorsUrl`) + `stretch`; new test coverage (the IDE has none for these). |
| [LSP_SHARED_CONNECTION](./LSP_SHARED_CONNECTION.md) | done pending user verify (uncommitted) — multiplex proof test + 268/268 jest | **7th.** N editors = 1 LSP socket: shared per-endpoint connection multiplexed by document URI (matches the server's `uriToDpqlSession` design); answers Filip's 20-builders question. Client class renamed `LspClient` → `ReqraftLspClient` (the `Reqraft*` convention, 2026-06-11); API otherwise unchanged. |
| [RENDER_EXPRESSION_LSP](./RENDER_EXPRESSION_LSP.md) | done pending user verify, branch `feature/render-expression-lsp` — server deployed + live-verified end-to-end 2026-06-10 (final gate 201/201 storybook, 268/268 jest, browser proof of server rendering) | **8th.** Server "Explain" over the LSP: new `dpql/renderExpression` in `QorusLspWebSocketHandler.qc` + `useRenderExpression` swap. Closes EXPRESSION_BUILDER_REPORT Phase D. Design: `design/RENDER_EXPRESSION_TRANSPORT.md`. |
| [FIELD_STACK_REPORT](./FIELD_STACK_REPORT.md) | done pending user verify (uncommitted) — final gate 234/234 storybook (incl. 37 ported Template/Auto plays), 268/268 jest | **9th.** Verbatim re-port of the IDE's `Field/template.tsx` + `Field/auto.tsx` (the operand layer under the ported builder) + their IDE stories, replacing the from-scratch TemplateField/AutoFormField; closes the `isFunction` operand-flow gap (behavioral difference #4 in EXPRESSION_BUILDER_REPORT). Supersedes the from-scratch implementation from REQRAFT_AUTO_FIELD (its stories/assertions are kept and reconciled). |
| [BRANCH_REMEDIATION](./BRANCH_REMEDIATION.md) | done pending user verify (uncommitted) — jest 268→356, plays 241→255, lint/tsc clean | **10th.** Burn-down of the 2026-06-10 full-branch audit: tests/stories/API/comment-voice remediation + behavior fixes (Select modal-click collapse, edge-triggered Url, ReqraftLspClient rename, CI auth wiring). Ledger: gitignored `SWEEP.local.md`. |
| [TEMPLATE_TOKEN_GRAMMAR](./TEMPLATE_TOKEN_GRAMMAR.md) | committed `0ef167c`, in PR (branch `bugfix/template-token-grammar`) — user-verified 2026-08-27; 13/13 unit, 21/21 template plays, qlip PNGs read | **11th (bugfix).** Braced `$data:{…}` state-output refs rehydrate as raw text: canonical token grammar + strict whole-token check + TemplateField renders whole-token values as the picker chip. Twin fix applied in qorus-ide the same day; ships as a normal per-PR patch release (`0.10.37`). |

Not yet scoped (acknowledged in the design doc): the remaining
`ui_type` editors (`tool-catalog`, `processor-mappings`, `test-cases`,
`active-windows`) and the rest of bucket-1 fields (`data-provider`,
`options`, `byte-size`, `url`, `code-editor`, …). They get their own
task files when picked up.

## Status vocabulary

- **ready to start** — task file exists, design locked, work hasn't begun
- **in progress, branch `<name>`** — branch created, code being written
- **done pending user verify** — code complete, tests pass, sitting uncommitted or on a branch awaiting human in-browser check
- **committed `<sha>`** — landed on the working branch
- **shipped `<tag>`** — released (tag pushed, npm published)
- **paused** — intentionally on hold (note the reason in the task file's "Status" header)
- **superseded by `<file>`** — work absorbed into another task; the file remains as history

## How to use this dashboard

1. **Picking what to work on next** — read top to bottom. Pick the
   highest-up task whose status is `ready to start` or
   `in progress` and whose sequence rationale doesn't put you out of
   order.
2. **Picking what to verify before commit** — when a task is "done
   pending user verify", check the **task file** (not this dashboard)
   for the verification checklist, plus the per-batch
   `VERIFY.local.md` (untracked) if one exists.
3. **Adding a new task** — write the planning doc first
   (`.tasks/<NAME>.md`), then add a row here.
4. **Closing a task** — flip its status here AND in the task file's
   `**Status:**` header. Don't delete completed task files;
   they become history.

## Out-of-band trackers

These don't live in `.tasks/`:

- **Reqore-side bugs** — spawn-task chips (see chat history) for
  upstream PRs needed by SmartEditor (Textarea null-check,
  renderElement deps fix). Track via your normal PR workflow on the
  Reqore repo, not here.
- **qorus-ide integration** — `qorus-frontend/qorus-ide/.tasks/ALERT_RULES_AND_SILENCES.md`
  is the consumer-side task that depends on
  `SMART_EDITOR_CONTEXT_AND_POLISH` item 4. Update the qorus-ide
  task when item 4 ships so the qorus-ide consumer can unblock.
- **Per-batch verification** — `VERIFY.local.md` (untracked). One
  per work batch — overwrite the previous when starting a new batch.
