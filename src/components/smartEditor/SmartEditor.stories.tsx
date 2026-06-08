// Stories for the generic SmartEditor primitive. The first story
// (`BasicMock`) demonstrates the minimum-viable usage against a mocked LSP
// server using `mock-socket`. The second (`LiveQonsole`) is a deliberate
// spike — it skips the mock and hits the real `/lsp` endpoint configured
// by Reqraft's storybook preview (`https://hq.qoretechnologies.com:8092`)
// with `languageId: 'qonsole'`. Lets us validate the Qonsole LSP wire
// shape end-to-end before promoting the spike into a `QonsoleSmartInput`
// component proper.

import { StoryObj } from '@storybook/react';
import { fn, userEvent, waitFor, within, expect } from '@storybook/test';
import { Server } from 'mock-socket';
import { useState } from 'react';
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
    // Type a single trigger character (`.`). This story's job is to prove
    // "trigger char → completion request → dropdown" — so trigger it
    // directly. Deliberately NOT a bare word like `hello `: a word now
    // fires autosuggest on every keystroke (5 quiet round-trips for
    // `hello`) before the trailing space triggers, which made this the
    // most timing-sensitive story in the suite and the one that flaked
    // under parallel CI load. One trigger = one round-trip.
    await userEvent.type(editable, '.');
    // Poll until the async mock-LSP round-trip renders the dropdown —
    // never a fixed sleep, which races the WebSocket on slow CI.
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('apple');
        expect(dropdown!.textContent).toContain('banana');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Exercises the markdown-documentation tooltip render — completion items
 * carry rich markdown that should appear on hover with `react-markdown`
 * rendering (bold, lists, inline code), and a plaintext fallback when the
 * server says `kind: 'plaintext'`. Visual story; no play assertions.
 */
export const WithMarkdownDocs: Story = {
  args: {
    languageId: 'demo',
    initialValue: '',
    triggerCharacters: new Set([' ', '.']),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type any trigger character (space or `.`) to open the dropdown, ' +
          'then hover an item for ~200ms to reveal the markdown documentation ' +
          'tooltip. The first two items use `kind: "markdown"`, the third uses ' +
          '`kind: "plaintext"` to verify the fallback render.',
      },
    },
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
                  {
                    label: 'forEach',
                    insertText: 'forEach',
                    kind: 2,
                    detail: '(callback: (item) => void) => void',
                    documentation: {
                      kind: 'markdown',
                      value:
                        '### `forEach`\n\n' +
                        'Invoke a callback for **each** element in the collection.\n\n' +
                        '```ts\n' +
                        "['a','b','c'].forEach((x) => console.log(x))\n" +
                        '```\n\n' +
                        '- Stops on `break` ✗ (use `for…of` instead)\n' +
                        '- Returns `undefined`',
                    },
                  },
                  {
                    label: 'map',
                    insertText: 'map',
                    kind: 2,
                    detail: '<U>(fn: (item: T) => U) => U[]',
                    documentation: {
                      kind: 'markdown',
                      value:
                        '### `map`\n\n' +
                        'Project each element through `fn`, returning a new array.\n\n' +
                        '- Pure / no side effects\n- Preserves length',
                    },
                  },
                  {
                    label: 'reduce',
                    insertText: 'reduce',
                    kind: 2,
                    detail: '<U>(fn, init: U) => U',
                    documentation: {
                      kind: 'plaintext',
                      value:
                        'Fold the collection into a single value using fn.\n\n' +
                        'Be careful with the initial value — without one, ' +
                        'reduce throws on empty input.',
                    },
                  },
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
  // Open the dropdown so the story snapshot is distinct from the other
  // empty-at-rest SmartEditor stories (and to guard the markdown-item
  // render path in CI).
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, 'arr.');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('forEach');
      },
      { timeout: 30000 }
    );

    // Regression guard: typing the method name after the `.` must
    // NARROW the list (not clear it). The filter needle is the segment
    // after the last `.` (`for`), not the whole `arr.for` token —
    // otherwise every suggestion would wrongly disappear. Poll until
    // the list has settled to the narrowed state (`reduce` gone).
    await userEvent.type(editable, 'for');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('forEach');
        expect(dropdown!.textContent).not.toContain('reduce');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Exercises multi-kind grouping — the dropdown should split items into
 * sections (Methods / Variables / Keywords) with a `ReqoreMenuDivider`
 * label between groups when more than one kind is present.
 */
export const WithGroupedKinds: Story = {
  args: {
    languageId: 'demo',
    initialValue: '',
    triggerCharacters: new Set([' ', '.']),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type a trigger to open the dropdown and verify the items are ' +
          'grouped under "Methods", "Variables", and "Keywords" headers. ' +
          'Each row also has its right-aligned kind chip.',
      },
    },
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
                  { label: 'concat', insertText: 'concat', kind: 2, detail: 'method' },
                  { label: 'slice', insertText: 'slice', kind: 2, detail: 'method' },
                  { label: 'length', insertText: 'length', kind: 6, detail: 'number' },
                  { label: 'name', insertText: 'name', kind: 6, detail: 'string' },
                  { label: 'if', insertText: 'if', kind: 14 },
                  { label: 'return', insertText: 'return', kind: 14 },
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
  // Open the grouped dropdown so the snapshot is distinct + guard the
  // kind-grouping render (Methods / Variables / Keywords sections).
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, 'x.');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        // Items from multiple kinds render.
        expect(dropdown!.textContent).toContain('concat');
        expect(dropdown!.textContent).toContain('length');
        expect(dropdown!.textContent).toContain('return');
      },
      { timeout: 30000 }
    );
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
