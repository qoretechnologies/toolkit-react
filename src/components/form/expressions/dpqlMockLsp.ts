// Copyright 2026 Qore Technologies, s.r.o.
// The DPQL language server every story talks to unless it brings its own.
//
// `.storybook/preview.tsx` starts it before each story, so an expression field,
// a Preview or an Explain panel finds a server on the endpoint whatever story it
// sits in — the same way `GLOBAL_STORY_MOCK_DATA` answers the REST requests
// components make on their own. A story that needs different handlers starts
// its own server on the URL and replaces this one (see `createMockLspServer`).
// The answers come from `dpqlMockLanguage`, which follows the real server.
import { mockHoverDpql } from '../../dpqlEditor/__fixtures__/dpqlMockHover';
import {
  createMockLspServer,
  DEFAULT_LSP_CAPABILITIES,
  IMockLspServer,
  MOCK_LSP_URL,
  TMockLspHandler,
} from '../../smartEditor/__fixtures__/mockLspServer';
import {
  IDpqlMockNode,
  mockParseDpql,
  mockExpressionTypeDpql,
  mockRenderDpql,
  mockSerializeDpql,
  mockTokenizeDpql,
  mockPublishedDiagnostics,
  TDpqlMockFields,
} from './dpqlMockLanguage';

/**
 * Every `dpql/parse` the mock answered, in order, for diagnosis.
 *
 * The type-analysis stories depend on the front end SENDING `target_type` —
 * the mock returns analysis only when it is present, exactly as the server
 * behaves. When one of those stories fails there are two very different
 * causes, and the rendered DOM cannot tell them apart: the request never
 * carried a target, or it did and the answer was not rendered. This records
 * which, and the story reports it in its assertion message so the answer
 * survives into a CI log.
 */
export interface IDpqlMockParseCall {
  text: string;
  target?: string;
  /** the request asked how the text reads as a condition (`condition: true`) */
  condition?: boolean;
  analysed: boolean;
}
export const dpqlMockParseCalls: IDpqlMockParseCall[] = [];

/** The template namespaces the server offers after a `$`. */
const DPQL_MOCK_TEMPLATE_ITEMS = [
  { label: '$data:', insertText: '$data:', kind: 1, detail: 'template' },
  { label: '$config:', insertText: '$config:', kind: 1, detail: 'template' },
  { label: '$static:', insertText: '$static:', kind: 1, detail: 'template' },
  { label: '$timestamp:', insertText: '$timestamp:', kind: 1, detail: 'template' },
];

/** The record fields the server offers after an `@`. */
const DPQL_MOCK_FIELD_ITEMS = [
  { label: '@name', insertText: '@name', kind: 5, detail: 'string' },
  { label: '@status', insertText: '@status', kind: 5, detail: 'string' },
];

/** The fields each document is bound to, by its URI. */
const dpqlMockDocumentFields = new Map<string, TDpqlMockFields>();

/**
 * The records the stand-in server knows by provider path, as the server answers `dpql/setContext` for a
 * provider: a field's display name, its description and its type. The Qorus server names the provider of an
 * expression option's record in the option's schema (`dpql_provider`, the option's connection and its path), and
 * the editor binds its document to it.
 */
export const DPQL_MOCK_PROVIDERS: Record<
  string,
  Record<string, { type: string; display_name: string; short_desc?: string }>
> = {
  'orders-db/orders': {
    order_id: { type: 'int', display_name: 'Order ID', short_desc: 'The number of the order.' },
    customer: { type: 'string', display_name: 'Customer', short_desc: 'Who placed the order.' },
    total: { type: 'number', display_name: 'Total', short_desc: 'What the order costs, with tax.' },
    shipped: {
      type: 'bool',
      display_name: 'Shipped',
      short_desc: 'Whether the order has shipped.',
    },
  },
};

/** The provider each document is bound to, by its URI. */
const dpqlMockDocumentProviders = new Map<string, string>();

