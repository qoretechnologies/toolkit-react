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
import { mockPublishedDiagnostics, mockTokenizeDpql } from '../form/expressions/dpqlMockLanguage';
import { mockHoverDpql } from './__fixtures__/dpqlMockHover';
import { DpqlEditor } from './DpqlEditor';
import { IDpqlEditorProps, TDpqlFsmContext } from './types';
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
import {
  chipsOf,
  completionLabels,
  completionRow,
  completionRows,
  expectRowsFit,
  highlightedCompletionLabel,
  saidOfTheText,
  seenCompletionLabels,
  typeAsAPerson,
  pickerFocused,
  pickerLabels,
  pickerRow,
  pickerSearch,
  plainTextOf,
} from '../../stories/templatePicker';
import { ITemplatesPayload } from '../../helpers/templates';
import {
  catalogueCompletions,
  storyDpqlCatalogue,
  TStoryRecordFields,
  TStoryStateData,
  TTemplateCatalogueFixture,
  undeclaredVariableDiagnostics,
} from '../../stories/templateCatalogueMock';
import { dpqlMockTypeName } from '../form/expressions/dpqlMockLsp';
import {
  QOG_FIELD_TEMPLATES,
  QOG_STATE_DATA_PAYLOAD,
  RECORD_FIELDS,
} from '../form/fields/template/__fixtures__/qogTemplatePayloads';

let lsp: IMockLspServer;

/**
 * The data the bound Qog's states give, as the server computes it when a Qog is bound (`dpql/setFsmContext`,
 * `FsmsRestClassV8::doComputeStateData`) and serves it at `fsms?action=getStateData`.
 */
const QOG_STATE_DATA: ITemplatesPayload = QOG_STATE_DATA_PAYLOAD;

/** The record the stories' server describes (`dpql/setContext`): what a field's hover says of it. */
const STORY_RECORD_FIELDS = RECORD_FIELDS;

/** A customer record, as a server describes it: its contact a record of its own (`@contact.email`). */
const CUSTOMER_RECORD_FIELDS = {
  name: { display_name: 'Name', short_desc: "The customer's name", type: { name: 'string' } },
  contact: {
    display_name: 'Contact',
    short_desc: 'How to reach the customer',
    type: {
      name: 'hash',
      fields: {
        email: { display_name: 'Email', short_desc: 'Their email address', type: { name: 'string' } },
        phone: { display_name: 'Phone', short_desc: 'Their phone number', type: { name: 'string' } },
      },
    },
  },
};

/** The fields the server offers after `@` and a record field's `.`: those at that path, each written whole. */
const fieldItemsAt = (fields: Record<string, unknown>, token: string) => {
  const path = token.slice(1).split('.');
  const typed = path.pop() ?? '';
  let level = fields as Record<string, { type?: { name?: string; fields?: Record<string, unknown> } }>;
  for (const step of path) {
    level = (level[step]?.type?.fields ?? {}) as typeof level;
  }
  return Object.entries(level)
    .filter(([name]) => name.startsWith(typed))
    .map(([name, field]) => ({
      label: `@${[...path, name].join('.')}`,
      insertText: `@${[...path, name].join('.')}`,
      kind: 5,
      detail: field.type?.name === 'hash' ? 'Key-value pairs (hash)' : 'Text',
    }));
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
  templates?: IDpqlEditorProps['templates'];
  wordWrap?: 'on' | 'off';
  maxHeight?: string;
  lineNumbers?: boolean;
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
    // The bound Qog's state data, from the most recent `dpql/setFsmContext`: what `$data:` completes, as the real
    // server completes it from the state data it computed when the Qog was bound.
    let fsmStateData: ITemplatesPayload = {};
    // the record the document is bound to, by its provider: a customer record has a record of its own in it
    let boundFields: Record<string, unknown> = STORY_RECORD_FIELDS;
    /* The document's template catalogue, as Qorus resolves it (`dpql/templateCatalogue`): the story's field's
       (`templateCatalogue`: one of Qorus's fixtures), with the bound Qog's state data as `$data:` and the bound
       record as `$record:`; a document with neither is a record expression with no context. */
    /* What the server finds in the text: its errors, and in a Qog, each variable a template uses that the Qog does
       not declare (`qog_variable_undeclared`, Qorus `getDpqlUndeclaredVariableDiagnostics()`). */
    const storyDiagnostics = (text: string) => [
      ...mockPublishedDiagnostics(text),
      ...(Object.keys(fsmStateData).length ? undeclaredVariableDiagnostics(storyCatalogue(), text) : []),
    ];
    const storyCatalogue = () =>
      storyDpqlCatalogue({
        catalogue: context.parameters?.templateCatalogue as TTemplateCatalogueFixture | undefined,
        stateData: Object.keys(fsmStateData).length ? (fsmStateData as TStoryStateData) : undefined,
        fields: boundFields as TStoryRecordFields,
      });
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

          /* A template being written, answered as Qorus answers a DPQL document from its catalogue
             (`catalogueCompletions`): the contexts it can use; after a context's `:`, `*` where it is used whole,
             then its keys; after a key's `.`, the key's keys. */
          const TEMPLATE_ITEMS =
            sigil === '$' ? catalogueCompletions(storyCatalogue(), sigilToken, dpqlMockTypeName) : [];

          /* The functions a bare word completes, as the real server lists them (`getFunctionCompletions`): those
             whose name starts with the word, each written with its bracket, what it gives its detail. */
          const wordTyped = (/[A-Za-z_]\w*$/.exec(chead)?.[0] ?? '').toLowerCase();
          const FUNCTIONS: Array<[string, string, string]> = [
            ['coalesce', 'gives any value', 'First non-null value.'],
            ['round', 'gives a number', 'Round a number.'],
            ['size', 'gives a whole number', 'The number of elements of a list or hash, or characters of text.'],
            ['substr', 'gives text', 'Extract a substring.'],
          ];
          const FUNCTION_ITEMS = FUNCTIONS.filter(([name]) => name.startsWith(wordTyped)).map(
            ([name, detail, value]) => ({
              label: name,
              insertText: `${name}(`,
              kind: 3,
              detail,
              documentation: { kind: 'markdown', value },
            })
          );

          /* Where a value can be written and nothing is typed of it - an empty text, after an operator, a comma
             or a bracket - what can start one, as Qorus answers there (Qore DpqlCompletionProvider, a value
             position): the record's fields, the literal values, the functions, the template contexts and `!`. */
          const atAValue = !wordTyped && (!chead.trim() || /[-+*/%<>=!&|,([]\s*$/.test(chead));
          const VALUE_POSITION_ITEMS = [
            ...(boundFields === STORY_RECORD_FIELDS ? FIELD_ITEMS : fieldItemsAt(boundFields, '@')),
            ...['true', 'false', 'null'].map((label) => ({ label, kind: 12, insertText: label })),
            ...FUNCTION_ITEMS,
            ...catalogueCompletions(storyCatalogue(), '$', dpqlMockTypeName),
            { label: '!', kind: 24, insertText: '!', documentation: 'Logical NOT' },
          ];
          /* After a whole value - a template written whole, braced (`$data:{receive_order.event_type}`, as a chip
             writes it) - what can follow one, as Qorus answers there: the operators. */
          if (/^\$[\w-]+:\{[^{}]*\}$/.test(sigilToken)) {
            return {
              items: ['==', '!=', '<', '>', '+', '&&', '||'].map((label) => ({ label, kind: 24, insertText: label })),
            };
          }
          const items = sigil === '$'
              ? TEMPLATE_ITEMS
              : sigil === '@'
                ? boundFields === STORY_RECORD_FIELDS ? FIELD_ITEMS : fieldItemsAt(boundFields, sigilToken)
                : atAValue
                  ? VALUE_POSITION_ITEMS
                  : // no sigil → functions/keywords
                    FUNCTION_ITEMS;

          return { items };
        },

        // `WithDelayedContext` slows this via `lsp.delays['dpql/setContext']`
        // to show the `isContextReady` overlay.
        'dpql/setContext': (msg) => {
          boundFields = msg.params?.provider === 'crm/customers' ? CUSTOMER_RECORD_FIELDS : STORY_RECORD_FIELDS;
          return {
            provider: msg.params?.provider ?? null,
            recordType: msg.params?.recordType ?? 'record',
            fields: boundFields,
          };
        },

        /* The server publishes what it finds in the text on every open and change, as Qorus does (`dpql-parse`):
           `$data:receive_order:ev` is refused - "':' can't be used here" (DPQL-E001, the server's own words). */
        'textDocument/didOpen': (msg, server) =>
          server.notify('textDocument/publishDiagnostics', {
            uri: msg.params?.textDocument?.uri,
            diagnostics: storyDiagnostics(server.textOf(msg.params?.textDocument?.uri)),
          }),
        'textDocument/didChange': (msg, server) =>
          server.notify('textDocument/publishDiagnostics', {
            uri: msg.params?.textDocument?.uri,
            diagnostics: storyDiagnostics(server.textOf(msg.params?.textDocument?.uri)),
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

        // the document's catalogue (Qorus `handleDpqlTemplateCatalogue`)
        'dpql/templateCatalogue': () => storyCatalogue(),

        // Echoes a synthetic state_data_keys list; mirrors the real
        // response shape (QorusLspWebSocketHandler.qc:8509).
        'dpql/setFsmContext': (msg, server) => {
          const sourceType = msg.params?.fsm
            ? 'inline'
            : msg.params?.draft_id
              ? 'draft'
              : msg.params?.fsmid
                ? 'published'
                : 'cleared';
          // the state data of the bound Qog while it is bound; a cleared binding has none
          fsmStateData = sourceType === 'cleared' ? {} : QOG_STATE_DATA;
          // the document's diagnostics again, with the Qog bound or cleared, as the server republishes them
          const boundUri = msg.params?.uri as string | undefined;
          if (boundUri) {
            server.notify('textDocument/publishDiagnostics', {
              uri: boundUri,
              diagnostics: storyDiagnostics(server.textOf(boundUri)),
            });
          }
          return {
            source_type: sourceType,
            current_state: msg.params?.current_state ?? null,
            // the states that give data, as the real server answers
            state_data_keys: Object.keys(fsmStateData),
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

        /* The text as the real server formats it, for the story that formats `1+2`: its operators spaced; any other
           text is left as it is (no edit). */
        'textDocument/formatting': (msg, server) => {
          const text = server.textOf(msg.params?.textDocument?.uri);
          return text === '1+2' ?
              [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: '1 + 2' }]
            : [];
        },

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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // read as the server reads it: no error under it (qlip #421: the stand-in server refused the escaped braces)
    await waitFor(() => expect(saidOfTheText(canvasElement)).toEqual([]));
  },
};

export const QuotedFieldTypedOutIsAChip: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    await typeAsAPerson(userEvent, '@"create.order-id" == 1');

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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `HoverOverAChipSaysWhatItsPathIs`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    await typeAsAPerson(userEvent, '@orders[*].id == 1');

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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
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
    // what a Qog host gives the field, as a Qog state's other fields have it (getContextData, getStateData)
    templates: QOG_FIELD_TEMPLATES,
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `TypingNarrowsToWhatItReaches`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          "Renders a DPQL field in a Qog state: the record's fields (`@`), the bound Qog's state data and the " +
          "field's context data, with the template button beside the text. Typing `$data:receive_order.` lists " +
          "that state's data only - Customer, Event type, Order ID and User name - each said to be in Receive " +
          'order, as State data, with its type; and the row that opens every template.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order.');
    await waitFor(
      () =>
        expect(completionLabels()).toEqual(['Customer', 'Event type', 'Order ID', 'User name', 'Browse all templates']),
      { timeout: 30000 }
    );
    // a user reads Qog, never FSM
    expect(completionListed().join(' | ')).not.toMatch(/FSM/);
    expect(canvasElement.querySelector('.smart-editor-template-button'), 'the template button').toBeTruthy();
  },
};

