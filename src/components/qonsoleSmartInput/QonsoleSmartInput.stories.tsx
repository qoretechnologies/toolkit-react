import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';
import { sleep } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import {
  createMockLspServer,
  DEFAULT_LSP_CAPABILITIES,
  IMockLspServer,
  MOCK_LSP_URL,
} from '../smartEditor/__fixtures__/mockLspServer';
import { QonsoleSmartInput } from './QonsoleSmartInput';
import { IQonsoleAssistContext } from './types';

// Start of the current Qonsole token; drives the textEdit range so
// accepting an item replaces the partial token (else `/l` + `/list` →
// `/l/list`).
function findQonsoleTokenStart(text: string, cursorChar: number): number {
  let i = cursorChar - 1;
  while (i >= 0 && /[\w/=:.-]/.test(text[i])) {
    i--;
  }
  return i + 1;
}

// Which completion slot the cursor sits in, for the mock's naive
// `/verb resource [--flag[=value]]…` grammar: slot is decided by the
// count of non-flag word tokens before the cursor. `null` = no opinion,
// dropdown stays closed.
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

// Mock semantic-tokens producer (LSP delta-5-tuple int array). Having no
// schema, it only paints sigil-bracketed forms — `/verb` (keyword 8),
// `--flag` (modifier 9), `"strings"` (11), numbers (12); resource names
// and flag values stay plain. See `LiveQonsole` for the real coverage.
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
    // Strings first so they swallow any `--`/digits inside their quotes.
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

// Mock LSP server for `BasicMock`, `WithCommitCharacters`, and
// `WithWizardItems`: contextual completion, the conservative tokenizer,
// and `qonsole/*` methods on the shared mock plumbing.
function setupBasicQonsoleMockServer(): IMockLspServer {
  return createMockLspServer(MOCK_LSP_URL, {
    capabilities: {
      ...DEFAULT_LSP_CAPABILITIES,
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
    handlers: {
      'textDocument/semanticTokens/full': (_msg, server) => ({
        data: mockTokenizeQonsole(server.documentText),
      }),

      'textDocument/completion': (msg, server) => {
        // textEdit range `[tokenStart, cursor)` so accepting an item
        // replaces the partial token (no `/l/list` duplication).
        const position = msg.params?.position ?? { line: 0, character: 0 };
        const text = server.documentText;
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
              // Wizard launch item — `command` fires `onWizardStart`
              // instead of inserting text, so no textEdit.
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
        return { items };
      },

      'qonsole/setContext': (msg) => ({
        ok: true,
        context: msg.params?.context ?? null,
      }),

      'qonsole/validate': () => ({ diagnostics: [] }),

      'qonsole/assist': () => ({
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
      }),
    },
  });
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

// Mock-socket variant mirroring the Qonsole LSP wire shape. Play test
// types `-` after `/list services ` and asserts the canned completions
// render. The slot grammar is a naive word-counter and the tokenizer
// only paints sigil-bracketed forms; use `LiveQonsole` for real behaviour.
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
  // Real Qonsole LSP — excluded from the play-test runner and from
  // Chromatic (CI has no token/network).
  tags: ['!test'],
  args: {
    initialValue: '/list services ',
  },
  parameters: {
    chromatic: { disable: true },
    docs: {
      description: {
        story:
          'Hits the real Qonsole LSP — no mock. Type after the trailing ' +
          'space (or `-`, `=`, `/`, etc.) to see real completions render.',
      },
    },
  },
  // Open real flag completions (via `qonsole/assist`) when run manually
  // against the live server. Verified: `/list services ` → 10 flag
  // items. Clear + retype so the trailing-space trigger fires.
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

/**
 * Same as `LiveQonsole` but pre-binds a `/use services` context so
 * predictive text is scoped to that resource — exercises
 * `qonsole/setContext` via the `useQonsoleSession` hook.
 */
export const LiveQonsoleWithContext: Story = {
  // Real Qonsole LSP — excluded from the play-test runner and from
  // Chromatic (CI has no token/network).
  tags: ['!test'],
  args: {
    initialValue: 'show me services in the pricing pipeline ',
    useContext: { resource: 'services' },
  },
  parameters: {
    chromatic: { disable: true },
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
    const lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {},
      handlers: {
        // After didOpen, push a publishDiagnostics notification so the
        // editor renders inline + panel feedback. `didOpen` carries the
        // uri in params.textDocument.uri.
        'textDocument/didOpen': (msg, server) => {
          server.notify('textDocument/publishDiagnostics', {
            uri: msg.params?.textDocument?.uri,
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
          });
        },
      },
    });
    return () => lsp.close();
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
 * Demonstrates wizard items in the completion dropdown
 * (QONSOLE_ASSIST_FEATURES). The mock returns a synthetic "Create
 * connection" wizard item (carrying `command: 'qonsole.startWizard'`)
 * when no resource is set yet (cursor on `/…`), alongside the verb
 * commands.
 *
 * This story is the **visual** of the feature: it opens the dropdown
 * and leaves it open so the wizard item is what you see (in Storybook
 * and Chromatic). The behaviour of *selecting* it — firing
 * `onWizardStart` instead of inserting text — is covered by
 * `SelectingWizardItemFiresCallback` below.
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
          'Wizard item in the dropdown. The `/` verb dropdown includes ' +
          'a "Start Create connection wizard" entry alongside the ' +
          'commands. Left open so the item is visible.',
      },
    },
  },
  async beforeEach() {
    const server = setupBasicQonsoleMockServer();
    return () => server.close();
  },
  // Open the verb dropdown and STOP with it open, so the snapshot shows
  // the wizard item. (The initial `/` doesn't auto-open —
  // trigger-on-typing — so clear and re-type `/`.) Selecting it is a
  // separate story; clicking here would dismiss the dropdown and leave
  // an empty-looking snapshot.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.clear(editable);
    await userEvent.type(editable, '/');
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
  },
};

/**
 * Behavioural counterpart to `WithWizardItems`: selecting the wizard
 * item fires the wrapper's `onWizardStart` callback with the wizard
 * descriptor and inserts **no** text (the input stays `/`). Reqraft
 * ships no wizard runner UI — that's qorus-ide-side; this verifies the
 * hand-off path:
 *   - the mock attaches `command: 'qonsole.startWizard'` on the item
 *   - the Qonsole inserter branches on that command
 *   - `onWizardStart` fires with `command.arguments[0]`
 *
 * `args.onWizardStart` is a `fn()` spy so the play test (and the
 * Actions panel) can confirm the invocation.
 */
export const SelectingWizardItemFiresCallback: Story = {
  args: {
    initialValue: '/',
    onWizardStart: fn(),
  },
  parameters: {
    chromatic: { disable: true },
    docs: {
      description: {
        story:
          'Selecting the wizard item fires `onWizardStart` with the ' +
          'descriptor and inserts no text — the input stays `/`. The ' +
          'visual of the item itself is in `WithWizardItems`.',
      },
    },
  },
  async beforeEach() {
    const server = setupBasicQonsoleMockServer();
    return () => server.close();
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.clear(editable);
    await userEvent.type(editable, '/');
    await waitFor(
      () => {
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
    // The callback fired with the wizard descriptor...
    await waitFor(() => expect(args.onWizardStart).toHaveBeenCalled(), {
      timeout: 30000,
    });
    const callArg = (args.onWizardStart as ReturnType<typeof fn>).mock
      .calls[0][0];
    expect(callArg).toMatchObject({ action: 'start-wizard' });
    // ...and NO text was inserted (wizard launch ≠ completion insert).
    expect(editable.textContent).toBe('/');
  },
};
