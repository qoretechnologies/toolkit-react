// Copyright 2026 Qore Technologies, s.r.o.
// A semantic string format is edited as one line of text.
//
// `email`, `uri`, `uuid`, `hostname`, `ipv4`, `ipv6` and `phone` are in the
// option vocabulary (`optionUiTypes`), the single-line list and the validator,
// but the auto field had no case for them: a field declared with one drew
// "Unknown type!" in every form.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { OPTION_UI_TYPES } from '../src/helpers/optionUiTypes';
import { isSingleLineStringType } from '../src/helpers/singleLineString';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const wrap = (node: React.ReactNode) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>{node}</FetchContext.Provider>
  </ReqoreUIProvider>
);

const SEMANTIC_STRING_TYPES = ['email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6', 'phone'];

describe('a semantic string format', () => {
  it('is a single-line option type the vocabulary knows', () => {
    for (const type of SEMANTIC_STRING_TYPES) {
      expect(OPTION_UI_TYPES).toContain(type);
      expect(isSingleLineStringType(type)).toBe(true);
    }
  });

  it.each(SEMANTIC_STRING_TYPES)('%s is edited as one line of text', (type) => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(
        <AutoFormField
          name='value'
          type={type as never}
          defaultType={type as never}
          value='a value'
          onChange={onChange}
        />
      )
    );

    expect(container.textContent).not.toContain('Unknown type!');
    const input = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('a value');
  });
});
