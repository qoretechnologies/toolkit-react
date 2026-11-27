// Copyright 2026 Qore Technologies, s.r.o.
// A field that holds several choices is picked with the multi-select.
//
// Once a field had `allowed_values`, the auto field handed it to the single-choice
// picker (`FieldAllowedValues`) and drew nothing of its own — right for a string
// with fixed choices, wrong for a `select-array`: a key's or a client's
// permissions, which hold several, could be given only one.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const multiSelect = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('../src/components/form/fields/multi-select/MultiSelectFormField', () => ({
  MultiSelectFormField: (props: Record<string, any>) => {
    multiSelect.props = props;
    return <div data-multi-select />;
  },
}));

import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const PERMISSIONS = [
  { display_name: 'ALL *', value: { type: 'string', value: '*' } },
  { display_name: 'READ', value: { type: 'string', value: 'READ' } },
];

describe('a field that holds several choices', () => {
  it.each(['select-array', 'multi-select'])('%s is picked with the multi-select', async (type) => {
    multiSelect.props = undefined;
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <AutoFormField
            name='permissions'
            type={type as never}
            defaultType={type as never}
            allowed_values={PERMISSIONS as never}
            value={['READ'] as never}
            onChange={onChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(container.querySelector('[data-multi-select]')).toBeTruthy());
    expect(multiSelect.props?.items).toBe(PERMISSIONS);
    // Not the single-choice picker beside it.
    expect(container.querySelectorAll('.reqore-checkbox')).toHaveLength(0);

    multiSelect.props?.onChange(['READ', '*']);
    expect(onChange.mock.lastCall?.slice(0, 3)).toEqual(['permissions', ['READ', '*'], type]);
  });
});
