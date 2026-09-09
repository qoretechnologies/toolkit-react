/**
 * Hovering a template chip says what the value IS.
 *
 * Reqore falls back to the tag's own value for a tooltip, so a chip labelled
 * `result` reported `$.result` on hover — the reference the author had just
 * chosen, restating the visible label in engine syntax. The description is what
 * a hover is for.
 *
 * Reported from the live IDE on a test assertion's `Value` field.
 *
 * The description is taken from the templates the field was already given
 * rather than from the chip's metadata, which carries only image / display name
 * / style flags; putting it there would mean threading a description through
 * every producer of a template list.
 */
import { describe, expect, it } from 'vitest';
import { getChipTooltipDescriptions } from '../src/components/form/fields/rich-text/RichText';

const TEMPLATES = {
  items: [
    {
      label: 'Values this case captures',
      items: [
        {
          value: '$.result',
          label: 'result',
          description: 'The value "call the service under test" stored (string)',
        },
        { value: '$.name', label: 'name (this case)', description: 'The name for this case' },
        // no description — nothing to say, so nothing to show
        { value: '$.bare', label: 'bare' },
      ],
    },
  ],
};

describe('template chip tooltips', () => {
  it('maps a template value to its description', () => {
    const map = getChipTooltipDescriptions(TEMPLATES as never);
    expect(map['$.result']).toBe('The value "call the service under test" stored (string)');
  });

  it('covers every described item in the group', () => {
    const map = getChipTooltipDescriptions(TEMPLATES as never);
    expect(map['$.name']).toBe('The name for this case');
  });

  it('omits an item with no description rather than inventing one', () => {
    const map = getChipTooltipDescriptions(TEMPLATES as never);
    expect(map['$.bare']).toBeUndefined();
  });

  it('reads a value carried as a typed object', () => {
    // Some producers emit `value: { type, value }` rather than a bare string.
    const map = getChipTooltipDescriptions({
      items: [
        {
          label: 'g',
          items: [{ value: { type: 'string', value: '$.typed' }, description: 'Typed one' }],
        },
      ],
    } as never);
    expect(map['$.typed']).toBe('Typed one');
  });

  /* The shape a field with ONE category hands down. `templateItemsToShow` opens
     a lone category onto its values where the templates are resolved, so this
     is not an edge case — it is what the common field looks like by the time
     the editor sees it, and reading only the grouped shape lost every tooltip
     on exactly those fields. */
  it('reads a flat list, which is what a lone category resolves to', () => {
    const map = getChipTooltipDescriptions({
      items: TEMPLATES.items[0].items,
    } as never);

    expect(map['$.result']).toBe('The value "call the service under test" stored (string)');
    expect(map['$.name']).toBe('The name for this case');
    expect(map['$.bare']).toBeUndefined();
  });

  it('reads a mixed list, where one category was hoisted and others were not', () => {
    const map = getChipTooltipDescriptions({
      items: [
        { value: '$.loose', description: 'A hoisted leaf' },
        { label: 'g', items: [{ value: '$.nested', description: 'Still in a group' }] },
      ],
    } as never);

    expect(map['$.loose']).toBe('A hoisted leaf');
    expect(map['$.nested']).toBe('Still in a group');
  });

  it('survives a list with no items at all', () => {
    expect(getChipTooltipDescriptions(undefined as never)).toEqual({});
    expect(getChipTooltipDescriptions({ items: [] } as never)).toEqual({});
  });
});
