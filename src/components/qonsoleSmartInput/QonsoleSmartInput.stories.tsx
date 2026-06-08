// Stories for QonsoleSmartInput. `BasicMock` exercises the full client↔
// server completion path against a mock-socket LSP that mirrors the
// shapes from the live spike. `LiveQonsole` hits the real `/lsp` endpoint
// (no mock) so the wrapper can be validated against the shipped Qorus
// backend before integrating into qorus-ide's QonsoleInput.

import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { Server } from 'mock-socket';
import { useState } from 'react';
import { sleep } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { QonsoleSmartInput } from './QonsoleSmartInput';
import { IQonsoleAssistContext } from './types';

const MOCK_LSP_URL = `wss://hq.qoretechnologies.com:8092/lsp?token=${process.env.REACT_APP_QORUS_TOKEN}`;

/**
 * Most-recent document text the client has sent via didOpen / didChange.
 * The mock's completion handler inspects this so it can return
 * contextually-correct items per the user's cursor position.
 */
let lastQonsoleText = '';

/**
 * Walk backward from `cursorChar` to find the start of the current
 * Qonsole token. Tokens are word-chars-and-sigils sequences (`/list`,
 * `--desc`, `services`, `qorus-ide`). Used to compute the `textEdit.range`
 * the server-side handler would compute so that accepting an item
 * REPLACES the partial token rather than appending to it (otherwise
 * accepting `/list` while the user has `/l` typed would produce
 * `/l/list`).
 */
function findQonsoleTokenStart(text: string, cursorChar: number): number {
  let i = cursorChar - 1;
  while (i >= 0 && /[\w/=:.-]/.test(text[i])) {
    i--;
  }
  return i + 1;
}

/**
 * Detect which completion context the cursor is in. Looks at the
 * current partial token + how many `/verb resource` slots have
 * already been consumed before the cursor to decide between verb /
 * resource / flag / flag-value / nothing.
 *
 * Grammar the mock assumes (simplified from the real server):
 *   `/verb resource [--flag[=value]]…`
 * So the slot the cursor is in depends on how many non-flag word
 * tokens precede it:
 *   - 0 word tokens → verb position (`/list…`)
 *   - 1 word token  → resource position (`services…`)
 *   - 2+ word tokens → flag position (`--desc…`) — the verb + resource
 *     slots are filled, so any subsequent word-position is a flag
 *
 * Returns `null` when no context matches — the dropdown stays closed
 * for free-typing positions the mock has no opinion about.
 */
function detectQonsoleContext(
  text: string,
  cursorChar: number
): {
  type: 'verb' | 'resource' | 'flag' | 'flag-value';
  tokenStart: number;
} | null {
  const tokenStart = findQonsoleTokenStart(text, cursorChar);
  const currentToken = text.slice(tokenStart, cursorChar);
  const charBefore = tokenStart > 0 ? text[tokenStart - 1] : '';

  // `--flag` partial token — always flag context regardless of position.
  if (currentToken.startsWith('-')) return { type: 'flag', tokenStart };
  // After `=` — value of the last seen `--flag=…`.
  if (charBefore === '=') return { type: 'flag-value', tokenStart };
  // Slash command — partial token starts with `/`.
  if (currentToken.startsWith('/')) return { type: 'verb', tokenStart };

  // Word-position decision — count non-flag word tokens before the
  // cursor's token start. Flags are `--something` and don't consume
  // a slot; everything else does.
  const before = text.slice(0, tokenStart);
  const words = before
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !w.startsWith('-'));
  if (words.length === 0) {
    // Empty editor — user is about to type the verb.
    if (tokenStart === 0 && currentToken === '') return { type: 'verb', tokenStart };
    return null;
  }
  if (words.length === 1) {
    // `/verb ` — next is the resource.
    if (charBefore === ' ') return { type: 'resource', tokenStart };
    return null;
  }
  // 2+ words → verb + resource consumed; subsequent slots are flags.
  if (charBefore === ' ') return { type: 'flag', tokenStart };
  return null;
}

