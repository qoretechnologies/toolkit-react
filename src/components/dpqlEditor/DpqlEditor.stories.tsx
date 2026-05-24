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

interface IDpqlEditorStoryArgs {
  value?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  templates?: any;
  provider?: string;
  recordType?: string;
  stateId?: string;
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
                result: { capabilities: {} },
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
                      label: '@name',
                      insertText: '@name',
                      kind: 5,
                      detail: 'string',
                    },
                    {
                      label: '@status',
                      insertText: '@status',
                      kind: 5,
                      detail: 'string',
                    },
                    {
                      label: '@age',
                      insertText: '@age',
                      kind: 5,
                      detail: 'int',
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

export const WithPlainText: Story = {
  args: {
    value: 'SELECT * FROM users WHERE name = "Alice"',
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
    value: '@name == $data:{1.name} AND @age > $config:min_age',
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
    expect(completionReq.params.textDocument.uri).toMatch(/^dpql:\/\/richtext\//);

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
