// Copyright 2026 Qore Technologies, s.r.o.
// A field skeleton always says what it is waiting for.
//
// `data-wait` is how a page — and a story, before its visual capture — asks
// whether a form has finished loading. FormFieldsSkeleton rendered it only when
// its caller named a reason, and the nested waits (a field resolving its named
// arg schema, a hash resolving its sub-schema) named none, so they drew a
// placeholder nothing could wait for: qorus-ide's Qlip build 279 captured the AI
// guardrail's Rules row on one.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/fetch', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils/fetch')>();
  // A schema request the server has not answered yet.
  return { ...original, query: vi.fn(() => new Promise(() => {})) };
});

import { FormFieldsSkeleton } from '../src/components/form/engine/FormFieldsSkeleton';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const wrap = (node: React.ReactNode) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={emptyFetchContext()}>{node}</FetchContext.Provider>
  </ReqoreUIProvider>
);

describe('FormFieldsSkeleton', () => {
  it('names the wait it stands for', () => {
    const { container } = render(wrap(<FormFieldsSkeleton rows={1} reason='templates' />));

    expect(container.querySelector('[data-wait]')?.getAttribute('data-wait')).toBe('templates');
  });

  it('is still marked when its caller names no wait', () => {
    const { container } = render(wrap(<FormFieldsSkeleton rows={1} />));

    expect(container.querySelector('[data-wait]')?.getAttribute('data-wait')).toBe('loading');
  });
});

describe('a field resolving its named arg schema', () => {
  it('shows a placeholder that says it waits for the schema', async () => {
    const { container } = render(
      wrap(
        <AutoFormField
          name='rules'
          type='list'
          defaultType='list'
          arg_schema='ai-guardrail-rules'
          onChange={vi.fn()}
        />
      )
    );

    await waitFor(() => expect(container.querySelector('[data-wait="arg-schema"]')).not.toBeNull());
  });
});
