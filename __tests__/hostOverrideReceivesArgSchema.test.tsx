import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * A host-injected editor must be handed the field's SHAPE, not just its value.
 *
 * `arg_schema` describes what is INSIDE the value, and a host sub-form renders
 * from it — directly when it is a hash, or by resolving the id when the server
 * sends one. It was destructured into a named prop and so never reached the
 * override, which is silent: the editor still mounts and still edits, it just
 * cannot describe any of its own fields.
 *
 * The reported case: the IDE's test-cases drawer. With no `arg_schema` it fell
 * back to humanising each key, so an assertion asked for `Path`, `Actual` and
 * `Expected` with no description on any of them — while the server's own
 * "Explicit Actual Value", "Expected Value" and their prose sat one fetch away.
 * Every host editor that renders a sub-form was affected, not only that drawer.
 *
 * `element_type` / `ui_element_type` travel with it: a sub-schema on its own
 * cannot say whether the value is one hash or a list of them.
 */
const SCHEMA = {
  cases: {
    type: 'test-cases',
    ui_type: 'test-cases',
    display_name: 'Cases',
    element_type: 'hash',
    ui_element_type: 'hash',
    arg_schema: {
      name: { type: 'string', display_name: 'Name', desc: 'The case key' },
      assertions: { type: 'list', display_name: 'Assertions' },
    },
  },
} as never;

const VALUE = { cases: { type: 'test-cases', value: [{ name: 'case_1' }] } } as never;

const renderWithHost = (record: (props: Record<string, unknown>) => void) => {
  const Host = (props: Record<string, unknown>) => {
    record(props);
    return <div>host editor</div>;
  };
  return render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          name='test'
          value={VALUE}
          options={SCHEMA}
          onChange={vi.fn()}
          componentOverrides={{ 'test-cases': Host }}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('a host-injected editor', () => {
  it('is handed the field arg_schema it renders its sub-form from', async () => {
    let props: Record<string, unknown> = {};
    const { container } = renderWithHost((p) => (props = p));
    await waitFor(() => expect(container.textContent).toContain('host editor'));

    expect(props.arg_schema).toBeDefined();
    expect(Object.keys(props.arg_schema as object)).toEqual(['name', 'assertions']);
    // the sub-field's own prose, which is what the drawer was missing
    expect((props.arg_schema as Record<string, { desc?: string }>).name.desc).toBe('The case key');
  });

  it('is told whether the value is one hash or a list of them', async () => {
    let props: Record<string, unknown> = {};
    const { container } = renderWithHost((p) => (props = p));
    await waitFor(() => expect(container.textContent).toContain('host editor'));

    expect(props.element_type).toBe('hash');
    expect(props.ui_element_type).toBe('hash');
  });

  it('still receives the descriptor members it already had', async () => {
    let props: Record<string, unknown> = {};
    const { container } = renderWithHost((p) => (props = p));
    await waitFor(() => expect(container.textContent).toContain('host editor'));

    expect(props.display_name).toBe('Cases');
    expect(props.ui_type).toBe('test-cases');
    expect(props.name).toBe('cases');
  });
});
