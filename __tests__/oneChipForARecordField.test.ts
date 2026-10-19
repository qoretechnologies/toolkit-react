import { describe, expect, it } from 'vitest';
import { getTagLabel } from '../src/components/dpqlEditor/dpqlHelpers';
import { makeDpqlTagRenderer } from '../src/components/dpqlEditor/dpqlTags';
import { recordTemplateOfReference } from '../src/helpers/recordFieldReference';

/**
 * One chip for one record field (qorus#646, David). A field written in DPQL - `@orders[*].id`, as the server writes
 * a record field on the Expression tab - and the template a value holds - `$record:{orders[*].id}`, as the Visual
 * tab draws it - are the same field, and are drawn as the same chip: the template chip's color, icon and label
 * (`record: orders[*].id`, or the catalogue's name for it). The field was a light blue chip with black text,
 * labeled with its path alone. The stories (DpqlEditor · A Record Field Is One Chip, FormEngine · A Record Field Is
 * The Same Chip On Every Tab) compare the two as drawn; these check the props the editor draws them with.
 */
const chipOf = (value: string, options?: Parameters<typeof makeDpqlTagRenderer>[1]) =>
  makeDpqlTagRenderer({}, options)({ type: 'tag', value, children: [{ text: '' }] } as never);

describe('a record field written in DPQL', () => {
  it('is the template it stands for', () => {
    expect(recordTemplateOfReference('@pos')).toBe('$record:{pos}');
    expect(recordTemplateOfReference('@"create.order-id"')).toBe('$record:{create.order-id}');
    expect(recordTemplateOfReference('@orders[*].id')).toBe('$record:{orders[*].id}');
    // only a reference that is the whole text
    expect(recordTemplateOfReference('@pos + 1')).toBeUndefined();
    expect(recordTemplateOfReference('pos')).toBeUndefined();
  });

  it('is drawn as the chip of that template', () => {
    const field = chipOf('@orders[*].id');
    const template = chipOf('$record:{orders[*].id}');

    expect(field).toMatchObject({
      label: 'record: orders[*].id',
      icon: 'ExchangeDollarLine',
      intent: 'info',
    });
    // the same color and icon; the template's chip is labeled by its element, with the label the field's says
    const { tooltip: _fieldTooltip, label: fieldLabel, ...fieldLook } = field;
    const { tooltip: _templateTooltip, ...templateLook } = template;
    expect(fieldLook).toEqual(templateLook);
    expect(fieldLabel).toBe(getTagLabel('$record:{orders[*].id}'));
  });

  it('takes the name the catalogue gives the template', () => {
    const templates = {
      items: [
        {
          label: 'Fields of the row',
          items: [{ label: 'pos', value: '$record:{pos}', badge: 'int' }],
        },
      ],
    };

    expect(chipOf('@pos', { templates } as never).label).toBe('pos');
    expect(chipOf('$record:{pos}', { templates } as never).label).toBe('pos');
  });

  it('has no hover of its own unless the record describes it, so the server’s hover is the one shown', () => {
    const field = chipOf('@orders[*].id');

    expect('tooltip' in field).toBe(true);
    expect(field.tooltip).toBeUndefined();
  });
});
