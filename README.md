<div align="center">
  <br><br><br>
  <img src="./public/logo.png" alt="Unstated Logo" width="500">
  <br><br><br>
</div>

# @qoretechnologies/toolkit-react

> A toolkit for building React applications with Qore Technologies standards and best practices. A collection of reusable components, hooks, and utilities.

## Installation

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Latest stable Node.js is required.

Install the library using

```console
$ yarn add @qoretechnologies/toolkit-react
```

## Features

## Components

The smart-editor stack is layered:

```
  ReqraftLspClient            generic JSON-RPC 2.0 LSP client over WebSocket
     ↓
  SmartEditor          generic Slate-based editor primitive
     ↓
  DpqlEditor           DPQL-flavored wrapper around SmartEditor
```

Most apps will use `DpqlEditor` directly. Reach for `SmartEditor` when you need an editor for a different language (Qonsole, Qore, …); use `ReqraftLspClient` directly only when you don't want an editor at all (CLI tools, scripts, headless validation).

### `DpqlEditor`

A Slate-based smart text field for writing Data Provider Query Language (DPQL), with LSP-driven syntax highlighting, autocomplete, live diagnostics, formatting, and expression↔text serialization. Talks to the Qorus `/lsp` WebSocket using `languageId: 'dpql'` and the server's `dpql/*` custom JSON-RPC methods. Internally a thin wrapper over `SmartEditor`.

```tsx
import { DpqlEditor, type IDpqlEditorRef } from '@qoretechnologies/reqraft';
import { useRef, useState } from 'react';

function MyForm() {
  const [dpql, setDpql] = useState('@status == "active"');
  const editorRef = useRef<IDpqlEditorRef>(null);

  return (
    <DpqlEditor
      ref={editorRef}
      value={dpql}
      onChange={setDpql}
      provider="datasource:omq/table/orders"
      recordType="record"
    />
  );
}
```

Props in brief:

| Prop | Type | What it does |
|---|---|---|
| `value` / `onChange` | `string` / `(v: string) => void` | Controlled value as plain DPQL text |
| `provider` | `string` | Data-provider spec — `@<app>/<action>`, `datasource:name`, `connection:name`, or factory string. Drives schema-aware completions via `dpql/setContext` |
| `recordType` | `string` | `'record'` (default), `'create'`, or `'update'` |
| `options` | `Record<string, any>` | Extra `dpql/setContext` options |
| `actionCode` | `number` | FSM action code (`DPAT_FIND` / `DPAT_UPDATE` / `DPAT_DELETE`) — derives search-context semantics |
| `fsmContext` | `TDpqlFsmContext` | Binds FSM context via `dpql/setFsmContext` — enables `$data:` state-field completions |
| `height` | `string` | CSS height of the editable area (default `'200px'`) |
| `readOnly` | `boolean` | |
| `onBlur` | `() => void` | |

The ref exposes `format()`, `validate()`, `parse(text)`, and `serialize(expression)` — all backed by LSP requests.

### `SmartEditor`

The generic Slate-based editor primitive that `DpqlEditor` wraps. Knows nothing about any specific language — instead it takes a caller-owned LSP session (`useLspSession`) plus a set of language-flavor props (`decorate`, `customRenderLeaf`, `tagRenderer`, `triggerCharacters`, `converter`, `completionInserter`, `topActions`). The same primitive can drive a DPQL editor, a Qonsole command input, or any other LSP-backed text field.

```tsx
import { SmartEditor, useLspSession } from '@qoretechnologies/reqraft';
import { useState } from 'react';

function MyQonsoleInput() {
  const [value, setValue] = useState('/list services ');

  // Own the session so you can react to its state (call qonsole/setContext,
  // dispatch qonsole/assist, etc.) in effects.
  const session = useLspSession({
    languageId: 'qonsole',
    initialMetadata: { /* /use context if any */ },
  });

  return (
    <SmartEditor
      session={session}
      value={value}
      onChange={setValue}
      triggerCharacters={new Set(['/', ' ', '-', '=', '.'])}
    />
  );
}
```

Props in brief:

