// Stories for DpqlEditor. Each story is wrapped by `DpqlEditorWithState`
// because the component is fully controlled (value/onChange). A `beforeEach`
// hook stands up an in-process `mock-socket` LSP server that handles the
// JSON-RPC handshake plus the methods the component actually calls —
// `initialize`, `textDocument/didOpen`, `textDocument/didChange`,
// `textDocument/didClose`, `textDocument/completion`, `dpql/setContext`,
// `dpql/validate`. Notifications are silently accepted; requests get canned
// responses.
//
// The end of the file includes a `LspCompletionRoundtrip` play test that
// exercises the full client↔server completion path: type `@`, wait for the
// mock server to receive `textDocument/completion`, then assert the
// dropdown rendered.

import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { Server } from 'mock-socket';
import { useState } from 'react';
import { sleep } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { DpqlEditor } from './DpqlEditor';

const STORY_LSP_URL = `wss://hq.qoretechnologies.com:8092/lsp?token=${process.env.REACT_APP_QORUS_TOKEN}`;

/**
 * Shared per-story state for the mock server. Reset in `beforeEach`.
 * The `LspCompletionRoundtrip` play test inspects `received` to verify
 * the full request reached the server.
 */
let received: any[] = [];

/**
 * Most-recent document text the client has sent via `didOpen` /
 * `didChange`. The semantic-tokens mock tokenises this string so the
 * response always matches what the user sees. Reset in `beforeEach`.
 */
let lastDocumentText = '';

/**
 * Story-level override for the artificial delay applied to
 * `dpql/setContext` responses. Used by the `WithDelayedContext`
 * story to demonstrate the `isContextReady` race-fix: while the
 * delay is in flight, the editor shows the "Loading schema…"
 * overlay and gates LSP-driven hooks (completions, hover, semantic
 * tokens) so they don't fire against a context-less server. Reset
 * by `beforeEach` on every other story.
 */
let setContextDelayMs = 0;

/**
 * Minimal DPQL-correct tokenizer used only by the story mock to
 * produce a plausible `textDocument/semanticTokens/full` response.
 * Returns the LSP-encoded flat int array (delta-encoded 5-tuples).
 *
 * Token type indices match the legend advertised in the mock's
 * `initialize` response:
 *   4 = variable   (`@field`)
 *   2 = class      (`$context:value` template references)
 *   8 = keyword    (`in`, `not`, `between`, `and`, `like`, `true`,
 *                  `false`, `null`)
 *   11 = string    (single- / double-quoted)
 *   12 = number    (int / float)
 *   14 = operator  (==, !=, <=, >=, <, >, &&, ||, !, =~, !~, +, -,
 *                  *, /, %, .., comma, parens, brackets, braces)
 *   13 = regexp    (/pattern/flags)
 *   10 = comment   (DPQL has no comments, but we keep this for
 *                  completeness if extended later)
 */