/** The rows of the completion list open at the editor's caret. */
const completionListed = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('.reqore-popover-content .completion-menu .reqore-menu-item')
  ).map((row) => row.textContent?.trim() ?? '');

/**
 * Puts the caret `offset` characters into the editor's text that is not a chip, or after its last chip when the
 * text is only chips (`offset` -1), and has the editor take it: a character typed and taken back there, which the
 * editor reads its selection at (navigation keys are not typed into a page by the test's keyboard).
 */
const caretAt = async (editable: HTMLElement, offset: number) => {
  const spots = Array.from(editable.querySelectorAll<HTMLElement>('[data-slate-string], [data-slate-zero-width]'));
  let at: { node: Text; offset: number } | undefined;
  if (offset < 0) {
    const last = spots[spots.length - 1];
    const node = document.createTreeWalker(last, NodeFilter.SHOW_TEXT).nextNode() as Text;
    at = { node, offset: node.length };
  } else {
    let left = offset;
    for (const spot of spots.filter((each) => each.hasAttribute('data-slate-string'))) {
      const node = document.createTreeWalker(spot, NodeFilter.SHOW_TEXT).nextNode() as Text;
      if (left <= node.length) {
        at = { node, offset: left };
        break;
      }
      left -= node.length;
    }
  }
  await userEvent.click(at!.node.parentElement!);
  editable.focus();
  window.getSelection()?.collapse(at!.node, at!.offset);
  await userEvent.keyboard('x{Backspace}');
};

/**
 * A Qog state's data picked from the list after `$data:receive_order.` is written as its chip, the whole reference:
 * it was written as its bare key (`order_id`), plain text the server cannot read (qorus#646, David's review).
 */
export const AStateDataPickIsWrittenAsItsChip: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders a DPQL field in a Qog state, types `$data:receive_order.` and picks Order ID from the list, ' +
          "which offers that state's data only: the text is the one chip for the whole reference " +
          '($data:{receive_order.order_id}), named Receive order › Order ID, and no plain text is left.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order.');
    await userEvent.click(await completionRow('Order ID'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{?receive_order\.order_id\}?\s*$/)
      )
    );
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Order ID']));
    expect(plainTextOf(editable)).toBe('');
  },
};

/**
 * A state picked from the list after `$data:` opens the picker at its data, and the data picked there is the one
 * chip of the whole reference (qorus#646, David's review of With Fsm Context: picking a state wrote its chip, a `.`
 * typed after it was lost when Event type was picked, and the text read `$data:receive_order$data:{…}`).
 */
export const APickedStateOpensItsDataAndThePickIsOneChip: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `$data:` and picks the state Receive order: its reference is written as text, ' +
          '$data:receive_order., and its data is listed - Customer, Event type, Order ID, User name. Picking ' +
          'Event type writes one chip, Receive order › Event type, for $data:{receive_order.event_type}, and ' +
          'nothing else.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:');
    /* a state taken is gone on into: its reference is written as text, and its data is listed next (qorus#646,
       David: "accepting an intermediate level continues to the next level") */
    await userEvent.click(await completionRow('Receive order'));
    await waitFor(() => expect(plainTextOf(editable)).toBe('$data:receive_order.'));
    await waitFor(() =>
      expect(seenCompletionLabels()).toEqual(['Customer', 'Event type', 'Order ID', 'User name', 'Browse all templates'])
    );
    await userEvent.click(await completionRow('Event type'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{?receive_order\.event_type\}?\s*$/)
      )
    );
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Event type']));
    expect(plainTextOf(editable)).toBe('');
  },
};

/**
 * A `.` typed after a state's chip goes on from it: a pick of the state's data takes the chip's place as well as
 * the `.` - one reference, one chip (qorus#646, David's review).
 */
export const AStateChipAndADotGoOnToOneChip: Story = {
  args: { ...WithFsmContext.args, value: '$data:receive_order', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Starts with the chip of the state Receive order, types `.` after it and picks Event type from the ' +
          "list of the state's data: the text is the one chip Receive order › Event type " +
          '($data:{receive_order.event_type}), not the state chip and a second chip after it.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await waitFor(() => expect(chipsOf(editable)).toHaveLength(1));
    await caretAt(editable, -1);
    await userEvent.keyboard('{Escape}.');
    await userEvent.click(await completionRow('Event type'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{?receive_order\.event_type\}?\s*$/)
      )
    );
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Event type']));
    expect(plainTextOf(editable)).toBe('');
  },
};

