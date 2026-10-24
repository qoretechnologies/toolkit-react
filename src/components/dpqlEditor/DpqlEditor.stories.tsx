import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { sleep } from '../../../__tests__/utils';
import { useState } from 'react';
import { StoryMeta } from '../../types';
import {
  createMockLspServer,
  DEFAULT_LSP_CAPABILITIES,
  IMockLspServer,
  MOCK_LSP_URL,
} from '../smartEditor/__fixtures__/mockLspServer';
import { mockTokenizeDpql } from '../form/expressions/dpqlMockLanguage';
import { mockHoverDpql } from './__fixtures__/dpqlMockHover';
import { DpqlEditor } from './DpqlEditor';
import { TDpqlFsmContext } from './types';
import { expectChipFits } from '../../stories/chips';
import { withCoarsePointer } from '../../stories/coarsePointer';
import {
  atTheCaptureSize,
  middleOf,
  middleOfElement,
  mouseOffThePage,
  restMouseOn,
} from '../../stories/mouse';
import { withTouchScreen } from '../../stories/touchScreen';
import { PHONE_VIEWPORT } from '../../stories/tracking';

let lsp: IMockLspServer;

/** The record the stories' server describes (`dpql/setContext`): what a field's hover says of it. */
const STORY_RECORD_FIELDS = {
  name: {
    display_name: 'Name',
    short_desc: "The customer's full name, as they gave it",
    type: { name: 'string' },
  },
  status: { display_name: 'Status', type: { name: 'string' } },
  age: { display_name: 'Age', type: { name: 'int' } },
};