function mockTokenizeDpql(text: string): number[] {
  const DPQL_KEYWORDS = new Set([
    'in',
    'not',
    'between',
    'and',
    'like',
    'true',
    'false',
    'null',
  ]);
  // DPQL built-in functions per qore-2/design/dpql-syntax.md
  // §"Built-in Functions". When an identifier appears immediately
  // before `(`, classify it as a function call.
  const DPQL_FUNCTIONS = new Set([
    'abs',
    'round',
    'floor',
    'ceil',
    'trim',
    'ltrim',
    'rtrim',
    'concat',
    'split',
    'substr',
    'coalesce',
    'nullif',
    'now',
    'days',
    'hours',
    'minutes',
    'seconds',
    'milliseconds',
    'microseconds',
    'years',
    'months',
    'weeks',
    'get_year',
    'get_month',
    'get_day',
    'get_hour',
    'get_minute',
    'get_second',
    'format_date',
    'format_number',
    'map',
    'hash_map',
    'contains',
  ]);
  // Order matters: longer operators must come first so `==` doesn't
  // get matched as two `=` etc. The regex's alternation groups identify
  // the token type at match time.
  const TOKEN_RE = new RegExp(
    [
      `("(?:\\\\.|[^"\\\\])*")`, // 1: double-quoted string
      `('(?:\\\\.|[^'\\\\])*')`, // 2: single-quoted string
      `(/(?:\\\\.|[^/\\\\])*/[gimsux]*)`, // 3: regex literal /…/flags
      `(@"(?:\\\\.|[^"\\\\])*"|@[A-Za-z_][\\w.]*)`, // 4: @field
      `(\\$[A-Za-z_-][\\w-]*:(?:\\{[^}]*\\}|[\\w.{}]+))`, // 5: $context:value
      `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`, // 6: number
      `(==|!=|<=|>=|&&|\\|\\||=~|!~|\\.\\.|[+\\-*/%<>!=,(){}\\[\\].])`, // 7: operator
      `(\\b[A-Za-z_][\\w]*\\b)`, // 8: identifier (keyword check)
    ].join('|'),
    'g'
  );

  const lines = text.split('\n');
  const tokens: Array<{
    line: number;
    char: number;
    length: number;
    type: number;
  }> = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    TOKEN_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_RE.exec(line)) !== null) {
      const length = match[0].length;
      let type = -1;
      if (match[1] || match[2]) type = 11; // string
      else if (match[3]) type = 13; // regexp
      else if (match[4]) type = 4; // variable
      else if (match[5]) type = 2; // class (template)
      else if (match[6]) type = 12; // number
      else if (match[7]) type = 14; // operator
      else if (match[8]) {
        const word = match[8].toLowerCase();
        if (DPQL_KEYWORDS.has(word)) {
          type = 8; // keyword
        } else if (DPQL_FUNCTIONS.has(word)) {
          // Treat as a function regardless of trailing `(` — the live
          // server might be more contextual but this is good enough
          // for visual demos.
          type = 6; // function
        } else {
          // Plain identifier — no decoration in the mock.
          continue;
        }
      }
      if (type >= 0) {
        tokens.push({ line: lineIdx, char: match.index, length, type });
      }
    }
  }

  // Sort by position (stable; lines already sorted, char within line
  // sorted by regex iteration order).
  // Delta-encode per LSP spec.
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of tokens) {
    const deltaLine = t.line - prevLine;
    const deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
    data.push(deltaLine, deltaChar, t.length, t.type, 0);
    prevLine = t.line;
    prevChar = t.char;
  }
  return data;
}

interface IDpqlEditorStoryArgs {
  value?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  templates?: any;
  provider?: string;
  recordType?: string;
  stateId?: string;
  useServerParse?: boolean;
  alertPayloadContext?: boolean;
  fsmContext?: any;
}

const DpqlEditorWithState = (props: IDpqlEditorStoryArgs) => {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <DpqlEditor
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
};