/**
 * What typing a reference offers is only what it reaches (qorus#646, David's review: `$data` showed what the empty
 * field did, `$data:` added the state, and every template was listed under whatever was typed): `$d`, `$data` and
 * `$data:` offer the states; `$data:receive_order.` that state's data. The row that opens every template is last.
 */
export const TypingNarrowsToWhatItReaches: Story = {
  args: { ...WithFsmContext.args },
  parameters: {
    docs: {
      description: {
        story:
          'Types key by key, and the list goes level by level: `$d` offers the template context it starts in a ' +
          'Qog, $data:; `$data` the one; `$data:` the states, Look up customer and Receive order; ' +
          "`$data:rec` Receive order; `$data:receive_order.` the state's data, Customer, Event type, Order ID and " +
          'User name. Every row fits the list: its name whole, its badges and its description inside it.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    /* level by level, each filtered by what is typed of it (qorus#646, David): `$d` the contexts it starts, the
       server's among them; `$data` the one; `$data:` its states; `$data:rec` the one */
    // a Qog's field: no workflow-only $dynamic: (Qorus `listTemplateContexts`, a DPQL document is a Qog's)
    await typeAsAPerson(userEvent, '$d');
    await waitFor(() => expect(completionLabels()).toEqual(['$data:', 'Browse all templates']), {
      timeout: 30000,
    });
    await typeAsAPerson(userEvent, 'ata');
    await waitFor(() => expect(completionLabels()).toEqual(['$data:', 'Browse all templates']), {
      timeout: 30000,
    });
    await typeAsAPerson(userEvent, ':');
    // the whole of it first, `$data:*` (UserApi reads `*` as the whole of it), then the states
    await waitFor(
      () =>
        expect(completionLabels()).toEqual(['$data:*', 'Look up customer', 'Receive order', 'Browse all templates']),
      { timeout: 30000 }
    );
    await typeAsAPerson(userEvent, 'rec');
    await waitFor(() => expect(completionLabels()).toEqual(['Receive order', 'Browse all templates']), {
      timeout: 30000,
    });
    await typeAsAPerson(userEvent, 'eive_order.');
    await waitFor(
      () =>
        expect(completionLabels()).toEqual(['Customer', 'Event type', 'Order ID', 'User name', 'Browse all templates']),
      { timeout: 30000 }
    );
    /* every row fits its list: its name whole, its type label not cut mid-word, its description inside it
       (qorus#646, David's review: Customer read as "t", its description over the row's edge) */
    expectRowsFit(completionRows());
  },
};

/**
 * A row says where it is apart from what it is (qorus#646, David's review: each state's data said "Receive order"
 * under its name, and was called a Variable): "in Receive order" on its line, State data and its type as its
 * badges, what it is in its documentation.
 */
export const ARowSaysWhereItIsApartFromWhatItIs: Story = {
  args: { ...WithFsmContext.args },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          "Types `$data:receive_order.e`: the row Event type says it is in Receive order, is State data (green, " +
          "the color of the data of the event that starts the Qog) of type Text, and, under its name, what it " +
          'is: what happened to the order. No row is called a Variable. `v` typed, Tab takes Event type: the chip ' +
          'Receive order › Event type.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order.e');
    const row = await completionRow('Event type');
    expect(row.textContent).toContain('in Receive order');
    expect(row.textContent).toContain('State data');
    expect(row.textContent).toContain('Text');
    expect(completionListed().join(' | ')).not.toContain('Variable');
    // what it is, in the row under its name - no hover over the row's edge (qorus#646, David's review)
    expect(row.textContent).toContain('What happened to the order');
    // typed on, key by key, the row stays; Tab takes it (qorus#646, David: Tab took the text as it was)
    await typeAsAPerson(userEvent, 'v');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('Event type'));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Event type']));
  },
};

/**
 * A click in the empty field opens the template picker at the top of what the field can refer to: its context
 * data, each Qog state, and the record's fields as a group of their own (qorus#646, David's review: the fields `@`
 * offers were not among the templates an empty field showed).
 */
export const AClickInTheEmptyFieldBrowsesItsTemplates: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Clicks in the empty DPQL field: the template picker opens at the top - Context Data, Look up customer, ' +
          'Receive order and Record fields. Record fields opens into name, status and age, each described by its ' +
          'display name; status picked is written as its chip, @status.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await waitFor(
      () =>
        expect(pickerLabels()).toEqual([
          'Context Data',
          'Look up customer',
          'Receive order',
          'Record fields',
          // every completion the field has (qorus#646): its contexts, each taken whole or gone into, the
          // functions and the values
          'Template contexts',
          'Functions',
          'Values and keywords',
        ]),
      { timeout: 30000 }
    );
    await userEvent.click(await pickerRow('Record fields'));
    await waitFor(() => expect(pickerLabels()).toEqual(['name', 'status', 'age']));
    await userEvent.click(await pickerRow('status'));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^@status\s*$/)));
    await waitFor(() => expect(chipsOf(editable)).toHaveLength(1));
  },
};

/** The keyboard browses the picker an empty field opens: the arrows, Enter to open and pick, ← to go back. */
export const TheKeyboardBrowsesThePicker: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Clicks in the empty field and uses only the keyboard: ↓ ↓ and Enter open Receive order, ← goes back to ' +
          'the top, Enter opens it again, ↓ and Enter pick Event type (the second row), written as its chip.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await waitFor(() => expect(pickerLabels()).toContain('Receive order'), { timeout: 30000 });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(pickerLabels()).toEqual(['Customer', 'Event type', 'Order ID', 'User name']));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(pickerLabels()).toContain('Receive order'));
    await waitFor(() =>
      expect(pickerFocused()).toBe('Context Data')
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{?receive_order\.event_type\}?\s*$/)
      )
    );
  },
};

/**
 * The template button puts the template at the caret, not at the end of the text (qorus#646): its search finds a
 * template at any depth by its name, and says where it is.
 */
