# TASK — server "Explain" over the LSP (`dpql/renderExpression`)

**Status:** code complete on branch `feature/render-expression-lsp`
(uncommitted) — server rebuilt/restarted by the user 2026-06-10 and
**verified live end-to-end** (probe + real-browser run of `LiveExplain`
against :8012: preview AND Explain show `"test".startsWith("t", true)`
served over `dpql/renderExpression`; the hq accidental run proved the
`-32601` fallback path too). Awaiting user browser verification.
**STOP — no commits until the user verifies.**

Design: `design/RENDER_EXPRESSION_TRANSPORT.md` (locked 2026-06-10).
Closes **Phase D** of `.tasks/EXPRESSION_BUILDER_REPORT.md`.
Server ask history: `/tmp/render-expression-exposure.md`.

## Surface area

| Area | Path | Change |
|---|---|---|
| Server handler | `qorus/Classes/QorusLspWebSocketHandler.qc` | NEW `dpql/renderExpression` dispatch case + `handleDpqlRenderExpression()` (modeled on the creator's `handleIdeRenderExpression`, JSON-RPC like `handleDpqlToRichtext`) |
| Server design doc | `qorus/design/language-server-api-metadata.md` | documented under "Custom Qorus LSP Methods" |
| The seam | `src/components/form/expressions/useRenderExpression.ts` | server-first via shared module-level `LspClient`; client-side fallback kept; per-hook ~300ms debounce; `serverRendering` now live |
| Mock LSP | `src/components/form/expressions/dpqlMockLsp.ts` | `dpql/renderExpression` case mirroring the server contract |
| Stories | `Foundation.stories.tsx` (mock in `beforeEach`), `ExpressionField.stories.tsx` (NEW `LiveExplain` live story) | |
| Storybook config | `.storybook/main.ts` | forward `REACT_APP_QORUS_INSTANCE`/`_TOKEN` shell overrides to the bundle (live-story flow was silently broken) |
| Untouched consumers | `builder/renderTemplate.tsx`, `ExpressionField.tsx` | public hook contract preserved |

## Phases

### Phase 0 — shortcut check (DONE 2026-06-10)

- [x] Probed live `wss://localhost:8012/lsp`: `dpql/serialize` richtext =
      DPQL string in paragraph nodes; `dpql/toRichtext` takes `text` only;
      `dpql/explain` / `dpql/renderExpression` → `-32601`.
- [x] Probed live `wss://localhost:8012/creator` `render-expression`:
      `"test".startsWith("t", true)` for the same AST — semantic rendering,
      ≠ serialize output. **Shortcut disproven → server change needed.**
- [x] Learned: creator accepts ONLY the `{is_expression, value}` wrapper
      (bare AST → `EXPRESSION-ARG-ERROR`); `and` is not in
      `QorusExpressionMap` (serializer accepts it, renderer doesn't).
      Probe scripts: `/tmp/render-step0.mjs`, `/tmp/render-step0-creator.mjs`.

### Phase 1 — server (code DONE; deploy PENDING)

- [x] `handleDpqlRenderExpression()` in `QorusLspWebSocketHandler.qc`:
      accepts bare AST or wrapper, optional `expmap`; returns
      `{ rendered, richtext }`; stateless (no uri/session).
- [x] `qorus/design/language-server-api-metadata.md` updated.
- [x] **Committed + MR'd (2026-06-11):** qorus branch
      `feature/render-expression-lsp`, commit `bccdb971c`, pushed with
      `-o ci.skip` (push pipeline skipped; repo has no MR pipelines) —
      https://git.qoretechnologies.com/qorus/qorus/-/merge_requests/2103,
      assigned to dnichols.
- [x] **Rebuilt + restarted by the user (2026-06-10).** Probe re-run green:
      `dpql/renderExpression` returns
      `{ rendered: "\"test\".startsWith(\"t\", true)", richtext: … }` for
      both the bare AST and the wrapper, with or without `uri`; missing
      expression → `-32602`; `and` (not in expmap) → clean `-32803`;
      nested `&&` → `("test".startsWith("t", true)) && (5 > 3)`.
      Note: qorus-core restarts invalidate session tokens — the probe
      script now logs in itself (`admin`, local dev creds).

### Phase 2 — reqraft seam swap (DONE)

- [x] `useRenderExpression`: lazy module-level `LspClient` shared by all
      consumers (rides `LspSharedConnection` — same socket as open DPQL
      editors); JSON-RPC id association; per-hook leading+trailing ~300ms
      debounce; bounded connect wait (1.5s) + 10s fail cooldown; `-32601`
      remembered → permanent client-side fallback on old servers;
      `serverRendering` flag now reflects the serving path live.
- [x] Public API unchanged (`{ render, serverRendering }`,
      `renderExpressionToText` still exported); consumers untouched.

### Phase 3 — tests (DONE)

- [x] `dpqlMockLsp.ts` extended with `dpql/renderExpression`.
- [x] `Foundation.Default` now runs the mock (its `findByText` 1s timeout
      is shorter than the offline fallback wait — would have gone flaky).
- [x] NEW `ExpressionField.LiveExplain` story (`tags: ['!test']`,
      `parameters: { live: true }`) for verification against :8012.
- [x] **GATE:** eslint clean · `build:test:prod` clean · jest **268/268** ·
      expressions play tests **17/17** · full storybook suite **200/201**
      (only the pre-existing `FormEngine › OnValidityChange` flaky).

### Phase 4 — verification (in progress)

- [x] Server rebuilt + restarted, step-0 script green (2026-06-10).
- [x] Agent end-to-end check: real chromium on the `LiveExplain` story at
      :6011 (storybook pointed at :8012) — WS frames confirmed
      `dpql/renderExpression` over the shared socket; preview AND Explain
      show `"test".startsWith("t", true)`. The earlier hq-pointed run
      doubled as the fallback proof (`-32601` → client-side rendering).
      Found+fixed en route: `.storybook/main.ts` never forwarded
      `REACT_APP_QORUS_INSTANCE`/`_TOKEN` from the shell, so the documented
      live-story flow silently fell back to hq.
- [x] **Styled Explain (2026-06-10, after user feedback):** the builder's
      Explain now renders the server's `richtext` (template refs as chips,
      via `richtextResponseToSlate` → `RichTextFormField`) — IDE parity;
      hook gained additive `renderRich()` (`render` keeps its string
      contract); fallback path now shows a muted "Approximate — server
      rendering unavailable" tag so the serving path is never ambiguous.
      Browser-verified on :6011: chips render, no badge, server text;
      gates re-run green (jest 268/268, expressions play 17/17, eslint,
      `build:test:prod`).
- [x] **LSP-highlighted Explain + Text-seeding fix (2026-06-10, user
      feedback round 2):**
      (a) Both Explain surfaces (builder panel + ExpressionField Text-mode
      Explanation) now render through a **read-only `DpqlEditor`** —
      template-ref chips + LSP semantic-token colours; new
      `showDiagnostics` prop on SmartEditor/DpqlEditor suppresses
      underlines AND the message panel (the rendering is readable text,
      not parseable DPQL — probe confirmed clean tokens but error diags).
      Fallback keeps plain rich-text + the "Approximate" tag.
      (b) Fixed ExpressionField Text-mode seeding: `enterTextMode` called
      `dpqlRef.current.serialize` before the editor mounted (ref null →
      silently empty editor); seeding now runs in an effect with a brief
      retry until the editor's LSP session is ready; user typing aborts
      a late seed. Browser-verified: 7 token colours + 6 chips in the
      builder explain, editor seeds `"test" startsWith "t"`, re-seeds on
      Visual→Text toggle. Full suite **201/201**, jest 268/268.
- [x] **SERVER BUG found + root-caused (round-trip, case-sensitivity):**
      `dpql/serialize` emits infix word operators (`"test" startsWith "t"`)
      that `dpql/parse` rejects. Root cause in **qore** qlib
      `DataProvider/DpqlParser.qc`: the comparison loop lowercases the
      identifier (`string kw = tok.value.lwr();`, ~:964) before the infix
      operator lookup `symbol_to_name{kw}` (~:1028), but the map is built
      with symbols as-is (`symbol_to_name{"startsWith"}`, ~:136) — hash
      lookup is case-sensitive, so camelCase symbols can never match.
      PROOF: `"a" like "b"` (lowercase symbol) parses fine through the
      same path (`exp=like`); `startsWith("test","t")` function form also
      parses (`exp=starts-with`); only infix camelCase fails. The infix
      path was added in qore commit `219938f44`. One-line fix in qore:
      build the map with lowercased keys (`symbol_to_name{sym.lwr()} =
      ename`) — matches DPQL's case-insensitive keywords (BETWEEN/IN).
      Affects `startsWith`/`endsWith`/any camelCase-symbol comparison op.
      Repo: QoreTechnologies/qore (NOT qorus) — needs qore qlib
      reinstall; running copy is `~/omq/qlib/DataProvider/DpqlParser.qc`
      (identical to source). Shows as a red diagnostic under the seeded
      Text editor in `LiveExplain` until fixed.
      **FILED + FIXED (2026-06-11):** issue
      https://github.com/qoretechnologies/qore/issues/5348; fix on qore
      branch `bugfix/5348-dpql-infix-word-operator-case` (uncommitted,
      Nick reinstalls qore himself): lowercased `symbol_to_name` keys +
      case-insensitive lookup in `resolveExpressionName()`. Validated
      against pure source (the repo qlib carries a stale compiled
      `DataProvider.qmod` that qore prefers over source — moved aside for
      the test, restored after; ~/omq has no qmod, so plain source
      install works): infix `startsWith`/`STARTSWITH` parse to
      `starts-with`, function form + `like` unregressed, full
      serialize→parse round-trip green.
      **DEPLOYED locally 2026-06-11** (Nick reinstalled qore + restarted
      core): live `dpql/parse('"test" startsWith "t"')` → success, zero
      diagnostics; LiveExplain seeded editor clean (no banner/squiggles),
      Explain still server-rendered. The qore branch stays uncommitted;
      issue #5348 open until the fix is committed/PR'd upstream.
- [ ] USER browser click-through per `VERIFY.local.md` § "Render-expression
      over LSP", incl. IDE :6007 comparison.
- [ ] `/tmp/render-expression-exposure.md` marked resolved (done — outcome
      section appended).
- [ ] Commit only after user approval.
