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
import { sleep } from '../../../__tests__/utils';
import { useState } from 'react';
import { StoryMeta } from '../../types';
import { createMockLspServer, MOCK_LSP_URL } from './__fixtures__/mockLspServer';
import { SmartEditor } from './SmartEditor';
import { useLspSession } from './useLspSession';

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
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      handlers: {
        'textDocument/completion': () => ({
          items: [
            { label: 'apple', insertText: 'apple', kind: 14 },
            { label: 'banana', insertText: 'banana', kind: 14 },
          ],
        }),
      },
    });
    return () => lsp.close();
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
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      handlers: {
        'textDocument/completion': () => ({
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
        }),
      },
    });
    return () => lsp.close();
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
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      handlers: {
        'textDocument/completion': () => ({
          items: [
            { label: 'concat', insertText: 'concat', kind: 2, detail: 'method' },
            { label: 'slice', insertText: 'slice', kind: 2, detail: 'method' },
            { label: 'length', insertText: 'length', kind: 6, detail: 'number' },
            { label: 'name', insertText: 'name', kind: 6, detail: 'string' },
            { label: 'if', insertText: 'if', kind: 14 },
            { label: 'return', insertText: 'return', kind: 14 },
          ],
        }),
      },
    });
    return () => lsp.close();
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
 * Server-pushed diagnostics on the bare primitive — wavy inline
 * underlines plus the stacked message panel below the editor, with no
 * language wrapper involved.
 */
export const WithDiagnostics: Story = {
  args: {
    languageId: 'demo',
    initialValue: 'list services in pricing',
  },
  async beforeEach() {
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      handlers: {
        // Push diagnostics as soon as the document opens.
        'textDocument/didOpen': (msg, server) => {
          server.notify('textDocument/publishDiagnostics', {
            uri: msg.params?.textDocument?.uri,
            diagnostics: [
              {
                range: { start: { line: 0, character: 5 }, end: { line: 0, character: 13 } },
                message: 'Unknown resource "services".',
                severity: 1,
              },
              {
                range: { start: { line: 0, character: 17 }, end: { line: 0, character: 24 } },
                message: 'Pipeline "pricing" not found.',
                severity: 2,
              },
            ],
          });
        },
      },
    });
    return () => lsp.close();
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        // Both pushed diagnostics render in the message panel…
        expect(canvasElement.textContent).toContain('Unknown resource "services"');
        expect(canvasElement.textContent).toContain('Pipeline "pricing" not found');
        // …and the inline wavy underline is decorated.
        expect(canvasElement.querySelector('[data-testid="diagnostic-underline"]')).not.toBeNull();
      },
      { timeout: 30000 }
    );
  },
};

/** Read-only mode — the content renders but cannot be edited. */
export const ReadOnly: Story = {
  args: {
    languageId: 'demo',
    initialValue: 'frozen content',
    readOnly: true,
  },
  async beforeEach() {
    const lsp = createMockLspServer(MOCK_LSP_URL, { capabilities: {} });
    return () => lsp.close();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('frozen content')).toBeInTheDocument();
    // Slate renders read-only editors as non-editable.
    await expect(canvasElement.querySelector('[contenteditable="false"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[contenteditable="true"]')).toBeNull();
  },
};

/**
 * The not-ready overlay: the mock delays `initialize`, so the session
 * stays connecting and the spinner overlay covers the editor, then
 * clears by itself once the delayed handshake lands.
 */
export const LoadingOverlay: Story = {
  args: {
    languageId: 'demo',
    initialValue: 'visible under the overlay',
  },
  async beforeEach() {
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      delays: { initialize: 4000 },
    });
    return () => lsp.close();
  },
  play: async ({ canvasElement }) => {
    // Overlay visible while the handshake is delayed…
    await waitFor(
      () => expect(canvasElement.textContent).toContain('Connecting to language server'),
      { timeout: 10000 }
    );
    // …and gone once `initialize` resolves.
    await waitFor(
      () => expect(canvasElement.textContent).not.toContain('Connecting to language server'),
      { timeout: 30000 }
    );
  },
};

/**
 * **Live spike — hits the real Qorus `/lsp` endpoint** at
 * `wss://hq.qoretechnologies.com:8092/lsp`. No mock-socket. Used to
 * validate the SmartEditor + ReqraftLspClient abstraction end-to-end against
 * the shipped Qonsole LSP before committing to a `QonsoleSmartInput`
 * wrapper API. Type a slash-command like `/list services ` and the
 * server's real completions / signature / hover should render.
 *
 * **Prereq:** export `REACT_APP_QORUS_TOKEN=<token>` before
 * running storybook. Without a valid token the WebSocket handshake
 * fails with 401.
 */
export const LiveQonsole: Story = {
  // `!test` excludes this from the play-test runner and Chromatic is
  // disabled below — it connects to the REAL Qonsole LSP, which CI
  // (no token/network) can't reach. Mirrors qorus-ide's `Views/FullIDE`
  // (`useRealWebsockets` + `tags: ['!test']`).
  tags: ['!test'],
  args: {
    languageId: 'qonsole',
    initialValue: '/list services ',
    triggerCharacters: new Set(['/', ' ', '-', '=', '.']),
    height: '200px',
  },
  parameters: {
    chromatic: { disable: true },
    docs: {
      description: {
        story:
          'Lives against the real Qonsole LSP — no mock. Validates the ' +
          'SmartEditor + ReqraftLspClient abstraction against the shipped server. ' +
          'Set REACT_APP_QORUS_TOKEN before launching storybook.',
      },
    },
  },
  // Open real flag completions when run manually against the live
  // server: `/list services ` (trailing space) → 10 flag items via
  // `textDocument/completion`. Clear + retype that exact command so the
  // trailing-space trigger lands on the populated position — a lone `-`
  // returns 0 items there. Generous settle/timeout for the real
  // round-trip; story is `!test` so the CI play-test runner skips it.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await sleep(3000); // let the live LSP session connect before typing (real WS handshake)
    await userEvent.click(editable);
    await userEvent.clear(editable);
    await userEvent.type(editable, '/list services ');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('--desc');
      },
      { timeout: 30000 }
    );
  },
};
