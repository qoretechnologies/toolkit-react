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

## Tasks

All tasks ship as part of `0.10.0`. Sequence below is the suggested
implementation order; release happens after the last row commits.

| Task | Status | Sequence rationale |
|---|---|---|
| [SMART_EDITOR_UX_POLISH](./SMART_EDITOR_UX_POLISH.md) | Phase 1 committed `6fb9bf3` · Phases 2–7 + 6 committed `a9b7f1b` · Phase 8 (release prep) deferred to end of batch | The original UX batch. All design-doc items (1–7) shipped; Phase 8's "bump version + push" step now happens after every follow-up below also lands. |
| [SMART_EDITOR_CONTEXT_AND_POLISH](./SMART_EDITOR_CONTEXT_AND_POLISH.md) | ready to start | **1st** — item 4 (`alertPayloadContext` + `fsmContext` props) is the qorus-ide alert-rule editor blocker; item 1 (`isContextReady` race) is real-bug correctness. Land these together. Items 2/3 ride along (loader debounce, README catch-up; the latter slim — full README rewrite at end of batch). |
| [SMART_EDITOR_LSP_FEATURES](./SMART_EDITOR_LSP_FEATURES.md) | ready to start | **2nd** — wires `textDocument/signatureHelp`, the only HIGH-value LSP method the server supports for DPQL. Introduces `session.capabilities` which other tasks can use defensively. |
| [QONSOLE_ASSIST_FEATURES](./QONSOLE_ASSIST_FEATURES.md) | ready to start | **3rd** — generic LSP wins (commit chars, sortText, warning) + Qonsole-specific (wizard launch, mode-type fix). |
| [SMART_EDITOR_VISUAL_POLISH](./SMART_EDITOR_VISUAL_POLISH.md) | ready to start | **4th (last)** — Reqore styling-vocabulary push. Polishes the **final** UI state — each preceding task adds new surfaces (signature pill, warning chips, wizard items) the polish pass should cover in one sweep. |
| `0.10.0` release prep (Phase 8 of UX_POLISH) | ready to start once all above complete | **5th (final)** — bump `package.json` to `0.10.0`; final README pass against the final API; tag; push. |

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
