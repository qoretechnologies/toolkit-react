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

const OPTIONS = {
  checked_value: { type: 'auto', display_name: 'Value', supports_expressions: true },
} as never;

/* The RUNTIME shape: the editor writes the flag onto the option itself. */
const LIVE_EXPRESSION = {
  checked_value: {
    type: 'hash',
    is_expression: true,
    value: { exp: '+', args: [1, 2] },
  },
} as never;

/* The PERSISTED shape, read back from a saved draft — the envelope is NESTED
   and there is no flag on the option at all. Confirmed from the running IDE:
   on load the row saw `otherKeys: ["value"]` and resolved `hash`; after an
   edit it saw `["value","is_expression"]` and resolved `auto`. Testing only
   the runtime shape is why several fixes passed while the bug survived. */
const STORED_EXPRESSION = {
  checked_value: {
    type: 'hash',
    value: { is_expression: true, value: { exp: '+', args: [1, 2] } },
  },
} as never;

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
            value={LIVE_EXPRESSION}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(typesSeen.length).toBeGreaterThan(0));
    const seen = typesSeen.flatMap((t) => [t.type, t.returnType]);
    expect(seen, `types handed to the field: ${JSON.stringify(typesSeen)}`).not.toContain('hash');
  });

  it('is the schema type in COMPACT mode too', async () => {
    /* The read-first rows are what the IDE's assertion drawer renders, and they
       resolve their own type rather than going through
       `getOptionFieldStorageType`. Testing only the default layout said the
       decision was right while the compact row kept handing the field `hash` —
       which is exactly how a fix shipped that changed nothing on screen. */
    typesSeen.length = 0;

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            /* The row renders read-first and mounts its editor only when open,
               so without this the field never renders and the test passes by
               never looking at anything. */
            initialExpandedOptions={['checked_value']}
            name='assertion'
            onChange={vi.fn()}
            options={OPTIONS}
            value={STORED_EXPRESSION}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(typesSeen.length).toBeGreaterThan(0));
    const seen = typesSeen.flatMap((t) => [t.type, t.returnType]);
    expect(seen, `types handed to the field: ${JSON.stringify(typesSeen)}`).not.toContain('hash');
  });

  it('is the schema type for a RELOADED expression, whose envelope is nested', async () => {
    /* The shape a saved draft comes back in. This is the case that was broken
       in the running IDE while every test passed: the option carries no
       `is_expression` of its own, so a check for the flat flag never fired and
       the stored `hash` won. */
    typesSeen.length = 0;

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            initialExpandedOptions={['checked_value']}
            name='assertion'
            onChange={vi.fn()}
            options={OPTIONS}
            value={STORED_EXPRESSION}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(typesSeen.length).toBeGreaterThan(0));
    const seen = typesSeen.flatMap((t) => [t.type, t.returnType]);
    expect(seen, `types handed to the field: ${JSON.stringify(typesSeen)}`).not.toContain('hash');
  });
});