const meta = {
  component: DpqlEditorWithState,
  title: 'Components/DpqlEditor',
  args: {
    value: '',
    onChange: fn(),
  },
  async beforeEach(context) {
    received = [];
    lastDocumentText = '';
    setContextDelayMs = 0;
    // Live stories (those with `parameters: { live: true }`) skip
    // the mock-socket server so the editor's WebSocket reaches the
    // real Qorus `/lsp` endpoint at `wss://hq.qoretechnologies.com:8092/lsp`.
    // Prereq: set `REACT_APP_QORUS_TOKEN` before running storybook.
    if (context.parameters?.live) {
      return undefined;
    }
    const server = new Server(STORY_LSP_URL);

    server.on('connection', (socket) => {
      socket.on('message', (raw) => {
        // ReqraftWebSocket sends heartbeat pings as plain strings.
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
        received.push(msg);

        // Track document text from didOpen / didChange notifications so
        // the semantic-tokens mock can tokenise the current content.
        if (msg.method === 'textDocument/didOpen') {
          lastDocumentText = msg.params?.textDocument?.text ?? '';
        } else if (msg.method === 'textDocument/didChange') {
          // The client sends a single full-document content change.
          const change = msg.params?.contentChanges?.[0];
          if (change && typeof change.text === 'string') {
            lastDocumentText = change.text;
          }
        }

        // Auto-respond to requests; notifications (no `id`) are accepted silently.
        if (msg.id === undefined) {
          return;
        }

        switch (msg.method) {
          case 'initialize':
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  capabilities: {
                    // Advertise semantic tokens with the LSP-standard
                    // 16-type / 6-modifier legend — same shape as the
                    // real Qorus `/lsp` endpoint (captured in
                    // `QONSOLE_LSP_RESPONSES.txt`).
                    semanticTokensProvider: {
                      legend: {
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
                      },
                      full: true,
                      range: true,
                    },
                    // Advertise signatureHelp so the client wires it
                    // up. Trigger chars mirror the real server
                    // (qorus/Classes/QorusLspWebSocketHandler.qc:847).
                    signatureHelpProvider: {
                      triggerCharacters: ['(', ',', ' ', '-', '='],
                    },
                  },
                },
              })
            );
            break;

          case 'textDocument/semanticTokens/full':
            // Tokenise the document text the client has just sent (via
            // the most recent didOpen / didChange). The story mock
            // doesn't track per-uri state — we use a small DPQL-correct
            // tokenizer here so the response matches the visible text.
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  data: mockTokenizeDpql(lastDocumentText),
                },
              })
            );
            break;

          case 'textDocument/completion':
            // Mirror the live DPQL server's shape — items include
            // `kind` (so SmartEditor renders the right-side kind chip)
            // and `documentation` (rendered as a markdown tooltip on
            // hover). Lets stories exercise the full visual treatment.
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  items: [
                    {
                      label: '@name',
                      insertText: '@name',
                      kind: 5,
                      detail: 'string',
                      documentation: {
                        kind: 'markdown',
                        value:
                          '**Display name** of the record.\n\n' +
                          '- Indexed, case-insensitive\n' +
                          '- Maps to the `name` column on the underlying table',
                      },
                    },
                    {
                      label: '@status',
                      insertText: '@status',
                      kind: 5,
                      detail: 'string',
                      documentation: {
                        kind: 'markdown',
                        value:
                          '**Lifecycle status** — one of:\n\n' +
                          '- `active`\n- `paused`\n- `archived`',
                      },
                    },
                    {
                      label: '@age',
                      insertText: '@age',
                      kind: 5,
                      detail: 'int',
                      documentation: {
                        kind: 'plaintext',
                        value: 'Age in years, computed from birth_date.',
                      },
                    },
                  ],
                },
              })
            );
            break;

          case 'dpql/setContext': {
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                provider: msg.params?.provider ?? null,
                recordType: msg.params?.recordType ?? 'record',
                fields: {
                  name: { display_name: 'Name', type: { name: 'string' } },
                  status: { display_name: 'Status', type: { name: 'string' } },
                  age: { display_name: 'Age', type: { name: 'int' } },
                },
              },
            });
            // Honour the story-level delay so the
            // `WithDelayedContext` story can demonstrate the
            // `isContextReady` overlay during a slow setContext
            // roundtrip. Most stories leave this at 0.
            if (setContextDelayMs > 0) {
              setTimeout(() => socket.send(response), setContextDelayMs);
            } else {
              socket.send(response);
            }
            break;
          }

          case 'dpql/validate':
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: { diagnostics: [] },
              })
            );
            break;

          case 'dpql/parse':
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  success: true,
                  expression: { exp: 'noop', args: [] },
                  diagnostics: [],
                },
              })
            );
            break;

          case 'dpql/serialize':
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: { dpql: '' },
              })
            );
            break;

          case 'dpql/setAlertPayloadContext':
            // Returns the canonical alert-payload schema. Mirrors
            // the real server's `setDpqlAlertPayloadContext`
            // (qorus/Classes/QorusLspWebSocketHandler.qc:8439).
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  context: 'alert-payload',
                  fields: {
                    severity: { display_name: 'Severity', type: { name: 'string' } },
                    alert_type: { display_name: 'Alert Type', type: { name: 'string' } },
                    alert_code: { display_name: 'Alert Code', type: { name: 'string' } },
                    alert_class: { display_name: 'Alert Class', type: { name: 'string' } },
                    interface_type: { display_name: 'Interface Type', type: { name: 'string' } },
                    interface_name: { display_name: 'Interface Name', type: { name: 'string' } },
                    alert_object: { display_name: 'Alert Object', type: { name: 'string' } },
                  },
                },
              })
            );
            break;

          case 'dpql/setFsmContext':
            // Captures which source the client passed and echoes
            // back a synthetic state_data_keys list so consumers
            // can verify the binding was sent. Mirrors the real
            // server's response shape from
            // `qorus/Classes/QorusLspWebSocketHandler.qc:8509`.
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  source_type: msg.params?.fsm
                    ? 'inline'
                    : msg.params?.draft_id
                      ? 'draft'
                      : msg.params?.fsmid
                        ? 'published'
                        : 'cleared',
                  current_state: msg.params?.current_state ?? null,
                  state_data_keys: ['order_id', 'user_name', 'event_type'],
                },
              })
            );
            break;

          case 'dpql/toRichtext':
            // Mirror the real server's response shape (see
            // `qorus/Classes/UserApi.qc:_priv_get_richtext_string`).
            // Synthetic small parser: turn `$prefix:value` and
            // `$prefix:{value}` patterns into tag children; everything
            // else is a text child. (The live server also recognises a
            // subset of patterns — we match what we know works.)
            (() => {
              const text = msg.params?.text ?? '';
              const TEMPLATE_RE =
                /\$[a-z][-a-z]+:(?:\{[^}]*\}|[\w.]+)/g;
              const children: any[] = [];
              let last = 0;
              let m: RegExpExecArray | null;
              while ((m = TEMPLATE_RE.exec(text)) !== null) {
                if (m.index > last) {
                  children.push({ text: text.slice(last, m.index) });
                }
                children.push({
                  type: 'tag',
                  value: m[0],
                  label: m[0],
                  children: [{ text: '' }],
                });
                last = m.index + m[0].length;
              }
              if (last < text.length) {
                children.push({ text: text.slice(last) });
              }
              if (children.length === 0) children.push({ text: '' });
              socket.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: {
                    type: 'richtext',
                    value: [{ type: 'paragraph', children }],
                  },
                })
              );
            })();
            break;

          case 'textDocument/formatting':
            // Return empty edit list — the editor treats this as "no change".
            socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: [] }));
            break;

          case 'textDocument/signatureHelp': {
            // Synthetic `coalesce(value1, value2, default)` signature
            // for visual demos. Real server returns the active call's
            // canonical signature via `dpql-get-signature-help`.
            const position = msg.params?.position ?? { line: 0, character: 0 };
            const lineText =
              lastDocumentText.split('\n')[position.line] ?? '';
            const head = lineText.slice(0, position.character);
            // Find the innermost unclosed `(` before the cursor. If
            // none, the cursor isn't inside any open call — return
            // empty signatures so the pill dismisses. Walk backward
            // tracking nesting depth: every `)` adds to depth, every
            // `(` at depth 0 is the one we're inside.
            let depth = 0;
            let openPos = -1;
            for (let i = head.length - 1; i >= 0; i--) {
              const c = head[i];
              if (c === ')') depth++;
              else if (c === '(') {
                if (depth === 0) {
                  openPos = i;
                  break;
                }
                depth--;
              }
            }
            if (openPos < 0) {
              // No open call at the cursor — empty signatures, pill
              // dismisses on the client side.
              socket.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: {
                    signatures: [],
                    activeSignature: 0,
                    activeParameter: 0,
                  },
                })
              );
              break;
            }
            // Count commas inside the matched open call, ignoring any
            // nested calls. (Crude: scan forward from openPos+1, track
            // paren depth, count commas at depth 0.)
            const argsRegion = head.slice(openPos + 1);
            let nestDepth = 0;
            let activeParameter = 0;
            for (let i = 0; i < argsRegion.length; i++) {
              const c = argsRegion[i];
              if (c === '(') nestDepth++;
              else if (c === ')') nestDepth--;
              else if (c === ',' && nestDepth === 0) activeParameter++;
            }
            // Synthetic `substr(...)` signature — mirrors the shape the
            // real Qorus server returns (captured during live probing).
            // Choosing `substr` (3 distinct params) over `coalesce`
            // (single-variadic-param) so active-parameter advancement
            // is visible on typing commas. Human-friendly capitalized
            // parameter names match the real server's convention.
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  signatures: [
                    {
                      label:
                        'substr(String Value, Start Character, Length) → string',
                      documentation: {
                        kind: 'markdown',
                        value:
                          'Extracts a substring from `String Value`, ' +
                          'starting at `Start Character` (0-based) and ' +
                          'taking at most `Length` characters.',
                      },
                      parameters: [
                        {
                          label: 'String Value',
                          documentation: 'The source string to extract from.',
                        },
                        {
                          label: 'Start Character',
                          documentation:
                            'The starting character position where the first character is 0.',
                        },
                        {
                          label: 'Length',
                          documentation:
                            'The maximum number of characters to return.',
                        },
                      ],
                    },
                  ],
                  activeSignature: 0,
                  activeParameter,
                },
              })
            );
            break;
          }

          default:
            // Unknown request: return null so the client's promise still resolves.
            socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null }));
            break;
        }
      });
    });

    return () => {
      server.close();
    };
  },
} as StoryMeta<typeof DpqlEditorWithState>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/**
 * No chips / templates — just a valid DPQL literal expression so we can
 * verify the editor mounts plain text without any tag elements. (The
 * previous example here used SQL `SELECT * FROM …` syntax — DPQL has
 * no `SELECT` / `FROM` / `WHERE`; the value was invalid DPQL inherited
 * from the qorus-ide Monaco placeholder. See design doc §7.)
 */
