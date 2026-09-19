import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldAllowedValues } from '../src/components/form/fields/allowed-values/AllowedValues';
import { FormField } from '../src/components/form/fields/Field';
import {
  ISelectFieldCollectionItem,
  SelectFieldCollection,
  UNAVAILABLE_ITEM_CLASS,
} from '../src/components/form/fields/select/SelectCollection';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import {
  ALLOWED_VALUE_AVAILABLE,
  getAllowedValueAvailability,
  useAllowedValueAvailability,
} from '../src/components/form/engine/OptionFieldMessages';
import { OptionsContext } from '../src/components/form/engine/optionsContext';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * An offered value that cannot be picked is disabled and says why — never
 * hidden, and never silent.
 *
 * The rule already existed one level up, on whole FIELDS: a field whose
 * `depends_on` is unmet renders locked with the dependency named. A VALUE had
 * no such grammar. A picker could mark a choice `disabled`, and the result was
 * a row that ignored clicks and explained nothing; the alternative callers
 * reached for — dropping the value from the list — is worse, because a choice
 * that vanishes takes its own explanation with it.
 *
 * Two things can refuse a value and they render identically, because a reader
 * has no way to tell them apart and no reason to care: the value's own
 * `depends_on`, judged here, and a refusal the server had already decided
 * (`disabled` with a message) for what only it can know.
 *
 * The one thing this must never do is reach for reqore's `disabled`.
 * `DisabledElement` is `pointer-events: none`, which would take the row's
 * tooltip and the control in its title bar with it — both places the reason
 * can be read. Dropping the click handler is what makes a row inert; reqore
 * derives `interactive` from the handlers a panel was given.
 */

const fetchContext = emptyFetchContext();

const form = (values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { type: 'string', value }])
  ) as never;

const SCHEMA = {
  kind: { type: 'string', display_name: 'Interface Kind' },
  cookie_name: { type: 'string', display_name: 'Session Cookie Name' },
} as never;

describe('what refuses a value, and in whose words', () => {
  it('offers a value whose dependency holds and refuses it when it does not', () => {
    const value = { depends_on: ['kind=workflow'] };

    expect(getAllowedValueAvailability(value, form({ kind: 'workflow' }), SCHEMA).available).toBe(
      true
    );

    const refused = getAllowedValueAvailability(value, form({ kind: 'service' }), SCHEMA);
    expect(refused.available).toBe(false);
    // Named, not merely reported: the reader is told WHICH answer would open it,
    // by the same describer the field-level lock uses.
    expect(refused.reason).toContain('"Interface Kind" must be "workflow"');
  });

  it('says a sibling must be unanswered in words, not as a comparison with nothing', () => {
    const refused = getAllowedValueAvailability(
      { depends_on: ['!cookie_name'] },
      form({ cookie_name: 'QORUS_SESSION' }),
      SCHEMA
    );

    expect(refused.available).toBe(false);
    expect(refused.reason).toContain('"Session Cookie Name" must have no value');
    // The comparison template would have produced `must not be "undefined"`.
    expect(refused.reason).not.toContain('undefined');
  });

  it('takes a served refusal at its word, and the most serious message is the reason', () => {
    const refused = getAllowedValueAvailability(
      {
        disabled: true,
        messages: [
          { intent: 'info', content: 'Stores objects under /var/opt/qorus.' },
          { intent: 'danger', content: 'This sandbox denies the FILESYSTEM domain.' },
        ],
      },
      form({})
    );

    expect(refused.available).toBe(false);
    expect(refused.reason).toBe('This sandbox denies the FILESYSTEM domain.');
    expect(refused.intent).toBe('danger');
  });

  it('honours when/unless on a served refusal, so a reason can itself be conditional', () => {
    const value = {
      disabled: true,
      messages: [
        { intent: 'warning' as const, content: 'No datasource is selected.', when: ['!kind'] },
        { intent: 'warning' as const, content: 'That kind has no coverage.', when: ['kind'] },
      ],
    };

    expect(getAllowedValueAvailability(value, form({}), SCHEMA).reason).toBe(
      'No datasource is selected.'
    );
    expect(getAllowedValueAvailability(value, form({ kind: 'job' }), SCHEMA).reason).toBe(
      'That kind has no coverage.'
    );
  });

  it('still says something when a refusal came with no words at all', () => {
    // Silence over a value that will not respond is the defect this exists to remove.
    const refused = getAllowedValueAvailability({ disabled: true }, form({}));
    expect(refused.available).toBe(false);
    expect(refused.reason).toBeTruthy();
  });

  it('prefers the predicate, which names a field the reader can act on', () => {
    const refused = getAllowedValueAvailability(
      {
        depends_on: ['kind=workflow'],
        disabled: true,
        messages: [{ content: 'Not available on this instance.' }],
      },
      form({ kind: 'service' }),
      SCHEMA
    );

    expect(refused.reason).toContain('"Interface Kind" must be "workflow"');
  });

  it('judges no predicate at all when there is no form around the picker', () => {
    // A standalone picker has no siblings. Locking every gated value there would
    // be a rendering fault, not a fact about a form.
    expect(getAllowedValueAvailability({ depends_on: ['kind=workflow'] }).available).toBe(true);
    // A served refusal still stands: it never depended on siblings.
    expect(getAllowedValueAvailability({ disabled: true }).available).toBe(false);
  });

  it('leaves a value that gates on nothing alone', () => {
    expect(getAllowedValueAvailability({}, form({ kind: 'service' }), SCHEMA).available).toBe(true);
  });
});