/**
 * Mock Qonsole semantic-tokens producer. Returns a flat int-5-tuple
 * array per LSP spec, types resolved against the standard 16-type
 * legend.
 *
 * **Deliberately conservative**: we only emit tokens for sigil-bracketed
 * syntactic forms whose grammar position is unambiguous from the text
 * alone. The real qorus server tokenises resource names and flag
 * values as classes / strings because it has a live type registry —
 * the mock has no such schema and any heuristic for "this word looks
 * like a resource" is bound to false-positive on user-typed garbage.
 * For full class / string coverage check `LiveQonsole` (real server)
 * or `Components/SmartEditor → WithSemanticTokens` (hand-crafted
 * deterministic response).
 *
 * Token types we emit:
 *  8 = keyword  → `/verb`
 *  9 = modifier → `--flag`
 * 11 = string   → `"quoted string"`
 * 12 = number   → integer or float literal
 */
function mockTokenizeQonsole(text: string): number[] {
  const tokens: Array<{
    line: number;
    char: number;
    length: number;
    type: number;
  }> = [];
  const lines = text.split('\n');
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // Regex alternation in priority order — strings first so they
    // swallow any `--` / digits inside their quotes.
    const TOKEN_RE =
      /("(?:\\.|[^"\\])*")|(\d+(?:\.\d+)?)|(--[A-Za-z][\w-]*)|(\/[A-Za-z][\w-]*)/g;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_RE.exec(line)) !== null) {
      let type = -1;
      if (match[1]) type = 11; // string
      else if (match[2]) type = 12; // number
      else if (match[3]) type = 9; // modifier — `--flag`
      else if (match[4]) type = 8; // keyword — `/verb`
      if (type >= 0) {
        tokens.push({
          line: lineIdx,
          char: match.index,
          length: match[0].length,
          type,
        });
      }
    }
  }
  // Stable sort by (line, char) — the regex above is left-to-right
  // per line already, but sort defensively in case priorities collide.
  tokens.sort((a, b) => (a.line - b.line) || (a.char - b.char));
  // Delta-encode per LSP spec.
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of tokens) {
    const dLine = t.line - prevLine;
    const dChar = dLine === 0 ? t.char - prevChar : t.char;
    data.push(dLine, dChar, t.length, t.type, 0);
    prevLine = t.line;
    prevChar = t.char;
  }
  return data;
}

/**
 * Standard LSP 16-type / 6-modifier legend — same as the real Qorus
 * server advertises in `initialize` (see
 * `qorus/Classes/QorusLspWebSocketHandler.qc:847-895`).
 */
const QONSOLE_SEMANTIC_TOKENS_LEGEND = {
  tokenTypes: [
    'namespace',
    'type',
    'class',
    'parameter',
    'variable',
    'property',
    'function',
    'method',
    'keyword',
    'modifier',
    'comment',
    'string',
    'number',
    'regexp',
    'operator',
    'decorator',
  ],
  tokenModifiers: [
    'declaration',
    'definition',
    'readonly',
    'static',
    'defaultLibrary',
    'documentation',
  ],
};

/**
 * Set up the BasicMock-style mock LSP server — used by `BasicMock`,
 * `WithCommitCharacters`, and `WithWizardItems`. Returns the server
 * instance so the caller can close it in their `beforeEach` teardown.
 *
 * Encapsulates: `initialize` (with full capabilities incl. semantic
 * tokens), contextual `textDocument/completion`, `qonsole/*` custom
 * methods, `textDocument/semanticTokens/full`, didOpen/didChange
 * text-tracking, and the default-null catch-all.
 *
 * **Not a real-server simulator.** See the docstring on `BasicMock`
 * for what this mock does and does not pretend to do — in particular
 * the slot grammar is a naive word counter and the tokenizer only
 * paints sigil-bracketed forms.
 */
