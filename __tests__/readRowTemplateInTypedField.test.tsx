// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { formatOptionValue } from '../src/components/form/engine/readFirst';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * qorus#646: a yes/no value holding the field pos read "Yes" in its collapsed row. The row's yes/no branch
 * came before its template branch, and the summary called any value that is not empty "Yes": a template
 * is not true, it is the field it names, and reads as that field, as it does in every other type.
 */
const ROW_FIELDS = { items: [{ label: 'Fields of the row', items: [{ label: 'pos', value: '$record:{pos}', badge: 'int' }] }] };

describe('a yes/no value holding a template, read', () => {
  it('is not summarised as Yes or No', () => {
    const summary = formatOptionValue({ type: 'bool', value: '$record:{pos}' } as never, { type: 'bool' } as never);
    expect(summary).not.toBe('Yes');
    expect(summary).not.toBe('No');
  });

  it('still reads true and false as Yes and No', () => {
    expect(formatOptionValue({ type: 'bool', value: true } as never, { type: 'bool' } as never)).toBe('Yes');
    expect(formatOptionValue({ type: 'bool', value: false } as never, { type: 'bool' } as never)).toBe('No');
  });

  it('shows the field it names in the collapsed row', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='read'
            stringTemplates={ROW_FIELDS as never}
            value={{ flag: { type: 'bool', value: '$record:{pos}' } } as never}
            options={{ flag: { type: 'bool', display_name: 'Flag', supports_templates: true } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.querySelector('.readfirst-row')).not.toBeNull());
    const row = container.querySelector('.readfirst-row') as HTMLElement;
    await waitFor(() => expect(row.textContent).toContain('pos'));
    expect(row.textContent).not.toContain('Yes');
  });
});