export const WithPlainText: Story = {
  args: {
    value: '1 == 1 && "hello" != "world"',
  },
};

export const WithFieldReference: Story = {
  args: {
    value: '@name == "Alice"',
  },
};

export const WithTemplateVariable: Story = {
  args: {
    value: 'contains("$local:input", "es")',
  },
};

export const WithMixedContent: Story = {
  args: {
    // DPQL uses `&&` for logical AND (not SQL's `AND`). See
    // qore-2/design/dpql-syntax.md §"Logical Operators".
    value: '@name == $data:{1.name} && @age > $config:min_age',
  },
};

/**
 * Exercises the `useServerParse` opt-in (design doc §6). The editor
 * calls `dpql/toRichtext` on the LSP and uses the server's structured
 * response as the Slate document. While the request is in flight, the
 * loading overlay shows; on a successful response, the editor renders
 * the server-parsed tree; on failure it falls back silently to the
 * client-side regex parser.
 *
 * The mock's `dpql/toRichtext` handler wraps `$prefix:value` patterns
 * as tag chips (matching the real server's behaviour). `@field` refs
 * are intentionally NOT chipped by the server response — that's a
 * known limitation; the client-side parser handles them in normal
 * (non-server-parse) mode.
 */
export const WithServerParse: Story = {
  args: {
    value: '$static:input == "Alice" && $config:min_age > 18',
    useServerParse: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opts into `useServerParse`. Templates (`$static:input`, ' +
          '`$config:min_age`) are wrapped as tag chips by the server, ' +
          'not by the client regex. Watch the brief "Connecting…" ' +
          'overlay on first mount while the server response arrives.',
      },
    },
  },
};

