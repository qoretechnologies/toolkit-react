import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * An expression's return type is a DATA type, never a `ui_type`.
 *
 * Reported from a test assertion's Expected Value: choosing **Use Expression**
 * produced *"This expression returns nothing but the expected return type is
 * test-reference. Please select an expression that returns test-reference…"* —
 * and nothing returns one, so no expression could be chosen. The saved draft
 * then carried `"type": "test-reference"` on the expression itself.
 *
 * `test-reference` is the IDE's rich-text reference editor: a statement about
 * how a value is EDITED. `TemplateField` picks its editor with
 * `ui_type || type`, which is right for rendering, and the same value was being
 * handed to the expression builder as the type an expression must RETURN.
 *
 * Asserted on the prop the builder is given, because that is the wiring that
 * broke — a test that only rendered the field passed just as happily with the
 * defect in place, since nothing calls back on mount.
 */
const seenProps: Record<string, unknown>[] = [];

vi.mock('../src/components/form/expressions/ExpressionField', () => ({
  ExpressionField: (props: Record<string, unknown>) => {
    seenProps.push(props);
    return <div data-testid='fake-expression-field' />;
  },
}));

import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

describe('the return type handed to the expression builder', () => {
  it('is the declared data type, not the ui_type that chose the editor', async () => {
    seenProps.length = 0;

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <TemplateField
            name='expected'
            aria-label='Expected Value'
            // The shape an assertion's Expected Value arrives in: an `any`
            // field the IDE renders with its reference editor.
            type={'any' as never}
            ui_type={'test-reference' as never}
            defaultType={'any' as never}
            // already holding an expression, so the builder mounts
            value={{ is_expression: true, value: { exp: 'value', args: [] } } as never}
            isFunction
            allowFunctions
            allowTextExpressions
            allowTemplates={false}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(seenProps.length).toBeGreaterThan(0));

    const returnTypes = seenProps.map((props) => props.returnType);
    // The reported failure: nothing can return a ui_type.
    expect(returnTypes).not.toContain('test-reference');
    // and it is the declared data type that is asked for instead
    expect(returnTypes).toContain('any');
  });
});
