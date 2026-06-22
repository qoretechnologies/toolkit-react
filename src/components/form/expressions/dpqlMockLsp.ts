// Copyright 2026 Qore Technologies, s.r.o.
// A compact mock LSP for ExpressionField Text-mode stories. Registers just
// enough of the DPQL contract on the shared harness plumbing
// (`smartEditor/__fixtures__/mockLspServer`) to exercise the parse/serialize
// boundary glue: `dpql/parse` echoes the typed text into an expression AST,
// `dpql/serialize` reconstructs a string. (The DpqlEditor's own stories
// carry the full mock; this is the minimal subset.)
import {
  createMockLspServer,
  MOCK_LSP_URL,
} from '../../smartEditor/__fixtures__/mockLspServer';

// Loose AST node shape the serialize/render handlers poke at — the mock
// doesn't validate structure.
interface IMockExprNode {
  exp?: string;
  args?: IMockExprNode[];
  value?: IMockExprNode;
  is_expression?: boolean;
}

/** Start the mock LSP; returns a teardown function. */
export const startDpqlMockLsp = (): (() => void) => {
  const lsp = createMockLspServer(MOCK_LSP_URL, {
    capabilities: {
      textDocumentSync: { openClose: true, change: 2 },
      completionProvider: { triggerCharacters: ['@', '$', '.', ':'] },
    },
    // Unknown requests get an empty success so nothing hangs.
    defaultResult: {},
    handlers: {
      'textDocument/completion': () => ({ isIncomplete: false, items: [] }),

      'textDocument/semanticTokens/full': () => ({ data: [] }),

      'dpql/setContext': () => ({ fields: {} }),

      // Echo the typed text into an `==` expression so the AST is
      // deterministic and verifiable.
      'dpql/parse': (msg) => {
        const text = (msg.params?.text ?? '').trim();
        return {
          success: true,
          expression: {
            is_expression: true,
            value: {
              exp: '==',
              args: [
                { type: 'string', value: text || 'x' },
                { type: 'string', value: '' },
              ],
            },
          },
          diagnostics: [],
        };
      },

      'dpql/serialize': (msg) => {
        const expr = msg.params?.expression as IMockExprNode | undefined;
        const args = expr?.args ?? expr?.value?.args ?? [];
        const left = args[0]?.value ?? '';
        const right = args[1]?.value ?? '';
        return { dpql: `${left} == ${right}`.trim() };
      },

      'dpql/validate': () => ({ diagnostics: [] }),

      // Mirrors the server contract: accepts the bare `{exp, args}` AST
      // or the `{is_expression, value}` wrapper; returns `{ rendered,
      // richtext }` where `rendered` is the human-readable form.
      'dpql/renderExpression': (msg) => {
        const input = msg.params?.expression as IMockExprNode | undefined;
        const root = input?.value && !input?.exp ? input.value : input;
        const renderNode = (node: IMockExprNode): string => {
          if (!node?.exp) return '';
          const args = (node.args ?? []).map((arg) =>
            arg?.is_expression && arg.value?.exp
              ? `(${renderNode(arg.value)})`
              : typeof arg?.value === 'string'
                ? JSON.stringify(arg.value)
                : String(arg?.value)
          );
          return /^[^\w\s]+$/.test(node.exp)
            ? args.join(` ${node.exp} `)
            : `${node.exp}(${args.join(', ')})`;
        };
        const rendered = renderNode(root);
        return {
          rendered,
          richtext: {
            type: 'richtext',
            value: [{ type: 'paragraph', children: [{ text: rendered }] }],
          },
        };
      },
    },
  });

  return () => lsp.close();
};