/**
 * Demonstrates the `isContextReady` race-fix (CONTEXT_AND_POLISH item 1).
 * Mock LSP delays `dpql/setContext` by 1.5s, so for the first 1.5s
 * after mount:
 * - The editor shows the "Loading schema…" overlay
 * - Typing `@` produces no completion dropdown (gated on
 *   `session.isContextReady`)
 * - Once setContext resolves, the overlay disappears and completions
 *   begin working.
 *
 * Verifies that the gap between LSP-ready and DPQL-context-bound
 * doesn't surface as a silently-empty dropdown anymore.
 */
export const WithDelayedContext: Story = {
  args: {
    value: '@name == "Alice"',
    provider: 'datasource:omq/table/users',
    recordType: 'record',
  },
  async beforeEach() {
    setContextDelayMs = 1500;
    return () => {
      setContextDelayMs = 0;
    };
  },
  parameters: {
    docs: {
      description: {
        story:
          'Slow `dpql/setContext` response (1.5s). On mount: ' +
          '"Loading schema…" overlay; typing `@` during the wait ' +
          'does NOT open the dropdown. After 1.5s: overlay clears, ' +
          'completions begin working normally.',
      },
    },
  },
};

/**
 * Demonstrates the `alertPayloadContext` prop (CONTEXT_AND_POLISH
 * item 4). Binds the document to the canonical alert-payload schema
 * instead of a provider/recordType pair — the field set becomes
 * `severity` / `alert_type` / `alert_code` / etc.
 *
 * Required by the qorus-ide Alert Rule / Silence editor's `match`
 * field.
 *
 * Implementation detail: when `alertPayloadContext` is set at mount,
 * the editor includes `metadata.dpql_context: "alert-payload"` in
 * the `textDocument/didOpen` notification so the server binds at
 * open-time — no extra roundtrip. Later toggles fire an explicit
 * `dpql/setAlertPayloadContext` request.
 */
export const WithAlertPayloadContext: Story = {
  args: {
    value: '@severity == "ERROR" && @interface_type == "service"',
    alertPayloadContext: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Alert-payload schema binding. Initial value uses ' +
          '`@severity` and `@interface_type` — fields the server ' +
          'knows about via the canonical alert-payload context.',
      },
    },
  },
};

