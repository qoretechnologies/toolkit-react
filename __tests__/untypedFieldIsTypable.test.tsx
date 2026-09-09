import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

/**
 * An empty UNTYPED field opens on something you can type into.
 *
 * Reported against a Qorus assertion's Expected Value: "I get the template
 * picker instead of the text entry control with a template picker, which is
 * what's supposed to be used in this and every other case."
 *
 * It was never about that field. An untyped field that accepts templates opens
 * in template mode on purpose — picking a reference is what most authors want
 * there, and it beats asking "is this a Text or a Number?" about a value whose
 * type is not theirs to choose. The defect was that template mode only had a
 * typable editor for `type: 'string'`, so an `any`/`auto` field fell through to
 * the pick-only dropdown and a literal could only be reached through the ⋮
 * menu.
 */
const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const TEMPLATES = {
  items: [
    {
      label: 'Values this case captures',
      items: [{ value: '$.result', label: 'result' }],
    },
  ],
};

const renderField = (type: string, value?: unknown) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <TemplateField
          name='expected'
          type={type as never}
          value={value as never}
          allowTemplates
          allowCustomValues
          templates={TEMPLATES as never}
          filterTemplatesByType={false}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/* The pick-only control: a button that can choose from a list and nothing
   else. Matched with `queryAll` because Reqore renders a button's label twice
   (an active and an inactive span for its animation), and the single-match
   query THROWS on that rather than reporting the control is there. */
const hasPickOnlyDropdown = () => screen.queryAllByText('Select Template').length > 0;
/** Anything that takes a keystroke. */
const typableControl = () => document.querySelector('textarea, input:not([type="checkbox"])');

describe('an empty untyped field with templates on offer', () => {
  it.each(['auto', 'any'])('gives %s a control that can be typed into', (type) => {
    renderField(type);

    expect(typableControl()).toBeTruthy();
    expect(hasPickOnlyDropdown()).toBe(false);
  });

  it('still offers the templates — typing is added, not swapped in', () => {
    renderField('auto');

    // The editor carries the same list; it shows it on focus rather than
    // being the list.
    expect(document.querySelector('.template-selector')).toBeTruthy();
  });
});

describe('what this must not change', () => {
  it('keeps the picker where picking is the ONLY option', () => {
    /* The guard that matters for this change: template mode gets a typable
       editor because the field CAN hold arbitrary text. A field that may not
       hold a custom value still has nothing to type into, and taking its
       picker away would leave it with no control at all. */
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <TemplateField
            name='expected'
            type={'auto' as never}
            value={undefined as never}
            allowTemplates
            allowCustomValues={false}
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect(hasPickOnlyDropdown()).toBe(true);
  });
});

/* Not asserted here: which concrete editor a TYPED field renders. A bare
   `TemplateField` has no form engine around it to resolve one, so the harness
   shows nothing for `string` whether or not this change is in — a test on it
   would pass for the wrong reason. The typed path is covered where the engine
   is: `templateListOpensLoneCategory` and the FormEngine stories. */
