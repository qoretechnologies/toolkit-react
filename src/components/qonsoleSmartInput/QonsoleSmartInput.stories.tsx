// Stories for QonsoleSmartInput. `BasicMock` exercises the full client↔
// server completion path against a mock-socket LSP that mirrors the
// shapes from the live spike. `LiveQonsole` hits the real `/lsp` endpoint
// (no mock) so the wrapper can be validated against the shipped Qorus
// backend before integrating into qorus-ide's QonsoleInput.

import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
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
 */
export const BasicMock: Story = {
  args: {
    initialValue: '/list services ',
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
        // Track document text so completion handler can return
        // contextually-correct items based on cursor position.
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
          case 'textDocument/completion': {
            // Stub Qonsole completion logic: return different items
            // based on what the user just typed. Mirrors the real
            // server's contextual behaviour — slash opens commands,
            // space opens resources / flags, `--` opens flag names.
            const position = msg.params?.position ?? { line: 0, character: 0 };
            const replaceRange = {
              start: { line: position.line, character: Math.max(0, position.character - 1) },
              end: position,
            };
            // Lightly inspect the document text the client most-recently
            // sent so we can tailor items. The `lastQonsoleText` ref
            // captures the latest didOpen / didChange.
            const text = lastQonsoleText;
            const charBefore = text[position.character - 1] ?? '';
            let items: any[] = [];
            if (text.startsWith('/') && !text.includes(' ')) {
              // Cursor is inside the verb token (`/lis…`) — suggest
              // top-level commands. Verbs commit on space (server
              // contract).
              items = [
                {
                  label: '/list',
                  insertText: '/list',
                  kind: 14,
                  detail: 'List resources',
                  commitCharacters: [' '],
                  sortText: '10_00_/list',
                },
                {
                  label: '/show',
                  insertText: '/show',
                  kind: 14,
                  detail: 'Show resource details',
                  commitCharacters: [' '],
                  sortText: '10_01_/show',
                },
                {
                  label: '/count',
                  insertText: '/count',
                  kind: 14,
                  detail: 'Count matching resources',
                  commitCharacters: [' '],
                  sortText: '10_02_/count',
                },
                // Mutating verb — server attaches a `warning` chip.
                {
                  label: '/delete',
                  insertText: '/delete',
                  kind: 14,
                  detail: 'Delete a resource',
                  commitCharacters: [' '],
                  warning: 'Mutates system state',
                  sortText: '20_00_/delete',
                },
                {
                  label: '/help',
                  insertText: '/help',
                  kind: 14,
                  detail: 'Show help',
                  commitCharacters: [' '],
                  sortText: '30_00_/help',
                },
                // Wizard launch item. When accepted, the wrapper's
                // `onWizardStart` fires INSTEAD of inserting text.
                // Mirror of the real-server shape:
                // qorus/Classes/QonsoleAssistService.qc:818
                {
                  label: 'Start "Create connection" wizard',
                  kind: 15, // CIK_SNIPPET — server uses snippet for wizards
                  detail: 'Guided setup',
                  data: {
                    action: 'start-wizard',
                    name: 'create-connection',
                    title: 'Create connection',
                    short_desc: 'Guided setup for a new connection',
                    verb: 'create',
                    resource: 'connections',
                    start_path: '/api/latest/qonsole/wizards/create-connection/start',
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
            } else if (/\s$/.test(text.slice(0, position.character))) {
              // Cursor sits after a space — suggest resource names.
              items = [
                { label: 'services', insertText: 'services', kind: 7, detail: 'Service interfaces', commitCharacters: [' '] },
                { label: 'workflows', insertText: 'workflows', kind: 7, detail: 'Workflow interfaces', commitCharacters: [' '] },
                { label: 'jobs', insertText: 'jobs', kind: 7, detail: 'Job interfaces', commitCharacters: [' '] },
                { label: 'users', insertText: 'users', kind: 7, detail: 'IDP users', commitCharacters: [' '] },
              ];
            } else if (charBefore === '-') {
              // Inside a `--flag` token — suggest flag names. Flags
              // commit on `=` for value-bearing flags or space for
              // booleans.
              items = [
                {
                  label: '--desc',
                  insertText: '--desc=',
                  kind: 10,
                  detail: 'sort descending',
                  textEdit: { range: replaceRange, newText: '--desc=' },
                  commitCharacters: ['='],
                },
                {
                  label: '--limit',
                  insertText: '--limit=',
                  kind: 10,
                  detail: 'maximum number of results',
                  textEdit: { range: replaceRange, newText: '--limit=' },
                  commitCharacters: ['='],
                },
                {
                  label: '--search',
                  insertText: '--search=',
                  kind: 10,
                  detail: 'filter by name using a regex',
                  textEdit: { range: replaceRange, newText: '--search=' },
                  commitCharacters: ['='],
                },
                {
                  label: '--app',
                  insertText: '--app=',
                  kind: 10,
                  detail: 'filter by application',
                  textEdit: { range: replaceRange, newText: '--app=' },
                  commitCharacters: ['='],
                },
              ];
            } else if (charBefore === '=') {
              // Inside a `--flag=value` value position — suggest
              // values for the last seen flag. The mock just returns
              // a few app names so the `--app=` path is exercisable.
              items = [
                { label: 'qorus', insertText: 'qorus', kind: 12, detail: 'Qorus core app' },
                { label: 'qorus-ide', insertText: 'qorus-ide', kind: 12, detail: 'Qorus IDE' },
                { label: 'qorus-creator', insertText: 'qorus-creator', kind: 12, detail: 'Qorus Creator' },
              ];
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
            socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null }));
            break;
        }
      });
    });
    return () => {
      server.close();
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');

    // Phase 1 contract: dropdown must not open just because the cursor
    // landed on a position whose char-before-cursor is a trigger
    // character. Initial value `/list services ` ends in a space (a
    // trigger char), so on mount + on click the dropdown must stay
    // closed.
    await sleep(500);
    expect(document.querySelector('.reqore-menu')).toBeNull();
    await userEvent.click(editable);
    await sleep(500);
    expect(document.querySelector('.reqore-menu')).toBeNull();

    // Now the user actually types — dropdown should open.
    await userEvent.type(editable, '-');
    await sleep(500);
    const dropdown = document.querySelector('.reqore-menu');
    expect(dropdown).not.toBeNull();
    expect(dropdown!.textContent).toContain('--desc');
    expect(dropdown!.textContent).toContain('--limit');
    expect(dropdown!.textContent).toContain('--search');

    // Accept the first item with Enter and check the editor doesn't
    // double-dash. The mock returns `textEdit` covering the typed `-`,
    // so the result must be `/list services --desc=`, not `---desc=`.
    await userEvent.keyboard('{Enter}');
    await sleep(200);
    expect(editable.textContent).toBe('/list services --desc=');
    expect(editable.textContent).not.toContain('---');
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
};

/**
 * Demonstrates `commitCharacters` auto-accept
 * (QONSOLE_ASSIST_FEATURES). The mock's flag completions carry
 * `commitCharacters: ['=']`. Typing `=` while a flag is focused
 * accepts the completion + inserts the `=` (or, when the
 * `textEdit.newText` already ends with `=`, suppresses the
 * duplicate).
 *
 * Sequence to play through:
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
 * The args.onWizardStart is a `fn()` spy so the play test (or your
 * Storybook actions panel) can confirm it was invoked.
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
};
