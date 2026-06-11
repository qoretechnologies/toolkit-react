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

The generic Slate-based editor primitive that `DpqlEditor` wraps. Knows nothing about any specific language — instead it takes a caller-owned LSP session (`useLspSession`) plus a set of language-flavour props (`decorate`, `customRenderLeaf`, `tagRenderer`, `triggerCharacters`, `converter`, `completionInserter`, `topActions`). The same primitive can drive a DPQL editor, a Qonsole command input, or any other LSP-backed text field.

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

Clients on the same LSP endpoint share ONE underlying WebSocket — each `ReqraftLspClient` is a per-document facade over the shared connection, multiplexed by document URI (the server keys language sessions per document), so N editors cost one socket. Auto-reconnect re-opens every document on the shared socket, 15s request timeout, request/response correlation by `id`, pending requests rejected on close. Document URIs should be opaque and client-generated — per the Qonsole LSP contract they must not contain session tokens, usernames, sandbox identifiers, or other secrets that end up in server logs.

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