interface IDpqlEditorStoryArgs {
  value?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  provider?: string;
  recordType?: string;
  useServerParse?: boolean;
  alertPayloadContext?: boolean;
  fsmContext?: TDpqlFsmContext;
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
    /* Every story starts with the mouse off the page: the hover stories leave theirs resting where their hover is
       open, so that the capture shows the hover they are about (qorus#646, Foxhoundn: "If a story is about hover,
       the hover needs to be seen"), and a mouse left there opened a hover in the story after. */
    await mouseOffThePage();
    // Live stories (those with `parameters: { live: true }`) skip
    // the mock-socket server so the editor's WebSocket reaches the
    // real Qorus `/lsp` endpoint at `wss://hq.qoretechnologies.com:8092/lsp`.
    // Prereq: set `REACT_APP_QORUS_TOKEN` before running storybook.
    if (context.parameters?.live) {
      return undefined;
    }
    // Captured from the most recent `dpql/setFsmContext`; surfaced inside
    // a `$data:` template, mirroring the real server where `$data:{…}`
    // resolves against the bound FSM state.
    let fsmStateDataKeys: string[] = [];
    lsp = createMockLspServer(MOCK_LSP_URL, {
      capabilities: {
        ...DEFAULT_LSP_CAPABILITIES,
        // Trigger chars mirror the real server (QorusLspWebSocketHandler.qc:847).
        signatureHelpProvider: {
          triggerCharacters: ['(', ',', ' ', '-', '='],
        },
        // the real server answers hovers: functions, operators, fields, accessors, templates (qorus#646)
        hoverProvider: true,
      },
      handlers: {
        'textDocument/hover': (msg, server) =>
          mockHoverDpql(
            server.textOf(msg.params?.textDocument?.uri),
            msg.params?.position ?? { line: 0, character: 0 },
            STORY_RECORD_FIELDS
          ),
        'textDocument/semanticTokens/full': (msg, server) => ({
          data: mockTokenizeDpql(server.textOf(msg.params?.textDocument?.uri)),
        }),

        // Position-aware like the real `dpql-get-completions`: `$` →
        // templates, `@` → fields, no sigil → functions/keywords. The
        // mock decides from the char before the cursor.
        'textDocument/completion': (msg, server) => {
          const cpos = msg.params?.position ?? { line: 0, character: 0 };
          const cline = server.documentText.split('\n')[cpos.line] ?? '';
          const chead = cline.slice(0, cpos.character);
          const sigilMatch = chead.match(/[@$][\w:.{}]*$/);
          const sigilToken = sigilMatch ? sigilMatch[0] : '';
          const sigil = sigilToken ? sigilToken[0] : '';
          // `$data:` with a bound FSM context resolves against the FSM
          // state — surface its data keys.
          const inFsmDataTemplate =
            sigilToken.startsWith('$data:') && fsmStateDataKeys.length > 0;

          const FIELD_ITEMS = [
            {
              label: '@name',
              insertText: '@name',
              kind: 5,
              detail: 'Text',
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
              detail: 'Text',
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
              detail: 'Whole number',
              documentation: {
                kind: 'plaintext',
                value: 'Age in years, computed from birth_date.',
              },
            },
          ];

          // Template namespaces — the real server's `$`-context
          // completions (QorusExpressionMap).
          const TEMPLATE_ITEMS = [
            {
              label: '$data:',
              insertText: '$data:',
              kind: 1,
              detail: "needs a value after ':'",
              documentation: { kind: 'plaintext', value: 'FSM state data.' },
            },
            {
              label: '$config:',
              insertText: '$config:',
              kind: 1,
              detail: "needs a value after ':'",
              documentation: {
                kind: 'plaintext',
                value: 'Interface configuration item.',
              },
            },
            {
              label: '$static:',
              insertText: '$static:',
              kind: 1,
              detail: "needs a value after ':'",
              documentation: {
                kind: 'plaintext',
                value: 'Static workflow data.',
              },
            },
            {
              label: '$timestamp:',
              insertText: '$timestamp:',
              kind: 1,
              detail: "needs a value after ':'",
              documentation: {
                kind: 'plaintext',
                value: 'Timestamp value (e.g. `now`).',
              },
            },
          ];

          // No sigil → functions/keywords (what autosuggest surfaces).
          const FUNCTION_ITEMS = [
            {
              label: 'substr',
              insertText: 'substr',
              kind: 3,
              detail: 'gives text',
              documentation: {
                kind: 'markdown',
                value: 'Extract a substring.',
              },
            },
            {
              label: 'coalesce',
              insertText: 'coalesce',
              kind: 3,
              detail: 'gives any value',
              documentation: {
                kind: 'markdown',
                value: 'First non-null value.',
              },
            },
            {
              label: 'round',
              insertText: 'round',
              kind: 3,
              detail: 'gives any value',
              documentation: {
                kind: 'markdown',
                value: 'Round a number.',
              },
            },
          ];

          // FSM state-data keys from `dpql/setFsmContext`, surfaced inside
          // `$data:` when a context is bound.
          const FSM_DATA_KEY_ITEMS = fsmStateDataKeys.map((key) => ({
            label: key,
            insertText: key,
            kind: 5, // Field
            detail: 'FSM state data',
            documentation: {
              kind: 'plaintext',
              value: `\`${key}\` — resolved from the bound FSM state.`,
            },
          }));

          const items = inFsmDataTemplate
            ? FSM_DATA_KEY_ITEMS
            : sigil === '$'
              ? TEMPLATE_ITEMS
              : sigil === '@'
                ? FIELD_ITEMS
                : // no sigil → functions/keywords
                  FUNCTION_ITEMS;

          return { items };
        },

        // `WithDelayedContext` slows this via `lsp.delays['dpql/setContext']`
        // to show the `isContextReady` overlay.
        'dpql/setContext': (msg) => ({
          provider: msg.params?.provider ?? null,
          recordType: msg.params?.recordType ?? 'record',
          fields: STORY_RECORD_FIELDS,
        }),

        'dpql/validate': () => ({ diagnostics: [] }),

        'dpql/parse': () => ({
          success: true,
          expression: { exp: 'noop', args: [] },
          diagnostics: [],
        }),

        'dpql/serialize': () => ({ dpql: '' }),

        // Canonical alert-payload schema; mirrors the real
        // `setDpqlAlertPayloadContext` (QorusLspWebSocketHandler.qc:8439).
        'dpql/setAlertPayloadContext': () => ({
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
        }),

        // Echoes a synthetic state_data_keys list; mirrors the real
        // response shape (QorusLspWebSocketHandler.qc:8509).
        'dpql/setFsmContext': (msg) => {
          const sourceType = msg.params?.fsm
            ? 'inline'
            : msg.params?.draft_id
              ? 'draft'
              : msg.params?.fsmid
                ? 'published'
                : 'cleared';
          const stateDataKeys = ['order_id', 'user_name', 'event_type'];
          // Keep the keys while bound so completions can surface them in
          // `$data:`; a cleared binding drops them.
          fsmStateDataKeys = sourceType === 'cleared' ? [] : stateDataKeys;
          return {
            source_type: sourceType,
            current_state: msg.params?.current_state ?? null,
            state_data_keys: stateDataKeys,
          };
        },

        // Synthetic parser mirroring the real response shape
        // (UserApi.qc:_priv_get_richtext_string): `$prefix:value` /
        // `$prefix:{value}` become tag children, everything else is text.
        'dpql/toRichtext': (msg) => {
          const text = msg.params?.text ?? '';
          const TEMPLATE_RE = /\$[a-z][-a-z]+:(?:\{[^}]*\}|[\w.]+)/g;
          const children: Array<Record<string, unknown>> = [];
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
          return {
            type: 'richtext',
            value: [{ type: 'paragraph', children }],
          };
        },

        // Empty edit list — the editor treats this as "no change".
        'textDocument/formatting': () => [],

        // Synthetic `substr(...)` signature; the real server returns the
        // active call's signature via `dpql-get-signature-help`.
        'textDocument/signatureHelp': (msg, server) => {
          const position = msg.params?.position ?? { line: 0, character: 0 };
          const lineText = server.documentText.split('\n')[position.line] ?? '';
          const head = lineText.slice(0, position.character);
          // Innermost unclosed `(` before the cursor; none means the
          // cursor isn't inside a call, so the pill dismisses.
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
            return { signatures: [], activeSignature: 0, activeParameter: 0 };
          }
          // Active parameter = commas at depth 0 inside the open call.
          const argsRegion = head.slice(openPos + 1);
          let nestDepth = 0;
          let activeParameter = 0;
          for (let i = 0; i < argsRegion.length; i++) {
            const c = argsRegion[i];
            if (c === '(') nestDepth++;
            else if (c === ')') nestDepth--;
            else if (c === ',' && nestDepth === 0) activeParameter++;
          }
          // `substr` (3 distinct params) makes active-parameter
          // advancement visible as commas are typed.
          return {
            signatures: [
              {
                label: 'substr(String Value, Start Character, Length) → string',
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
                    documentation: 'The maximum number of characters to return.',
                  },
                ],
              },
            ],
            activeSignature: 0,
            activeParameter,
          };
        },
      },
    });
    return () => lsp.close();
  },
} as StoryMeta<typeof DpqlEditorWithState>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the DpqlEditor with no value — the editor mounts empty and ready for input.',
      },
    },
  },
};

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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with a plain DPQL literal expression — no field references or templates, so the editor mounts as plain text with no tag chips.',
      },
    },
  },
};

export const WithFieldReference: Story = {
  args: {
    value: '@name == "Alice"',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with an @name field reference — the editor mounts with a tag chip for the field and the literal string operand.',
      },
    },
  },
};

