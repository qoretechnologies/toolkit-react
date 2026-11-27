import { expect } from 'storybook/test';

/** The indigo the list fields' add bar was filled with. */
const OLD_ADD_BAR_FILL = 'rgb(34, 39, 59)';

/**
 * A list field's add control is an ordinary action: a button as wide as its words, one leading +,
 * the theme's own button surface. It was a bar across the whole field filled in indigo, with a +
 * at each end, which read as a status (blue means a filter is on) rather than as "add one".
 */
export const expectAPlainAddButton = async (field: Element) => {
  const buttons = field.querySelectorAll<HTMLElement>('.array-auto-add');
  await expect(buttons.length, 'one add button').toBe(1);
  const [button] = buttons;

  await expect(button.querySelectorAll('.reqore-icon').length, 'one + on the add button').toBe(1);
  await expect(
    getComputedStyle(button).backgroundColor,
    'the add button is the ordinary button, not the indigo bar'
  ).not.toBe(OLD_ADD_BAR_FILL);
  await expect(
    button.getBoundingClientRect().width,
    'the add button is as wide as its words, not the field'
  ).toBeLessThan(field.getBoundingClientRect().width * 0.75);
  await expect(
    button.getBoundingClientRect().left - field.getBoundingClientRect().left,
    'the add button starts where the field starts'
  ).toBeLessThan(2);
};
