/**
 * The host's per-`ui_type` editors reach an expression's operand fields.
 *
 * `AutoFormField` renders a consumer's own `ui_type` through
 * `componentOverrides`, and anything it does not recognise falls through its
 * switch to a literal `Unknown type!` tag. `FormEngine` forwards the overrides
 * to `TemplateField` (rest-spread, see the SEAM comment there) — but the
 * EXPRESSION shell rendered in expression mode neither accepted nor forwarded
 * them, so the builder's operand fields had none.
 *
 * Reported from the live IDE: a test assertion's `Value` is `test-reference`,
 * an IDE ui_type whose editor the IDE registers through `componentOverrides`.
 * Clicking "Use expression" on it rendered `Unknown type!` where the operand
 * editor belongs.
 *
 * Each hop is asserted separately by mocking the child and reading the props it
 * was handed. Driving the whole builder instead would make these tests depend
 * on the shape of a live expression catalogue — and an earlier attempt to do
 * that crashed into the builder's error boundary, where "does not contain
 * Unknown type!" passed against a component that had rendered nothing at all.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const builderProps: any[] = [];

/* Only the BUILDER is mocked. Mocking the shell too would mean the second test
   rendered the mock instead of the component it is about — the real shell has
   to run for these to mean anything. */
vi.mock('../src/components/form/expressions/builder', () => ({
  ExpressionBuilder: (props: any) => {
    builderProps.push(props);
    return <div data-testid='builder' />;
  },
  // `TemplateField` imports this directly to break an import cycle.
  Expression: () => null,
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** Stands in for the IDE's `TestReferenceField`. */
const HostEditor = () => <div data-testid='host-editor'>host editor</div>;
const OVERRIDES = { 'test-reference': HostEditor };

const wrap = (node: React.ReactNode) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext as never}>{node}</FetchContext.Provider>
  </ReqoreUIProvider>
);

describe('componentOverrides reach an expression operand', () => {
  it('reach the builder from a field in expression mode', async () => {
    builderProps.length = 0;

    render(
      wrap(
        <TemplateField
          name='value'
          type={'test-reference' as never}
          isFunction
          allowFunctions
          allowTextExpressions
          onChange={vi.fn()}
          value={{ exp: '+', args: [1, 2] } as never}
          componentOverrides={OVERRIDES as never}
        />
      )
    );

    await waitFor(() => expect(builderProps.length).toBeGreaterThan(0));
    expect(builderProps[0].componentOverrides).toBe(OVERRIDES);
  });

  it('the expression shell hands them to the builder', async () => {
    builderProps.length = 0;

    render(
      wrap(
        <ExpressionField
          value={{ is_expression: true, value: { exp: '+', args: [1, 2] } } as never}
          onChange={vi.fn()}
          type='auto'
          expressions={[]}
          componentOverrides={OVERRIDES as never}
        />
      )
    );

    await waitFor(() => expect(builderProps.length).toBeGreaterThan(0));
    expect(builderProps[0].componentOverrides).toBe(OVERRIDES);
  });
});