describe('what a picker pays for one gated value', () => {
  it('resolves the gated values and hands back the shared constant for the rest', () => {
    const { result } = renderHook(
      () =>
        useAllowedValueAvailability([
          { depends_on: ['kind=workflow'] },
          {},
          { disabled: true, messages: [{ content: 'Not on this instance.' }] },
          {},
        ]),
      {
        wrapper: ({ children }) => (
          <OptionsContext.Provider value={{ schema: SCHEMA, value: form({ kind: 'service' }) }}>
            {children}
          </OptionsContext.Provider>
        ),
      }
    );

    expect(result.current[0].available).toBe(false);
    expect(result.current[2].reason).toBe('Not on this instance.');

    /* Identity, not equality. The gate used to be ONE flag for the whole
       field, so a single gated value resolved every value beside it and
       serialised the lot — a thousand of them in a big picker, on every
       keystroke anywhere in the form. An ungated position now costs the frozen
       constant and nothing else, which is what "skips the computation" means
       where it can be measured. */
    expect(result.current[1]).toBe(ALLOWED_VALUE_AVAILABLE);
    expect(result.current[3]).toBe(ALLOWED_VALUE_AVAILABLE);
  });

  it('judges nothing at all when no value gates on anything', () => {
    const { result } = renderHook(() => useAllowedValueAvailability([{}, {}]), {
      wrapper: ({ children }) => (
        <OptionsContext.Provider value={{ schema: SCHEMA, value: form({ kind: 'service' }) }}>
          {children}
        </OptionsContext.Provider>
      ),
    });

    expect(result.current).toHaveLength(2);
    result.current.forEach((entry) => expect(entry).toBe(ALLOWED_VALUE_AVAILABLE));
  });
});

const Explanation = ({ explanation }: { explanation?: string }) => (
  <em data-testid='explanation'>{explanation}</em>
);

const Control = () => (
  <button type='button' data-testid='control'>
    ?
  </button>
);

const REASON = 'Only a workflow keeps a step history to assert against.';

const ITEMS: ISelectFieldCollectionItem[] = [
  {
    value: 'step_result',
    display_name: 'Step: result',
    short_desc: 'Passes when the named step reported this result.',
    disabled: true,
    unavailable: { content: REASON, intent: 'warning' },
  },
  {
    value: 'value_equals',
    display_name: 'Value: equals',
    short_desc: 'Passes when the value is exactly equal.',
  },
];

const renderCollection = (
  items: ISelectFieldCollectionItem[],
  onItemSelect = vi.fn(),
  onClose = vi.fn()
) => {
  render(
    <ReqoreUIProvider>
      <SelectFieldCollection items={items} onClose={onClose} onItemSelect={onItemSelect} />
    </ReqoreUIProvider>
  );
  return { onItemSelect, onClose };
};

const rowFor = async (label: string): Promise<HTMLElement> =>
  waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('.reqore-collection-item')].find(
      (item) => item.querySelector('.reqore-panel-title')?.textContent?.includes(label)
    );
    expect(found, `no row labelled ${label}`).toBeTruthy();
    return found as HTMLElement;
  });

