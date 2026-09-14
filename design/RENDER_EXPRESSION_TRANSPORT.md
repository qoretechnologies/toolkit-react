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

## Waiting, not approximating (reqraft)

`useRenderExpression()` returns `{ render, renderRich }`; both resolve the
server's rendering or `null`:

- A render **waits for the connection** — there is no timer racing it. The
  connection has its own reconnect schedule and rejects once it gives up
  (see below), so a render never outlives a dead socket.
- `null` means the server cannot render: the connection gave up, or the server
  predates the method (`-32601`, remembered for the page lifetime).
- There is **no client-side stand-in**. A Qorus form does not work without
  Qorus, so the approximation only ever appeared while the page's first
  connection was still opening, marked "Approximate" on the first Explain of
  every page. `renderExpressionToText` survives only as the synchronous summary
  a collapsed row prints (`readFirst.ts`), and is never shown in place of a
  server rendering.

## How an expression is shown when it is not being edited

Every read-only expression surface draws through **`DpqlRendering`**
(`src/components/form/expressions/DpqlRendering.tsx`): the Explain panel, the
Text view's Preview, the conversion a type-fit message suggests, and a collapsed
expression row. It is a read-only `DpqlEditor` with diagnostics and hover off,
so every one of them reads the same — monospace, coloured by the language
server's semantic tokens (the canonical tokenizer; there is no client-side
highlighter), template references as chips.

- `ExpressionRendering` renders an AST: it waits in the form's one waiting shape
  (`FormFieldsSkeleton`, `data-wait="expression-rendering"`), then shows the
  server's rendering, or says "This expression could not be rendered." when the
  server cannot.
- The Preview appears only once the server's rendering exists and differs from
  the typed text; it has no waiting state of its own.
- A surface with a template catalogue passes it (`templates`): a reference the
  catalogue knows reads as the name it was chosen by, with the entry's
  description as its hover — the Discord assistant's Save Reply row reads
  `trim(Choices[0].message.content)`. One it does not know keeps its path
  (`data: dc_ai_reply.choices[0].message.content`). A collapsed row passes its
  field's own templates, else the form's; the builder's Explain passes its own.
- A reference's path takes every dot except one that starts a method call, so
  the server's `$local:str.endsWith($local:p, true)` chips `$local:str`, not
  `str.endsWith`.
- A new read-only expression surface uses `DpqlRendering`, never its own
  `<code>`, rich-text field or chip splitter.

## Lifetime of the shared render socket

The module-level render client never releases its connection: the first
expression rendered on a page holds the endpoint's `LspSharedConnection` for
the rest of the page. Two consequences are designed for:

- **A socket that gives up is forgotten.** When the socket exhausts its
  reconnect attempts, the connection fails any handshake still waiting and
  drops the socket; the next `connect()` from any client on that endpoint
  dials afresh. Without this, a first handshake that never completed held
  every later editor on "Connecting to language server…" for the life of the
  page, and one that had completed kept reporting the dead socket as ready.
- **Storybook resets it per story.** Stories run in one page, so the
  connection an earlier story opened would otherwise serve a later story —
  including one that starts its own mock LSP, which is then never dialled.
  `.storybook/preview.tsx` runs `_resetRenderExpressionTransportForTests()`
  and `_resetSharedLspConnectionsForTests()` in a project-level `beforeEach`.
- **Every story has a language server.** Because renderings wait rather than
  approximate, the same `beforeEach` starts the mock DPQL server
  (`dpqlMockLsp.ts`) for every story that is not `live`. Its answers follow the
  real server's (`dpqlMockLanguage.ts`, pinned in
  `__tests__/dpqlMockLanguage.test.ts`); a story that needs other answers starts
  its own server on the URL, which replaces the default.
- **The rendering is spelled by the catalogue.** The server renders a function
  by name (`concat("a", $local:x)`), an expression with a `render_template` by
  that template (`$arg[0].startsWith($arg[1], $arg[2])`, a missing argument
  read as its `default_value`), and any other operator as its arguments joined
  by its symbol. A two-argument word comparison serializes infix
  (`"test" startsWith "t"`) and otherwise as a call by symbol. The story server
  reads `mockExpressions` by the same rules, which is why that fixture carries
  the live `render_template`s and groups.
