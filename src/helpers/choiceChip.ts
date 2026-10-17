// Copyright 2026 Qore Technologies, s.r.o.
import { IQorusAllowedValue, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { Editor, Node, Path, Range, Transforms } from 'slate';
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

/** The choice's value as the plain string it is; it arrives in the form engine's `{type, value}` envelope. */
export const choiceValue = (choice: IQorusAllowedValue): string =>
  String(getListElementValue(choice.value) ?? '');

/**
 * The text a document is, when it is one paragraph of plain text and nothing
 * else; `undefined` for anything more — a chip, a mark, a second paragraph.
 */
export const plainTextOfNodes = (nodes: unknown): string | undefined => {
  if (!Array.isArray(nodes) || nodes.length !== 1) {
    return undefined;
  }

  const paragraph = nodes[0] as { type?: unknown; children?: unknown[] } | undefined;

  if (paragraph?.type !== 'paragraph' || !Array.isArray(paragraph.children)) {
    return undefined;
  }

  let text = '';

  for (const child of paragraph.children as { text?: unknown }[]) {
    if (typeof child?.text !== 'string' || Object.keys(child).some((key) => key !== 'text')) {
      return undefined;
    }
    text += child.text;
  }

  return text;
};

/**
 * The choice a value is: a whole plain string the field offers, or a document
 * that is one paragraph of exactly that text — which is what an edit of the
 * chip stores, so an id typed back is the choice it was. A string or document
 * holding anything more is the author's own text and is never a choice.
 */
export const choiceForValue = (
  value: unknown,
  choices?: IQorusAllowedValue[]
): IQorusAllowedValue | undefined => {
  const text = typeof value === 'string' ? value : plainTextOfNodes(value);

  if (!text || !choices?.length) {
    return undefined;
  }

  return findAllowedValueOption(text, { allowed_values: choices } as TQorusFormFieldSchema) as
    | IQorusAllowedValue
    | undefined;
};

/** The one-chip document that draws a choice by its name. */
export const choiceToNodes = (
  choice: IQorusAllowedValue
): { type: 'paragraph'; children: ({ text: string } | IChoiceChipNode)[] }[] => {
  const value = choiceValue(choice);
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

export const isChoiceChip = (node: unknown): node is IChoiceChipNode =>
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

/**
 * What a choice chip does when the author acts on it, by action.
 *
 * The chip is a void: it holds no text of its own, so a key or a click on it
 * has nothing to land in, and an author who wants to change one letter of the
 * value it draws (`C07ERBFS0P6` to `C07ERBFS0P7`) has no way in unless the
 * chip opens. Each action is configurable, and the default is the one that
 * opens it: a creatable choice is the author's to edit.
 */
export interface IChoiceChipBehavior {
  /**
   * Backspace with the cursor right after the chip. `unwrap` (the default)
   * turns the chip into its value as plain text, the cursor at the end of it,
   * for the author to edit; `remove` deletes it whole, as the editor deletes
   * any other chip.
   */
  backspace?: 'unwrap' | 'remove';
  /**
   * A click on the chip's body. `unwrap` (the default) turns the chip into its
   * value as plain text, the cursor at the end of it; `cursor` only places the
   * cursor after it, as a click on a template chip does.
   */
  click?: 'unwrap' | 'cursor';
}

export const DEFAULT_CHOICE_CHIP_BEHAVIOR: Required<IChoiceChipBehavior> = {
  backspace: 'unwrap',
  click: 'unwrap',
};

/** Where the node is in the document, by identity; the editor renders the document's own nodes, so a chip handed to a click handler is one of them. */
export const pathOfNode = (editor: Editor, node: unknown): Path | undefined => {
  // Stepped by hand: the build target cannot iterate a generator (TS2802).
  const nodes = Node.nodes(editor);

  for (let entry = nodes.next(); !entry.done; entry = nodes.next()) {
    if (entry.value[0] === node) {
      return entry.value[1];
    }
  }

  return undefined;
};

/**
 * The chip the cursor is on: right after it with nothing between, where
 * Backspace would take it, or inside it, where the arrow keys can leave the
 * cursor. Nothing when the selection spans text or sits anywhere else.
 */
export const choiceChipAtCursor = (editor: Editor): Path | undefined => {
  const { selection } = editor;

  if (!selection || !Range.isCollapsed(selection)) {
    return undefined;
  }

  const { path, offset } = selection.anchor;
  const inside = Editor.above(editor, { at: path, match: isChoiceChip, voids: true });

  if (inside) {
    return inside[1];
  }

  if (offset !== 0 || !Path.hasPrevious(path)) {
    return undefined;
  }

  const previous = Path.previous(path);

  return isChoiceChip(Node.get(editor, previous)) ? previous : undefined;
};

/**
 * Opens the chip at `path` into its value as plain text, the cursor at the
 * end of the text: what the author read is what they chose, now editable
 * letter by letter. The document is text from here on, and is stored as the
 * field stores anything typed; it is drawn as a chip again only when it is
 * read back as exactly one of the choices.
 */
export const unwrapChoiceChip = (editor: Editor, path: Path): boolean => {
  const chip = Node.get(editor, path);

  if (!isChoiceChip(chip)) {
    return false;
  }

  Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(editor, [{ text: chip.value }], { at: path });
    Transforms.select(editor, Editor.end(editor, path));
  });

  return true;
};