export const WithTemplateVariable: Story = {
  args: {
    value: 'contains("$local:input", "es")',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with a contains() call whose first argument is a $local:input template — the template renders as a tag chip inside the call.',
      },
    },
  },
};

export const WithMixedContent: Story = {
  args: {
    // DPQL uses `&&` for logical AND (not SQL's `AND`). See
    // qore-2/design/dpql-syntax.md §"Logical Operators".
    value: '@name == $data:{1.name} && @age > $config:min_age',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with mixed content — two @field references, two $data / $config templates and the DPQL "&&" logical operator between them, each rendered as its own chip or token.',
      },
    },
  },
};

/** The labels of the chips the editor draws, in order. */
const chipLabels = (editable: HTMLElement) =>
  [...editable.querySelectorAll('.reqore-tag')].map((chip) =>
    (chip.textContent ?? '').replace(/\uFEFF/g, '').trim()
  );

/**
 * The fields the server writes quoted (qorus#646): `dpql/serialize` writes a record field whose name DPQL does
 * not read bare as `@"…"` - a path with `[*]` or an index, a dashed key - which is how `$record:{create.items[*].id}`
 * comes back after a tab switch. Each is its chip, as `@name` is, labeled with the name it stands for; a template
 * with an escaped brace is one chip; and a field in a string is the string.
 */
export const WithQuotedFieldReferences: Story = {
  args: {
    value: '@"create.Unit\\.Price" == $record:{create.a\\{b\\}} && @"create.order-id" != "@name"',
    onChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with the quoted fields the server writes for record fields that are not bare names - @"create.Unit\\.Price", where the key Unit.Price holds a dot (qore#5480), and @"create.order-id" - a $record template whose value holds escaped braces, and the string "@name". Each field and the template is one chip, labeled as the record template it is (record: create.order-id); the string stays text; the text is written back as it was.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');

    await waitFor(() =>
      expect(chipLabels(editable)).toEqual([
        'record: create.Unit\\\\.Price',
        'record: create.a\\{b\\}',
        'record: create.order-id',
      ])
    );
    await expect(editable.textContent?.replace(/\uFEFF/g, '')).toContain('!= "@name"');
    // drawn, not rewritten
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const QuotedFieldTypedOutIsAChip: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the empty DpqlEditor and types @"create.order-id" == 1 without picking from the list. When the space after the closing quote is typed, the quoted field is drawn as its chip, labeled record: create.order-id, and the rest is typed after it.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');

    await userEvent.click(editable);
    await userEvent.type(editable, '@"create.order-id" == 1');

    await waitFor(() => expect(chipLabels(editable)).toEqual(['record: create.order-id']));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('@"create.order-id" == 1'));
    await expect(editable.textContent?.replace(/\uFEFF/g, '')).toMatch(/create\.order-id\s*== 1$/);
  },
};

/**
 * A field with accessors (David, qorus#646): the server writes a reference with a selector back as
 * `@create.items[*].id`, a key after an index as `.id`, and a key that needs quoting in braces. Each is one chip,
 * labeled with the whole path, and written back as it was.
 */