/** Binds the document `uri` to the record of `provider`, if the stand-in knows it; returns the record. */
const bindMockProvider = (uri: string, provider: unknown) => {
  const record = typeof provider === 'string' ? DPQL_MOCK_PROVIDERS[provider] : undefined;
  if (!record) {
    return undefined;
  }
  dpqlMockDocumentProviders.set(uri, provider as string);
  dpqlMockDocumentFields.set(
    uri,
    Object.fromEntries(Object.entries(record).map(([name, field]) => [name, { type: field.type }]))
  );
  return record;
};

/**
 * A document's text as plain DPQL: the editor sends text, or rich text whose chips are references
 * (`{type: 'tag', value}`), which the server reads as the references they are.
 */
const plainText = (text: unknown): string => {
  if (typeof text === 'string') return text;
  const blocks = (text as { value?: unknown[] } | undefined)?.value ?? [];
  const leaf = (node: unknown): string => {
    const n = node as { text?: string; type?: string; value?: unknown; children?: unknown[] };
    if (typeof n?.text === 'string') return n.text;
    if (n?.type === 'tag' && typeof n.value === 'string') return n.value;
    return (n?.children ?? []).map(leaf).join('');
  };
  return blocks.map(leaf).join('\n');
};

/** Publish what the server finds in a document's text, as it does after every open and change. */
const publishDiagnostics = (server: IMockLspServer, uri: string, text: string) =>
  server.notify('textDocument/publishDiagnostics', {
    uri,
    diagnostics: mockPublishedDiagnostics(text, dpqlMockDocumentFields.get(uri)),
  });

