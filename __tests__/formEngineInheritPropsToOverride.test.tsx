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

describe('inherit_props reaches a consumer-injected editor', () => {
  it('hands a host editor the sibling values its field declared', async () => {
    // `inherit_props` exists to feed an editor the form engine does not ship —
    // the values live on SIBLING fields, and a host editor cannot read them. It
    // was resolved correctly and then dropped, because `inheritedFromParent` is
    // destructured out of `rest` (so the primitive renderers do not spread it
    // onto a DOM node) and the override render did not pass it on. Every
    // consumer downstream saw `undefined` and silently rendered nothing.
    const seen: Array<Record<string, unknown> | undefined> = [];
    const HostEditor = ({ inheritedFromParent }: any) => {
      seen.push(inheritedFromParent);
      return <div data-testid='host-editor' />;
    };

    const { findByTestId } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <FormEngine
            name='inherit-props'
            value={{
              kind: { type: 'string', value: 'service' },
              body: { type: 'string', value: 'x' },
            }}
            options={
              {
                kind: { type: 'string', display_name: 'Kind' },
                body: {
                  type: 'string',
                  ui_type: 'host-editor',
                  display_name: 'Body',
                  inherit_props: { subjectKind: 'kind' },
                },
              } as never
            }
            componentOverrides={{ 'host-editor': HostEditor }}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await findByTestId('host-editor');
    await waitFor(() => expect(seen.at(-1)).toBeDefined());
    // the sibling's VALUE, under the name the field asked for
    expect(seen.at(-1)?.subjectKind).toBe('service');
  });
});
