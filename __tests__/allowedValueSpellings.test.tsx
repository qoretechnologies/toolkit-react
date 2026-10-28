import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldAllowedValues } from '../src/components/form/fields/allowed-values/AllowedValues';
import { allowedValueOf, findAllowedValueOption } from '../src/helpers/allowedValues';

/**
 * A choice is the same choice however its entry is written.
 *
 * An `allowed_values` entry comes as an envelope (`{value: {type, value}}`), a
 * bare value (`{value: 'x'}`) or a name alone (`{name: 'x'}`) — the app
 * catalogue sends the bare form, a `context=ui` answer the envelope. The row
 * that names a stored choice read all three; the pickers that write one read
 * only the envelope. On a bare list nothing showed as selected, and clicking a
 * choice stored `undefined`: picking a pipeline processor's class cleared it.
 */
describe('the value a choice stands for', () => {
  it('reads the envelope, the bare value and the name', () => {
    expect(allowedValueOf({ value: { type: 'string', value: 'a' } })).toBe('a');
    expect(allowedValueOf({ value: 'b' })).toBe('b');
    expect(allowedValueOf({ name: 'c' })).toBe('c');
    // A falsy bare value is still the value, not a reason to fall back to the name.
    expect(allowedValueOf({ name: 'zero', value: 0 })).toBe(0);
    expect(allowedValueOf({ value: false })).toBe(false);
  });

  it('agrees with the lookup that names the stored choice', () => {
    for (const entry of [
      { name: 'x', value: { type: 'string', value: 'v' } },
      { name: 'x', value: 'v' },
      { name: 'v' },
    ]) {
      const schema = { type: 'string', allowed_values: [entry] } as never;
      expect(findAllowedValueOption(allowedValueOf(entry), schema)).toBe(entry);
    }
  });
});

describe('a short list written with bare values', () => {
  const items = [
    { name: 'ProcessorTypeTest', display_name: 'Processor Type Test', value: 'ProcessorTypeTest' },
    {
      name: 'qogcompatibilitytest',
      display_name: 'Qog Compatibility Test',
      value: 'qogcompatibilitytest',
    },
  ];

  it('stores the choice that was clicked', () => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FieldAllowedValues
          type='string'
          name='processor'
          value='ProcessorTypeTest'
          onChange={onChange}
          items={items as never}
        />
      </ReqoreUIProvider>
    );

    fireEvent.click(screen.getByText('Qog Compatibility Test').closest('.reqore-checkbox')!);
    expect(onChange).toHaveBeenCalledWith('processor', 'qogcompatibilitytest');
  });

  it('knows the stored value is the selected choice', () => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FieldAllowedValues
          type='string'
          name='processor'
          value='ProcessorTypeTest'
          onChange={onChange}
          items={items as never}
        />
      </ReqoreUIProvider>
    );

    // Clicking the selected choice unselects it, which is only possible if the
    // picker recognised it as the selected one.
    fireEvent.click(screen.getByText('Processor Type Test').closest('.reqore-checkbox')!);
    expect(onChange).toHaveBeenCalledWith('processor', undefined);
  });
});
