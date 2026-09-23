import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UNAVAILABLE_ITEM_CLASS } from '../src/components/form/fields/select/SelectCollection';

/**
 * The three picker paths that still handed a refused value to reqore's
 * `disabled`.
 *
 * `DisabledElement` is `pointer-events: none`, so a row marked with it cannot
 * be hovered — and the hover is where the whole reason fits. Two of these
 * paths do not own a per-row handler, because reqore's own select owns the
 * selection; there the row is marked and the refusal lands in the one handler
 * this code DOES own, which is the same rule stated in the one place it can
 * be. `design/UNAVAILABLE_ALLOWED_VALUES.md` records which is which.
 *
 * The lists reqore is given are read where they are HANDED OVER rather than
 * out of an open popover: reqore positions its dropdown through a portal that
 * jsdom never opens, so a test that clicked to open it would assert nothing.
 * The menu below is not a popover, so that one is read from the DOM.
 */
let selectProps: any;
let multiSelectProps: any;

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreSelect: (props: any) => {
      selectProps = props;
      return <div data-testid='select' />;
    },
    ReqoreMultiSelect: (props: any) => {
      multiSelectProps = props;
      return <div data-testid='multi-select' />;
    },
  };
});

const { SelectFormField } = await import('../src/components/form/fields/select/Select');
const { MultiSelectFormField } = await import(
  '../src/components/form/fields/multi-select/MultiSelectFormField'
);

const REASON = 'This sandbox denies the FILESYSTEM domain.';

const REFUSED = {
  value: 'file',
  display_name: 'Local Filesystem',
  short_desc: 'Stores objects under /var/opt/qorus.',
  disabled: true,
  messages: [{ intent: 'danger' as const, content: REASON }],
};

const OFFERED = {
  value: 'db',
  display_name: 'Database',
  short_desc: 'Stores objects in the system schema.',
};

