import { IQorusFormSchema, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';

export const getOptionsFromRequiredGroups = (
  schema: IQorusFormSchema,
  groups: string[],
  currentOption?: string
): string[] => {
  return Object.keys(schema)
    .filter((option) => {
      return (schema[option] as TQorusFormFieldSchema).required_groups?.some((group) =>
        groups.includes(group)
      );
    })
    .filter((option) => option !== currentOption);
};

export const getRequiredOptionMessage = (
  schema: IQorusFormSchema,
  groups: string[],
  currentField: string
): string => {
  if ((schema[currentField] as TQorusFormFieldSchema).required) {
    return 'This field is required';
  }

  const requiredOptions = getOptionsFromRequiredGroups(schema, groups, currentField)
    .map((option) => (schema[option] as TQorusFormFieldSchema).display_name)
    .join(' or ');

  return `This field or ${requiredOptions} is required`;
};

/**
 * The value of one element of a list field.
 *
 * A list element arrives in either of two shapes, and both are legitimate. The
 * editor keeps each element in a `{value, type}` envelope while the form is
 * being worked on — that is what `formatToServerValue` writes — while a value
 * read back from storage holds what the server contract asks for, which for a
 * list of strings is the bare strings.
 *
 * Reaching straight for `.value` answered `undefined` for every stored element.
 * On a read that emptied the row; on a validation pass it failed the element as
 * empty; and on an autosaving form the emptiness was then written back over the
 * stored value. One helper so the readers cannot disagree about which shape
 * they are looking at.
 *
 * An array is never an envelope — a rich-text document is itself an array, and
 * `'value' in []` is false anyway, but saying so keeps the intent legible.
 */
export const getListElementValue = (element: unknown): unknown =>
  element && typeof element === 'object' && !Array.isArray(element) && 'value' in element ?
    (element as { value: unknown }).value
  : element;