/**
 * Demonstrates the `fsmContext` prop (CONTEXT_AND_POLISH item 4).
 * Binds an FSM context for state-aware template completions; the
 * mock sends a "published" source_type response when `fsmId` is
 * provided.
 *
 * Required by the qorus-ide FSM state editor when DpqlEditor is
 * embedded inside an action's match expression — `$data:` /
 * `$fsminput:` templates then resolve against the FSM's state
 * graph.
 *
 * Composable: can be combined with `provider`/`recordType` (provider
 * yields `@field` completions; FSM yields `$template:` completions).
 */
export const WithFsmContext: Story = {
  args: {
    value: '@status == "active" && $data:{order_id} > 0',
    provider: 'datasource:omq/table/orders',
    recordType: 'record',
    fsmContext: { fsmId: 42, currentState: 'process_order' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Composes provider context (for `@field` completions) ' +
          'with FSM context (for `$data:` template completions). ' +
          'Mock server replies with `source_type: "published"` and ' +
          'a synthetic state-data keys list.',
      },
    },
  },
};

/**
 * Demonstrates `textDocument/signatureHelp` (LSP_FEATURES task).
 * Initial value `substr("hello", ` leaves the cursor inside a
 * function call's argument list — on mount, the mock returns a
 * synthetic `substr(String Value, Start Character, Length) → string`
 * signature with the active parameter computed from the comma count
 * at the cursor.
 *
 * Mock shape mirrors the real Qorus DPQL server's `substr`
 * signature (3 distinct params, capitalized labels, `→ string`
 * return annotation) so the mock and live stories exercise
 * structurally-identical responses. See
 * `LiveDpqlEditorWithSignatureHelp` for the same flow against the
 * real backend.
 *
 * The signature pill renders ABOVE the caret line; the completion
 * popover (if it pops up alongside) anchors BELOW. The two coexist
 * without overlap.
 *
 * The mock advertises `signatureHelpProvider.triggerCharacters` in
 * its initialize response, so the editor wires up the hook. Servers
 * that don't advertise the provider get a silent no-op.
 */
export const WithSignatureHelp: Story = {
  args: {
    value: 'substr("hello", ',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Signature-help pill above the caret. Type `0, ` to ' +
          'advance to the next parameter (`Start Character` → ' +
          '`Length`); typing `)` dismisses.',
      },
    },
  },
};

/**
 * **Live spike — hits the real Qorus `/lsp` endpoint** at
 * `wss://hq.qoretechnologies.com:8092/lsp` with `languageId: 'dpql'`.
 * Used to validate `useLspSignatureHelp` end-to-end against the
 * shipped Qorus DPQL handler (`dpql-get-signature-help` in
 * `qorus/Classes/QorusLspWebSocketHandler.qc`).
 *
 * **Initial value: `substr("hello", `** — uses `substr` rather than
 * `coalesce` because `substr` has THREE distinct positional
 * parameters (`String Value`, `Start Character`, `Length`), so typing
 * commas visibly advances the active parameter. The server models
 * `coalesce` and `concat` as single-variadic-parameter functions
 * (one `Value` slot) — the pill stays static on those.
 *
 * Server-confirmed via direct probes:
 * - `substr("hello", ` → `activeParameter: 1` (Start Character)
 * - `substr("hello", 0, ` → `activeParameter: 2` (Length)
 *
 * Other multi-param candidates verified to advance: `round(Number,
 * Precision)`, `format_date(Date To Format, Format String)`,
 * `nullif(Value, Compare Value)`, `split(String To Split, Separator)`.
 *
 * The `parameters: { live: true }` flag tells the meta-level
 * `beforeEach` to skip the mock-socket setup so the WebSocket reaches
 * the real backend.
 *
 * **Prereq:** export `REACT_APP_QORUS_TOKEN` before running storybook.
 * Without a valid token the WebSocket handshake fails with 401.
 *
 * **Expected behavior:**
 * - On mount, pill appears showing `substr(String Value, Start
 *   Character, Length) → string` with `Start Character` highlighted
 *   (already past the first comma).
 * - Type `0, ` — pill updates: `Length` is now highlighted.
 * - Type `)` — pill dismisses (server returns empty signatures when
 *   the call is closed).
 *
 * **If no pill appears**, the most likely causes are:
 * - The real server doesn't advertise `signatureHelpProvider` for
 *   `languageId: 'dpql'` (capability drift — check via DevTools
 *   Network → WS frame inspector → `initialize` response).
 * - The server's `dpql-get-signature-help` returns a shape our
 *   client doesn't parse (check the response body for the request).
 * - The token is invalid (401 in DevTools Network).
 */
