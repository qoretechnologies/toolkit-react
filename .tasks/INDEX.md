# SmartEditor task index

One-glance status across every task file in `.tasks/`. **Update this
file whenever a task transitions between statuses** (per the
convention in `.claude/CLAUDE.md` § "Task & design docs workflow").

## Releases

| Release | Status | Tag / sha |
|---|---|---|
| `0.9.0` | shipped | (current published) |
| `0.10.0-beta` | done pending user verify | uncommitted Phase 8 + `a9b7f1b` (Phases 2-7) + `6fb9bf3` (Phase 1) |
| `0.10.1` | planned | follow-up — see below |
| `0.11.0` | planned | follow-up — see below |

## Tasks

| Task | Status | Target release | Sequence rationale |
|---|---|---|---|
| [SMART_EDITOR_UX_POLISH](./SMART_EDITOR_UX_POLISH.md) | Phase 1 committed `6fb9bf3` · Phases 2–7 + 6 committed `a9b7f1b` · Phase 8 release prep pending user-verify | **0.10.0-beta** | The main UX batch. Phase 8 is the release-prep step (bump version, README, push) — gated on user verification of `VERIFY.local.md` |
| [SMART_EDITOR_CONTEXT_AND_POLISH](./SMART_EDITOR_CONTEXT_AND_POLISH.md) | ready to start | **0.10.1** | **Blocking dependency**: item 4 (`alertPayloadContext` + `fsmContext` props) unblocks qorus-ide's `ALERT_RULES_AND_SILENCES.md` integration. Land first after `0.10.0` ships. |
| [SMART_EDITOR_LSP_FEATURES](./SMART_EDITOR_LSP_FEATURES.md) | ready to start | **0.10.2** or **0.11.0** | `textDocument/signatureHelp` — the only HIGH-value LSP method the server actually supports for DPQL. Introduces `session.capabilities` which other tasks can use. |
| [QONSOLE_ASSIST_FEATURES](./QONSOLE_ASSIST_FEATURES.md) | ready to start | **0.11.0** | Qonsole-side UX (commit chars, wizard launch, sort order, etc.). Most useful when an actual Qonsole consumer (qorus-ide `QonsoleInput.tsx` swap) is on the horizon. |
| [SMART_EDITOR_VISUAL_POLISH](./SMART_EDITOR_VISUAL_POLISH.md) | ready to start | **0.11.0** or **0.11.1** | Reqore styling-vocabulary push. Land **last** so it polishes the final UI state — each preceding task adds new surfaces (signature pill, warning chips, wizard items) the polish pass should cover in one go. |

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
