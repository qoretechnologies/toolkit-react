// Copyright 2026 Qore Technologies, s.r.o.
/**
 * An `allowed_values` entry is written three ways - an envelope (`{value: {type, value}}`), a bare value
 * (`{value: 'x'}`) or a name (`{name: 'x'}`), as `findAllowedValueOption` reads them. A short list's check group
 * read the envelope only, so an entry written another way was a box with no name, which a click could not tick
 * (qorus#646, David on FormEngine · Compact Required Field Loaded Late Opens By Itself: "an invalid empty radio box
 * control with two empty choices").
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAllowedValueAvailability } from '../src/components/form/engine/OptionFieldMessages';
import { FieldAllowedValues } from '../src/components/form/fields/allowed-values/AllowedValues';
import { FormField } from '../src/components/form/fields/Field';
import { SelectFormField } from '../src/components/form/fields/select/Select';
import { allowedValueName, allowedValueOf, heldAllowedValue } from '../src/helpers/allowedValues';
import { validateField } from '../src/helpers/validations';

/* The anchored list is read where it is handed to reqore: reqore opens it through a portal that jsdom never
   opens (see selectRefusedValuePaths.test.tsx). Nothing else here draws a dropdown. */
let dropdownProps: any;
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => {
      dropdownProps = props;
      return <div data-testid='dropdown' />;
    },
  };
});

describe('an allowed value, however its entry is written', () => {
  it('has its value', () => {
    expect(allowedValueOf({ value: { type: 'string', value: 'x' } })).toBe('x');
    expect(allowedValueOf({ value: 'x' })).toBe('x');
    expect(allowedValueOf({ name: 'x' })).toBe('x');
    expect(allowedValueOf({ value: 0 })).toBe(0);
  });

  it('has its name', () => {
    expect(allowedValueName({ display_name: 'Ex', value: 'x' })).toBe('Ex');
    expect(allowedValueName({ name: 'x', value: 'x' })).toBe('x');
    expect(allowedValueName({ value: { type: 'string', value: 'x' } })).toBe('x');
    expect(allowedValueName({ value: { type: 'int', value: 3 } })).toBe('3');
  });
});

describe('a short list of choices written without envelopes', () => {
  it.each([
    [
      'bare values with names',
      [
        { name: 'ProcessorTypeTest', value: 'ProcessorTypeTest' },
        { name: 'qogcompatibilitytest', value: 'qogcompatibilitytest' },
      ],
    ],
    ['names only', [{ name: 'ProcessorTypeTest' }, { name: 'qogcompatibilitytest' }]],
  ])('names each choice and ticks the one held (%s)', (_how, items) => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FieldAllowedValues
          type='string'
          name='processor'
          value='qogcompatibilitytest'
          onChange={onChange}
          items={items as never}
        />
      </ReqoreUIProvider>
    );
    const held = screen
      .getByText('qogcompatibilitytest')
      .closest('.reqore-checkbox') as HTMLElement;
    const other = screen.getByText('ProcessorTypeTest').closest('.reqore-checkbox') as HTMLElement;
    expect(
      held.querySelector('input')?.checked ?? held.getAttribute('aria-checked') === 'true'
    ).toBe(true);
    // a click picks it
    fireEvent.click(other);
    expect(onChange).toHaveBeenCalledWith('processor', 'ProcessorTypeTest');
  });
});

/** The same two choices, written each way an entry is written. */
const WRITTEN = [
  [
    'envelopes',
    [
      { display_name: 'Workflow', value: { type: 'string', value: 'wf' } },
      { display_name: 'Service', value: { type: 'string', value: 'svc' } },
    ],
  ],
  [
    'bare values',
    [
      { display_name: 'Workflow', value: 'wf' },
      { display_name: 'Service', value: 'svc' },
    ],
  ],
] as const;

