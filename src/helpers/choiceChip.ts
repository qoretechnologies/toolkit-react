// Copyright 2026 Qore Technologies, s.r.o.
import { IQorusAllowedValue, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { findAllowedValueOption } from './allowedValues';
import { getListElementValue } from './options';

/**
 * A value that IS one of the field's own choices, drawn as that choice.
 *
 * A rich-text field offered choices picks one by writing its value, so an
 * author who chose the Slack channel "general" read `C07ERBFS0P6` in the
 * editor. The value is right — it is what the server resolves — but it is not
 * what was chosen by. These helpers draw such a value as one chip named from
 * the choice, the way a template reference is drawn from the catalogue, while
 * what is stored stays the plain value: the chip's own `value` is the choice's,
 * so the text a document stands for is unchanged, and a document that is
 * nothing but the chip is read back as the value it draws.
 */

/** The marker a choice chip carries, so it is told apart from a template reference. */
export const CHOICE_CHIP_META = 'allowedValue';

export interface IChoiceChipNode {
  type: 'tag';
  value: string;
  label: string;
  metadata: { [CHOICE_CHIP_META]: true; description?: string };
  children: [{ text: '' }];
}

/**
 * The choice a value is, when the value is a whole plain string the field
 * offers. A document, or a string holding more than the choice, is the
 * author's own text and is never a choice.
 */
export const choiceForValue = (
  value: unknown,
  choices?: IQorusAllowedValue[]
): IQorusAllowedValue | undefined => {
  if (typeof value !== 'string' || !value || !choices?.length) {
    return undefined;
  }

  return findAllowedValueOption(value, { allowed_values: choices } as TQorusFormFieldSchema) as
    | IQorusAllowedValue
    | undefined;
};

/** The one-chip document that draws a choice by its name. */
export const choiceToNodes = (
  choice: IQorusAllowedValue
): { type: 'paragraph'; children: ({ text: string } | IChoiceChipNode)[] }[] => {
  // The choice's value arrives in the form engine's `{type, value}` envelope.
  const value = String(getListElementValue(choice.value) ?? '');
  const description = (choice as { desc?: string; short_desc?: string }).short_desc ?? choice.desc;

  return [
    {
      type: 'paragraph',
      children: [
        { text: '' },
        {
          type: 'tag',
          value,
          label: choice.display_name ?? value,
          metadata: { [CHOICE_CHIP_META]: true, ...(description ? { description } : {}) },
          children: [{ text: '' }],
        },
        { text: '' },
      ],
    },
  ];
};

const isChoiceChip = (node: unknown): node is IChoiceChipNode =>
  !!node &&
  typeof node === 'object' &&
  (node as { type?: unknown }).type === 'tag' &&
  !!(node as { metadata?: Record<string, unknown> }).metadata?.[CHOICE_CHIP_META];

/**
 * The value a document is, when the document is one choice chip and nothing
 * else; `undefined` when the author has written anything around it, in which
 * case the document itself is the value.
 */
export const choiceValueOfNodes = (nodes: unknown): string | undefined => {
  if (!Array.isArray(nodes) || nodes.length !== 1) {
    return undefined;
  }

  const children: unknown[] = (nodes[0] as { children?: unknown[] })?.children ?? [];
  const chips = children.filter(isChoiceChip);
  const text = children
    .filter((node) => !isChoiceChip(node))
    .map((node) => (typeof (node as { text?: unknown })?.text === 'string' ? (node as { text: string }).text : '\u0000'))
    .join('');

  return chips.length === 1 && text === '' ? chips[0].value : undefined;
};
