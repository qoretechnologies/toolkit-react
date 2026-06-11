# TASK — FormEngine ↔ IDE Options sync (fetch layer)

**Status:** Phases 1+2+3 DONE pending user verify (uncommitted) — 6/6 new play tests. Follows the verbatim-port method
(`design/EXPRESSION_BUILDER_REPORT_STRATEGY.md`); audit findings below.

## Research summary (2026-06-10)

FormEngine was extracted from the IDE's `Options` (`systemOptions.tsx`) on
**2026-03-18**; both evolved independently since (8 IDE commits). Full diff
audit found the drift is small — loop fixes, help text, dependencies,
operators UI, required groups all present on both sides; helpers materially
identical. The REAL gaps:

- **IDE-only:** the remote-fetch layer — `url`/`customUrl` (options schema
  from `/options/{url}` or a custom endpoint), `onOptionsLoaded` (declared in
  FormEngine but never called), `operatorsUrl` (operator schema; without it
  FormEngine's operators UI is dead code — `operators` state is hardcoded
  `undefined` with no setter). Plus a two-line `stretch` layout for
  `tool-catalog` options (commit 8e6b7781 — the "external data support" in
  that commit message was ApiKeys/OAuth2 views, NOT Options).
- **reqraft-only (IDE behind us):** detailed `onValidityChange` payload,
  any/auto type preservation, expression value unwrapping.
- **Tests:** the IDE has **zero** coverage for the fetch features (all 30
  Options stories pass fixture schemas as props) — so there is nothing to
  copy; we write new coverage with a `window.fetch` mock (the dpqlMockLsp
  pattern).

## Decisions

- Port the fetch trio verbatim-adapted: IDE `fetchData` → reqraft `query()`
  (same `{data, ok, error}` response shape; reqraft prepends
  `${instance}api/latest/` like the IDE's `${apiHost}api/latest/`).
  Normalise the IDE's leading-slash URLs (avoid `api/latest//options/...`).
- Port the IDE's loading-skeleton branch + the `stretch`/`STRECHABLE_TYPES`
  two-liner.
- **Skip `allowAi`** — IDE-only AI infra; seam pattern exists (expression
  builder's `extraActions`) if ever needed.
- **Skip `interfaceContext`** — only meaningful through the IDE's template
  fetching, which reqraft's `useTemplates` deliberately stubs.

## Phases

### Phase 1 — fetch layer in FormEngine — DONE (2026-06-10)
- [x] Props: `url`, `customUrl`, `operatorsUrl`; `onOptionsLoaded` now fires
      (was declared-but-dead since extraction)
- [x] Mount fetch (seeds `fixOptions(value, schema)`), refetch-on-change
      (clears value, seeds `fixOptions({}, schema)`) — IDE semantics verbatim
      (`query()` in place of the IDE's `fetchData`; same response shape)
- [x] Operators fetch (own state — `setOperators` finally exists; the loading
      gate waits for BOTH schemas when both urls are set, per the IDE)
- [x] Skeleton branch extended with the remote gates; `stretch` +
      `STRECHABLE_TYPES` (tool-catalog) ported
- [x] GATE: prod typecheck + eslint clean, jest 267/267

### Phase 2 — tests (new coverage; the IDE has none) — DONE (2026-06-10)
- [x] `mockFetchRoutes` helper in `FormEngineRemote.stories.tsx` — patches
      `window.fetch`, serves matching routes, passes the rest through;
      distinct URLs per story (the `query()` GET cache is 5 min)
- [x] Stories (4): `SchemaFromUrl` (3 options render, preselected default
      seeded, `onOptionsLoaded` called with the schema), `OperatorsFromUrl`
      (operator select resolves `Like` + the WHERE/IS tags — the previously
      DEAD operators UI working end-to-end, verified by screenshot),
      `FetchFailure` (500 → "No options available", no crash),
      `UrlChangeResetsValue` (url switch clears the old value, new schema
      seeds)
- [x] GATE: **4/4 play tests** (repeatedly, incl. after a flake-hardening
      timeout bump); jest 267/267; FormEngine.stories 24/24 isolated;
      useWebSocket 15/15, Object 11/11 isolated.
### Phase 3 — seam parity ("item 5") — DONE (2026-06-10)
- [x] `SelectFormField` now **rest-spreads** caller props into all four render
      branches (IDE parity; computed `flat`/`intent`/`size`/handlers stay
      authoritative by coming after the spread) — closes the
      "every pass-through prop needs hand-forwarding" seam for good.
- [x] **`optionActions`** on FormEngine — per-option injected hover actions
      (array or factory receiving `{name, schema, value}`), prepended where
      the IDE renders its `allowAi` AiAssistanceAction. Same pattern as the
      builder's `extraActions`; reqraft stays AI-free.
- [x] **`useTemplates` opt-in fetching** — ported the IDE's
      `system/getContextData` fetch + `buildTemplates` (FSM `states` param
      seamed out; structural payload types), gated on a NEW explicit
      `interfaceContext` (FormEngine prop, threaded through). Without a
      context: the original stub behavior, byte-for-byte — no existing
      consumer starts fetching.
- [x] Coverage: `InjectedOptionActions` (hover → injected action) and
      `TemplatesFromContext` (context fetch hit + loading gate) stories.
      **6/6** FormEngineRemote, **17/17** expressions, 23/24 FormEngine
      (the 1 = pre-existing `OnValidityChange` flake), jest 267/267,
      typecheck + eslint clean.

- Verification caveat (environment, not code): full-suite runs tonight flap
      on LIVE-hq stories (CurrentUser, Log/WS) — same suites pass and fail
      across runs with zero code delta (CurrentUser failed 2/2 then passed
      2/2 a minute later), and the same full suite was green 194/194 earlier
      today. hq intermittency + dev-server wear; re-run the full suite on a
      fresh server when hq is stable for the final pre-commit pass.