describe('the choice a field holds', () => {
  const items = [
    { display_name: 'general', value: { type: 'richtext', value: 'C07ERBFS0P6' } },
    { display_name: 'random', value: { type: 'richtext', value: 'C07RANDOM01' } },
  ];

  it('is the choice, however the value spells it', () => {
    expect(heldAllowedValue('C07RANDOM01', items)).toBe('C07RANDOM01');
    // the document an editor wrote for it
    expect(
      heldAllowedValue([{ type: 'paragraph', children: [{ text: 'C07ERBFS0P6' }] }], items)
    ).toBe('C07ERBFS0P6');
    // a choice written by its name only
    expect(heldAllowedValue('x', [{ name: 'x' }])).toBe('x');
  });

  it('is none when the field holds nothing, or a value no choice is', () => {
    expect(heldAllowedValue('C07OTHER', items)).toBeUndefined();
    // a choice with no value is not held by a field that holds nothing
    expect(heldAllowedValue(undefined, [{ name: 'x' }])).toBeUndefined();
    expect(heldAllowedValue('', [{ name: 'x' }])).toBeUndefined();
    expect(heldAllowedValue('x', [])).toBeUndefined();
  });
});

describe('suggestions beside an editor that holds the value', () => {
  // qorus#646, David: "if this option takes a single value, then selecting another value should replace the
  // one that's there" - the list said nothing of the one held, so a pick read as adding to it
  const renderSuggestions = (markedValue: unknown, onChange = vi.fn()) => {
    render(
      <ReqoreUIProvider>
        <SelectFormField
          items={[
            { display_name: 'general', value: 'C07ERBFS0P6' },
            { display_name: 'random', value: 'C07RANDOM01' },
          ]}
          markedValue={markedValue}
          onChange={onChange}
          placeholder='Saved & Suggested Values'
          minimal
        />
      </ReqoreUIProvider>
    );
    return onChange;
  };

  it('tick the one the field holds, and a pick of another replaces it', () => {
    const onChange = renderSuggestions('C07ERBFS0P6');
    const items = dropdownProps.items as {
      label: string;
      selected: boolean;
      onClick: () => void;
    }[];
    expect(items.map(({ label, selected }) => [label, selected])).toEqual([
      ['general', true],
      ['random', false],
    ]);
    // the trigger keeps its own name: the editor beside it draws the value
    expect(dropdownProps.children).toBe('Saved & Suggested Values');

    items[1].onClick();
    expect(onChange).toHaveBeenCalledWith('C07RANDOM01');
  });

  it('tick none when the field holds none of them', () => {
    renderSuggestions(undefined);
    expect((dropdownProps.items as { selected: boolean }[]).some(({ selected }) => selected)).toBe(
      false
    );
  });
});

describe('choices written without envelopes, wherever they are read', () => {
  it.each(WRITTEN)('a short list names each and ticks the one held (%s)', (_how, items) => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FormField
          type='string'
          name='kind'
          value='svc'
          onChange={onChange}
          allowed_values={items as never}
        />
      </ReqoreUIProvider>
    );
    const held = screen.getByText('Service').closest('.reqore-checkbox') as HTMLElement;
    expect(
      held.querySelector('input')?.checked ?? held.getAttribute('aria-checked') === 'true'
    ).toBe(true);
    fireEvent.click(screen.getByText('Workflow').closest('.reqore-checkbox') as HTMLElement);
    expect(onChange).toHaveBeenCalled();
    expect(JSON.stringify(onChange.mock.lastCall)).toContain('"wf"');
  });

  it.each(WRITTEN)('a refusal names the answer it needs by its name (%s)', (_how, items) => {
    const schema = {
      kind: { type: 'string', display_name: 'Interface Kind', allowed_values: items },
    };
    const refused = getAllowedValueAvailability(
      { depends_on: ['kind=wf'] },
      { kind: { type: 'string', value: 'svc' } } as never,
      schema as never
    );
    expect(refused.available).toBe(false);
    expect(refused.reason).toContain('"Interface Kind" must be "Workflow"');
  });

  it.each(WRITTEN)('a connection that is one of them is valid (%s)', (_how, items) => {
    expect(validateField('connection', 'svc', { allowed_values: items as never } as never)).toBe(
      true
    );
    expect(validateField('connection', 'other', { allowed_values: items as never } as never)).toBe(
      false
    );
  });
});
