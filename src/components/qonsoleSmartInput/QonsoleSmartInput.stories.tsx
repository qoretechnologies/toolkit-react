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

interface IDemoArgs {
  initialValue?: string;
  useContext?: IQonsoleAssistContext;
  height?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
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
          case 'textDocument/completion':
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  items: [
                    {
                      label: '--desc',
                      insertText: '--desc=',
                      kind: 10,
                      detail: 'if true then sort in descending order',
                    },
                    {
                      label: '--limit',
                      insertText: '--limit=',
                      kind: 10,
                      detail: 'maximum number of results',
                    },
                    {
                      label: '--search',
                      insertText: '--search=',
                      kind: 10,
                      detail: 'filter by name using a regex',
                    },
                  ],
                },
              })
            );
            break;
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
    await userEvent.click(editable);
    await userEvent.type(editable, '-');
    await sleep(500);
    const dropdown = document.querySelector('.reqore-menu');
    expect(dropdown).not.toBeNull();
    expect(dropdown!.textContent).toContain('--desc');
    expect(dropdown!.textContent).toContain('--limit');
    expect(dropdown!.textContent).toContain('--search');
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