export const WithAccessorChains: Story = {
  args: {
    value:
      'size(@create.items[*].id) > size(@prices{*}) && @items[0].id != @headers{"content-type"}',
    onChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with fields that carry accessors, as the server writes them: @create.items[*].id, @prices{*}, @items[0].id and @headers{"content-type"}. Each is one chip labeled with its whole path as the record template it is - record: create.items[*].id, record: prices{*}, record: items[0].id, record: headers.content-type - not a chip for the field and plain text for the accessors; the text is written back as it was.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');

    await waitFor(() =>
      expect(chipLabels(editable)).toEqual([
        'record: create.items[*].id',
        'record: prices{*}',
        'record: items[0].id',
        'record: headers.content-type',
      ])
    );
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** A chip's look: its colors and its icon. */
const chipLook = (chip: HTMLElement) => {
  const style = getComputedStyle(chip);
  return {
    background: style.backgroundColor,
    color: getComputedStyle(chip.querySelector('.reqore-tag-content') ?? chip).color,
    icon:
      chip.querySelector('.reqore-icon')?.getAttribute('data-icon') ??
      chip.querySelector('svg')?.innerHTML,
  };
};

export const ARecordFieldIsOneChip: Story = {
  args: { value: '@orders[*].id == $record:{orders[*].id}', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with one record field written both ways - @orders[*].id, as the server writes DPQL, and $record:{orders[*].id}, as a value holds it. They are the same field and the same chip: both labeled record: orders[*].id, in the color and with the icon of every template chip (qorus#646, David: one chip for one record field). Before, the field was a light blue chip with black text, labeled orders[*].id.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');

    await waitFor(() =>
      expect(chipLabels(editable)).toEqual(['record: orders[*].id', 'record: orders[*].id'])
    );
    const [field, template] = Array.from(editable.querySelectorAll<HTMLElement>('.reqore-tag'));
    await expect(chipLook(field)).toEqual(chipLook(template));
    // drawn, not rewritten
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** The hovers the editor shows, as their text. */
const shownHovers = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.reqore-popover-content'))
    .map((popover) => (popover.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/**
 * The hover's card is a surface: an opaque background under its words, as a chip's hover is drawn. Drawn as glass it
 * was its words over an empty page (Foxhoundn, qlip #392: "It looks like the background is transparent?").
 */
const expectHoverOnACard = () => {
  const card = document.querySelector<HTMLElement>('.reqore-popover-content .reqore-popover-text');
  expect(card, "the hover's card").toBeTruthy();
  const background = getComputedStyle(card!).backgroundColor;
  const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(background)?.[1];
  expect(alpha === undefined ? 1 : Number(alpha), `the card's background (${background})`).toBe(1);
};

/** The editor, once its server is connected and the record described: a hover asked for from now on is answered. */
const readyEditor = async (canvasElement: HTMLElement) => {
  await waitFor(
    () =>
      expect(canvasElement.textContent).not.toMatch(/Connecting to language server|Loading schema/),
    { timeout: 10000 }
  );
  return within(canvasElement).getByRole('textbox');
};

/** The chip the editor draws for `label`. */
/** A chip's label: what a click on the chip lands on. */
const labelOf = (chip: HTMLElement) => chip.querySelector<HTMLElement>('.reqore-tag-content')!;

/** The editor's list (of completions, or of what may replace a chip), or null when it is not shown. */
const chipList = (editable: HTMLElement) =>
  document.getElementById(editable.getAttribute('aria-controls') ?? '');

/** A chip's list is under the chip, from its left edge. */
const expectListUnder = (label: HTMLElement, list: HTMLElement | null) => {
  const chip = (label.closest('.reqore-tag') as HTMLElement).getBoundingClientRect();
  const card = (list?.closest('.reqore-popover-content') as HTMLElement | null)?.getBoundingClientRect();
  expect(card, "the chip's list").toBeTruthy();
  expect(Math.abs(card!.left - chip.left), "the list from the chip's left edge").toBeLessThanOrEqual(2);
  expect(card!.top, 'the list under the chip').toBeGreaterThanOrEqual(chip.bottom - 1);
};

const chipFor = (editable: HTMLElement, label: string) =>
  waitFor(() => {
    const chip = Array.from(editable.querySelectorAll<HTMLElement>('.reqore-tag')).find(
      (each) => (each.textContent ?? '').replace(/\uFEFF/g, '').trim() === label
    );
    expect(chip, `the chip ${label}`).toBeTruthy();
    return chip!;
  });

export const HoverSaysWhatAFunctionIs: Story = {
  args: { ...WithAccessorChains.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with size(@create.items[*].id) > size(@prices{*}) && … and rests the mouse on size: the hover says what the server says of it - "function size", "Get Size", what it returns and its argument - as the live Qorus /lsp answers (qorus#646, David: "there are no mouseover / hovers on the functions").',
      },
    },
  },
  play: async ({ canvasElement, parameters }) => {
    // the frame at the size it is captured at: the mouse is on what it hovers when the hover is captured
    await atTheCaptureSize(parameters);
    const editable = await readyEditor(canvasElement);
    // the mouse stays on size: the capture shows the hover (the next story starts with the mouse off the page)
    await restMouseOn(editable, middleOf(editable, 'size'));
    await waitFor(() => expect(shownHovers()).toEqual([expect.stringContaining('Get Size')]), {
      timeout: 10000,
    });
    await expect(shownHovers()[0]).toContain('Returns the size of the operand');
    expectHoverOnACard();
  },
};

export const HoverOverAChipSaysWhatItsPathIs: Story = {
  args: { ...WithAccessorChains.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with the field path @create.items[*].id drawn as one chip, and rests the mouse on the chip: the hover says what the server says of each part of it - the field @create.items, the list wildcard [*], and the field id after it - as its text would, in one card (qorus#646, David: "there are no mouseover / hovers on the chips").',
      },
    },
  },
  play: async ({ canvasElement, parameters }) => {
    // the frame at the size it is captured at: the mouse is on what it hovers when the hover is captured
    await atTheCaptureSize(parameters);
    const editable = await readyEditor(canvasElement);
    const chip = await chipFor(editable, 'record: create.items[*].id');
    // the mouse stays on the chip: the capture shows the hover
    await restMouseOn(chip, middleOfElement(chip));
    await waitFor(
      () => expect(shownHovers()).toEqual([expect.stringContaining('list wildcard ([*])')]),
      { timeout: 10000 }
    );
    const [hover] = shownHovers();
    await expect(hover).toContain('@create.items');
    await expect(hover).toMatch(/field\s*id/);
    expectHoverOnACard();
  },
};

export const DetailsOnAChipOnATouchScreen: Story = {
  tags: ['touch'],
  args: { ...WithAccessorChains.args, onChange: fn() },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the same text on a phone (390 px, touch) and taps the chip create.items[*].id, which opens its list of what may replace it, then Details, its icon alone at this width: a finger cannot hover, and Details shows what the server says of the chip - the field @create.items, the list wildcard [*] and the field id - in a card under the text, all three lines of it. The tap on Details puts the list of the chip away, and the chips wrap inside the field.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await withTouchScreen(async (touch) => {
      const editable = await readyEditor(canvasElement);
      const chip = await chipFor(editable, 'record: create.items[*].id');
      await touch.tap(chip);
      // the tap opens the chip's list, as a click does
      await waitFor(() => expect(chipList(editable)).not.toBeNull());
      const details = await waitFor(
        () => {
          const button = canvasElement.querySelector<HTMLElement>('.smart-editor-details');
          expect(button, 'the Details button').toBeTruthy();
          return button!;
        },
        { timeout: 10000 }
      );
      if (touch.narrowed) {
        // in a row a phone's width, Details is its icon alone, still named (Foxhoundn, qlip #383)
        await waitFor(() => expect(details.textContent?.trim()).toBe(''));
        await expect(details).toHaveAccessibleName('Show what the word at the cursor is');
      }
      await touch.tap(details);
      // Details is a tap outside the chip's list: the list is put away, however soon it comes, and the card is
      // the one thing over the text (the list stayed open behind it when Details came within 300 ms)
      await expect(chipList(editable)).toBeNull();
      await waitFor(
        () => expect(shownHovers()).toEqual([expect.stringContaining('list wildcard ([*])')]),
        { timeout: 10000 }
      );
      await expect(shownHovers()[0]).toContain('@create.items');
      // under the text, all of it: the editor is three lines tall here, taller than the button
      const card = document.querySelector('.reqore-popover-content')!.getBoundingClientRect();
      await expect(card.top).toBeGreaterThanOrEqual(editable.getBoundingClientRect().bottom - 1);
    });
  },
};

export const AClickOnAChipOpensItsListAndASecondClosesIt: Story = {
  args: { value: '@name == @customer.name', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders @name == @customer.name and clicks the chip record: name: its list of what may replace it opens under it. A second click on the chip closes the list; a click on the other chip opens the list there; a click outside the list closes it. The capture shows the list open under record: customer.name.',
      },
    },
  },
  play: async ({ canvasElement, parameters }) => {
    // the frame at the size it is captured at: the list is drawn under its chip as captured
    await atTheCaptureSize(parameters);
    const editable = await readyEditor(canvasElement);
    // a click on a chip is on its label, where the mouse is: the label takes the chip's click
    const name = labelOf(await chipFor(editable, 'record: name'));
    const customer = labelOf(await chipFor(editable, 'record: customer.name'));

    await userEvent.click(name);
    await waitFor(() => expect(chipList(editable)).not.toBeNull());

    // the chip the list is at: the list is put away (it was put away by the click outside it, and opened
    // again by the same click on the chip)
    await userEvent.click(name);
    await waitFor(() => expect(chipList(editable)).toBeNull());

    await userEvent.click(name);
    await waitFor(() => expect(chipList(editable)).not.toBeNull());

    // another chip: the list is at that chip, where it is drawn - past the first one on a wide line, below it on
    // the next line where the line wraps (a phone) - under it from its left edge, not at the caret the click left
    // after it (Foxhoundn, qlip #392), nor still at the first chip (the popover the list was in says it closed
    // after the list opened there)
    await userEvent.click(customer);
    await waitFor(() => expectListUnder(customer, chipList(editable)));

    // outside the list: it is put away
    await userEvent.click(canvasElement);
    await waitFor(() => expect(chipList(editable)).toBeNull());

    await userEvent.click(customer);
    await waitFor(() => expect(chipList(editable)).not.toBeNull());
    // the list the capture shows: under record: customer.name, as the description says
    await waitFor(() => expectListUnder(customer, chipList(editable)));
  },
};

export const AChipLongerThanItsLineWrapsInsideIt: Story = {
  args: { ...WithAccessorChains.args, onChange: fn() },
  // an editor in a narrow card: narrower than its longest chips
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Renders the accessor chains in an editor 240 px wide, narrower than the chips record: create.items[*].id and record: headers.content-type. Each wraps its label inside its line, with its icon and its remove button, rather than running past the line and losing both ends (Foxhoundn, qlip #383: "The template tag is overflowing, you need to wrap it"). A chip that fits stays on one line, the height it always had.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    const long = await chipFor(editable, 'record: create.items[*].id');
    const short = await chipFor(editable, 'record: prices{*}');
    const line = editable.getBoundingClientRect();
    const chips = Array.from(editable.querySelectorAll<HTMLElement>('.reqore-tag'));
    await expect(chips.length).toBe(4);
    for (const chip of chips) {
      // small or bigger, and nothing in it running out of it
      expectChipFits(chip);
      const name = (chip.textContent ?? '').replace(/\uFEFF/g, '').trim();
      const box = chip.getBoundingClientRect();
      // inside its line
      await expect(box.left, `${name} starts in the line`).toBeGreaterThanOrEqual(line.left);
      await expect(box.right, `${name} ends in the line`).toBeLessThanOrEqual(line.right);
      // and its label is all drawn: none of it runs past the chip, which would clip it
      const label = chip.querySelector<HTMLElement>('.reqore-tag-content')!.getBoundingClientRect();
      await expect(label.left, `${name}: its label starts in it`).toBeGreaterThanOrEqual(
        box.left - 0.5
      );
      await expect(label.right, `${name}: its label ends in it`).toBeLessThanOrEqual(
        box.right + 0.5
      );
    }
    // the long chip wraps; the short one stays on one line
    await expect(long.getBoundingClientRect().height).toBeGreaterThan(
      short.getBoundingClientRect().height * 1.5
    );
  },
};

export const AChipWithItsOwnDescriptionShowsOneHover: Story = {
  args: { value: '@name == "Alice"', provider: 'orders-db', recordType: 'record', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders @name == "Alice" with the record described, and rests the mouse on the chip record: name: the chip shows its own description - "The customer\'s full name, as they gave it" - and the server\'s hover is not drawn over it as well. One hover over a chip, not two.',
      },
    },
  },
  play: async ({ canvasElement, parameters }) => {
    // the frame at the size it is captured at: the mouse is on what it hovers when the hover is captured
    await atTheCaptureSize(parameters);
    const editable = await readyEditor(canvasElement);
    const chip = await chipFor(editable, 'record: name');
    // the mouse stays on the chip: the capture shows its description, the one hover
    await restMouseOn(chip, middleOfElement(chip));
    await waitFor(
      () => expect(shownHovers()).toEqual([expect.stringContaining("The customer's full name")]),
      { timeout: 10000 }
    );
    await expect(shownHovers().join(' ')).not.toContain('Type: string');
  },
};

