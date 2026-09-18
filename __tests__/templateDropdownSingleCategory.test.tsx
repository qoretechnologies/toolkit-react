/**
 * A lone template category is opened for the author.
 *
 * The picker groups templates by category, which is what makes a long
 * catalogue scannable. With only ONE category that grouping buys nothing and
 * costs a click: the author opens the picker, sees a single row naming the
 * category, clicks it, and only then sees the values — with a back arrow as
 * the only other thing on offer.
 *
 * Reported against a Qorus test assertion's `Value`, whose only category is
 * "Values this case captures".
 */
import { describe, expect, it } from 'vitest';
import { templateItemsToShow } from '../src/helpers/templateItems';

const VALUES = [
  { label: 'result', value: '$.result' },
  { label: 'name', value: '$.name' },
];

describe('templateItemsToShow', () => {
  it('opens a single category onto its values', () => {
    expect(templateItemsToShow([{ label: 'Values this case captures', items: VALUES }])).toEqual(
      VALUES
    );
  });

  it('keeps two categories grouped', () => {
    // Two categories are a real choice and the headers are what make them
    // scannable — flattening here would lose which value came from where.
    const groups = [
      { label: 'Values this case captures', items: VALUES },
      { label: 'Config', items: [{ label: 'key', value: '$config:key' }] },
    ];
    expect(templateItemsToShow(groups)).toBe(groups);
  });

  it('leaves a single EMPTY category alone rather than showing nothing', () => {
    const groups = [{ label: 'Values this case captures', items: [] }];
    expect(templateItemsToShow(groups)).toBe(groups);
  });

  it('leaves a single item that is not a category alone', () => {
    // A flat list of one template is already what it should show.
    const flat = [{ label: 'result', value: '$.result' }];
    expect(templateItemsToShow(flat)).toBe(flat);
  });

  it('passes undefined and empty through', () => {
    expect(templateItemsToShow(undefined)).toBeUndefined();
    const none: unknown[] = [];
    expect(templateItemsToShow(none)).toBe(none);
  });
});

/**
 * Where the rule is applied, and why it is applied THERE.
 *
 * Every picker this control offers reads the same resolved template list — the
 * "Select Template" dropdown, the in-editor `$` list, the numeric field's focus
 * dropdown, the expression builder's argument picker. Applying the rule per
 * picker meant each new one had to remember; the ones that forgot made the
 * author click through a header naming the only category on offer to reach the
 * only values on offer, which is what was reported against a Qorus assertion's
 * Expected Value.
 */
describe('a lone category, wherever the templates are read', () => {
  const grouped = {
    items: [
      {
        label: 'Values this case captures',
        items: [
          { label: 'result', value: '$.result' },
          { label: 'mode', value: '$._case.mode' },
        ],
      },
    ],
  };

  it('is opened once, on the resolved list every picker shares', () => {
    // The shape `TemplateField` hands down as `componentTemplates`.
    const resolved = { ...grouped, items: templateItemsToShow(grouped.items) };

    expect(resolved.items).toEqual([
      { label: 'result', value: '$.result' },
      { label: 'mode', value: '$._case.mode' },
    ]);
  });

  it('is idempotent, so a picker that applies it again changes nothing', () => {
    // Both pickers still call it for their own sake — one may be used directly,
    // without this field around it.
    const once = templateItemsToShow(grouped.items);
    expect(templateItemsToShow(once)).toBe(once);
  });
});
