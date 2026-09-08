import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * What type the form hands the expression editor, through the REAL render path.
 *
 * Reported live: `1 + 2` on a test assertion's Value — a field the server
 * declares `"type": "auto"` — came back "This does not fit. The expression
 * returns int, and this field holds hash." A literal `1` was fine, which is
 * the tell: a literal is stored as a plain value whose type matches, while an
 * expression is stored as `{ is_expression: true, value: {...} }` and the type
 * recorded beside it describes that ENVELOPE.
 *
 * The unit test on `getOptionFieldStorageType` pins the decision in isolation.
 * This one pins that the decision is what the FIELD actually receives, which is
 * the part three previous fixes got wrong by guarding code this screen never
 * runs.
 */
const typesSeen: Array<{ type?: unknown; returnType?: unknown }> = [];

vi.mock('../src/components/form/fields/template/TemplateField', () => ({
  TemplateField: (props: any) => {
    typesSeen.push({ type: props.type, returnType: props.returnType });
    return <div data-testid='template-field' />;
  },
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

describe('the type the form hands the expression editor', () => {
  it('is the schema type, not the one stored beside the expression', async () => {
    typesSeen.length = 0;

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            name='assertion'
            onChange={vi.fn()}
            options={
              {
                checked_value: {
                  type: 'auto',
                  display_name: 'Value',
                  supports_expressions: true,
                },
              } as never
            }
            value={
              {
                checked_value: {
                  type: 'hash',
                  is_expression: true,
                  value: { exp: '+', args: [1, 2] },
                },
              } as never
            }
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(typesSeen.length).toBeGreaterThan(0));
    const seen = typesSeen.flatMap((t) => [t.type, t.returnType]);
    expect(seen, `types handed to the field: ${JSON.stringify(typesSeen)}`).not.toContain('hash');
  });
});