export const AccessorChainTypedOutIsAChip: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the empty DpqlEditor and types @orders[*].id == 1 without picking from the list. When the space after it is typed, the field and its accessors are drawn as one chip, record: orders[*].id, and the rest is typed after it.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');

    await userEvent.click(editable);
    // `[` starts a key descriptor for userEvent; `[[` types one
    await userEvent.type(editable, '@orders[[*].id == 1');

    await waitFor(() => expect(chipLabels(editable)).toEqual(['record: orders[*].id']));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('@orders[*].id == 1'));
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
    // The meta-level beforeEach has already created the per-story
    // harness; slow down setContext for this story only.
    lsp.delays['dpql/setContext'] = 1500;
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
  // CI guard for the `isContextReady` gate: while the 1.5s setContext
  // is in flight the "Loading schema…" overlay shows; once it resolves
  // the overlay clears.
  play: async () => {
    // While the 1.5s setContext is in flight, the overlay shows. Poll
    // for it (substring match — the copy is "Loading schema…").
    await waitFor(
      () => expect(document.body.textContent).toContain('Loading schema'),
      { timeout: 30000 }
    );
    // Once setContext resolves, the overlay clears.
    await waitFor(
      () => expect(document.body.textContent).not.toContain('Loading schema'),
      { timeout: 30000 }
    );
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
  // CI guard: `alertPayloadContext` must bind at `didOpen` time via the
  // `dpql_context: "alert-payload"` metadata (not a separate roundtrip).
  play: async () => {
    // Poll until the didOpen notification arrives and carries the
    // alert-payload binding metadata — no fixed sleep racing the socket.
    await waitFor(
      () => {
        const didOpen = lsp.received.find(
          (m) => m.method === 'textDocument/didOpen'
        );
        expect(didOpen).toBeDefined();
        expect(didOpen.params.textDocument.metadata?.dpql_context).toBe(
          'alert-payload'
        );
      },
      { timeout: 30000 }
    );
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
    value: '',
    provider: 'datasource:omq/table/orders',
    recordType: 'record',
    fsmContext: { fsmId: 42, currentState: 'process_order' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Composes provider context (`@field` completions) with FSM ' +
          'context. Typing a `$data:` template surfaces the bound FSM ' +
          "state's data keys (`order_id`, `user_name`, `event_type`) — " +
          'the distinctive payload of `fsmContext`. The mock answers ' +
          '`dpql/setFsmContext` with `source_type: "published"` and that ' +
          'key list, then returns the keys as completions inside `$data:`.',
      },
    },
  },
  // Open the `$data:` template so the snapshot shows the FSM-driven
  // state-data keys — this is what makes the story self-explanatory in
  // Chromatic and answers "which template is the FSM context": `$data:`.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await waitFor(
      () => {
        expect(document.body.textContent).not.toContain('Connecting to language server');
        expect(document.body.textContent).not.toContain('Loading schema');
      },
      { timeout: 30000 }
    );
    await userEvent.click(editable);
    await userEvent.type(editable, '$data:');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        // FSM state-data keys (from the bound fsmContext), NOT the generic
        // template namespaces — proves the FSM binding drives these completions.
        expect(dropdown!.textContent).toContain('order_id');
        expect(dropdown!.textContent).toContain('user_name');
        expect(dropdown!.textContent).toContain('event_type');
      },
      { timeout: 30000 }
    );
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
  // CI regression guard: on mount (cursor inside the open `substr(`
  // call) the signature pill must render with the active parameter
  // (`Start Character`) highlighted. Mount fires the hook without
  // typing, so this is deterministic — see the `Editor.end` fallback
  // in `useLspSignatureHelp`.
  play: async () => {
    // Poll until the signature pill renders (mount fires the hook via the
    // `Editor.end` fallback) with the active parameter highlighted.
    await waitFor(
      () => {
        const pill = Array.from(document.querySelectorAll('div')).find(
          (el) =>
            (el as HTMLElement).style?.position === 'fixed' &&
            el.textContent?.includes('substr(String Value')
        );
        expect(pill).toBeDefined();
        expect(pill!.textContent).toContain(
          'substr(String Value, Start Character, Length)'
        );
        // Active parameter highlighted in a <strong>.
        const strong = pill!.querySelector('strong');
        expect(strong).not.toBeNull();
        expect(strong!.textContent).toBe('Start Character');
      },
      { timeout: 30000 }
    );
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
  // Real DPQL LSP — excluded from the play-test runner and from Chromatic
  // (CI has no token/network, so the play would flake the snapshot).
  tags: ['!test'],
  args: {
    value: 'substr("hello", ',
  },
  parameters: {
    live: true,
    chromatic: { disable: true },
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
  // The signature pill fires on mount (cursor inside the open `substr(`
  // call) — no typing needed. Poll for it so a manual run shows the
  // real pill. Verified live: `substr("hello", ` →
  // `substr(String Value, Start Character, Length) → string`,
  // activeParameter 1.
  play: async () => {
    await waitFor(
      () => {
        const pill = Array.from(document.querySelectorAll('div')).find(
          (el) =>
            (el as HTMLElement).style?.position === 'fixed' &&
            el.textContent?.includes('substr(String Value')
        );
        expect(pill).toBeDefined();
      },
      { timeout: 30000 }
    );
  },
};

/**
 * **Live — real `/lsp`, with an alert-payload context bound.** This is
 * the story to verify `@` **field** completions against the real
 * server. `alertPayloadContext: true` fires `dpql/setAlertPayloadContext`,
 * binding the canonical alert schema — so typing `@` returns real fields
 * (`@severity`, `@alert_type`, `@interface_type`, …).
 *
 * Why a dedicated story: the no-context `LiveDpqlEditorWithSignatureHelp`
 * returns nothing on `@` (field refs need a bound context — the server's
 * NO-CONTEXT path yields functions/keywords/templates but not fields).
 * This story supplies that context so the `@` path is exercisable live.
 *
 * Also exercises `$` → templates in the same editor (server returns the
 * global namespaces context-free).
 *
 * **Prereq:** export `REACT_APP_QORUS_TOKEN` before running storybook.
 */
export const LiveDpqlEditorWithAlertPayload: Story = {
  // Real DPQL LSP — excluded from the play-test runner and from Chromatic
  // (CI has no token/network).
  tags: ['!test'],
  args: {
    value: '@severity == "MAJOR" and ',
    alertPayloadContext: true,
  },
  parameters: {
    live: true,
    chromatic: { disable: true },
    docs: {
      description: {
        story:
          'Real `/lsp` with `alertPayloadContext`. Type `@` → real ' +
          'alert-payload fields; type `$` → template namespaces. The ' +
          'context story you use to verify `@` field completions live.',
      },
    },
  },
  // Type `@` to open real alert-payload field completions so the
  // Chromatic snapshot shows live data. Verified live (alert-payload
  // context bound at didOpen): `…and @` → 21 fields (alert_type,
  // alert_code, severity, …).
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await sleep(3000); // let the live LSP session connect before typing (real WS handshake)
    await userEvent.click(editable);
    await userEvent.type(editable, '@');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('alert_type');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Demonstrates LSP-driven syntax highlighting (design doc §7) across a
 * representative DPQL expression touching every colored token type:
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
          'Every colored DPQL token category. Variables (`@status`, ' +
          '`@age`, …) in red, operators (`==`, `&&`, `=~`, `between`) ' +
          'in cyan, strings in green, numbers in orange, keywords ' +
          '(`in`, `between`, `and`, `not`, `true`) in purple, regex ' +
          'in cyan.',
      },
    },
  },
  // CI guard for the semantic-token pipeline (server tokens → decode →
  // decorate → colored leaf). Assert the editor rendered spans carrying
  // the palette colors: keyword purple (#c678dd → rgb(198,120,221)) and
  // string green (#98c379 → rgb(152,195,121)). If the decoration breaks,
  // the tokens render uncolored and these are absent.
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    // Poll until the semantic-token pipeline has colored the leaves
    // (server tokens → decode → decorate). Before the round-trip lands
    // the spans are uncolored and these assertions fail.
    await waitFor(
      () => {
        const colors = Array.from(editable.querySelectorAll('span'))
          .map((s) => (s as HTMLElement).style.color)
          .filter(Boolean);
        expect(colors).toContain('rgb(198, 120, 221)'); // keyword purple
        expect(colors).toContain('rgb(152, 195, 121)'); // string green
      },
      { timeout: 30000 }
    );
  },
};

