// Stories for the generic SmartEditor primitive. The first story
// (`BasicMock`) demonstrates the minimum-viable usage against a mocked LSP
// server using `mock-socket`. The second (`LiveQonsole`) is a deliberate
// spike — it skips the mock and hits the real `/lsp` endpoint configured
// by Reqraft's storybook preview (`https://hq.qoretechnologies.com:8092`)
// with `languageId: 'qonsole'`. Lets us validate the Qonsole LSP wire
// shape end-to-end before promoting the spike into a `QonsoleSmartInput`
// component proper.

import { StoryObj } from '@storybook/react';
import { fn, userEvent, within, expect } from '@storybook/test';
import { Server } from 'mock-socket';
import { useState } from 'react';
import { sleep } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { SmartEditor } from './SmartEditor';
import { useLspSession } from './useLspSession';

const MOCK_LSP_URL = `wss://hq.qoretechnologies.com:8092/lsp?token=${process.env.REACT_APP_QORUS_TOKEN}`;

interface IDemoArgs {
  languageId?: string;
  initialValue?: string;
  triggerCharacters?: Set<string>;
  height?: string;
  readOnly?: boolean;
  initialMetadata?: Record<string, any>;
  onChange?: (v: string) => void;
}

/** Generic playground — owns the LSP session and the controlled value. */
function SmartEditorPlayground(props: IDemoArgs) {
  const [value, setValue] = useState(props.initialValue ?? '');
  const session = useLspSession({
    languageId: props.languageId ?? 'qonsole',
    initialMetadata: props.initialMetadata,
    initialText: props.initialValue ?? '',
  });
  return (
    <SmartEditor
      session={session}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
      triggerCharacters={props.triggerCharacters}
      height={props.height}
      readOnly={props.readOnly}
    />
  );
}

const meta = {
  component: SmartEditorPlayground,
  title: 'Components/SmartEditor',
  args: {
    initialValue: '',
    onChange: fn(),
  },
} as StoryMeta<typeof SmartEditorPlayground>;

export default meta;
export type Story = StoryObj<typeof meta>;

/**
 * Minimum-viable SmartEditor against a mocked LSP server. Demonstrates
 * trigger characters → completion request → dropdown rendering with no
 * language-specific configuration.
 */
export const BasicMock: Story = {
  args: {
    languageId: 'demo',
    initialValue: '',
    triggerCharacters: new Set([' ', '.']),
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
        if (msg.method === 'initialize') {
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { capabilities: {} },
            })
          );
        } else if (msg.method === 'textDocument/completion') {
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                items: [
                  { label: 'apple', insertText: 'apple', kind: 14 },
                  { label: 'banana', insertText: 'banana', kind: 14 },
                ],
              },
            })
          );
        } else {
          socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null }));
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
    await userEvent.type(editable, 'hello ');
    await sleep(500);
    const dropdown = document.querySelector('.reqore-menu');
    expect(dropdown).not.toBeNull();
    expect(dropdown!.textContent).toContain('apple');
    expect(dropdown!.textContent).toContain('banana');
  },
};

/**
 * **Live spike — hits the real Qorus `/lsp` endpoint** at
 * `wss://hq.qoretechnologies.com:8092/lsp`. No mock-socket. Used to
 * validate the SmartEditor + LspClient abstraction end-to-end against
 * the shipped Qonsole LSP before committing to a `QonsoleSmartInput`
 * wrapper API. Type a slash-command like `/list services ` and the
 * server's real completions / signature / hover should render.
 *
 * **Prereq:** export `REACT_APP_QORUS_TOKEN=2f58cd78-...` before
 * running storybook. Without a valid token the WebSocket handshake
 * fails with 401.
 */
export const LiveQonsole: Story = {
  args: {
    languageId: 'qonsole',
    initialValue: '/list services ',
    triggerCharacters: new Set(['/', ' ', '-', '=', '.']),
    height: '200px',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Lives against the real Qonsole LSP — no mock. Validates the ' +
          'SmartEditor + LspClient abstraction against the shipped server. ' +
          'Set REACT_APP_QORUS_TOKEN before launching storybook.',
      },
    },
  },
};
