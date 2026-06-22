# TASK — Shared LSP connection (N editors = 1 socket)

**Status:** DONE pending user verify (uncommitted, 2026-06-10).

## Why

Filip's call question (2026-06-10): with 20 expression builders open, "would
it have different connections or how would you associate the message?"
Research findings:
- The server is BUILT for multiplexing: `QorusLspWebSocketHandler.qc:531`
  keeps `uriToDpqlSession` — a per-connection map of URI → DPQL session
  (created on didOpen :1004, removed on didClose :1213); `dpql/setContext`
  takes a `uri` param. One connection serves N documents.
- reqraft's old `LspClient` opened one isolated socket PER editor
  (`pooled: false`) — 20 Text-mode editors = 20 sockets + 20 handshakes. The
  old comment's rationale ("sharing conflates diagnostics and correlation")
  was wrong: JSON-RPC ids correlate responses; `publishDiagnostics` carries
  the uri.
- qorus-ide's own Creator WS already uses the shared-socket + `request_id`
  pattern (`helpers/functions.tsx:405`).

## What changed (`src/utils/lspClient.ts`)

- New internal `LspSharedConnection`: one WebSocket + one `initialize` per
  endpoint URL (registry; first acquirer's reconnect config wins). Owns the
  id counter + pending map; routes responses by id, `publishDiagnostics` by
  `params.uri`, other notifications to every registered client. Closes when
  the last client releases it.
- `LspClient` is now a per-document façade with an UNCHANGED public API
  (`useDpqlSession`/`useLspSession`/`DpqlEditor` untouched);
  `capabilities`/`semanticTokensLegend` became getters proxying the
  connection. Reconnect: the connection re-initializes once, then each client
  re-sends its own `didOpen` (`_resyncAfterReconnect`).
- Editor URIs were already unique per instance
  (`${languageId}://session/${counter}` in `useLspSession`) — collision-safe.
- Test hook `_resetSharedLspConnectionsForTests()` (mirrors the websocket
  manager reset in jest).
- Answer to Filip, in one line: **one connection per endpoint, sessions
  multiplexed by URI; requests correlate by JSON-RPC id, diagnostics by uri —
  matching the server's design and the IDE's request_id pattern.**

## Consumer audit (what the refactor touches)

- **Exactly one `LspClient` creation site** in the library:
  `useLspSession.ts:110` — SmartEditor, DpqlEditor, Qonsole and the
  expressions Text mode ALL flow through it; its API was preserved verbatim.
- `capabilities`/`semanticTokensLegend` readers (`useLspSession`,
  `useLspSemanticTokens`, `useLspSignatureHelp`) only READ them → the
  field→getter change is API-identical.
- NEW behavior introduced: different `languageId`s (dpql + qonsole) can now
  share one connection (same `'lsp'` URL). Verified safe — the server
  resolves language PER DOCUMENT (`detectLanguage(textDoc.languageId, uri)`
  at didOpen, `uriToLanguage{uri}`/`uriToSource{uri}` maps), and verified
  LIVE (below).

## Verification

- New jest proof: two clients → `connections === 1`, one `initialize`,
  diagnostics delivered only to the matching uri, releasing one client keeps
  the socket for the other. lspClient suite **15/15**; full jest **268/268**.
- **LIVE e2e against the real server** (`lsp-multiplex-e2e.local.mjs`,
  gitignored — one socket to `wss://localhost:8012/lsp`): initialize once;
  two DPQL docs + one Qonsole doc coexist; interleaved per-document
  `semanticTokens` requests return DISTINCT results; diagnostics route per
  uri (invalid doc got 3, valid got 0, qonsole got 0); closing doc A leaves
  doc B fully functional. `E2E OK`.
- **Browser-level proof**: new `DpqlEditor › TwoEditorsOneConnection` story —
  two mounted editors, the mock server accepts exactly ONE connection, one
  `initialize`, two `didOpen`s with distinct URIs. dpqlEditor suite **17/17**.
- Storybook (fresh server): smartEditor+qonsole **8/8**, expressions
  **17/17**. Typecheck + eslint clean.
- Known semantics note: with >1 client on a connection, a disconnecting
  client's in-flight requests are left to their timeouts (results ignored
  post-unmount); the sole-client case still rejects them via the connection
  close — covered by the existing test.
