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
import { templateItemsToShow } from '../src/components/form/fields/template/TemplateField';

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