| Prop | Type | What it does |
|---|---|---|
| `session` | `IUseLspSessionResult` | Caller-owned LSP session (from `useLspSession`) |
| `value` / `onChange` | `string` / `(v: string) => void` | Controlled plain-text value |
| `decorate` | Slate `decorate` | Client-side syntax highlighting |
| `customRenderLeaf` | `(props: RenderLeafProps) => JSX.Element` | Leaf renderer reading `decorate` marks |
| `tagRenderer` | `(tag: ISlateElement) => IReqoreTagProps` | Per-tag chip props |
| `triggerCharacters` | `Set<string>` | Characters that open the completion dropdown |
| `converter` | `ISlateConverter` | Plain-text ↔ Slate conversion. Default = paragraphs split on newlines |
| `completionInserter` | `(item, editor) => void` | How a completion is inserted. Default = plain text |
| `topActions` | `ReactNode` | Optional content above the editor |
| `height` / `readOnly` / `onBlur` | | Standard chrome props |

For language-specific custom methods (e.g. `dpql/setContext`, `qonsole/assist`), call `session.client.customRequest(...)` directly from your wrapper — the session is yours.

### `ReqraftLspClient`

A generic JSON-RPC 2.0 LSP client over `ReqraftWebSocket`. `SmartEditor` builds on it via `useLspSession`. Reach for `ReqraftLspClient` directly when you want LSP machinery without an editor — CLI tools, validation pipelines, server-driven introspection.

```tsx
import { ReqraftLspClient } from '@qoretechnologies/reqraft';

const client = new ReqraftLspClient({
  languageId: 'qonsole',
  uri: 'qonsole://chat/abc',
});

await client.connect();
client.didOpen('list services ');

// Standard LSP
const items = await client.getCompletions(0, 14);

// Language-specific custom methods
await client.customRequest('qonsole/assist', { input: '/list ', features: ['completion'] });

client.onDiagnostics((uri, diags) => { /* … */ });
client.onNotification('qonsole/sessionStateChanged', (params) => { /* … */ });

client.disconnect();
```

### `ReqraftWebSocket`

The WebSocket under `useReqraftWebSocket` and `ReqraftLspClient`: one socket per URL on the configured instance (unless `pooled: false`), with a heartbeat and reconnects. `useReqraftWebSocket` takes the same options.

```ts
import { ReqraftWebSocket } from '@qoretechnologies/reqraft';

const socket = new ReqraftWebSocket({
  url: 'log/main', // the path on the instance
  onMessage: (event) => append(event.data),
  onReconnectFailed: () => offerReload(),
});

socket.remove(); // let go of it; the last user of a shared socket closes it
```

| Option | Default | |
|---|---|---|
| `pooled` | `true` | Users of the same `url` share one socket; `false` gives this one its own |
| `reconnect` | `true` | Replace a socket that closes, or whose handshake does not open in time |
| `reconnectInterval` | `5000` | ms between attempts; the first attempt after a socket is lost is made at once |
| `maxReconnectTries` | `10` | Attempts before `onReconnectFailed` |
| `handshakeTimeout` | `15000` (`REQRAFT_WS_HANDSHAKE_TIMEOUT_MS`) | ms a handshake has to open; `0` sets no limit |
| `probeTimeout` | `10000` (`REQRAFT_WS_PROBE_TIMEOUT_MS`) | ms an attempt waits for its server-status probe; `0` sets no limit |
| `useHeartbeat` | `true` | Send `ping` every 3 s while open |
| `tokenOverride` | | A token for this socket instead of the instance's |
| `onOpen`, `onMessage`, `onClose`, `onError`, `onReconnecting`, `onReconnectFailed` | | Callbacks |

- **A handshake that hangs** (the server takes the connection and never answers the upgrade) sends no event at all until the browser gives up, about four minutes later in Chromium, and Chromium holds back every other socket to the same host and port while it waits. At `handshakeTimeout` the socket is closed and replaced: its users get `onError` and then `onClose` with code 1006, as for a handshake that failed, and the replacement follows the same `reconnectInterval` and `maxReconnectTries` as after a close. An open socket has no deadline, and a connection never has more than one socket.
- **Before each attempt** it asks the server `GET system/pid`, so that a session that has expired is sent to sign in (`fetchConfig.unauthorizedRedirect`). The answer never holds the attempt back: the request is aborted after `probeTimeout`, and the attempt is made either way.
- **`remove()` and `close()`** close on purpose: the socket is not reconnected, also when it was still connecting (a browser reports that close as 1006), and a reconnect waiting to run, its probe and the handshake deadline are called off. `ReqraftWebSocketsManager.closeAll()` closes every socket the same way.

### `ReqraftColorValue`

A stored color, read-only: a swatch painted the color, beside the color written out (`#6495ED`, or `rgba(255, 0, 0, 0.5)` when it is see-through), on a wash of the color. A compact form row draws its colors with it, so a page and a form show a color the same way.

