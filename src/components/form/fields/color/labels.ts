// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The words of the color field. A host that translates its interface passes its own; English where it
 * does not. A text that holds a value is a function of it, so a host keeps its language's word order.
 */
export interface IColorFormFieldLabels {
  hex: string;
  red: string;
  green: string;
  blue: string;
  opacity: string;
  /** The square in which the color's strength and brightness are chosen. */
  area: string;
  hue: string;
  /** What the preview says of the color, for a screen reader. */
  preview: (hex: string, opacityPercent: number) => string;
  /** What the preview says when the field holds no color yet. */
  noColor: string;
  /** The button that shows and hides what the controls mean. */
  help: string;
  /*
   * The help and the messages below are markdown: a value in them is a code span (`6495ED`), drawn in the
   * data style by the host's markdown renderer, or reqraft's own where the host has none.
   */
  helpArea: string;
  helpHex: string;
  helpChannels: string;
  helpOpacity: string;
  /** A swatch's name, for a screen reader: the color it picks. */
  swatch: (title: string) => string;
  /** Characters typed into a hex code that cannot be in one. */
  notHex: (characters: string) => string;
  /** Characters typed into a number that cannot be in one. */
  notDigits: (characters: string, field: string) => string;
  /** A hex code too long to be one. */
  hexTooLong: string;
  /** A hex code of the wrong length. */
  hexLength: (text: string) => string;
  /** A hex code left empty. */
  hexEmpty: string;
  /** A number past its field's range. */
  outOfRange: (field: string, max: number) => string;
  /** A number field left empty. */
  empty: (field: string, max: number) => string;
}

/** Text as a markdown code span, whatever backticks it holds: drawn in the data style. */
const code = (text: string): string => {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return longest ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
};

const characters = (chars: string): string =>
  Array.from(new Set(chars.split('')))
    .map((char) => (char === ' ' ? 'a space' : code(char)))
    .join(', ');

export const DEFAULT_COLOR_FORM_FIELD_LABELS: IColorFormFieldLabels = {
  hex: 'Hex code',
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  opacity: 'Opacity %',
  area: 'Strength and brightness',
  hue: 'Color',
  preview: (hex, opacity) =>
    opacity === 100 ? `Chosen color: ${hex}` : `Chosen color: ${hex}, ${opacity}% opaque`,
  noColor: 'No color chosen yet',
  help: 'What do these mean?',
  helpArea:
    'The square sets how strong the color is (left to right) and how bright (bottom to top); the rainbow bar under it sets the color itself.',
  helpHex:
    'Hex code: the whole color as six characters, each 0–9 or A–F, two each for red, green and blue: `6495ED` is cornflower blue. Three characters are short for six: `F80` is `FF8800`.',
  helpChannels:
    'Red, Green, Blue: how much red, green and blue light make the color, each from `0` (none) to `255` (all). `0, 0, 0` is black and `255, 255, 255` is white.',
  helpOpacity:
    'Opacity: how solid the color is, from `0%` (you see through it) to `100%` (solid). The squares behind the preview show through a color that is not solid.',
  swatch: (title) => `Use ${title}`,
  notHex: (chars) =>
    `${characters(chars)} cannot be in a hex code: use the digits 0–9 and the letters A–F.`,
  notDigits: (chars, field) => `${characters(chars)} cannot be in ${field}: type a whole number.`,
  hexTooLong: 'A hex code has six characters.',
  hexLength: (text) =>
    `${code(text)} is not a color: a hex code has six characters (or three, short for six).`,
  hexEmpty: 'Type a hex code: six characters, each 0–9 or A–F.',
  outOfRange: (field, max) => `${field} goes from \`0\` to \`${max}\`.`,
  empty: (field, max) => `${field} needs a whole number from \`0\` to \`${max}\`.`,
};