function setupBasicQonsoleMockServer(): Server {
  lastQonsoleText = '';
  const server = new Server(MOCK_LSP_URL);
  server.on('connection', (socket) => {
    socket.on('message', (raw) => {
      if (raw === 'ping') {
        socket.send('pong');
        return;
      }
      let msg: any;
      try {
        msg = JSON.parse(raw as string);
      } catch {
        return;
      }
      if (msg.method === 'textDocument/didOpen') {
        lastQonsoleText = msg.params?.textDocument?.text ?? '';
      } else if (msg.method === 'textDocument/didChange') {
        const change = msg.params?.contentChanges?.[0];
        if (change && typeof change.text === 'string') {
          lastQonsoleText = change.text;
        }
      }
      if (msg.id === undefined) return;

      switch (msg.method) {
        case 'initialize':
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                capabilities: {
                  semanticTokensProvider: {
                    legend: QONSOLE_SEMANTIC_TOKENS_LEGEND,
                    full: true,
                    range: true,
                  },
                  experimental: {
                    qonsole: {
                      version: '1.0',
                      methods: [
                        'qonsole/assist',
                        'qonsole/validate',
                        'qonsole/setContext',
                      ],
                    },
                  },
                },
              },
            })
          );
          break;

        case 'textDocument/semanticTokens/full':
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { data: mockTokenizeQonsole(lastQonsoleText) },
            })
          );
          break;

        case 'textDocument/completion': {
          // Detect the completion context from cursor position +
          // partial token. The resulting `tokenStart` is the start
          // of the partial token the user has typed; the textEdit
          // range covers `[tokenStart, cursor)` so accepting an
          // item REPLACES the partial token cleanly (no
          // `/l/list` duplication).
          const position = msg.params?.position ?? { line: 0, character: 0 };
          const text = lastQonsoleText;
          const ctx = detectQonsoleContext(text, position.character);
          let items: any[] = [];
          if (ctx) {
            const replaceRange = {
              start: { line: position.line, character: ctx.tokenStart },
              end: position,
            };
            const withTextEdit = (item: any) => ({
              ...item,
              textEdit: { range: replaceRange, newText: item.insertText ?? item.label },
            });
            if (ctx.type === 'verb') {
              items = [
                withTextEdit({
                  label: '/list',
                  insertText: '/list',
                  kind: 14,
                  detail: 'List resources',
                  commitCharacters: [' '],
                  sortText: '10_00_/list',
                }),
                withTextEdit({
                  label: '/show',
                  insertText: '/show',
                  kind: 14,
                  detail: 'Show resource details',
                  commitCharacters: [' '],
                  sortText: '10_01_/show',
                }),
                withTextEdit({
                  label: '/count',
                  insertText: '/count',
                  kind: 14,
                  detail: 'Count matching resources',
                  commitCharacters: [' '],
                  sortText: '10_02_/count',
                }),
                // Mutating verb — server attaches a `warning` chip.
                withTextEdit({
                  label: '/delete',
                  insertText: '/delete',
                  kind: 14,
                  detail: 'Delete a resource',
                  commitCharacters: [' '],
                  warning: 'Mutates system state',
                  sortText: '20_00_/delete',
                }),
                withTextEdit({
                  label: '/help',
                  insertText: '/help',
                  kind: 14,
                  detail: 'Show help',
                  commitCharacters: [' '],
                  sortText: '30_00_/help',
                }),
                // Wizard launch item — `command` triggers
                // `onWizardStart` instead of text insertion. The
                // inserter doesn't read textEdit for wizard items,
                // so we omit it.
                {
                  label: 'Start "Create connection" wizard',
                  kind: 15,
                  detail: 'Guided setup',
                  data: {
                    action: 'start-wizard',
                    name: 'create-connection',
                    title: 'Create connection',
                    short_desc: 'Guided setup for a new connection',
                    verb: 'create',
                    resource: 'connections',
                    start_path:
                      '/api/latest/qonsole/wizards/create-connection/start',
                  },
                  command: {
                    title: 'Start Create connection wizard',
                    command: 'qonsole.startWizard',
                    arguments: [
                      {
                        action: 'start-wizard',
                        name: 'create-connection',
                        title: 'Create connection',
                        short_desc: 'Guided setup for a new connection',
                        verb: 'create',
                        resource: 'connections',
                        start_path:
                          '/api/latest/qonsole/wizards/create-connection/start',
                      },
                    ],
                  },
                  sortText: '40_00_wizard',
                },
              ];
            } else if (ctx.type === 'resource') {
              items = [
                withTextEdit({ label: 'services', insertText: 'services', kind: 7, detail: 'Service interfaces', commitCharacters: [' '] }),
                withTextEdit({ label: 'workflows', insertText: 'workflows', kind: 7, detail: 'Workflow interfaces', commitCharacters: [' '] }),
                withTextEdit({ label: 'jobs', insertText: 'jobs', kind: 7, detail: 'Job interfaces', commitCharacters: [' '] }),
                withTextEdit({ label: 'users', insertText: 'users', kind: 7, detail: 'IDP users', commitCharacters: [' '] }),
              ];
            } else if (ctx.type === 'flag') {
              items = [
                withTextEdit({
                  label: '--desc',
                  insertText: '--desc=',
                  kind: 10,
                  detail: 'sort descending',
                  commitCharacters: ['='],
                }),
                withTextEdit({
                  label: '--limit',
                  insertText: '--limit=',
                  kind: 10,
                  detail: 'maximum number of results',
                  commitCharacters: ['='],
                }),
                withTextEdit({
                  label: '--search',
                  insertText: '--search=',
                  kind: 10,
                  detail: 'filter by name using a regex',
                  commitCharacters: ['='],
                }),
                withTextEdit({
                  label: '--app',
                  insertText: '--app=',
                  kind: 10,
                  detail: 'filter by application',
                  commitCharacters: ['='],
                }),
              ];
            } else if (ctx.type === 'flag-value') {
              items = [
                withTextEdit({ label: 'qorus', insertText: 'qorus', kind: 12, detail: 'Qorus core app' }),
                withTextEdit({ label: 'qorus-ide', insertText: 'qorus-ide', kind: 12, detail: 'Qorus IDE' }),
                withTextEdit({ label: 'qorus-creator', insertText: 'qorus-creator', kind: 12, detail: 'Qorus Creator' }),
              ];
            }
          }
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { items },
            })
          );
          break;
        }

        case 'qonsole/setContext':
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { ok: true, context: msg.params?.context ?? null },
            })
          );
          break;

        case 'qonsole/validate':
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { diagnostics: [] },
            })
          );
          break;

        case 'qonsole/assist':
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                version: '1.0',
                mode: 'command',
                context: {},
                canonical: {
                  command_name: 'list-services',
                  verb: 'list',
                  resource: 'services',
                },
                completion: {
                  state: 'flag',
                  prefix: '',
                  replace_start: 15,
                  replace_end: 15,
                  items: [
                    { label: '--desc', kind: 'flag' },
                    { label: '--limit', kind: 'flag' },
                  ],
                },
                diagnostics: [],
                metrics: { duration_ms: 5 },
              },
            })
          );
          break;

        default:
          socket.send(
            JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null })
          );
          break;
      }
    });
  });
  return server;
}

