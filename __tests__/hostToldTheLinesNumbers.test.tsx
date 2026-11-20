// Copyright 2026 Qore Technologies, s.r.o.
/*
 * The numbers a host draws its submit control from (`onAttentionChange`) are the readiness line's, to the one. An
 * optional field its host says is wrong (`invalid_reason`) stays among the optional ones and is counted in the line
 * ("Incomplete · 1 need attention"); the host was not told, and its submit read ready.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

describe('what the host is told', () => {
  it('counts a fault outside the first box, as the line does', async () => {
    const onAttentionChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='check'
            value={{} as never}
            options={
              {
                expected: {
                  type: 'string',
                  ui_type: 'string',
                  display_name: 'Expected value',
                  preselected: true,
                  invalid_reason: 'The record has no field named "pos".',
                },
              } as never
            }
            onAttentionChange={onAttentionChange}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() =>
      expect(container.querySelector('.options-readfirst-completion')?.textContent).toContain(
        '1 need attention'
      )
    );
    expect(onAttentionChange).toHaveBeenLastCalledWith({ count: 1, faults: 1 });
  });
});