export const LiveDpqlEditorWithSignatureHelp: Story = {
  args: {
    value: 'substr("hello", ',
  },
  parameters: {
    live: true,
    docs: {
      description: {
        story:
          'Hits the real Qorus DPQL LSP — no mock. Initial value is ' +
          '`substr("hello", ` so active-parameter advancement is ' +
          'visible (`coalesce` would not advance because the server ' +
          'models it as single-variadic-param). Set ' +
          '`REACT_APP_QORUS_TOKEN` before launching storybook.',
      },
    },
  },
};

/**
 * Demonstrates LSP-driven syntax highlighting (design doc §7) across a
 * representative DPQL expression touching every coloured token type:
 * field references, templates, operators, string / number / boolean /
 * null literals, regex, range, keywords, parens.
 *
 * The story's mock LSP runs a small DPQL-correct tokenizer (defined at
 * the top of this file) and returns the LSP-encoded int array; the
 * editor's `useLspSemanticTokens` hook decodes it and renders each
 * token in the theme palette defined in `SmartEditor`.
 */
export const WithSemanticTokens: Story = {
  args: {
    value:
      '@status in ("active", "pending") && @age between 18 and 65 ' +
      '&& @email =~ /^[a-z]+@example\\.com$/i ' +
      '&& @balance > 0 && @deleted != true',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every coloured DPQL token category. Variables (`@status`, ' +
          '`@age`, …) in red, operators (`==`, `&&`, `=~`, `between`) ' +
          'in cyan, strings in green, numbers in orange, keywords ' +
          '(`in`, `between`, `and`, `not`, `true`) in purple, regex ' +
          'in cyan.',
      },
    },
  },
};

export const ReadOnly: Story = {
  args: {
    value: '@name == "Alice"',
    readOnly: true,
  },
};

export const WithTemplates: Story = {
  args: {
    value: '',
    templates: {
      items: [
        {
          label: '$local:input',
          value: '$local:input',
          icon: 'ExchangeDollarLine',
        },
        {
          label: '$timestamp:now',
          value: '$timestamp:now',
          icon: 'ExchangeDollarLine',
        },
        {
          label: '$config:api_key',
          value: '$config:api_key',
          icon: 'ExchangeDollarLine',
        },
      ],
    },
  },
};

/**
 * Sanity check that the editor mounts and accepts plain typing. Mirrors the
 * `CanTypeText` story on the qorus-ide feature/dpql-editor branch.
 */
export const CanTypeText: Story = {
  args: {
    value: '',
    onChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, 'hello');

    await expect(args.onChange).toHaveBeenCalled();
  },
};

/**
 * End-to-end LSP completion test. Types `@`, waits for the mock server to
 * receive `textDocument/completion`, and asserts the canned completion
 * items render in the dropdown. This guards the entire request-correlation
 * + autocomplete-debounce + dropdown-rendering path.
 */
export const LspCompletionRoundtrip: Story = {
  args: {
    value: '',
    onChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, '@');

    // The autocomplete debounce is 150ms; allow generous slack for the
    // server round-trip + React re-render.
    await sleep(500);

    // Server received the completion request.
    const completionReq = received.find(
      (m) => m.method === 'textDocument/completion'
    );
    expect(completionReq).toBeDefined();
    // useLspSession (Phase 1 + SmartEditor refactor) generates URIs as
    // `${languageId}://session/<n>` — for DPQL that's `dpql://session/<n>`.
    expect(completionReq.params.textDocument.uri).toMatch(/^dpql:\/\/session\//);

    // Dropdown rendered the canned items. They live outside the canvas
    // (Popover portal), so query the document directly.
    await sleep(100);
    const dropdown = document.querySelector('.reqore-menu');
    expect(dropdown).not.toBeNull();
    expect(dropdown!.textContent).toContain('@name');
    expect(dropdown!.textContent).toContain('@status');
    expect(dropdown!.textContent).toContain('@age');
  },
};