describe('the creatable chip picker', () => {
  const renderCreatable = (onChange = vi.fn()) => {
    render(
      <ReqoreUIProvider>
        <SelectFormField canCreateItems items={[REFUSED, OFFERED] as never} onChange={onChange} />
      </ReqoreUIProvider>
    );
    return onChange;
  };

  it('marks the refused row without deadening it, and says why', async () => {
    renderCreatable();
    await waitFor(() => expect(selectProps?.items).toBeTruthy());

    const refused = selectProps.items.find((item: any) => item.label === 'Local Filesystem');
    // `disabled` is what this used to pass, and it would have taken the
    // tooltip — the only place the whole reason fits — with it.
    expect(refused.disabled).toBeUndefined();
    expect(refused.readOnly).toBe(true);
    expect(refused.tooltip).toBe(REASON);
    expect(refused.icon).toBe('LockLine');
    expect(refused.effect).toEqual({ opacity: 0.55 });
    // The reason LEADS: a reader who has just been refused a choice is looking
    // for why, not for what the value would have done.
    expect(refused.description).toContain(REASON);
    expect(refused.description.indexOf('sandbox')).toBeLessThan(
      refused.description.indexOf('/var/opt/qorus')
    );

    const offered = selectProps.items.find((item: any) => item.label === 'Database');
    expect(offered.readOnly).toBe(false);
    expect(offered.effect).toBeUndefined();
    expect(offered.description).toBe('Stores objects in the system schema.');
  });

  it('refuses the value however it was reached, and still takes the one beside it', async () => {
    const onChange = renderCreatable();
    await waitFor(() => expect(selectProps?.onValueChange).toBeTruthy());

    // Reqore owns this list's selection, so the row cannot withhold a handler
    // of its own against the reqore we pin — this is where the refusal lands.
    selectProps.onValueChange('file');
    expect(onChange).not.toHaveBeenCalled();

    // Typing the same text into a creatable field is the same value by another
    // route, and is refused as the same value.
    selectProps.onValueChange('db');
    expect(onChange).toHaveBeenCalledWith('db');

    // Clearing is the author's own act and is never refused.
    selectProps.onValueChange(undefined);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe('the menu a picker renders inline', () => {
  const renderMenu = (onChange = vi.fn()) => {
    render(
      <ReqoreUIProvider>
        <SelectFormField asMenu items={[REFUSED, OFFERED] as never} onChange={onChange} />
      </ReqoreUIProvider>
    );
    return onChange;
  };

  /* By class, not by text: reqore's button prints its label in three nested
     spans to animate it, so a text query matches all three. */
  const rowFor = async (label: string): Promise<HTMLElement> =>
    waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('.reqore-menu-item')].find((row) =>
        row.textContent?.includes(label)
      );
      expect(found, `no menu row labelled ${label}`).toBeTruthy();
      return found as HTMLElement;
    });

  it('prints the reason in the row and takes no click, while the row beside it does', async () => {
    const onChange = renderMenu();

    const refused = await rowFor('Local Filesystem');
    expect(refused.className).toContain(UNAVAILABLE_ITEM_CLASS);
    // A hover is the one affordance a touch screen and a keyboard never reach,
    // so the reason is IN the row as well, and it leads.
    expect(refused.textContent).toContain(REASON);
    expect(refused.textContent!.indexOf('sandbox')).toBeLessThan(
      refused.textContent!.indexOf('/var/opt/qorus')
    );
    // `DisabledElement` would have made this `none`, and taken the tooltip and
    // every other pointer affordance with it.
    expect(getComputedStyle(refused).pointerEvents).not.toBe('none');
    // What replaces it: the cursor says the row will not respond, and it says
    // so through reqore's own `readOnly` rather than a hand-rolled style.
    expect(getComputedStyle(refused).cursor).toBe('not-allowed');

    fireEvent.click(refused);
    expect(onChange).not.toHaveBeenCalled();

    const offered = await rowFor('Database');
    expect(offered.className).not.toContain(UNAVAILABLE_ITEM_CLASS);
    fireEvent.click(offered);
    expect(onChange).toHaveBeenCalledWith('db');
  });
});

describe('the multi-select', () => {
  const renderMulti = (value: unknown[], onChange = vi.fn()) => {
    render(
      <ReqoreUIProvider>
        <MultiSelectFormField
          items={
            [
              { display_name: 'Local Filesystem', value: { type: 'string', value: 'file' }, disabled: true, messages: [{ intent: 'danger', content: REASON }] },
              { display_name: 'Database', value: { type: 'string', value: 'db' } },
            ] as never
          }
          value={value}
          onChange={onChange}
        />
      </ReqoreUIProvider>
    );
    return onChange;
  };

  it('marks the refused item without deadening it', async () => {
    renderMulti([]);
    await waitFor(() => expect(multiSelectProps?.items).toBeTruthy());

    const refused = multiSelectProps.items.find((item: any) => item.value === 'file');
    expect(refused.disabled).toBe(false);
    expect(refused.readOnly).toBe(true);
    expect(refused.tooltip).toBe(REASON);
    expect(refused.icon).toBe('LockLine');
    expect(refused.description).toContain(REASON);

    const offered = multiSelectProps.items.find((item: any) => item.value === 'db');
    expect(offered.readOnly).toBe(false);
    expect(offered.tooltip).toBeUndefined();
  });

  it('will not add a refused value, and never takes back one the author already gave', async () => {
    const onChange = renderMulti([]);
    await waitFor(() => expect(multiSelectProps?.onValueChange).toBeTruthy());

    multiSelectProps.onValueChange(['file']);
    expect(onChange).toHaveBeenCalledWith([]);

    multiSelectProps.onValueChange(['db']);
    expect(onChange).toHaveBeenLastCalledWith(['db']);
  });

  it('keeps a held value that has since been refused', async () => {
    // Clearing an answer the author gave, because a sibling edit closed the
    // value, is worse than holding one the form can no longer offer.
    const onChange = renderMulti(['file']);
    await waitFor(() => expect(multiSelectProps?.onValueChange).toBeTruthy());

    multiSelectProps.onValueChange(['file', 'db']);
    expect(onChange).toHaveBeenCalledWith(['file', 'db']);
  });

  it('still collapses the selection to the wildcard', async () => {
    const onChange = renderMulti([]);
    await waitFor(() => expect(multiSelectProps?.onValueChange).toBeTruthy());

    multiSelectProps.onValueChange(['db', '*']);
    expect(onChange).toHaveBeenCalledWith(['*']);
  });

  it('refuses the wildcard itself when the wildcard is what was refused', async () => {
    // The refusal is applied BEFORE the collapse, or the one value that
    // overrides every other would be the one value nothing could refuse.
    const onChange = vi.fn();
    render(
      <ReqoreUIProvider>
        <MultiSelectFormField
          items={
            [
              {
                display_name: 'Everything',
                value: { type: 'string', value: '*' },
                disabled: true,
                messages: [{ intent: 'danger', content: 'This role may not grant every right.' }],
              },
              { display_name: 'Database', value: { type: 'string', value: 'db' } },
            ] as never
          }
          value={[]}
          onChange={onChange}
        />
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(multiSelectProps?.onValueChange).toBeTruthy());

    multiSelectProps.onValueChange(['db', '*']);
    expect(onChange).toHaveBeenCalledWith(['db']);
  });
});