export const TheTemplateButtonInsertsAtTheCaret: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSignatureHelp`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `concat(` - closed as it is typed, the caret between the brackets - and opens the template button: ' +
          'searching "city" finds City, in Receive order › Customer › Address. Picked, it is written at the caret - ' +
          'concat($data:{receive_order.customer.address.city}) - and its chip says the start and the end of its ' +
          'path: Receive order › … › Address › City.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, 'concat(');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat()'));
    await userEvent.keyboard('{Escape}');
    // a value can be written after `concat(`: the button can be pressed
    const button = canvasElement.querySelector<HTMLButtonElement>('.smart-editor-template-button')!;
    await waitFor(() => expect(button).not.toBeDisabled());
    await userEvent.click(button);
    const search = await pickerSearch();
    await userEvent.click(search);
    await userEvent.type(search, 'city');
    const city = await pickerRow('City');
    expect(city.textContent).toContain('in Receive order › Customer › Address');
    await userEvent.click(city);
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith('concat($data:{receive_order.customer.address.city})')
    );
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › … › Address › City']));
  },
};

/**
 * A click on a chip opens the picker at the chip's group, its row the keyboard's, and the pick takes its place
 * (qorus#646).
 */
export const AChipIsReplacedFromItsGroup: Story = {
  args: { ...WithFsmContext.args, value: '$data:{receive_order.order_id} > 10', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Clicks the chip Receive order › Order ID: the picker opens at Receive order with Order ID chosen. ' +
          'User name picked there takes its place: $data:{receive_order.user_name} > 10.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    const chip = await waitFor(() => {
      const found = editable.querySelector<HTMLElement>('.reqore-tag');
      expect(found).toBeTruthy();
      return found!;
    });
    // a click on a chip is on its label, where the mouse is: the label takes the chip's click
    await userEvent.click(labelOf(chip));
    await waitFor(() =>
      expect(pickerFocused()).toBe('Order ID')
    );
    await userEvent.click(await pickerRow('User name'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith('$data:{receive_order.user_name} > 10')
    );
  },
};

/** The picker on a phone: as wide as the screen less its margins, nothing wider than the screen. */
export const ThePickerOnAPhone: Story = {
  args: { ...WithFsmContext.args },
  tags: ['touch'],
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'On a phone, taps the empty field: the template picker fits the screen with a margin on each side, its ' +
          'rows wrap, and nothing scrolls sideways.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await withTouchScreen(async (touch) => {
      await touch.tap(editable);
      await waitFor(() => expect(document.querySelector('.template-picker')).toBeTruthy());
      if (touch.narrowed) {
        await waitFor(() => {
          const { left, right } = document.querySelector<HTMLElement>('.template-picker')!.getBoundingClientRect();
          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(window.innerWidth);
          expect(right - left).toBeLessThanOrEqual(window.innerWidth - 32 + 1);
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
        });
      }
      // a finger's row: as tall as a finger needs
      expect((await pickerRow('Receive order')).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    });
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
    await typeAsAPerson(userEvent, '@');
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
    // the regular expression is one value: its `@example` is the pattern's, no chip, and nothing is refused
    // (qlip #418: the chip record: example, and errors the server never gives)
    expect(chipsOf(editable)).toEqual([
      'record: status',
      'record: age',
      'record: email',
      'record: balance',
      'record: deleted',
    ]);
    expect(saidOfTheText(canvasElement)).toEqual([]);
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
            { label: 'order id', value: '$local:{order_id}', badge: 'int' },
            { label: 'customer', value: '$local:{customer}', badge: 'string' },
          ],
        },
      ],
    } as never,
  },
  parameters: {
    // a Qog state's field, in a loop, with variables, configuration items and state data (Qorus's fixture)
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          'Type `$` to list the template contexts Qorus offers a Qog\'s field ($autovar:, $config:, $data:, ...). ' +
          '`loc` and Tab write $local: and list the templates given in it, order id and customer. `@` lists the ' +
          'fields (@name, @status, @age).',
      },
    },
  },
  // CI guard: `$` lists whole templates and no bare context, `@` lists fields
  play: async ({ canvasElement }) => {
    // wait for the language server before typing: a `$` typed into the editor while it is still connecting is
    // answered once the session is ready, and this story's job is the completion content, not that race (#602)
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);

    // `$` → the contexts Qorus offers a Qog's field, and no field
    await typeAsAPerson(userEvent, '$');
    await waitFor(
      () => {
        // every row of the list, those scrolled out of sight too (in the catalogue's order, `sort_priority`)
        const listed = Array.from(
          document.querySelectorAll('.reqore-popover-content .completion-menu [data-label]')
        ).map((row) => row.getAttribute('data-label'));
        expect(listed).toEqual(expect.arrayContaining(['$config:', '$data:', '$env:']));
        expect(listed).not.toContain('@name');
      },
      { timeout: 30000 }
    );
    // `$local:` (taken with Tab) → the templates given in it, order id and customer
    await typeAsAPerson(userEvent, 'loc');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('$local:'));
    await userEvent.keyboard('{Tab}');
    // the whole of it, the templates given in it and the local context's keys the server lists
    await waitFor(() =>
      expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['$local:*', 'order id', 'customer', 'Interface ID']))
    );

    // Clear and switch to `@` → fields. Clearing is deterministic (select all through the DOM, then delete)
    // so it never rides on Ctrl+A landing mid-selection-sync; the emptied field offers its picker, which the
    // Escape puts away before `@` opens the completion list in its place (develop #602).
    await userEvent.keyboard('{Escape}');
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(editable);
    const selection = canvasElement.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(editable.textContent?.replace(/\uFEFF/g, '').trim()).toBe(''));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('.template-picker')).toBeNull());
    await typeAsAPerson(userEvent, '@');
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
 * A `$` typed while the language server is still connecting is answered once it is ready: the edit made before
 * the session was up is not lost, so the completion the author asked for still opens. This guards the deferred
 * request path (`pendingTypingRef`), whose loss on a loaded runner left `With Templates`' first `$` unanswered
 * and hung the test (develop #602).
 */
export const TypingBeforeTheServerIsReadyIsStillAnswered: Story = {
  args: { value: '', onChange: fn() },
  async beforeEach() {
    // the meta's beforeEach has made the harness; hold the session's `initialize` so `$` below is typed first
    lsp.delays.initialize = 800;
  },
  parameters: {
    // a Qog state's field, as `WithTemplates`
    templateCatalogue: 'qog-loops',
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'The editor is still connecting (its `initialize` is held 800ms). `$` is typed into it before the ' +
          'session is ready; once it is, the deferred request is answered and the contexts are listed - the ' +
          'edit made before the server was up is not lost.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = within(canvasElement).getByRole('textbox');
    // the session is not ready yet: the overlay is up
    await waitFor(() => expect(canvasElement.textContent).toContain('Connecting to language server'));
    // typed before the server is ready
    await userEvent.click(editable);
    await typeAsAPerson(userEvent, '$');
    expect(plainTextOf(editable)).toBe('$');
    // once the session is ready the deferred request is answered and the contexts are listed
    await waitFor(
      () => {
        const listed = Array.from(
          document.querySelectorAll('.reqore-popover-content .completion-menu [data-label]')
        ).map((row) => row.getAttribute('data-label'));
        expect(listed).toEqual(expect.arrayContaining(['$config:', '$data:', '$env:']));
      },
      { timeout: 20000 }
    );
  },
};

/**
 * `$` in an editor given no templates: the list says there are none. It listed the server's template contexts, and
 * a pick of one left the text invalid (qorus#646).
 */
export const ADollarWithNoTemplatesListsTheServersContexts: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    // a Qog state's field, in a loop, with variables, configuration items and state data (Qorus's fixture)
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          'Type `$` in an editor given no templates: the list offers the server\'s template contexts ($config:, ' +
          '$data:, ...), each of which a pick writes and goes on from, listing what is in it (qorus#646, David: ' +
          'typing should offer the language server\'s completions).',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // wait for the language server before typing `$`, so the request is not raced against the session coming up
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await typeAsAPerson(userEvent, '$');
    await waitFor(
      () => {
        const dropdown = document.querySelector('.completion-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('$data:');
        expect(dropdown!.textContent).toContain('$config:');
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
    await typeAsAPerson(userEvent, 'sub');
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithPlainText`.
    qlip: { skip: true },
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
    await typeAsAPerson(userEvent, 'hello');

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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
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
    await typeAsAPerson(userEvent, '@');

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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithPlainText`.
    qlip: { skip: true },
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

/**
 * A bracket typed is closed, a closing one typed before it steps over it, Backspace between an empty pair takes
 * both - as the Monaco editor the DPQL field had did (qorus#646, David: the editor that replaces it loses nothing).
 */
export const BracketsAndQuotesAreClosed: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `SpaceLeavesAHalfReferenceAsAnError`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `concat(`: the bracket is closed, `concat()`, the caret inside it. `"a` adds a closed string, ' +
          '`concat("a")`; `"` and `)` typed before the same ones step over them. `(` then Backspace takes the empty ' +
          'pair back whole.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, 'concat(');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat()'));
    await userEvent.keyboard('"a');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat("a")'));
    await userEvent.keyboard('")');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat("a")'));
    await userEvent.keyboard(' + (');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat("a") + ()'));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat("a") + '));
  },
};

/** The bracket matching the one at the caret is marked, past a chip and on another line. */
export const TheMatchingBracketIsMarked: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types `f((1), 2`: each bracket is closed as it is typed, and with the caret before the last `)`, it and ' +
          'the `(` it closes are marked - not the brackets of (1).',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, 'f((1), 2');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('f((1), 2)'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      const marked = Array.from(editable.querySelectorAll('.smart-editor-bracket-match'));
      expect(marked.map((each) => each.textContent)).toEqual(['(', ')']);
    });
  },
};

