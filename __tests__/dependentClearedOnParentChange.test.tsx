import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * Changing an option that has dependents clears those dependents' values.
 *
 * The lookup asked `flatten(depends_on).includes(optionName)` — a whole-string
 * compare, so only a bare `['kind']` ever matched. Every real declaration is
 * `kind=value`, so nothing was ever cleared.
 *
 * Reported from the live IDE: a test whose subject was switched from a workflow
 * to a service kept the workflow's `Subject Interface Version`. Services and
 * jobs are versioned but only the LATEST is testable, so the field no longer
 * applied — and a field holding a value is deliberately not withheld (hiding it
 * would orphan a value still being submitted), so it stayed on the form as a
 * locked control in front of a value the author could not clear.
 */
const SCHEMA = {
  kind: { type: 'string', display_name: 'Kind', has_dependents: true },
  version: {
    type: 'string',
    display_name: 'Version',
    depends_on: ['kind=workflow', 'kind=step'],
  },
  unrelated: { type: 'string', display_name: 'Unrelated' },
} as any;

const drive = async () => {
  const changes: any[] = [];
  const { container } = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          name='subject'
          options={SCHEMA}
          value={
            {
              kind: { type: 'string', value: 'workflow' },
              version: { type: 'string', value: '1.0' },
              unrelated: { type: 'string', value: 'keep me' },
            } as never
          }
          onChange={((_n: string, v: any) => changes.push(v)) as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

  const input = await waitFor(() => {
    const els = [...container.querySelectorAll('input, textarea')] as HTMLInputElement[];
    const el = els.find((e) => e.value === 'workflow');
    if (!el) {
      throw new Error(
        `no field holding 'workflow'; found: ${JSON.stringify(els.map((e) => e.value))}`
      );
    }
    return el;
  });

  fireEvent.change(input, { target: { value: 'service' } });
  await waitFor(() => expect(changes.length).toBeGreaterThan(0), { timeout: 3000 });
  return changes[changes.length - 1];
};

describe('changing an option that has dependents', () => {
  it('clears a dependent declared as `kind=value`', async () => {
    const next = await drive();

    expect(next.kind.value).toBe('service');
    expect(next.version.value).toBeUndefined();
  });

  it('leaves an option that does not depend on it alone', async () => {
    const next = await drive();

    expect(next.unrelated.value).toBe('keep me');
  });
});