export const ReadOnly: Story = {
  args: {
    value: '@name == "Alice"',
    readOnly: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the DpqlEditor with a valued expression but readOnly enabled — the field chip and literal render but the editor cannot be edited.',
      },
    },
  },
};

/**
 * Templates via the `$` trigger: the templates the editor is given, as whole values. The server answers `$` with
 * its template contexts (`$data:`, `$config:`, …), each of which needs a name typed after it, so a pick of one left
 * the text invalid (qorus#646, David: "clicking a variable immediately results in errors"); they are not listed,
 * and a context can still be typed by hand. `@` lists the record's fields.
 */
export const WithTemplates: Story = {
  args: {
    value: '',
    onChange: fn(),
    templates: {
      items: [
        {
          label: 'Order data',
          items: [
            { label: 'order id', value: '$static:{order_id}', badge: 'int' },
            { label: 'customer', value: '$static:{customer}', badge: 'string' },
          ],
        },
      ],
    } as never,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type `$` to list the templates the editor is given (order id, customer), each a whole value - not the ' +
          "server's template contexts ($data:, $config:), which need a name typed after them. Templates and " +
          'fields share one completion list: `$` lists templates, `@` fields (@name, @status, @age).',
      },
    },
  },
  // CI guard: `$` lists whole templates and no bare context, `@` lists fields
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);

    // `$` → the templates, as whole values
    await userEvent.type(editable, '$');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.completion-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('order id');
        expect(dropdown!.textContent).toContain('customer');
        // no context that needs a name typed after it, and no field
        expect(dropdown!.textContent).not.toContain('$data:');
        expect(dropdown!.textContent).not.toContain('$config:');
        expect(dropdown!.textContent).not.toContain('@name');
      },
      { timeout: 30000 }
    );

    // Clear and switch to `@` → fields.
    await userEvent.clear(editable);
    await userEvent.type(editable, '@');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.completion-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('@name');
        expect(dropdown!.textContent).not.toContain('$data:');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * `$` in an editor given no templates: the list says there are none. It listed the server's template contexts, and
 * a pick of one left the text invalid (qorus#646).
 */
export const ADollarWithNoTemplatesSaysThereAreNone: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Type `$` in an editor given no templates: the list says "No templates here" - not the server\'s ' +
          'template contexts ($data:, $config:), each of which needs a name typed after it, so a pick of one left ' +
          'the text invalid (David: "clicking a variable immediately results in errors"). A context can still be ' +
          'typed by hand.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, '$');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.completion-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('No templates here');
        expect(dropdown!.textContent).not.toContain('$data:');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Autosuggest — typing a **bare identifier** (no `@` / `$` sigil) opens
 * function / keyword completions as you type, e.g. `sub` → `substr`.
 * No trigger character or manual invoke needed.
 *
 * The dropdown only appears when the server actually has suggestions:
 * the request is "quiet" (the popover stays closed until items arrive),
 * and the position-aware server returns `[]` where completion isn't
 * appropriate (inside a string, a dead-end token) so nothing flickers.
 */
export const WithAutosuggest: Story = {
  args: {
    value: '',
    onChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Type a bare identifier (no sigil) — e.g. `sub` — and ' +
          'function completions appear (`substr`). Autosuggest fires ' +
          'on identifier typing; the server gates what (if anything) ' +
          'shows.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    // Bare identifier — no trigger char. Autosuggest should open the
    // dropdown and narrow to `substr`.
    await userEvent.type(editable, 'sub');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('substr');
        // Non-matching functions are filtered out by the typed prefix.
        expect(dropdown!.textContent).not.toContain('round');
      },
      { timeout: 30000 }
    );
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the empty DpqlEditor and types "hello" into it — the editor accepts the plain text and fires onChange.',
      },
    },
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
 * A reference that is the whole expression: the chip starts AND ends the line.
 * A click (or tap) at the end of the line puts the caret at the line's last
 * caret position, and what is typed there is written after the reference
 * (qorus#646, "can't type" in the Text view). Slate requires a text node on
 * each side of a chip; when the loaded document had none, the last caret
 * position was inside the chip, where Slate drops every keystroke, so the
 * editor looked focused and ignored typing.
 */
const typeAtTheEndOfTheLine =
  (reference: string, tap: 'mouse' | 'touch'): Story['play'] =>
  async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editable = canvas.getByRole('textbox');
    const line = await waitFor(() => {
      const paragraph = editable.querySelector<HTMLElement>('.reqore-tag')?.closest('p');
      if (!paragraph) throw new Error('the reference is not drawn as a chip yet');
      return paragraph;
    });
    // where the browser puts the caret for a click past the line's end: its
    // last caret position, the last text the line holds
    const caretSpots = line.querySelectorAll('[data-slate-string], [data-slate-zero-width]');
    const last = caretSpots[caretSpots.length - 1] as HTMLElement;
    if (tap === 'touch') {
      await userEvent.pointer([{ keys: '[TouchA]', target: last }]);
    } else {
      await userEvent.click(last);
    }
    editable.focus();
    const spot = document.createTreeWalker(last, NodeFilter.SHOW_TEXT).nextNode() as Text;
    window.getSelection()?.collapse(spot, spot.length);
    await userEvent.keyboard(' + 1');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(`${reference} + 1`));
    await expect(editable.textContent?.replace(/\uFEFF/g, '')).toContain(' + 1');
  };

