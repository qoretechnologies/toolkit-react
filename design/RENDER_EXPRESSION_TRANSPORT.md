# Render-expression transport — server "Explain" over the LSP

**Status:** locked 2026-06-10.
**Task file:** `.tasks/RENDER_EXPRESSION_LSP.md`.
**Background:** `/tmp/render-expression-exposure.md` (the original server
ask), `design/EXPRESSION_BUILDER_REPORT_STRATEGY.md` (the builder port that
consumes this), `.tasks/LSP_SHARED_CONNECTION.md` (the shared-socket
architecture this rides).

## Decision

The "Explain" rendering (`DataProvider::renderExpression`) is delivered to
reqraft over the **LSP** as a new custom method **`dpql/renderExpression`**,
added to `QorusLspWebSocketHandler.qc` next to `dpql/serialize`. REST
(`?action=render-expression`) is the recorded fallback if the server side
prefers it; SSE was considered and rejected on the 2026-06-10 call
(one-way). Rationale:

- The server delta is tiny — the rendering engine already exists
  (`DataProvider::renderExpression`, qore `DataProvider.qc:834`); the
  creator-WS handler is a thin wrapper over it, and the new LSP handler is
  the same wrapper speaking JSON-RPC.
- reqraft already speaks this protocol (`src/utils/lspClient.ts`) — no new
  transport, auth, or reconnect machinery.
- JSON-RPC request ids natively solve response association (see below).
- Explain updates live as the expression changes (confirmed on the team
  call), which suits a persistent socket + debounce.
- Storybook bonus: REST fetches from storybook to `localhost:8012` are
  CORS-blocked; the LSP WebSocket is not.

### Why not the alternatives (verified live, 2026-06-10)

The hoped-for shortcut — that `dpql/serialize`'s `richtext` or
`dpql/toRichtext` already produce the rendering — was **disproven** against
`localhost:8012`:

| Source | Output for `starts-with("test","t")` |
|---|---|
| creator-WS `render-expression` | `"test".startsWith("t", true)` — semantic rendering |
| LSP `dpql/serialize` | `dpql: "test" startsWith "t"` + `richtext` = the same DPQL string in paragraph nodes |
| LSP `dpql/toRichtext` | takes a `text` (DPQL string) param, not an AST — syntactic highlighting only |

`renderExpression` renders the *AST semantically*; `toRichtext` highlights
the *DPQL source string*. Different things; the shortcut does not exist.

## The 20-builders question (Filip, 2026-06-10 call)

> "you can have 20 [builders]… if one [message] comes, you need to
> associate it with one of the 20 expression builders… would it have
> different connections or how would you associate the message?"

The answer has three parts:

1. **Association = JSON-RPC ids.** Each `useRenderExpression().render(value)`
   call sends a request with a unique id and resolves its OWN promise from
   the matching response (`LspSharedConnection.pending` map). No broadcast,
   no cross-wiring — 20 builders means 20 independent in-flight requests,
   each landing in the right component.
2. **Connections: ONE shared render socket, not 20.** All
   `useRenderExpression` consumers share a single lazy module-level
   `LspClient`, which itself rides the per-endpoint `LspSharedConnection`
   (see `.tasks/LSP_SHARED_CONNECTION.md`) — so render requests multiplex
   onto the *same* socket any open DPQL editors already use. Rendering is
   stateless server-side (no document session), so one connection serves
   everyone. Reconnect logic is the existing `ReqraftWebSocket` schedule.
3. **Debounce per builder (~300ms).** Each hook instance coalesces rapid
   re-renders (leading edge immediate, trailing edge collapses to the
   newest AST), so 20 builders typing don't flood the socket.

## Contract

```
method: dpql/renderExpression          (stateless — no uri/didOpen needed)
params: { expression: <bare {exp,args} AST  |  {is_expression, value} wrapper>,
          expmap?: <expression info map override> }
result: { rendered: "<readable string>", richtext: <richtext hash> }
errors: -32602 missing/invalid expression; -32803 render failure;
        -32601 on servers predating the method
```

## Fallback behaviour (reqraft)

`useRenderExpression` keeps the public signature `{ render, serverRendering }`:

- Server-first; on LSP unreachable (bounded connection wait + cooldown) or
  `-32601` (older server — remembered for the page lifetime), `render`
  falls back to the client-side approximation (`renderExpressionToText`)
  and `serverRendering` reports `false`.
- Consumers (`builder/renderTemplate.tsx`, `ExpressionField.tsx`) are
  untouched.
