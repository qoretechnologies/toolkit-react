// Copyright 2026 Qore Technologies, s.r.o.
// A reference typed out in full is drawn as its chip once it has been typed, as one picked from the completion
// list is (qorus#646).
import { ISlateConverter, ISlateElement, ISlateText, TSlateNode } from './types';

const isTag = (node: TSlateNode): node is ISlateElement => (node as ISlateElement).type === 'tag';

/** How many characters of plain text `node` stands for, as the converter writes it. */
const plainLength = (converter: ISlateConverter, node: TSlateNode): number =>
  isTag(node) ?
    converter.fromSlateNodes([{ type: 'paragraph', children: [{ text: '' }, node, { text: '' }] }])
      .length
  : (node as ISlateText).text.length;

/** Where in `paragraph`'s plain text each of its chips is: `[start, end)`. */
const chipRanges = (converter: ISlateConverter, paragraph: ISlateElement): [number, number][] => {
  const ranges: [number, number][] = [];
  let at = 0;
  paragraph.children.forEach((child) => {
    const length = plainLength(converter, child);
    if (isTag(child)) {
      ranges.push([at, at + length]);
    }
    at += length;
  });
  return ranges;
};

/** The Slate point at plain-text `offset` in `paragraph` (at index `index`): in a text node, never in a chip. */
const pointAt = (
  converter: ISlateConverter,
  paragraph: ISlateElement,
  index: number,
  offset: number
): { path: number[]; offset: number } => {
  let at = 0;
  for (let child = 0; child < paragraph.children.length; child += 1) {
    const node = paragraph.children[child];
    const length = plainLength(converter, node);
    if (!isTag(node) && offset <= at + length) {
      return { path: [index, child], offset: offset - at };
    }
    at += length;
  }
  const last = paragraph.children.length - 1;
  return { path: [index, last], offset: plainLength(converter, paragraph.children[last]) };
};

export interface IRechippedParagraph {
  /** The paragraph's children, with the references typed in it drawn as chips. */
  children: TSlateNode[];
  /** Where the caret goes in them: the same place in the text. */
  caret?: { path: number[]; offset: number };
}

/**
 * The paragraph at `index`, its typed references drawn as chips - or `undefined` when there is none to draw.
 *
 * A reference is typed out in full when the converter reads one where the paragraph has plain text. With a
 * `caret` (the plain-text offset of the caret in the paragraph), only a reference the caret has left is drawn:
 * the converter says the character typed right after it ends it (`endsReference`) - a space or an operator, not
 * a `.` that goes on to a sub-field. One still being typed is left as text; drawn as a chip mid-word, the rest of
 * the word could not be typed into it. Without a caret (the editor has been left) every one is drawn.
 */
export const rechipTypedReferences = (
  converter: ISlateConverter,
  paragraph: ISlateElement,
  index: number,
  caret?: number
): IRechippedParagraph | undefined => {
  const text = converter.fromSlateNodes([paragraph]);
  const [rebuilt] = converter.toSlateNodes(text);
  if (!rebuilt) {
    return undefined;
  }
  const had = chipRanges(converter, paragraph);
  const typed = chipRanges(converter, rebuilt).filter(
    ([start, end]) => !had.some(([from, to]) => from === start && to === end)
  );
  if (!typed.length || typed.length + had.length !== chipRanges(converter, rebuilt).length) {
    // nothing typed out, or a reading the paragraph does not share (a chip it holds is not one the text makes)
    return undefined;
  }
  if (caret !== undefined) {
    const ended = typed.every(
      ([, end]) => end < caret && !!converter.endsReference?.(text.charAt(end))
    );
    if (!ended) {
      return undefined;
    }
  }
  return {
    children: rebuilt.children,
    caret: caret === undefined ? undefined : pointAt(converter, rebuilt, index, caret),
  };
};