/** The search (Ctrl+F) finds every place a text is written, and its replace replaces one or all. */
export const FindAndReplace: Story = {
  args: { value: 'concat("old", " and ", "old")', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSignatureHelp`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Ctrl+F opens the search over the text: "old" is found twice, "1 of 2", both marked. Its replace, with ' +
          '"new", replaces all: concat("new", " and ", "new"). Escape closes it.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}{Control>}f{/Control}');
    const find = await waitFor(() => {
      const input = canvasElement.querySelector<HTMLInputElement>('.smart-editor-find input');
      expect(input).toBeTruthy();
      return input!;
    });
    await userEvent.type(find, 'old');
    await waitFor(() =>
      expect(canvasElement.querySelector('.smart-editor-find-count')?.textContent).toContain('1 of 2')
    );
    expect(editable.querySelectorAll('.smart-editor-find-match, .smart-editor-find-current')).toHaveLength(2);
    await userEvent.click(canvasElement.querySelector<HTMLElement>('.smart-editor-find-toggle-replace')!);
    const replace = canvasElement.querySelector<HTMLInputElement>('.smart-editor-replace input')!;
    await userEvent.type(replace, 'new');
    await userEvent.click(canvasElement.querySelector<HTMLElement>('.smart-editor-replace-all')!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('concat("new", " and ", "new")'));
    await userEvent.type(find, '{Escape}');
    await waitFor(() => expect(canvasElement.querySelector('.smart-editor-find')).toBeNull());
  },
};

/** Alt+↓ moves a line down, Shift+Alt+↓ copies it; Shift+Alt+F formats the text as the server does. */
export const LinesMovedAndCopied: Story = {
  args: { value: '', onChange: fn(), lineNumbers: true },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `SpaceLeavesAHalfReferenceAsAnError`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types two lines, `1 > 0` and `2 > 0`, each numbered. On the second, Alt+↑ moves it above the first; ' +
          'Shift+Alt+↓ copies it below itself.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '1 > 0');
    await userEvent.keyboard('{Escape}{Enter}');
    await typeAsAPerson(userEvent, '2 > 0');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('1 > 0\n2 > 0'));
    await userEvent.keyboard('{Escape}{Alt>}{ArrowUp}{/Alt}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('2 > 0\n1 > 0'));
    await userEvent.keyboard('{Shift>}{Alt>}{ArrowDown}{/Alt}{/Shift}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('2 > 0\n2 > 0\n1 > 0'));
  },
};

/** Shift+Alt+F formats the text as the language server formats it. */
export const FormattedByTheServer: Story = {
  args: { value: '1+2', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
    docs: {
      description: {
        story: 'Shift+Alt+F in "1+2" formats it as the server does (textDocument/formatting): "1 + 2".',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}{Shift>}{Alt>}f{/Alt}{/Shift}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('1 + 2'));
  },
};

/** Lines that do not wrap scroll inside the box; a box with a height scrolls its text within it. */
export const LongLinesDoNotWrap: Story = {
  args: {
    value:
      '@name == "a very long value that runs well past the width of the field, on and on, past any screen it is ' +
      'drawn on, a desktop one included" || @status == "another long value, as long as the first one, or longer"\n' +
      Array.from({ length: 12 }, (_, index) => `|| @age == ${index}`).join('\n'),
    wordWrap: 'off',
    maxHeight: '160px',
    lineNumbers: true,
    onChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Word wrap off, a 160px box and line numbers: the long first line scrolls sideways inside the box, the 13 ' +
          'lines scroll up and down within it, each numbered; nothing is wider than the box.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await waitFor(() => {
      expect(editable.scrollWidth).toBeGreaterThan(editable.clientWidth);
      expect(editable.getBoundingClientRect().height).toBeLessThanOrEqual(161);
      expect(editable.scrollHeight).toBeGreaterThan(editable.clientHeight);
    });
    const box = canvasElement.querySelector<HTMLElement>('.smart-editor-box')!;
    expect(editable.getBoundingClientRect().right).toBeLessThanOrEqual(box.getBoundingClientRect().right + 1);
  },
};

/**
 * A Qog state's data and a record are taken whole as well as opened (qorus#646, David: "if a user wants to choose
 * the entire Receive order or record hash, is this possible? If not, it should be."): the row's Use.
 */
export const AStateOrARecordIsTakenWhole: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types `$data:`: the state Receive order has Use beside it, which writes the state\'s whole data as one ' +
          'chip, Receive order ($data:{receive_order}); a click on the row instead opens its data. Then ' +
          '`$data:receive_order.`: the record Customer has Use too ($data:{receive_order.customer}), set apart ' +
          'from its row by a divider; hovered, it says "Use the whole record: all of Customer as one value".',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:');
    const state = await completionRow('Receive order');
    await userEvent.click(state.parentElement!.querySelector<HTMLElement>('.completion-use')!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^\$data:\{receive_order\}\s*$/)));
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order']));
    expect(plainTextOf(editable)).toBe('');
    await typeAsAPerson(userEvent, ' == $data:receive_order.');
    const customer = await completionRow('Customer');
    const use = customer.parentElement!.querySelector<HTMLElement>('.completion-use');
    expect(use, 'Use beside Customer').toBeTruthy();
    // set apart from the row's ">" by a divider, and saying what it does on hover (qorus#646, David's review)
    expect(getComputedStyle(use!).borderLeftStyle).toBe('solid');
    await userEvent.hover(use!);
    await waitFor(() =>
      expect(document.body.textContent).toContain('Use the whole record: all of Customer as one value')
    );
  },
};

/**
 * A template's color means one thing everywhere, and its hover says what (qorus#646, David: "what is the
 * significance of the colors?"): green is the data of the event that starts the Qog, purple a value Qorus gives,
 * blue any other data.
 */
export const AChipSaysWhatItsColorMeans: Story = {
  args: { ...WithFsmContext.args, value: '$data:{receive_order.event_type} == $timestamp:now' },
  parameters: {
    docs: {
      description: {
        story:
          'Event type, data of the event that starts the Qog, is a green chip; Current Timestamp, a value Qorus ' +
          'gives, a purple one. Hovered, each says what it is and what its color means: "From the event that ' +
          'starts the Qog." and "A value Qorus gives."',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    const eventType = await chipFor(editable, 'Receive order › Event type');
    await userEvent.hover(labelOf(eventType));
    await waitFor(() => expect(document.body.textContent).toContain('From the event that starts the Qog.'));
    await userEvent.unhover(labelOf(eventType));
    const now = await chipFor(editable, 'Current Timestamp');
    await userEvent.hover(labelOf(now));
    await waitFor(() => expect(document.body.textContent).toContain('A value Qorus gives.'));
  },
};

/**
 * What is typed is completed by the language server as well as from the field's templates, in the same list,
 * ranked by how well it fits (qorus#646, David: "typing '$dat' or '@nam' does not result in any LSP completion
 * support, but it should"): a template context, a function, a record field.
 */
export const TypingOffersTheServersCompletionsToo: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `$dat`: with the states, the server\'s template context $data:, which picked is written and lists ' +
          'the states. `siz` lists the function size first, saying it gives a whole number; `@nam` the record\'s ' +
          'field name.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$dat');
    await userEvent.click(await completionRow('$data:'));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$data:'));
    // written as text, and the list goes on from it: the states
    await waitFor(() => expect(completionLabels()).toEqual(expect.arrayContaining(['Receive order'])), {
      timeout: 30000,
    });
    await userEvent.keyboard('{Escape}{Control>}a{/Control}{Backspace}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(''));
    await typeAsAPerson(userEvent, 'siz');
    await waitFor(() => expect(completionLabels()[0]).toBe('size'), { timeout: 30000 });
    expect((await completionRow('size')).textContent).toContain('gives a whole number');
    await userEvent.keyboard('{Escape}{Control>}a{/Control}{Backspace}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(''));
    await typeAsAPerson(userEvent, '@nam');
    await completionRow('@name');
  },
};

/**
 * Tab takes the completion the keyboard is on, as a code editor's Tab does, and the text keeps the focus (qorus#646,
 * David: "if I type $data:receive_order.ev and hit <tab> ... it accepts the value as it is"). Typed one key at a
 * time, as a person types.
 */
export const TabTakesTheHighlightedCompletion: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `$data:receive_order.ev` key by key: the list shows Event type, highlighted. Tab takes it: the ' +
          'chip Receive order › Event type, the value $data:{receive_order.event_type}, and the caret stays in ' +
          'the text.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order.ev');
    await waitFor(() => expect(seenCompletionLabels()).toEqual(['Event type', 'Browse all templates']), {
      timeout: 30000,
    });
    expect(highlightedCompletionLabel()).toBe('Event type');
    // nothing is said of the reference while it is being written and its list is open
    expect(saidOfTheText(canvasElement)).toEqual([]);
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Event type']));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{receive_order\.event_type\}\s*$/)
      )
    );
    expect(plainTextOf(editable)).toBe('');
    expect(editable.contains(document.activeElement) || document.activeElement === editable).toBe(true);
  },
};

/**
 * Space after a half-typed reference puts the list away and types a space; the reference is left as the text it
 * was typed as, and the editor says it names nothing - never taken as a reference (qorus#646, David's review).
 */
export const SpaceLeavesAHalfReferenceAsAnError: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types `$data:receive_order.ev` key by key, then a space: the list goes away and the space is typed. ' +
          '$data:receive_order.ev stays text - no chip - and the editor says "No template here is called ' +
          '`$data:receive_order.ev`: pick one from the list, or remove it." It stays so when the editor is left.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order.ev');
    await waitFor(() => expect(seenCompletionLabels()).toContain('Event type'), { timeout: 30000 });
    await typeAsAPerson(userEvent, ' ');
    await waitFor(() => expect(seenCompletionLabels()).toEqual([]));
    const NAMES_NOTHING =
      'No template here is called `$data:receive_order.ev`: pick one from the list, or remove it.';
    await waitFor(() => expect(saidOfTheText(canvasElement)).toContain(NAMES_NOTHING), { timeout: 30000 });
    expect(chipsOf(editable)).toEqual([]);
    expect(plainTextOf(editable).trim()).toBe('$data:receive_order.ev');
    // left: still the text it was typed as, still said to name nothing
    await userEvent.click(canvasElement.ownerDocument.body);
    await waitFor(() => expect(chipsOf(editable)).toEqual([]));
    expect(saidOfTheText(canvasElement)).toContain(NAMES_NOTHING);
  },
};

/**
 * A `:` between a reference's parts (`$data:receive_order:ev`) is refused as the server refuses it: "':' can't be
 * used here" (DPQL-E001) - not taken as written (qorus#646, David's review).
 */
export const AColonBetweenAReferencesPartsIsRefused: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `SpaceLeavesAHalfReferenceAsAnError`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          "Types `$data:receive_order:ev` key by key: the editor says what the server says of it, \"':' can't " +
          'be used here: remove it, or put it in quotes to make it text." The parts of a reference are ' +
          'separated by a dot: $data:receive_order.event_type.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$data:receive_order:ev');
    await userEvent.keyboard('{Escape}');
    await waitFor(
      () =>
        expect(saidOfTheText(canvasElement)).toContain(
          "':' can't be used here: remove it, or put it in quotes to make it text."
        ),
      { timeout: 30000 }
    );
  },
};


/**
 * A reference typed key by key is completed at every level, by the language server and the field's templates
 * (qorus#646, David: "as a user types a template or field reference character by character, they must get
 * completion at every step"): Tab takes the row the keyboard is on; a context, a state or a record taken is written
 * as text and what is in it listed next; a whole reference taken is its chip.
 */
export const TypingCompletesEachLevel: Story = {
  args: { ...WithFsmContext.args, provider: 'crm/customers', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    // a Qog state's field, in a loop, with variables, configuration items and state data (Qorus's fixture)
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          'Types key by key, Tab at each level: `$da` → $data:, then its states; `rec` → $data:receive_order., ' +
          'then its data; `cu` → $data:receive_order.customer., then the customer\'s; `na` → the chip for ' +
          '$data:{receive_order.customer.name}.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    const step = async (typed: string, highlighted: string, then?: string[]) => {
      await typeAsAPerson(userEvent, typed);
      await waitFor(() => expect(highlightedCompletionLabel()).toBe(highlighted), { timeout: 30000 });
      await userEvent.keyboard('{Tab}');
      if (then) {
        await waitFor(() => expect(seenCompletionLabels()).toEqual([...then, 'Browse all templates']), {
          timeout: 30000,
        });
      }
    };
    await typeAsAPerson(userEvent, '$');
    await waitFor(() => expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['$data:', '$config:'])), {
      timeout: 30000,
    });
    await step('da', '$data:', ['$data:*', 'Look up customer', 'Receive order']);
    expect(plainTextOf(editable)).toBe('$data:');
    await step('rec', 'Receive order', ['Customer', 'Event type', 'Order ID', 'User name']);
    expect(plainTextOf(editable)).toBe('$data:receive_order.');
    await step('cu', 'Customer', ['Address', 'Name']);
    expect(plainTextOf(editable)).toBe('$data:receive_order.customer.');
    await step('na', 'Name');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\$data:\{receive_order\.customer\.name\}\s*$/)
      )
    );
    expect(chipsOf(editable)).toHaveLength(1);
  },
};

/** A context of values Qorus knows, typed key by key: `$time` → $timestamp:, then the timestamps, `tim` → a chip. */
export const TypingCompletesAContextOfValues: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `AChipSaysWhatItsColorMeans`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types `$time` key by key: $timestamp: is listed first and Tab writes it; the timestamps are listed, and ' +
          '`tim` and Tab make the chip Epoch Seconds.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$time');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('$timestamp:'), { timeout: 30000 });
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['Epoch Seconds'])), {
      timeout: 30000,
    });
    await typeAsAPerson(userEvent, 'tim');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('Epoch Seconds'), { timeout: 30000 });
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringContaining('$timestamp:timegm')));
    expect(chipsOf(editable)).toHaveLength(1);
  },
};

/** A record field typed key by key is completed at every level too: `@co` → @contact., then its fields. */
export const TypingCompletesEachFieldLevel: Story = {
  args: { ...WithFsmContext.args, provider: 'crm/customers', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Types key by key, Tab at each level: `@co` → @contact., then its fields; `em` → the chip for ' +
          '@contact.email.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    const step = async (typed: string, highlighted: string) => {
      await typeAsAPerson(userEvent, typed);
      await waitFor(() => expect(highlightedCompletionLabel()).toBe(highlighted), { timeout: 30000 });
      await userEvent.keyboard('{Tab}');
    };
    await typeAsAPerson(userEvent, '@co');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('contact'), { timeout: 30000 });
    await userEvent.keyboard('{Tab}');
    await waitFor(
      () => expect(seenCompletionLabels()).toEqual(['@contact.email', '@contact.phone', 'Browse all templates']),
      { timeout: 30000 }
    );
    await step('em', '@contact.email');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/@contact\.email\s*$/)));
    expect(chipsOf(editable)).toHaveLength(1);
  },
};

/**
 * A context of free keys and its key, typed out (`$dynamic:order.id`), is a whole reference: drawn as its chip when
 * Enter takes it, or the editor is left (qorus#646, David's review).
 */
export const AFreeKeyReferenceTypedOutIsAChip: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
    // a Qog state that a workflow's step runs: the order's dynamic data, its keys written
    templateCatalogue: 'qog-workflow-host',
    docs: {
      description: {
        story:
          'Types `$dynamic:order.id` key by key in the field of a Qog a workflow runs: nothing is listed in ' +
          '$dynamic: but the whole of it, and the list says to write its key. Enter takes what is written: the chip ' +
          'for $dynamic:order.id. Then ` == $dynamic:batch` typed and the editor left: that too is a chip.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$dynamic:order.id');
    await waitFor(() =>
      expect(document.querySelector('.reqore-popover-content .completion-menu')?.textContent).toContain(
        "Write what $dynamic: refers to after the ':', or pick from the list"
      )
    );
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(chipsOf(editable)).toEqual(['dynamic: order.id']));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^\$dynamic:order\.id\s*$/)));
    await typeAsAPerson(userEvent, ' == $dynamic:batch');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(canvasElement.ownerDocument.body);
    await waitFor(() => expect(chipsOf(editable)).toEqual(['dynamic: order.id', 'dynamic: batch']));
  },
};


/**
 * The template picker offers every completion the field has, in every state - on load, after the text is cleared,
 * after it is typed again, opened from the template button - the same set typing offers (qorus#646, David: "if the
 * textarea is cleared, then fields are not shown in the template picker"; "users should be supported with all
 * available completions in the template picker"). The record's fields here are known only to the language server.
 */
export const ThePickerOffersEveryCompletionAfterClearing: Story = {
  args: { ...WithTemplates.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types `@` key by key: the record\'s fields are listed. The text cleared with Ctrl+A and Backspace and ' +
          'the empty field clicked, the picker lists the given templates under their group, Order data (order id, ' +
          'customer), then Record fields (name, status, age), the ' +
          'template contexts, the functions and the values - what typing offers. Typed again (`@`) and cleared ' +
          'with Backspace, it lists them again; opened from the template button, the same.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    const everySource = ['Record fields', 'Template contexts', 'Functions', 'Values and keywords'];
    const openEmpty = async () => {
      await userEvent.click(canvasElement.ownerDocument.body);
      await userEvent.click(editable);
      await waitFor(() => expect(pickerLabels()).toEqual(expect.arrayContaining(everySource)), { timeout: 30000 });
      // the given templates kept whole under their group's name beside the others, not loose among them
      expect(pickerLabels()[0]).toBe('Order data');
      expect(pickerLabels()).not.toContain('order id');
      await userEvent.click(await pickerRow('Order data'));
      await waitFor(() => expect(pickerLabels()).toEqual(['order id', 'customer']));
      await userEvent.keyboard('{Backspace}');
      await userEvent.click(await pickerRow('Record fields'));
      await waitFor(() => expect(pickerLabels()).toEqual(['name', 'status', 'age']));
      await userEvent.keyboard('{Escape}');
    };
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '@');
    await waitFor(() => expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['@name'])), {
      timeout: 30000,
    });
    // cleared with select-all and Backspace
    await userEvent.keyboard('{Escape}{Control>}a{/Control}{Backspace}');
    await waitFor(() => expect(plainTextOf(editable)).toBe(''));
    await openEmpty();
    // typed again, cleared with Backspace
    await userEvent.click(editable);
    await typeAsAPerson(userEvent, '@');
    await waitFor(() => expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['@name'])));
    await userEvent.keyboard('{Escape}{Backspace}');
    await waitFor(() => expect(plainTextOf(editable)).toBe(''));
    await openEmpty();
    // opened from the template button: the same
    await userEvent.click(canvasElement.querySelector<HTMLElement>('.smart-editor-template-button')!);
    await waitFor(() => expect(pickerLabels()).toEqual(expect.arrayContaining(everySource)), { timeout: 30000 });
  },
};

/**
 * A template context is a container, and one Qorus reads whole is used whole (qorus#646, David: "for all
 * 'container' values that can be used, the 'Use' control should be present"; `$data:*` - UserApi reads `*` as the
 * whole of it): Use on its row writes `$data:*`, in the list typing opens and in the picker.
 */
export const AContextIsUsedWhole: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types `$dat`: the row $data: is a container - its ">" goes into the states - with Use beside it, set ' +
          'apart by a divider; Use writes the whole of it, the chip for $data:*. Cleared, the picker\'s Template ' +
          'contexts list $data: with Use too.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$dat');
    const row = await completionRow('$data:');
    const use = row.parentElement!.querySelector<HTMLElement>('.completion-use');
    expect(use, 'Use beside $data:').toBeTruthy();
    expect(getComputedStyle(use!).borderLeftStyle).toBe('solid');
    await userEvent.click(use!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^\$data:\*\s*$/)));
    await waitFor(() => expect(chipsOf(editable)).toHaveLength(1));
    // the picker: the template contexts, each with Use
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
    await userEvent.click(canvasElement.ownerDocument.body);
    await userEvent.click(editable);
    await userEvent.click(await pickerRow('Template contexts'));
    const context = await pickerRow('$data:');
    expect(context.parentElement!.querySelector('.template-picker-use'), 'Use beside $data: in the picker').toBeTruthy();
  },
};

/**
 * A click after a chip lists what can follow it, as typing there does (qorus#646, David: "clicking the mouse on
 * the textarea after the chip shows no templates; is this intentional?" - it was not: the story server answered
 * nothing after a whole value).
 */
export const AClickAfterAChipListsWhatCanFollow: Story = {
  args: { ...WithFsmContext.args, value: '$data:{receive_order.event_type}', onChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'A click just after the chip Receive order › Event type lists what can follow a value there: the ' +
          'operators (==, !=, ...), as Qorus answers after a whole value.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    const chip = await waitFor(() => {
      const found = editable.querySelector<HTMLElement>('.reqore-tag');
      expect(found).toBeTruthy();
      return found!;
    });
    const box = chip.getBoundingClientRect();
    await userEvent.pointer({ keys: '[MouseLeft]', target: editable, coords: { clientX: box.right + 8, clientY: box.top + box.height / 2 } });
    await waitFor(() => expect(seenCompletionLabels()).toEqual(expect.arrayContaining(['==', '!='])), {
      timeout: 30000,
    });
  },
};

/**
 * A context of variables is offered only where some are defined, and lists them; used whole, `$transient:*`
 * (qorus#646, David: "if none are defined, don't offer $transient: at all"; "Qorus needs to know when transient
 * variables have been defined and provide a guided UX"). Here the Qog defines two.
 */
export const TransientVariablesDefinedAreListed: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithSemanticTokens`.
    qlip: { skip: true },
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          'In a Qog that declares the global variable total (Qorus\'s catalog of a Qog state in a loop): `$tr` ' +
          'lists $transient:, with Use; Tab writes it and lists the whole of it, $transient:*, and the variable; ' +
          '`tot` and Tab make the chip for $transient:total.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$tr');
    const row = await completionRow('$transient:');
    expect(row.parentElement!.querySelector('.completion-use'), 'Use beside $transient:').toBeTruthy();
    await userEvent.keyboard('{Tab}');
    await waitFor(
      () =>
        expect(seenCompletionLabels()).toEqual(['$transient:*', 'total', 'Browse all templates']),
      { timeout: 30000 }
    );
    await typeAsAPerson(userEvent, 'tot');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('total'));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^\$transient:total\s*$/)));
  },
};