interface IDemoArgs {
  initialValue?: string;
  useContext?: IQonsoleAssistContext;
  height?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
  onWizardStart?: (args: Record<string, unknown>) => void;
}

function QonsoleSmartInputWithState(props: IDemoArgs) {
  const [value, setValue] = useState(props.initialValue ?? '');
  return (
    <QonsoleSmartInput
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
      useContext={props.useContext}
      height={props.height}
      readOnly={props.readOnly}
      onWizardStart={props.onWizardStart}
    />
  );
}

const meta = {
  component: QonsoleSmartInputWithState,
  title: 'Components/QonsoleSmartInput',
  args: {
    initialValue: '',
    onChange: fn(),
  },
} as StoryMeta<typeof QonsoleSmartInputWithState>;

export default meta;
export type Story = StoryObj<typeof meta>;

/**
 * Mock-socket variant that mirrors the Qonsole LSP wire shape captured
 * in `qorus-frontend/QONSOLE_LSP_REFERENCE.md`. Replies to `initialize`,
 * `textDocument/completion`, `qonsole/setContext`, `qonsole/assist`,
 * `qonsole/validate`. Play test types `-` after `/list services ` and
 * asserts the canned completions render.
 *
 * **Scope of this mock** (read before you go down a rabbit hole):
 * - This is a minimal scaffold for the deterministic play test and for
 *   poking at the editor without a Qorus server. It is **not** a
 *   robustness simulation of the real Qonsole grammar.
 * - The slot grammar is a naive word-counter (`/verb` → resource →
 *   flag…). Feed it malformed input like `"hello world" 43 /list ` and
 *   it WILL pick a weird slot — that's expected. The real server has
 *   the type registry to handle that; the mock does not.
 * - The semantic tokenizer is deliberately conservative — it only
 *   colors sigil-bracketed forms (`/verb`, `--flag`, `"strings"`,
 *   numbers). Resource names, flag values, and any free-form
 *   identifier stay plain because the mock has no schema.
 * - For real-server behavior use `LiveQonsole` /
 *   `LiveQonsoleWithContext`.
 * - For deterministic full-fidelity semantic tokens (hand-crafted
 *   response, no heuristics) see
 *   `Components/SmartEditor → WithSemanticTokens`.
 */
