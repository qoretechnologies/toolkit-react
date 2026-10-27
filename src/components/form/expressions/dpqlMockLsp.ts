// Copyright 2026 Qore Technologies, s.r.o.
// The DPQL language server every story talks to unless it brings its own.
//
// `.storybook/preview.tsx` starts it before each story, so an expression field,
// a Preview or an Explain panel finds a server on the endpoint whatever story it
// sits in — the same way `GLOBAL_STORY_MOCK_DATA` answers the REST requests
// components make on their own. A story that needs different handlers starts
// its own server on the URL and replaces this one (see `createMockLspServer`).
// The answers come from `dpqlMockLanguage`, which follows the real server.
import {
  dpqlTemplateContext,
  qorusTemplateCompletions,
} from '../../../stories/qorusTemplateContexts';
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

/* A completion's detail in the server's plain words (Qore DpqlCompletionProvider, batch 6): a type is named as Qore's
   DataTypeCatalogue names it (a template context's, `qorusTemplateCompletions`). */
const DPQL_MOCK_TYPE_NAMES: Record<string, string> = {
  any: 'Any',
  string: 'Text',
  int: 'Whole number',
  float: 'Number',
  number: 'Exact number',
  bool: 'True or false',
  date: 'Date',
  binary: 'Binary data',
  data: 'Text or binary data',
  hash: 'Key-value pairs (hash)',
  list: 'List',
  nothing: 'No value',
};
/** A type as the catalogue names it: an optional or soft form, or a complex one, by its base; else its own name. */
export const dpqlMockTypeName = (type: string): string =>
  DPQL_MOCK_TYPE_NAMES[type.replace(/^\*/, '').replace(/^soft/, '').replace(/<.*>$/, '')] ?? type;

/** What the server offers after a whole value: operators (Keywords), never a value. */
const DPQL_MOCK_AFTER_A_VALUE = ['==', '!=', '<', '>', '&&', '||'].map((label) => ({
  label,
  kind: 14,
}));

/** What a value cannot follow, so one is written next: an operator, an opening bracket, a comma. */
const MOCK_BEFORE_A_VALUE = /[-+*/%<>=!&|,([]$/;

/** A template written out whole: `$record:{pos}`, not the `$` or `$rec` of one being written. */
const MOCK_WHOLE_TEMPLATE = /^\$[A-Za-z_][\w-]*:(?:\{[^{}]*\}|[\w.])+$/;

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
    const token = head.match(/[@$][\w:.{}]*$/)?.[0] ?? '';
    /* a document bound to a record is offered its fields, as the server offers them: a provider's, or the
       fields it was given; one bound to none is offered none (professor's `/lsp`: `@` with no record, 0 items) */
    const uri = String(msg.params?.textDocument?.uri);
    const provider = dpqlMockDocumentProviders.get(uri);
    const fields =
      (provider ? DPQL_MOCK_PROVIDERS[provider] : undefined) ??
      dpqlMockDocumentFields.get(uri) ??
      {};
    const fieldItems = Object.entries(fields).map(([name, field]) => ({
      label: `@${name}`,
      insertText: `@${name}`,
      kind: 5,
      detail:
        [(field as { type?: string | string[] }).type ?? []]
          .flat()
          .map(dpqlMockTypeName)
          .join(' or ') || undefined,
    }));
    /* a template being written, as Qorus answers a DPQL document (`qorusTemplateCompletions`): the contexts of a
       Qog's record expression that its name starts; after the `:`, the values Qorus knows in the context - none of
       a context of free keys, none of `$data:` with no Qog bound */
    if (token.startsWith('$') && !MOCK_WHOLE_TEMPLATE.test(token)) {
      return { isIncomplete: false, items: qorusTemplateCompletions(token, dpqlTemplateContext()) };
    }
    if (token.startsWith('@')) {
      return { isIncomplete: false, items: fieldItems };
    }
    /* Elsewhere as the server answers, by where the caret is: values where one can be written - an empty document
       too (Qorus `QorusLspWebSocketHandler::handleCompletion`: "an empty document has a source: what can start an
       expression completes it") - the record's fields and the template contexts; operators after a whole
       value - a reference (`$record:{pos}|`) or anything a space follows (`12 |`) - and nothing in a word or a
       number being typed (`12|`; the server's functions are not the stand-in's). */
    const written = head.trimEnd();
    const items =
      !written || MOCK_BEFORE_A_VALUE.test(written) ?
        [...fieldItems, ...qorusTemplateCompletions('$', dpqlTemplateContext())]
      : MOCK_WHOLE_TEMPLATE.test(token) || written !== head ? DPQL_MOCK_AFTER_A_VALUE
      : [];
    return { isIncomplete: false, items };
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