describe('the picker row a value cannot be chosen from', () => {
  it('refuses the click while the available row beside it still takes one', async () => {
    const { onItemSelect, onClose } = renderCollection(ITEMS);

    fireEvent.click(await rowFor('Step: result'));
    expect(onItemSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(await rowFor('Value: equals'));
    expect(onItemSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps every pointer event, which is what the reason is read through', async () => {
    renderCollection([{ ...ITEMS[0], title_actions: [{ as: Control }] }, ITEMS[1]]);

    const row = await rowFor('Step: result');
    // `DisabledElement` would have made this `none`, and taken the tooltip and
    // the control in the title bar with it.
    expect(getComputedStyle(row).pointerEvents).toBe('auto');
    expect(getComputedStyle(within(row).getByTestId('control')).pointerEvents).toBe('auto');

    // What replaces it: the cursor says the row will not respond, and it says
    // so only because the row was given no handler — reqore derives
    // `interactive` from the handlers a panel has, which is why the row beside
    // it still offers a pointer.
    expect(getComputedStyle(row).cursor).toBe('not-allowed');
    expect(getComputedStyle(await rowFor('Value: equals')).cursor).toBe('pointer');
  });

  it('reads the reason before the description, not under it', async () => {
    renderCollection(ITEMS);

    const row = await rowFor('Step: result');
    const body = row.querySelector(':scope > .reqore-panel-content') as HTMLElement;
    const text = body.textContent || '';

    expect(text).toContain(REASON);
    expect(text).toContain('Passes when the named step');
    // A `messages` entry renders under the description; the reason a reader has
    // just been refused with cannot wait its turn behind it.
    expect(text.indexOf(REASON)).toBeLessThan(text.indexOf('Passes when the named step'));
  });

  it('dims the name it will not accept, and leaves the reason at full strength', async () => {
    renderCollection(ITEMS);

    const refused = await rowFor('Step: result');
    expect(refused.className).toContain(UNAVAILABLE_ITEM_CLASS);
    /* Measured, not asserted on the class: the item mapping did not forward
       `className` at all before this, so the rule had nothing to land on. And
       the dimming is on the TITLE — `opacity` creates a stacking context, so
       dimming the row would dim the reason inside it. */
    expect(
      getComputedStyle(refused.querySelector(':scope > .reqore-panel-title') as HTMLElement).opacity
    ).toBe('0.55');

    const offered = await rowFor('Value: equals');
    expect(offered.className).not.toContain(UNAVAILABLE_ITEM_CLASS);
    expect(
      getComputedStyle(offered.querySelector(':scope > .reqore-panel-title') as HTMLElement).opacity
    ).not.toBe('0.55');
  });

  it('opens the reason from a hover anywhere on the row', async () => {
    renderCollection(ITEMS);

    fireEvent.mouseEnter(await rowFor('Step: result'));
    await waitFor(() => expect(screen.getByText(REASON)).toBeTruthy());
  });

  it('leaves a tooltip the caller declared alone', async () => {
    renderCollection([
      {
        ...ITEMS[0],
        tooltip: {
          handler: 'hover',
          delay: 0,
          content: { as: Explanation, props: { explanation: 'The kind, explained.' } },
        },
      },
    ]);

    fireEvent.mouseEnter(await rowFor('Step: result'));
    const rendered = await screen.findByTestId('explanation');
    expect(rendered.textContent).toBe('The kind, explained.');
  });

  it('finds the row by a word from the reason', async () => {
    renderCollection(ITEMS);
    await rowFor('Step: result');

    // Reqore searches a row's label and the STRING of its content — which is a
    // React element here, so every row matched `[object Object]` equally and a
    // reason was findable by nobody.
    const search = document.querySelector('.reqore-collection input') as HTMLInputElement;
    expect(search).toBeTruthy();
    fireEvent.change(search, { target: { value: 'step history' } });

    await waitFor(() =>
      expect(document.querySelectorAll('.reqore-collection-item')).toHaveLength(1)
    );
    expect(document.querySelector('.reqore-collection-item')?.textContent).toContain(
      'Step: result'
    );
  });

  it('promotes a served refusal out of its messages, and does not print it twice', async () => {
    renderCollection([
      {
        value: 'file',
        display_name: 'Local Filesystem',
        disabled: true,
        messages: [{ intent: 'danger', content: 'This sandbox denies the FILESYSTEM domain.' }],
      },
    ]);

    const row = await rowFor('Local Filesystem');
    const printed = (row.textContent || '').split('This sandbox denies the FILESYSTEM domain.');
    expect(printed).toHaveLength(2);
  });
});

const CHECKBOX_REASON = 'Coverage needs a datasource to read from.';

describe('the checkbox group a short list renders as', () => {
  it('refuses the value and says why in the row, not only on a hover', async () => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FieldAllowedValues
          type='string'
          name='kind'
          value={undefined}
          onChange={onChange}
          items={[
            {
              display_name: 'Coverage',
              value: { type: 'string', value: 'coverage' },
              disabled: true,
              messages: [{ intent: 'warning', content: CHECKBOX_REASON }],
            },
            { display_name: 'Value', value: { type: 'string', value: 'value' } },
          ]}
        />
      </ReqoreUIProvider>
    );

    const name = await screen.findByText('Coverage');
    const refused = name.closest('.reqore-checkbox') as HTMLElement;
    expect(refused).toBeTruthy();
    // A hover is the one affordance a touch screen and a keyboard never reach.
    expect(refused.textContent).toContain(CHECKBOX_REASON);
    // `DisabledElement` is what the item's `disabled` used to apply here — the
    // one path in the picker family that destroyed its own explanation.
    expect(getComputedStyle(refused).pointerEvents).toBe('auto');
    expect(getComputedStyle(refused).cursor).toBe('not-allowed');

    /* Measured, because the dimming was passed as `effect` and a non-switch
       ReqoreCheckbox destructures `effect` out and never applies it: the row
       got the padlock and the cursor and no dimming at all, and nothing here
       noticed. It is `labelEffect` that lands, and it lands on the NAME. */
    expect(getComputedStyle(name).opacity).toBe('0.55');
    const explanation = refused.querySelector('.reqore-checkbox-description') as HTMLElement;
    expect(explanation.textContent).toContain(CHECKBOX_REASON);
    // The reason is the one thing in the row that has to stay readable, which
    // is why the row itself is never what gets dimmed.
    expect(getComputedStyle(explanation).opacity).not.toBe('0.55');

    fireEvent.click(refused);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click((await screen.findByText('Value')).closest('.reqore-checkbox') as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('kind', 'value');
  });

  it('refuses a value whose dependency is unmet, against the form it stands in', async () => {
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <OptionsContext.Provider value={{ schema: SCHEMA, value: form({ kind: 'service' }) }}>
          <FieldAllowedValues
            type='string'
            name='assertion'
            value={undefined}
            onChange={onChange}
            items={
              [
                {
                  display_name: 'Step: result',
                  value: { type: 'string', value: 'step_result' },
                  /* `depends_on` on a VALUE — declared locally in reqraft until
                     ts-toolkit 0.5.83 publishes it (see `IReqraftAllowedValue`),
                     which is why this list is cast. */
                  depends_on: ['kind=workflow'],
                },
                { display_name: 'Value', value: { type: 'string', value: 'value' } },
              ] as never
            }
          />
        </OptionsContext.Provider>
      </ReqoreUIProvider>
    );

    const refused = (await screen.findByText('Step: result')).closest(
      '.reqore-checkbox'
    ) as HTMLElement;
    expect(refused.textContent).toContain('"Interface Kind" must be "workflow"');

    fireEvent.click(refused);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("reqraft's own FormField picker", () => {
  it('dims the name of a value it will not accept, and not the reason', async () => {
    // Three or fewer values, so `FormField` renders its OWN checkbox group
    // rather than delegating to `FieldAllowedValues` — the same defect lived
    // in both, and each had to be fixed where it stood.
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <FormField
          type='string'
          name='kind'
          value={undefined}
          onChange={onChange}
          allowed_values={
            [
              {
                display_name: 'Coverage',
                value: { type: 'string', value: 'coverage' },
                disabled: true,
                messages: [{ intent: 'warning', content: CHECKBOX_REASON }],
              },
              { display_name: 'Value', value: { type: 'string', value: 'value' } },
            ] as never
          }
        />
      </ReqoreUIProvider>
    );

    const name = await screen.findByText('Coverage');
    const refused = name.closest('.reqore-checkbox') as HTMLElement;
    expect(getComputedStyle(name).opacity).toBe('0.55');
    expect(getComputedStyle(refused).pointerEvents).toBe('auto');
    expect(getComputedStyle(refused).cursor).toBe('not-allowed');

    const explanation = refused.querySelector('.reqore-checkbox-description') as HTMLElement;
    expect(explanation.textContent).toContain(CHECKBOX_REASON);
    expect(getComputedStyle(explanation).opacity).not.toBe('0.55');

    fireEvent.click(refused);
    expect(onChange).not.toHaveBeenCalled();
  });


  it('forwards the row affordances its whitelist used to drop', async () => {
    render(
      <ReqoreUIProvider>
        <FormField
          type='string'
          name='kind'
          value={undefined}
          onChange={vi.fn()}
          fieldProps={{ forceDropdown: false }}
          allowed_values={
            [
              {
                display_name: 'Coverage',
                short_desc: 'Passes when the process you name ran code.',
                value: { type: 'string', value: 'coverage' },
                title_actions: [{ as: Control }],
                tooltip: {
                  handler: 'hover',
                  delay: 0,
                  content: { as: Explanation, props: { explanation: 'What coverage means.' } },
                },
              },
              { display_name: 'Value', value: { type: 'string', value: 'value' } },
              { display_name: 'Step', value: { type: 'string', value: 'step' } },
              { display_name: 'Log', value: { type: 'string', value: 'log' } },
            ] as never
          }
        />
      </ReqoreUIProvider>
    );

    // >3 values and no forced dropdown, so the picker opens the collection.
    fireEvent.click((await screen.findAllByText('Please select'))[0]);
    const row = await rowFor('Coverage');

    // Both used to be dropped by an eleven-key whitelist, which is why the IDE
    // had to hand its items straight to the select and bypass this renderer.
    expect(within(row).getByTestId('control')).toBeTruthy();
    fireEvent.mouseEnter(row);
    await waitFor(() => expect(screen.getByTestId('explanation')).toBeTruthy());
  });
});

const GATED_SCHEMA = {
  kind: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Interface Kind',
    required: true,
  },
  assertion: {
    type: 'select-string',
    ui_type: 'select-string',
    display_name: 'Assertion',
    required: true,
    supports_custom_values: false,
    allowed_values: [
      {
        display_name: 'Step: result',
        value: { type: 'string', value: 'step_result' },
        depends_on: ['kind=workflow'],
      },
      { display_name: 'Value: equals', value: { type: 'string', value: 'value_equals' } },
    ],
  },
} as never;

const renderEngine = (value: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='assertion'
          value={value}
          options={GATED_SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a form whose choice opens up', () => {
  it('flashes the field that offers a value which has just become available', async () => {
    const { container, rerender } = renderEngine(form({ kind: 'service' }));

    await waitFor(() => expect(container.querySelector('[data-field="assertion"]')).toBeTruthy());
    expect(container.querySelector('[data-field="assertion"]')?.className).not.toContain(
      'readfirst-row-flash'
    );

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='assertion'
            value={form({ kind: 'workflow' })}
            options={GATED_SCHEMA}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    // A choice that opens up inside a control the reader may not have open is
    // as invisible as a field that becomes editable, so the field says so.
    await waitFor(() =>
      expect(container.querySelector('[data-field="assertion"]')?.className).toContain(
        'readfirst-row-flash'
      )
    );
  });

  it('stays quiet when the answer changes without opening anything', async () => {
    // The control that pins the flash above on the value, not on the form
    // having changed at all: `service` and `job` both leave the value locked.
    const { container, rerender } = renderEngine(form({ kind: 'service' }));

    await waitFor(() => expect(container.querySelector('[data-field="assertion"]')).toBeTruthy());

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='assertion'
            value={form({ kind: 'job' })}
            options={GATED_SCHEMA}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() =>
      expect(container.querySelector('[data-field="kind"]')?.textContent).toContain('job')
    );
    expect(container.querySelector('[data-field="assertion"]')?.className).not.toContain(
      'readfirst-row-flash'
    );
  });
});