export const BasicMock: Story = {
  args: {
    initialValue: '/list services ',
  },
  async beforeEach() {
    const server = setupBasicQonsoleMockServer();
    return () => server.close();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');

    // Phase 1 contract: dropdown must not open just because the cursor
    // landed on a position whose char-before-cursor is a trigger
    // character. Initial value `/list services ` ends in a space (a
    // trigger char), so on mount + on click the dropdown must stay
    // closed. A "must NOT open" check needs a fixed settle — `waitFor`
    // would pass instantly, before the dropdown could have (wrongly)
    // opened, and prove nothing.
    await sleep(500);
    expect(document.querySelector('.reqore-menu')).toBeNull();
    await userEvent.click(editable);
    await sleep(500);
    expect(document.querySelector('.reqore-menu')).toBeNull();

    // Now the user actually types — dropdown should open. Poll for it.
    await userEvent.type(editable, '-');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('--desc');
        expect(dropdown!.textContent).toContain('--limit');
        expect(dropdown!.textContent).toContain('--search');
      },
      { timeout: 30000 }
    );

    // Accept the first item with Enter and check the editor doesn't
    // double-dash. The mock returns `textEdit` covering the typed `-`,
    // so the result must be `/list services --desc=`, not `---desc=`.
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () => {
        expect(editable.textContent).toBe('/list services --desc=');
        expect(editable.textContent).not.toContain('---');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * **Live spike — hits the real Qorus `/lsp` endpoint** at
 * `wss://hq.qoretechnologies.com:8092/lsp` with `languageId: 'qonsole'`.
 * Used to validate `QonsoleSmartInput` end-to-end against the shipped
 * server before integrating into the qorus-ide `QonsoleInput.tsx`
 * (which is a separate qorus-ide-side task — see toolkit-react#61).
 *
 * **Prereq:** export `REACT_APP_QORUS_TOKEN` before running storybook.
 * Without a valid token the WebSocket handshake fails with 401.
 */
export const LiveQonsole: Story = {
  args: {
    initialValue: '/list services ',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hits the real Qonsole LSP — no mock. Type after the trailing ' +
          'space (or `-`, `=`, `/`, etc.) to see real completions render.',
      },
    },
  },
};

/**
 * Same as `LiveQonsole` but pre-binds a `/use services` context so
 * predictive text is scoped to that resource — exercises
 * `qonsole/setContext` via the `useQonsoleSession` hook.
 */
