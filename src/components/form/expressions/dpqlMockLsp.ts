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
  createMockLspServer,
  DEFAULT_LSP_CAPABILITIES,
  IMockLspServer,
  MOCK_LSP_URL,
  TMockLspHandler,
} from '../../smartEditor/__fixtures__/mockLspServer';
import {
  IDpqlMockNode,
  mockParseDpql,
  mockRenderDpql,
  mockSerializeDpql,
  mockTokenizeDpql,
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
      return { isIncomplete: false, items: DPQL_MOCK_FIELD_ITEMS };
    }
    return { isIncomplete: false, items: [] };
  },

  'textDocument/semanticTokens/full': (msg, server) => ({
    data: mockTokenizeDpql(server.textOf(msg.params?.textDocument?.uri)),
  }),

  'dpql/setContext': () => ({ fields: {} }),

  'dpql/parse': (msg) => {
    const text = String(msg.params?.text ?? '');
    const target = msg.params?.target_type as string | undefined;
    dpqlMockParseCalls.push({ text: text.trim(), target, analysed: !!target });
    return mockParseDpql(text, target);
  },

  'dpql/serialize': (msg) => mockSerializeDpql(msg.params?.expression as IDpqlMockNode),

  'dpql/validate': () => ({ diagnostics: [] }),

  'dpql/renderExpression': (msg) => mockRenderDpql(msg.params?.expression as IDpqlMockNode),
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
  const lsp = createMockLspServer(MOCK_LSP_URL, {
    capabilities: {
      ...DEFAULT_LSP_CAPABILITIES,
      textDocumentSync: { openClose: true, change: 2 },
      completionProvider: { triggerCharacters: ['@', '$', '.', ':'] },
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