/**
 * A context of variables the Qog does not declare where the field is, or a loop's outside one, is not offered: it
 * would read nothing when the Qog runs (qorus#646, David: "if none are defined, don't offer $transient: at all").
 */
export const UndefinedVariablesAndLoopsAreNotOffered: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `ADollarWithNoTemplatesListsTheServersContexts`.
    qlip: { skip: true },
    // a Qog state that nothing runs but on demand: a global and a local variable, no automatic one, in no loop
    templateCatalogue: 'qog-unhosted',
    docs: {
      description: {
        story:
          'In a Qog state that declares a global and a local variable, no automatic variable, and is in no loop: ' +
          '`$` lists $transient: and $var:, and no $autovar:, $foreach: or $for: - nor the aliases $globalvar: ' +
          'and $localvar:, which work when written but are not offered.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await typeAsAPerson(userEvent, '$');
    // every row of the list, those scrolled out of sight too
    const listed = () =>
      Array.from(document.querySelectorAll('.reqore-popover-content .completion-menu [data-label]')).map((row) =>
        row.getAttribute('data-label')
      );
    await waitFor(() => expect(listed()).toEqual(expect.arrayContaining(['$transient:', '$var:'])), {
      timeout: 20000,
    });
    for (const context of ['$autovar:', '$globalvar:', '$localvar:', '$foreach:', '$for:']) {
      expect(listed(), context).not.toContain(context);
    }
  },
};

