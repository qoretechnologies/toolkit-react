/**
 * A list whose elements are chosen from a closed set of more than three values.
 *
 * The server sends each choice as a `{type, value}` envelope. The list editor
 * unwrapped those for its check group and then handed the same unwrapped list
 * to the multi-select, which unwraps `.value` itself - so every choice reached
 * the picker as `undefined`. Picking one stored an element with no value
 * ("List item 0 is invalid") and drew an "undefined" chip; this is how an auth
 * profile's role, permission and group requirements could not be set at all.
 *
 * reqore's multi-select is mocked so the items it is HANDED are read directly:
 * its dropdown opens through a portal that jsdom never renders.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let multiSelectProps: any;

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreMultiSelect: (props: any) => {
      multiSelectProps = props;
      return <div data-testid='multi-select' />;
    },
  };
});

const { AutoFormField } = await import('../src/components/form/fields/auto/AutoFormField');

const role = (name: string, desc: string) => ({
  value: { type: 'string', value: name },
  display_name: name,
  short_desc: desc,
  desc,
});

const ROLES = [
  role('admin', 'administrator profile'),
  role('auditor', 'read-only audit profile'),
  role('operator', 'operator profile'),
  role('reader', 'read-only profile'),
];

const roles = (props: { value?: unknown; onChange?: (...args: any[]) => void; choices?: unknown[] }) =>
  render(
    <ReqoreUIProvider>
      <AutoFormField
        name='roles'
        type='list'
        element_type='string'
        element_allowed_values={(props.choices ?? ROLES) as never}
        element_allowed_values_creatable={false}
        value={(props.value ?? []) as never}
        onChange={(props.onChange ?? vi.fn()) as never}
      />
    </ReqoreUIProvider>
  );

beforeEach(() => {
  multiSelectProps = undefined;
});

describe('a list chosen from more than three allowed values', () => {
  it('offers every choice by its value and name', async () => {
    roles({});
    await waitFor(() => expect(multiSelectProps?.items).toBeTruthy());

    expect(multiSelectProps.items.map((item: any) => item.value)).toEqual([
      'admin',
      'auditor',
      'operator',
      'reader',
    ]);
    expect(multiSelectProps.items.map((item: any) => item.label)).toEqual([
      'admin',
      'auditor',
      'operator',
      'reader',
    ]);
  });

  it('stores a picked choice as a typed list element', async () => {
    const onChange = vi.fn();
    roles({ onChange });
    await waitFor(() => expect(multiSelectProps?.onValueChange).toBeTruthy());

    // a pick hands back the value of the item the picker was given, as reqore does
    const operator = multiSelectProps.items.find((item: any) => item.label === 'operator');
    multiSelectProps.onValueChange([operator.value]);

    expect(onChange).toHaveBeenCalled();
    const stored = onChange.mock.calls.at(-1)[1];
    expect(stored).toEqual([{ type: 'string', value: 'operator' }]);
  });

  it('shows a stored choice as selected, with no empty element', async () => {
    roles({ value: [{ type: 'string', value: 'operator' }] });
    await waitFor(() => expect(multiSelectProps).toBeTruthy());

    expect(multiSelectProps.value).toEqual(['operator']);
  });

  it('shows a choice stored as a bare value as selected', async () => {
    roles({ value: ['operator', 'reader'] });
    await waitFor(() => expect(multiSelectProps).toBeTruthy());

    expect(multiSelectProps.value).toEqual(['operator', 'reader']);
  });

  it('keeps three or fewer choices in the check group instead', async () => {
    const { findByText } = roles({ choices: ROLES.slice(0, 3) });

    // the check group draws a button per choice, labelled with its name
    expect(await findByText('operator')).toBeTruthy();
    expect(multiSelectProps).toBeUndefined();
  });
});
