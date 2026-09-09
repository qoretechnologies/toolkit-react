/**
 * A lone category is opened wherever this control's templates are READ.
 *
 * The rule existed, applied per picker, so each new picker had to remember it —
 * and the one a Qorus assertion's Expected Value uses did not. The author
 * opened the list, saw a single row naming the only category on offer, and had
 * to click through it to reach the only values on offer, with a back arrow as
 * the only other thing there.
 *
 * Asserted on what the field hands DOWN, because that is where the rule now
 * lives: every picker this control offers — the "Select Template" dropdown, the
 * in-editor `$` list, the numeric focus dropdown, the expression builder's
 * argument picker — reads the same resolved list.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const VALUES = [
  { value: '$.result', label: 'result' },
  { value: '$._case.mode', label: 'mode (this case)' },
];

/** The shape a Qorus assertion's Value field is given. */
const ONE_CATEGORY = { items: [{ label: 'Values this case captures', items: VALUES }] };

const TWO_CATEGORIES = {
  items: [
    { label: 'Values this case captures', items: VALUES },
    { label: 'Config', items: [{ value: '$config:key', label: 'key' }] },
  ],
};

/** Captures what the field hands its rendered editor. */
let seen: any;
const HostEditor = (props: any) => {
  seen = props;
  return <div data-testid='host-editor' />;
};

const renderField = (templates: unknown) => {
  seen = undefined;
  return render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <TemplateField
          name='value'
          allowTemplates
          templates={templates as never}
          filterTemplatesByType={false}
          onChange={vi.fn()}
          component={HostEditor as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('the templates this control resolves', () => {
  it('opens a lone category onto its values', () => {
    renderField(ONE_CATEGORY);

    // The values themselves, not a row naming the category holding them.
    expect(seen.templates.items).toEqual(VALUES);
  });

  it('keeps two categories grouped, where the headers do real work', () => {
    renderField(TWO_CATEGORIES);

    expect(seen.templates.items).toHaveLength(2);
    expect(seen.templates.items[0].label).toBe('Values this case captures');
  });

  it('says nothing about a field with no templates at all', () => {
    renderField({ items: [] });

    expect(seen.templates.items).toEqual([]);
  });
});
