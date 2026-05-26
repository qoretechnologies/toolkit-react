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
  async beforeEach() {
    received = [];
    lastDocumentText = '';
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

          case 'dpql/setContext':
            socket.send(
              JSON.stringify({
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
              })
            );
            break;

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