export const LiveQonsoleWithContext: Story = {
  args: {
    initialValue: 'show me services in the pricing pipeline ',
    useContext: { resource: 'services' },
  },
};

/**
 * Mock-socket variant that pushes diagnostics via the LSP
 * `textDocument/publishDiagnostics` notification immediately after the
 * client opens the document. Verifies:
 * - inline wavy-underline decorations (driven by `decorate` →
 *   `useLspDiagnosticDecorations`),
 * - the `ReqoreMessage` panel below the editor (one row per
 *   diagnostic, intent + icon per severity).
 *
 * The initial value contains two recognisable spans — `services` (an
 * Error) and `pricing` (a Warning). Adjust the mock if you change the
 * value here.
 */
export const WithDiagnostics: Story = {
  args: {
    initialValue: '/list services in pricing',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows inline wavy-underline + the diagnostic message panel ' +
          'below the editor. Hover an underlined token for the native ' +
          'title-tooltip with the diagnostic message.',
      },
    },
  },
  async beforeEach() {
    lastQonsoleText = '';
    const server = new Server(MOCK_LSP_URL);
    server.on('connection', (socket) => {
      socket.on('message', (raw) => {
        if (raw === 'ping') {
          socket.send('pong');
          return;
        }
        let msg: any;
        try {
          msg = JSON.parse(raw as string);
        } catch {
          return;
        }
        if (msg.id !== undefined) {
          switch (msg.method) {
            case 'initialize':
              socket.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: { capabilities: {} },
                })
              );
              break;
            case 'qonsole/setContext':
            case 'qonsole/validate':
              socket.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: null,
                })
              );
              break;
            default:
              socket.send(
                JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null })
              );
              break;
          }
        }
        // After didOpen, push a publishDiagnostics notification so the
        // editor renders inline + panel feedback. `didOpen` carries the
        // uri in params.textDocument.uri.
        if (msg.method === 'textDocument/didOpen') {
          const uri = msg.params?.textDocument?.uri;
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'textDocument/publishDiagnostics',
              params: {
                uri,
                diagnostics: [
                  {
                    range: {
                      start: { line: 0, character: 6 },
                      end: { line: 0, character: 14 },
                    },
                    message:
                      'Unknown resource "services" — did you mean "service"?',
                    severity: 1,
                  },
                  {
                    range: {
                      start: { line: 0, character: 18 },
                      end: { line: 0, character: 25 },
                    },
                    message: 'Pipeline "pricing" not found in workspace.',
                    severity: 2,
                  },
                ],
              },
            })
          );
        }
      });
    });
    return () => {
      server.close();
    };
  },
  // CI guard for the diagnostics round-trip (server `publishDiagnostics`
  // → the stacked `ReqoreMessage` panel below the editor). Both pushed
  // messages must render.
  play: async ({ canvasElement }) => {
    // Poll until the server's publishDiagnostics round-trip renders both
    // messages in the stacked panel below the editor.
    await waitFor(
      () => {
        const text = canvasElement.textContent ?? '';
        expect(text).toContain('Pipeline "pricing" not found in workspace.');
        expect(text).toContain('Unknown resource "services"');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Demonstrates `commitCharacters` auto-accept
 * (QONSOLE_ASSIST_FEATURES). The mock's flag completions carry
 * `commitCharacters: ['=']`. Typing `=` while a flag is focused
 * accepts the completion + inserts the `=` (or, when the
 * `textEdit.newText` already ends with `=`, suppresses the
 * duplicate).
 *
 * Sequence to play through (start from the default initial value —
 * see the BasicMock docstring on why typing arbitrary preamble
 * confuses the mock's slot grammar):
 *   1. Initial value `/list services `
 *   2. Type `-` — dropdown shows the flag list
 *   3. Type `-` again (now typing `--`)
 *   4. Type `l` — narrows to `--limit`
 *   5. Type `=` — `--limit` auto-accepts; final text is `/list services --limit=`
 *      (NOT `/list services --limit==`)
 */
export const WithCommitCharacters: Story = {
  args: {
    initialValue: '/list services ',
  },
  parameters: {
    docs: {
      description: {
        story:
          '`commitCharacters` auto-accept on `=` for flag value tokens. ' +
          'Verifies that no duplicate `=` is inserted when the ' +
          'completion already ends with one.',
      },
    },
  },
  async beforeEach() {
    const server = setupBasicQonsoleMockServer();
    return () => server.close();
  },
  // CI guard: typing `=` while `--limit` is focused auto-accepts and
  // must NOT produce `--limit==` (the inserted text already ends with
  // `=`, so the typed `=` is suppressed).
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    // Let the LSP session connect before typing — the completion only
    // fires on the keystroke, so the keystroke must land post-connect (a
    // dropped pre-connect trigger never opens, and `waitFor` can't undo
    // that). A short fixed settle is the right tool here.
    await sleep(500);
    await userEvent.click(editable);
    // `-` opens the flag list (first item `--desc` is auto-focused).
    await userEvent.type(editable, '-');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('--desc');
      },
      { timeout: 30000 }
    );
    // `=` is a commit character → auto-accept the focused `--desc`.
    // Use `userEvent.keyboard` (not `type`) so the keydown reaches the
    // document-capture commit handler cleanly. Its insertText already
    // ends with `=`, so the typed `=` is suppressed (no `--desc==`).
    await userEvent.keyboard('=');
    await waitFor(
      () => {
        expect(editable.textContent).toBe('/list services --desc=');
        expect(editable.textContent).not.toContain('==');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Demonstrates wizard launch via `command: 'qonsole.startWizard'`
 * (QONSOLE_ASSIST_FEATURES). The mock returns a synthetic
 * "Create connection" wizard item when no resource is set yet
 * (cursor on `/…`). Accepting the wizard item fires the wrapper's
 * `onWizardStart` callback INSTEAD of inserting text.
 *
 * Reqraft ships NO wizard runner UI — that's qorus-ide-side
 * (separate task). This story exists to verify the hand-off path:
 *   - The mock attaches a `command` field on the wizard item
 *   - The Qonsole inserter branches on `command.command === "qonsole.startWizard"`
 *   - The wrapper's `onWizardStart` fires with `command.arguments[0]`
 *
 * The args.onWizardStart is a `fn()` spy so the play test (and the
 * Storybook Actions panel) can confirm it was invoked.
 */
export const WithWizardItems: Story = {
  args: {
    initialValue: '/',
    onWizardStart: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Wizard-launch path. Initial value `/`; the dropdown opens ' +
          'on `/` with both commands AND a "Start Create connection ' +
          'wizard" item. Selecting the wizard item fires ' +
          '`onWizardStart` (visible in the Actions panel).',
      },
    },
  },
  async beforeEach() {
    const server = setupBasicQonsoleMockServer();
    return () => server.close();
  },
  // CI guard: selecting the wizard item fires `onWizardStart` with the
  // descriptor INSTEAD of inserting text. The initial `/` doesn't
  // auto-open (trigger-on-typing) — clear and re-type `/` to open the
  // verb dropdown that includes the wizard item.
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.clear(editable);
    await userEvent.type(editable, '/');
    // Poll until the verb dropdown opens and includes the wizard item.
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        const item = Array.from(
          document.querySelectorAll('.reqore-menu-item')
        ).find((el) => el.textContent?.includes('Create connection'));
        expect(item).toBeDefined();
      },
      { timeout: 30000 }
    );
    const wizardItem = Array.from(
      document.querySelectorAll('.reqore-menu-item')
    ).find((el) => el.textContent?.includes('Create connection'));
    await userEvent.click(wizardItem as HTMLElement);
    // The callback fired with the wizard descriptor.
    await waitFor(() => expect(args.onWizardStart).toHaveBeenCalled(), {
      timeout: 10000,
    });
    const callArg = (args.onWizardStart as ReturnType<typeof fn>).mock
      .calls[0][0];
    expect(callArg).toMatchObject({ action: 'start-wizard' });
  },
};
