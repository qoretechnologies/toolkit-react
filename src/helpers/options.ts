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

/**
 * The schema with every one-of group that offers no choice turned back into a
 * plain required field.
 *
 * A `required_groups` group says *"at least one of these"*, and the whole
 * affordance built on it — the ONE OF header, the `Covers` / `Covered by “X”`
 * chips, the *"this field or X is required"* message — exists to tell an author
 * that they have a CHOICE and which way they have answered it. When the group
 * has a single member in the schema in hand, there is no choice: that field
 * must be set, which is exactly what `required` already means. Saying it in the
 * one-of grammar instead is worse than saying nothing, because a green tick
 * beside a value reads as confirmation of the VALUE — a Qorus test author read
 * `✓ COVERS` beside their service as "yes, this is the service your test is
 * about", which the form never said and cannot know.
 *
 * This is not a hypothetical: a server may legitimately declare a group over an
 * API-only alternative it then hides from the form (Qorus test steps put
 * `target` in a group with `service`, and hide `target`), so the form is handed
 * one member of a two-member group. The group is still real for the API and
 * must stay in the schema the server serves; it is only this form that has
 * nothing to offer.
 *
 * The rewrite is exact rather than cosmetic: a one-of over one option and a
 * required option are the same constraint, so validation, the completion meter
 * and the required-only filter all keep saying what they said — in the grammar
 * that fits.
 *
 * A field in a degenerate group is required by that group ALONE, so it is
 * marked required even when it also belongs to a group that does offer a
 * choice; that other group keeps its affordance and is satisfied by this field
 * either way. The key is deleted rather than emptied because `[]` is truthy,
 * and every consumer tests `option.required_groups` for existence.
 *
 * Returns the schema unchanged — the same object — when no group degenerates,
 * so it can sit on a memo without giving every render a new schema identity.
 */
export const resolveDegenerateRequiredGroups = <T extends IQorusFormSchema | undefined>(
  schema: T
): T => {
  if (!schema) return schema;

  const membersPerGroup: Record<string, number> = {};
  Object.values(schema).forEach((option) => {
    (option as TQorusFormFieldSchema)?.required_groups?.forEach((group) => {
      membersPerGroup[group] = (membersPerGroup[group] ?? 0) + 1;
    });
  });

  const degenerate = (group: string): boolean => membersPerGroup[group] < 2;
  if (!Object.keys(membersPerGroup).some(degenerate)) return schema;

  const resolved: IQorusFormSchema = {};
  Object.entries(schema).forEach(([name, option]) => {
    const groups = (option as TQorusFormFieldSchema)?.required_groups;
    if (!groups?.some(degenerate)) {
      resolved[name] = option;
      return;
    }
    const kept = groups.filter((group) => !degenerate(group));
    const rest = { ...(option as TQorusFormFieldSchema) };
    delete rest.required_groups;
    resolved[name] = {
      ...rest,
      required: true,
      ...(kept.length ? { required_groups: kept } : {}),
    } as TQorusFormFieldSchema;
  });
  return resolved as T;
};

/** A note attached to a field or to one of its allowed values. */
export interface ISchemaMessage {
  intent?: string;
  title?: string;
  content?: string;
}

/** The sentence a refusal with no reason of its own falls back to. */
export const UNAVAILABLE_VALUE_FALLBACK_REASON = 'This value is not available';

/**
 * Which of a refused value's messages is the REASON it was refused.
 *
 * A value can carry several notes, and only one of them explains why it cannot
 * be picked. The most serious one does: a `danger` message is what a refusal
 * sounds like, a `warning` is the next thing to it, and an `info` note beside
 * either is a remark about the value rather than about the refusal.
 *
 * Both the form's resolver and the picker that renders a pre-resolved refusal
 * ask this, so the two cannot disagree about which words stand in for a choice.
 */
export const getRefusalMessage = <T extends ISchemaMessage>(messages?: T[]): T | undefined =>
  messages?.find((message) => message.intent === 'danger') ||
  messages?.find((message) => message.intent === 'warning') ||
  messages?.[0];