/** A loop's context inside one: `$foreach:` lists its values, and the whole of it. */
export const ALoopsContextInsideTheLoop: Story = {
  args: { ...WithFsmContext.args, onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `ADollarWithNoTemplatesListsTheServersContexts`.
    qlip: { skip: true },
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          'Inside a foreach loop: `$fo` lists $foreach: then $for:, in the order Qorus gives them; `re` and Tab ' +
          'list the whole of $foreach: and its values - value, index, size.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    // the contexts in the catalogue's order, the server's (`sort_priority`), as a rich-text field lists them
    await typeAsAPerson(userEvent, '$fo');
    await waitFor(
      () => expect(seenCompletionLabels()).toEqual(['$foreach:', '$for:', 'Browse all templates']),
      { timeout: 30000 }
    );
    await typeAsAPerson(userEvent, 're');
    await waitFor(() => expect(highlightedCompletionLabel()).toBe('$foreach:'), { timeout: 30000 });
    await userEvent.keyboard('{Tab}');
    await waitFor(
      () =>
        expect(seenCompletionLabels()).toEqual([
          '$foreach:*',
          'Element',
          'Index',
          'Size',
          'Browse all templates',
        ]),
      { timeout: 30000 }
    );
  },
};

/**
 * A variable a template uses that the Qog does not declare is a warning the server gives, and the host's action for
 * it is beside it (qorus#646: Qorus's `qog_variable_undeclared`, with where to declare it): "Declare it".
 */