```tsx
import { ReqraftColorValue } from '@qoretechnologies/reqraft';

<ReqraftColorValue value={{ r: 100, g: 149, b: 237 }} />            // detail page
<ReqraftColorValue value={option.value} size='compact' />           // one-line summary (row, cell)
```

- **Values:** `{ r, g, b }`, `{ r, g, b, a }` (as the color field stores it), `{ hex }`, or a hex code of 3, 4, 6 or 8 digits, with or without its `#`. A channel past its range is brought into it, as the color field does.
- **A stored color** is `{ r, g, b, a? }` and nothing more: `r`, `g` and `b` whole numbers from 0 to 255, `a` its opacity from 0 to 1 (none: opaque). A hex code, bare or as `{ hex }`, and a color with another field beside its own (`{ r, g, b, hex }`, which the server refuses), are drawn so a value stored that way is seen, but they are not stored colors: the `rgbcolor` validator says what is wrong (`storedColorProblem(value)`), and the color field stores the hash, and only the hash, when it edits such a value.
- **A value that is not a color** (`#zzz`, `red`, a channel that is not a number) draws no swatch: it says what the value is ("Not a color: “#zzz”"). With no value it says "No color".
- **Sizes:** `normal` (default; a 20px swatch over a checkerboard, so transparency shows; the text wraps) and `compact` (a 12px swatch; one line ending in an ellipsis). `wrap` overrides the line behavior.
- **Accessible:** the color is text (it reads, copies and is found like any text); the swatch is an image named for the color ("Color #6495ED").
- **Words:** `labels` replaces any of `swatch(color)`, `invalid(shown)` and `empty` for a host that translates its interface.

`describeColorValue(value)` is the reader on its own: `{ kind: 'color', text, css }`, `{ kind: 'invalid', shown }` or `{ kind: 'empty' }`.

## Tracking, consent and A/B testing

First-party analytics with a consent gate and client-side A/B testing, for any Qore web app. The core is plain TypeScript with no DOM, the browser layer attaches the listeners, and the React bindings sit on top. Everything product-specific comes in through config; the server keeps each product's data separate by `property`.

```tsx
import { createBrowserTracker, Experiment, TrackingProvider } from '@qoretechnologies/reqraft/dist/tracking';

const tracking = createBrowserTracker({
  property: 'ide',
  endpoint: '/qorus-cloud/collect',
  experimentsEndpoint: '/qorus-cloud/experiments',
});

<TrackingProvider tracker={tracking.tracker} attach={tracking.attach} location={pathname + search}>
  <Experiment id='signup-cta' variants={{ a: <Current />, b: <New /> }} />
</TrackingProvider>;
```

`@qoretechnologies/reqraft/dist/tracking` loads nothing else from Reqraft; the same names are exported from the package root. The A/B test UI every product shows (`<ExperimentsOverlay>`, `<ExperimentCard>`, `useExperimentsAdmin`) is in `@qoretechnologies/reqraft/dist/tracking/ui`. Config, consent, `useExperiment`, `trackClick` / `trackSection` markup, `createMemoryTracker` for tests and the server contract: [design/TRACKING.md](design/TRACKING.md).

Clients on the same LSP endpoint share ONE underlying WebSocket — each `ReqraftLspClient` is a per-document facade over the shared connection, multiplexed by document URI (the server keys language sessions per document), so N editors cost one socket. Auto-reconnect re-opens every document on the shared socket, 15s request timeout, request/response correlation by `id`, pending requests rejected on close. A `connect()` never outlives its socket: once the socket exhausts `maxReconnectTries`, a handshake still waiting rejects, and the next `connect()` — from that client or any other — dials again, so an editor opened after an outage connects once the server is back, without a page reload. Document URIs should be opaque and client-generated — per the Qonsole LSP contract they must not contain session tokens, usernames, sandbox identifiers, or other secrets that end up in server logs.

## Community

- [GitHub Organization](https://github.com/qoretechnologies) for Official open-source projects
- [Discord](https://discord.gg/T7vgS6nh) for support, discussion, news and latest release updates

## Examples

## Contributing

The Qorus-Toolkit project welcomes all constructive contributions. Contributions can be of many forms including bug fixes, enhancements, fixes to documentation, additional tests and more!

See the [Contributing Guide](CONTRIBUTING.MD) for more technical details on contributing.

### Security Issues

If you discover a security vulnerability in this library, please see [Security Policies and Procedures](SECURITY.md).

## License

[MIT](LICENSE)