export const TypesAfterAReferenceThatIsTheWholeLine: Story = {
  args: { value: '@pos', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'The expression is one reference. A click at the end of the line puts the caret after the chip, and " + 1" typed there is written after the reference.',
      },
    },
  },
  play: typeAtTheEndOfTheLine('@pos', 'mouse'),
};

export const TypesAfterAReferenceThatIsTheWholeLineOnTouch: Story = {
  args: { value: '@pos', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'The same on a touch screen: a tap at the end of the line puts the caret after the only chip, and what is typed there is written after the reference.',
      },
    },
  },
  play: typeAtTheEndOfTheLine('@pos', 'touch'),
};

export const TypesAfterAServerDrawnReference: Story = {
  args: { value: '$record:{pos}', useServerParse: true, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'The server draws the chips (`useServerParse`) and sends a line that is one reference. A click at the end of the line and typing writes after the reference.',
      },
    },
  },
  play: typeAtTheEndOfTheLine('$record:{pos}', 'mouse'),
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the empty DpqlEditor and types the "@" trigger — the LSP receives a textDocument/completion request against a dpql:// document URI and the dropdown mounts with the canned @name / @status / @age items.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const editable = canvas.getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.type(editable, '@');

    // Poll until the server received the completion request (the
    // autocomplete debounce is 150ms; the round-trip + re-render follow).
    await waitFor(
      () => {
        const completionReq = lsp.received.find(
          (m) => m.method === 'textDocument/completion'
        );
        expect(completionReq).toBeDefined();
        // useLspSession (Phase 1 + SmartEditor refactor) generates URIs as
        // `${languageId}://session/<n>` — for DPQL that's `dpql://session/<n>`.
        expect(completionReq.params.textDocument.uri).toMatch(
          /^dpql:\/\/session\//
        );
      },
      { timeout: 30000 }
    );

    // Dropdown rendered the canned items. They live outside the canvas
    // (Popover portal), so query the document directly.
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('@name');
        expect(dropdown!.textContent).toContain('@status');
        expect(dropdown!.textContent).toContain('@age');
      },
      { timeout: 30000 }
    );
  },
};

/**
 * Two editors mounted at once share ONE WebSocket — the `LspSharedConnection`
 * multiplexing layer in `lspClient.ts`. Each editor opens its own document
 * URI on the shared socket (`textDocument/didOpen` ×2) but the server sees a
 * single physical connection and a single `initialize` handshake.
 */
export const TwoEditorsOneConnection: Story = {
  parameters: {
    chromatic: { disable: true },
    docs: {
      description: {
        story:
          'Renders two DpqlEditor instances side by side — both share a single WebSocket via LspSharedConnection and each opens its own document URI, so the server sees one initialize but two didOpen notifications.',
      },
    },
  },
  render: () => (
    <>
      <DpqlEditorWithState value='name' />
      <DpqlEditorWithState value='status' />
    </>
  ),
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(2),
      { timeout: 10000 }
    );
    await waitFor(
      () => {
        const uris = new Set(
          lsp.received
            .filter((m) => m.method === 'textDocument/didOpen')
            .map((m) => m.params?.textDocument?.uri)
        );
        expect(uris.size).toBe(2);
      },
      { timeout: 10000 }
    );
    await waitFor(() => expect(lsp.getOpenConnectionCount()).toBe(1), { timeout: 10000 });
  },
};