export const AnUndeclaredVariableCanBeDeclared: Story = {
  args: {
    ...WithFsmContext.args,
    value: '$transient:retries > 3',
    onChange: fn(),
    diagnosticAction: (diagnostic: { code?: unknown; data?: unknown }) =>
      diagnostic.code === 'qog_variable_undeclared' ?
        { label: 'Declare it', onClick: declareIt.bind(null, diagnostic.data) }
      : undefined,
  } as never,
  parameters: {
    templateCatalogue: 'qog-loops',
    docs: {
      description: {
        story:
          "In a Qog that declares the global variable total, not retries: `$transient:retries > 3` is said to read " +
          "nothing - \"The Qog does not declare the global variable retries, so it reads as nothing; declare it in " +
          "the Qog's global variables.\" - with Declare it beside it, which the host declares it with (here: the " +
          'Qog\'s global variables, `globalvar`).',
      },
    },
  },
  play: async ({ canvasElement }) => {
    declared.length = 0;
    await readyEditor(canvasElement);
    const action = await waitFor(
      () => {
        const button = canvasElement.querySelector<HTMLElement>('.smart-editor-diagnostic-action');
        expect(button, 'Declare it').toBeTruthy();
        return button!;
      },
      { timeout: 30000 }
    );
    expect(saidOfTheText(canvasElement).join(' ')).toContain(
      "The Qog does not declare the global variable retries, so it reads as nothing; declare it in the Qog's global variables."
    );
    expect(action.textContent).toBe('Declare it');
    // said once, as the server's warning - not an error of the editor's beside it - and the button its words' width
    expect(saidOfTheText(canvasElement)).toHaveLength(1);
    expect(action.getBoundingClientRect().width).toBeLessThan(200);
    await userEvent.click(action);
    expect(declared).toEqual([{ scope: 'globalvar', name: 'retries' }]);
  },
};

/** What the story's host was asked to declare. */
const declared: Array<{ scope: string; name: string }> = [];
const declareIt = (data: unknown) => {
  const facts = data as { variable_name: string; declare: { scope: string } };
  declared.push({ scope: facts.declare.scope, name: facts.variable_name });
};


/**
 * A key typed right after a pair the editor closed goes where the caret is, though the page has not drawn the pair
 * yet (qorus#646: CI typed `"a" + 1` as `a" + 1""`). The editor closes the pair in its document and puts the caret
 * between the quotes; the page draws it a moment later. A key typed in that moment, after a click whose caret the
 * editor had not read yet, was put where the page's caret still was - before the quotes.
 */
export const AKeyRightAfterAClosedPairGoesBetweenItsQuotes: Story = {
  args: { value: '', onChange: fn() },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithTemplates`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Clicks the empty text and, in the same moment - before the page has drawn anything - types `"` and `1`: ' +
          'the text is "1", the 1 between the quotes the editor closed, as a fast typist on a busy page types it.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    /* the page's caret moved by the click, its change not read by the editor yet: the editor reads such changes
       a little later, at most so often, and a change that comes while it waits is read at the next input */
    const doc = editable.ownerDocument;
    doc.dispatchEvent(new Event('selectionchange'));
    doc.dispatchEvent(new Event('selectionchange'));
    // in one task, before the page draws the pair: the quote's key, then the next character's input
    // as a browser does: a key's input follows its keydown unless the keydown was taken
    const type = (key: string, code: string) => {
      const proceed = editable.dispatchEvent(
        new KeyboardEvent('keydown', { key, code, shiftKey: key === '"', bubbles: true, cancelable: true })
      );
      if (proceed) {
        editable.dispatchEvent(
          new InputEvent('beforeinput', { inputType: 'insertText', data: key, bubbles: true, cancelable: true })
        );
      }
    };
    type('"', 'Quote');
    type('1', 'Digit1');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('"1"'));
    expect(plainTextOf(editable)).toBe('"1"');
  },
};

/** The template picker open at the top of the field's templates, and no completion list beside it. */
const expectThePickerAtItsTop = async () => {
  await waitFor(
    () => expect(pickerLabels()).toEqual(expect.arrayContaining(['Order data', 'Template contexts', 'Record fields'])),
    { timeout: 30000 }
  );
  expect(completionLabels()).toEqual([]);
};

/** Nothing open at the editor: neither the picker nor the completion list. */
const expectNothingOpen = () =>
  waitFor(() => {
    expect(pickerLabels()).toEqual([]);
    expect(completionLabels()).toEqual([]);
  });

export const WhereOnlyBrowseAllIsLeftThePickerOpens: Story = {
  args: { ...WithTemplates.args, onChange: fn() },
  parameters: {
    ...WithTemplates.parameters,
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `ThePickerOffersEveryCompletionAfterClearing`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Where the completion list would hold nothing but Browse all templates, the picker opens in its place, at ' +
          'its top (Foxhoundn on qlip #425). A click in the empty field opens it; Escape puts it away, the keys ' +
          'staying in the text. `1 + 2` typed key by key: the picker. `+ $` lists the contexts, Browse all templates ' +
          'among them; `zq`, which goes on to nothing: the picker. Escape puts it away each time.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    // a click in the empty field
    await userEvent.click(editable);
    await expectThePickerAtItsTop();
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    expect(editable.contains(document.activeElement), 'the keys are the text\'s').toBe(true);
    // typed: nothing is listed but the way to the templates
    await typeAsAPerson(userEvent, '1 + 2');
    await expectThePickerAtItsTop();
    expect(editable.contains(document.activeElement), 'the keys are the text\'s').toBe(true);
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    expect(editable.contains(document.activeElement), 'the keys are the text\'s').toBe(true);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('1 + 2'));
    // where there are rows, Browse all templates is one of them, and the list stays
    await typeAsAPerson(userEvent, ' + $');
    await waitFor(
      () => expect(completionLabels()).toEqual(expect.arrayContaining(['$data:', 'Browse all templates'])),
      { timeout: 30000 }
    );
    expect(pickerLabels()).toEqual([]);
    // a `$` that goes on to nothing
    await typeAsAPerson(userEvent, 'zq');
    await expectThePickerAtItsTop();
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('1 + 2 + $zq'));
  },
};

export const AnEmptiedFieldOpensThePicker: Story = {
  args: { ...WithTemplates.args, value: '1 + 2', onChange: fn() },
  parameters: {
    ...WithTemplates.parameters,
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `ThePickerOffersEveryCompletionAfterClearing`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'A text emptied as it is written offers what an empty field offers: the picker at its top. `1 + 2` ' +
          'cleared with Ctrl+A and Backspace: the picker, whose rows the arrows move through, as in an empty field ' +
          'clicked; Escape puts it away. `x` typed and taken back with Backspace: the picker again. The template ' +
          'button opens it too.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = await readyEditor(canvasElement);
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    // cleared
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(''));
    await expectThePickerAtItsTop();
    // the arrows move through the picker, as in an empty field clicked
    const first = await waitFor(() => {
      const row = pickerFocused();
      expect(row, 'the row the keyboard is on').toBeTruthy();
      return row;
    });
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(pickerFocused()).not.toBe(first));
    expect(editable.contains(document.activeElement), 'the keys are the text\'s').toBe(true);
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    // its last character deleted
    await typeAsAPerson(userEvent, 'x');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('x'));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(''));
    await expectThePickerAtItsTop();
    await userEvent.keyboard('{Escape}');
    await expectNothingOpen();
    // the template button
    await userEvent.click(canvasElement.querySelector<HTMLElement>('.smart-editor-template-button')!);
    await expectThePickerAtItsTop();
  },
};