const DPQL_MOCK_HANDLERS: Record<string, TMockLspHandler> = {
  /* Position-aware, as the real server is: `$` opens the template
     namespaces, `@` the record fields. Answering the same list whatever
     precedes the cursor would make a story asserting the `$` menu pass
     for a shell that asked in the wrong context — which is the only thing
     such a story is there to catch. (`DpqlEditor`'s own stories carry the
     full catalogue; this is the minimal subset.) */
  'textDocument/completion': (msg, server) => {
    const position = msg.params?.position ?? { line: 0, character: 0 };
    const line = server.textOf(msg.params?.textDocument?.uri).split('\n')[position.line] ?? '';
    const head = line.slice(0, position.character);
    const sigil = head.match(/[@$][\w:.{}]*$/)?.[0]?.[0] ?? '';
    if (sigil === '$') {
      return { isIncomplete: false, items: DPQL_MOCK_TEMPLATE_ITEMS };
    }
    if (sigil === '@') {
      // a document bound to a provider is offered its record's fields, as the server offers them
      const provider = dpqlMockDocumentProviders.get(String(msg.params?.textDocument?.uri));
      const record = provider ? DPQL_MOCK_PROVIDERS[provider] : undefined;
      return {
        isIncomplete: false,
        items:
          record ?
            Object.entries(record).map(([name, field]) => ({
              label: `@${name}`,
              insertText: `@${name}`,
              kind: 5,
              detail: field.type,
            }))
          : DPQL_MOCK_FIELD_ITEMS,
      };
    }
    return { isIncomplete: false, items: [] };
  },

  'textDocument/semanticTokens/full': (msg, server) => ({
    data: mockTokenizeDpql(server.textOf(msg.params?.textDocument?.uri)),
  }),

  // the fields a document is bound to, kept as the server keeps them: they type its `@field` operands
  'dpql/setContext': (msg) => {
    if (msg.params?.fields) {
      dpqlMockDocumentFields.set(String(msg.params.uri), msg.params.fields as TDpqlMockFields);
    }
    // a provider's record, answered as the server answers it: each field with its name, description and type
    const record = bindMockProvider(String(msg.params?.uri), msg.params?.provider);
    return {
      fields:
        record ?
          Object.fromEntries(
            Object.entries(record).map(([name, field]) => [
              name,
              {
                display_name: field.display_name,
                short_desc: field.short_desc,
                type: { name: field.type },
              },
            ])
          )
        : {},
    };
  },

  // the server publishes what it finds in a document's text on every open and change
  'textDocument/didOpen': (msg, server) => {
    const doc = (msg.params?.textDocument ?? {}) as {
      uri?: string;
      text?: unknown;
      metadata?: { fields?: TDpqlMockFields };
    };
    const metadata = (doc.metadata ?? msg.params?.metadata) as
      { fields?: TDpqlMockFields; provider?: string } | undefined;
    if (metadata?.fields) dpqlMockDocumentFields.set(String(doc.uri), metadata.fields);
    bindMockProvider(String(doc.uri), metadata?.provider);
    publishDiagnostics(server, String(doc.uri), plainText(doc.text ?? ''));
  },

  'textDocument/didChange': (msg, server) => {
    const uri = String(msg.params?.textDocument?.uri);
    const changes = (msg.params?.contentChanges ?? []) as { text?: unknown }[];
    publishDiagnostics(server, uri, plainText(changes[changes.length - 1]?.text ?? ''));
  },

  'dpql/parse': (msg) => {
    const text = String(msg.params?.text ?? '');
    const target = msg.params?.target_type as string | undefined;
    const condition = msg.params?.condition === true;
    dpqlMockParseCalls.push({
      text: text.trim(),
      target,
      ...(condition ? { condition } : {}),
      analysed: !!target || condition,
    });
    return mockParseDpql(
      text,
      target,
      condition,
      dpqlMockDocumentFields.get(String(msg.params?.uri))
    );
  },

  'dpql/serialize': (msg) => mockSerializeDpql(msg.params?.expression as IDpqlMockNode),

  'dpql/validate': () => ({ diagnostics: [] }),

  // as the live `/lsp` answers it (dpqlMockHover): a field the record declares has its type
  'textDocument/hover': (msg, server) => {
    const uri = String(msg.params?.textDocument?.uri);
    return mockHoverDpql(
      server.textOf(uri),
      (msg.params?.position as { line: number; character: number }) ?? { line: 0, character: 0 },
      dpqlMockDocumentFields.get(uri)
    );
  },

  'dpql/renderExpression': (msg) => mockRenderDpql(msg.params?.expression as IDpqlMockNode),

  'dpql/expressionType': (msg) => mockExpressionTypeDpql(msg.params?.expression as IDpqlMockNode),
};

export interface IStartDpqlMockLspOptions {
  /** Handlers to use instead of, or beside, the default ones. */
  handlers?: Record<string, TMockLspHandler>;
  /** Per-method response delays in ms. */
  delays?: Record<string, number>;
}

/** Start the mock DPQL language server; returns the server and a teardown. */
export const startDpqlMockLspServer = (
  options: IStartDpqlMockLspOptions = {}
): { lsp: IMockLspServer; stop: () => void } => {
  dpqlMockParseCalls.length = 0;
  dpqlMockDocumentFields.clear();
  dpqlMockDocumentProviders.clear();
  const lsp = createMockLspServer(MOCK_LSP_URL, {
    capabilities: {
      ...DEFAULT_LSP_CAPABILITIES,
      textDocumentSync: { openClose: true, change: 2 },
      completionProvider: { triggerCharacters: ['@', '$', '.', ':'] },
      // the real server answers hovers: functions, operators, fields, accessors, templates (qorus#646)
      hoverProvider: true,
    },
    // Unknown requests get an empty success so nothing hangs.
    defaultResult: {},
    delays: options.delays,
    handlers: { ...DPQL_MOCK_HANDLERS, ...options.handlers },
  });
  return { lsp, stop: () => lsp.close() };
};

/** Start the mock DPQL language server; returns a teardown function. */
export const startDpqlMockLsp = (options?: IStartDpqlMockLspOptions): (() => void) =>
  startDpqlMockLspServer(options).stop;
