// Copyright 2026 Qore Technologies, s.r.o.
//
// The expression's Text view gets the record's fields the field's schema declares (`dpql_fields`), so
// every field the Visual view offers can be referred to by name there too (David's review of qorus#646).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

let editorProps: any;

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>((props) => {
    if (!props.readOnly) {
      editorProps = props;
    }
    return <textarea data-testid='fake-dpql' readOnly value={props.value ?? ''} />;
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();
const FIELDS = { qty: { type: 'int' }, pos: { type: ['int', 'string'] } };

describe('the Text view of an expression', () => {
  it('is given the record fields', async () => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <ExpressionField
            value={{ is_expression: true, value: { args: [] } } as never}
            onChange={vi.fn()}
            type='int'
            defaultMode='text'
            expressions={[]}
            fields={FIELDS}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await screen.findByTestId('fake-dpql');
    expect(editorProps.fields).toEqual(FIELDS);
  });
});
