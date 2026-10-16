/**
 * A reqraft component's own props stop at the component: what it hands on to the Reqore component it draws is
 * that component's props only (qorus#646).
 *
 * The menu item handed `activePaths` to a router link, which wrote it onto its `<a>`. A sweep for the same
 * read-then-spread pattern found four more: each read a prop of its own, then spread its props into a Reqore
 * component that does not take it. Reqore writes what it does not know onto its element when it is drawn `as`
 * another component, and drops it otherwise, so whether one reached the page depended on the Reqore version
 * and on `as`. These tests watch what each Reqore component is handed.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const handed = vi.hoisted(() => ({}) as Record<string, Record<string, unknown>[]>);

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const reqore = await importOriginal<typeof import('@qoretechnologies/reqore')>();
  const React = await import('react');
  const watch = (name: string, Component: any) =>
    React.forwardRef((props: Record<string, unknown>, ref) => {
      (handed[name] ??= []).push(props);
      return React.createElement(Component, { ...props, ref });
    });
  return {
    ...reqore,
    ReqoreCollection: watch('ReqoreCollection', reqore.ReqoreCollection),
    ReqoreModal: watch('ReqoreModal', reqore.ReqoreModal),
    ReqorePanel: watch('ReqorePanel', reqore.ReqorePanel),
    ReqoreTabs: watch('ReqoreTabs', reqore.ReqoreTabs),
  };
});

vi.mock('../src/hooks/useQorusTypes', () => ({
  useQorusTypes: () => ({ value: [], loading: false, getExactMatches: () => [] }),
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { ConfirmUnsupportedTypeModal } from '../src/components/form/expressions/builder/confirmUnsupportedTypeModal';
import { ReqraftFileFormField } from '../src/components/form/fields/file/File';
import { ReqraftObjectFormField } from '../src/components/form/fields/object/Object';
import { FetchContext } from '../src/contexts/FetchContext';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';
import { emptyFetchContext } from './support/fetchContext';

const keysHanded = (name: string) => {
  expect(handed[name]?.length, `${name} was drawn`).toBeGreaterThan(0);
  return new Set(handed[name].flatMap((props) => Object.keys(props)));
};

const storage = {
  getStorage: (_path: string, defaultValue?: unknown) => defaultValue,
  updateStorage: () => undefined,
  removeStorageValue: () => undefined,
} as never;

afterEach(() => {
  Object.keys(handed).forEach((name) => delete handed[name]);
});

describe('what a reqraft component hands the Reqore component it draws', () => {
  it("FormEngine: none of the form's own options, templates or wait reason", async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            name='own'
            value={{ name: { type: 'string', value: 'n' } } as never}
            options={{ name: { type: 'string', display_name: 'Name' } } as never}
            stringTemplates={{ items: [] } as never}
            skeletonReason='schema'
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.textContent).toContain('Name'));
    const keys = keysHanded('ReqoreCollection');
    expect(['options', 'stringTemplates', 'skeletonReason'].filter((key) => keys.has(key))).toEqual(
      []
    );
  });

  it('ConfirmUnsupportedTypeModal: not exactMatch', () => {
    render(
      <ReqoreUIProvider>
        <ReqraftStorageContext.Provider value={storage}>
          <ConfirmUnsupportedTypeModal acceptedTypes={['int']} exactMatch />
        </ReqraftStorageContext.Provider>
      </ReqoreUIProvider>
    );
    expect(keysHanded('ReqoreModal').has('exactMatch')).toBe(false);
  });

  it('the file field: not readonly, which still makes its drop area take no file', () => {
    // a drop area that takes files is a keyboard stop (tabIndex 0); a disabled one is not
    const dropArea = (props: { readonly?: boolean }) => {
      render(
        <ReqoreUIProvider>
          <ReqraftFileFormField {...props} onChange={vi.fn()} />
        </ReqoreUIProvider>
      );
      const panel = handed.ReqorePanel.find((p) => p.role === 'presentation');
      delete handed.ReqorePanel;
      return panel;
    };
    expect(dropArea({})?.tabIndex).toBe(0);
    const readOnly = dropArea({ readonly: true });
    expect(readOnly).toBeTruthy();
    expect('readonly' in readOnly!).toBe(false);
    expect(readOnly?.tabIndex).toBeUndefined();
  });

  it('the object field: not disabled, which its own buttons take', () => {
    render(
      <ReqoreUIProvider>
        <ReqraftObjectFormField type='object' value={{ a: 1 }} onChange={vi.fn()} disabled />
      </ReqoreUIProvider>
    );
    expect(keysHanded('ReqoreTabs').has('disabled')).toBe(false);
  });
});
