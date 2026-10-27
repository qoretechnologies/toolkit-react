// Copyright 2026 Qore Technologies, s.r.o.
// A host's saved values reach a form, and a form asks the host to save one.
//
// Saving a value for reuse and picking a saved one were IDE features that the
// port left inert: `showSavedValues` contributed no choices and `allowSaving`
// drew no control, so every form that moved to this engine lost both. The host
// keeps the values; this package draws them and asks it to save
// (`SavedValuesContext`).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import { FieldAllowedValues } from '../src/components/form/fields/allowed-values/AllowedValues';
import {
  ISavedValues,
  SavedValuesContext,
} from '../src/components/form/fields/allowed-values/savedValues';
import {
  ITemplateFieldProps,
  TemplateField,
} from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const SAVED: ISavedValues['items'] = [
  { display_name: 'Production URL', value: 'https://example.com', valueType: 'string' },
  { display_name: 'Answer', value: 42, valueType: 'int' },
];

const withSavedValues = (node: React.ReactNode, savedValues?: ISavedValues) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <SavedValuesContext.Provider value={savedValues}>{node}</SavedValuesContext.Provider>
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

describe('the saved values a field offers', () => {
  it('are offered by a field that shows saved values', () => {
    render(
      withSavedValues(
        <FieldAllowedValues items={[]} value={undefined} type='string' name='url' showSavedValues onChange={vi.fn()} />,
        { items: SAVED }
      )
    );

    expect(screen.queryAllByText('Saved & Suggested Values').length).toBeGreaterThan(0);
  });

  it('are not offered without a host, by a read-only field, or of another type', () => {
    const { unmount } = render(
      withSavedValues(<FieldAllowedValues items={[]} value={undefined} type='string' name='url' showSavedValues onChange={vi.fn()} />)
    );
    expect(screen.queryAllByText('Saved & Suggested Values')).toHaveLength(0);
    unmount();

    const readOnly = render(
      withSavedValues(
        <FieldAllowedValues items={[]} value={undefined} type='string' name='url' showSavedValues readOnly onChange={vi.fn()} />,
        { items: SAVED }
      )
    );
    expect(screen.queryAllByText('Saved & Suggested Values')).toHaveLength(0);
    readOnly.unmount();

    render(
      withSavedValues(
        <FieldAllowedValues items={[]} value={undefined} type='date' name='when' showSavedValues onChange={vi.fn()} />,
        { items: SAVED }
      )
    );
    expect(screen.queryAllByText('Saved & Suggested Values')).toHaveLength(0);
  });
});

/** The row side of the menu channel: whatever the field inside published. */
const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};
const menuItem = (label: string) =>
  Object.values(published)
    .flat()
    .find((item) => (item as { label?: unknown }).label === label) as
    | (IReqoreDropdownItem & { onClick?: () => void })
    | undefined;

const fieldInARow = (props: Partial<ITemplateFieldProps>, savedValues?: ISavedValues) =>
  render(
    withSavedValues(
      <RowMenuContext.Provider value={registry}>
        <TemplateField
          name='url'
          type={'string' as never}
          onChange={vi.fn()}
          {...({ allowSaving: true } as object)}
          {...props}
        />
      </RowMenuContext.Provider>,
      savedValues
    )
  );

beforeEach(() => {
  Object.keys(published).forEach((id) => delete published[id]);
});

describe('saving a field’s value', () => {
  it('is offered in the row menu and asks the host to save the value', async () => {
    const saveValue = vi.fn();
    fieldInARow({ value: 'https://example.com' }, { items: [], saveValue, saveLabel: 'Save' });

    await waitFor(() => expect(menuItem('Save')).toBeDefined());
    menuItem('Save')!.onClick!();
    expect(saveValue).toHaveBeenCalledWith({ value: 'https://example.com', type: 'string' });
  });

  it('is not offered with nothing to save, no host, a yes/no or fixed choices', async () => {
    const saveValue = vi.fn();
    const empty = fieldInARow({ value: undefined }, { items: [], saveValue });
    await waitFor(() => expect(Object.keys(published).length).toBeGreaterThan(0));
    expect(menuItem('Save value')).toBeUndefined();
    empty.unmount();

    const noHost = fieldInARow({ value: 'x' });
    await waitFor(() => expect(Object.keys(published).length).toBeGreaterThan(0));
    expect(menuItem('Save value')).toBeUndefined();
    noHost.unmount();

    const yesNo = fieldInARow({ type: 'bool' as never, value: true }, { items: [], saveValue });
    await waitFor(() => expect(Object.keys(published).length).toBeGreaterThan(0));
    expect(menuItem('Save value')).toBeUndefined();
    yesNo.unmount();

    fieldInARow(
      {
        value: 'a',
        allowed_values: [{ name: 'a', value: { type: 'string', value: 'a' } }] as never,
      },
      { items: [], saveValue }
    );
    await waitFor(() => expect(Object.keys(published).length).toBeGreaterThan(0));
    expect(menuItem('Save value')).toBeUndefined();
  });
});
