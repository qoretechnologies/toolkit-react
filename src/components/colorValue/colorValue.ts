// Copyright 2026 Qore Technologies, s.r.o.
// What a stored color is: the one reader for every read-only view of a color (qorus#646).
//
// A color reaches a page in the shapes it is stored in - `{ r, g, b }` or `{ r, g, b, a }` as the color
// field stores it (with a `hex` beside them when react-color wrote it), `{ hex }`, or a hex code, with or
// without its `#`, as a value written by hand or by another client can be. `ReqraftColorValue` draws what
// this reads, and a compact form row summarises a color with it, so the two never disagree.

/** What a stored value is, as a color. */
export type TReqraftColorValueDescription =
  /** A color: `text` is how it is written (`#6495ED`, or `rgba(…)` when it is see-through), `css` paints it. */
  | { kind: 'color'; text: string; css: string }
  /** No color: nothing, an empty string or an empty hash. */
  | { kind: 'empty' }
  /** A value that is not a color; `shown` is the value as text (a string in quotes), to say what it is. */
  | { kind: 'invalid'; shown: string };

/** A hex code as CSS takes one: 3, 4, 6 or 8 hex digits (the last digit or pair is the alpha). */
const HEX_CODE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The longest an invalid value is shown; a longer one is cut, with an ellipsis. */
const SHOWN_MAX = 60;

interface IParsedColor {
  /** The hex code, with its `#`, as it was written (case kept). */
  hex?: string;
  r?: number;
  g?: number;
  b?: number;
  /** From 0 to 1. */
  a: number;
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** A channel brought into its range, as a whole number: the color field does the same. */
const clampChannel = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

const clampAlpha = (n: number): number => Math.max(0, Math.min(1, n));

const toHexPart = (n: number): string => clampChannel(n).toString(16).padStart(2, '0');

const hasRgb = (c: IParsedColor): c is IParsedColor & { r: number; g: number; b: number } =>
  c.r !== undefined && c.g !== undefined && c.b !== undefined;

/** A hex code with its `#`, or undefined when the text is not one. */
const hexCode = (text: string): string | undefined => {
  const trimmed = text.trim();
  return (
    HEX_CODE.test(trimmed) ?
      trimmed.startsWith('#') ?
        trimmed
      : `#${trimmed}`
    : undefined
  );
};

/** Whether a value holds nothing: nothing, an empty string or an empty hash. */
const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

/** A stored color's parts, or undefined when the value is not a color. */
const parseColor = (value: unknown): IParsedColor | undefined => {
  if (typeof value === 'string') {
    const hex = hexCode(value);
    return hex ? { hex, a: 1 } : undefined;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const { r, g, b, a, hex } = value as {
      r?: unknown;
      g?: unknown;
      b?: unknown;
      a?: unknown;
      hex?: unknown;
    };
    // an alpha that is given is a number, or this is not a color (null is an alpha not given)
    if (a !== undefined && a !== null && !isFiniteNumber(a)) {
      return undefined;
    }
    const alpha = isFiniteNumber(a) ? clampAlpha(a) : 1;
    if (isFiniteNumber(r) && isFiniteNumber(g) && isFiniteNumber(b)) {
      return { r, g, b, a: alpha };
    }
    if (typeof hex === 'string') {
      const code = hexCode(hex);
      return code ? { hex: code, a: alpha } : undefined;
    }
  }
  return undefined;
};

/** A value that is not a color, as text: a string in quotes, anything else as JSON, cut when long. */
const showValue = (value: unknown): string => {
  let shown: string;
  if (typeof value === 'string') {
    shown = `“${value}”`;
  } else {
    try {
      shown = JSON.stringify(value) ?? String(value);
    } catch {
      // a value JSON cannot write (a cycle, a BigInt) is still shown as something
      shown = String(value);
    }
  }
  return shown.length > SHOWN_MAX ? `${shown.slice(0, SHOWN_MAX)}…` : shown;
};

/**
 * What a stored value is, as a color: a color (how it is written, and how CSS paints it), no color, or
 * a value that is not a color (shown as it is). A channel past its range is brought into it, as the color
 * field does; a channel that is not a finite number, a hex code that is not one (`#zzz`, seven digits) or
 * a color name is not a color.
 */
export const describeColorValue = (value: unknown): TReqraftColorValueDescription => {
  if (isEmpty(value)) {
    return { kind: 'empty' };
  }
  const c = parseColor(value);
  if (!c) {
    return { kind: 'invalid', shown: showValue(value) };
  }
  if (hasRgb(c)) {
    const [r, g, b] = [clampChannel(c.r), clampChannel(c.g), clampChannel(c.b)];
    const alpha = Math.round(c.a * 100) / 100;
    return {
      kind: 'color',
      // rgba(…) for a see-through color: the hex shortcut would drop its alpha
      text:
        c.a < 1 ?
          `rgba(${r}, ${g}, ${b}, ${alpha})`
        : `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`.toUpperCase(),
      css: `rgba(${r}, ${g}, ${b}, ${c.a})`,
    };
  }
  return { kind: 'color', text: c.hex!.toUpperCase(), css: c.hex! };
};

/** How a color is written (`#0000FF`, or `rgba(…)` when see-through); undefined when the value is none. */
export const formatColorValue = (value: unknown): string | undefined => {
  const description = describeColorValue(value);
  return description.kind === 'color' ? description.text : undefined;
};

/** The CSS color a swatch is painted (alpha kept); undefined when the value is none. */
export const colorToCss = (value: unknown): string | undefined => {
  const description = describeColorValue(value);
  return description.kind === 'color' ? description.css : undefined;
};

/** The channels of a stored color, with the words a reader knows them by. */
const STORED_CHANNELS = [
  ['r', 'red'],
  ['g', 'green'],
  ['b', 'blue'],
] as const;

const isWholeChannel = (n: unknown): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255;

const isOpacity = (n: unknown): boolean =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

/** "red (r)", "red (r) and blue (b)", "red (r), green (g) and blue (b)". */
const listChannels = (channels: string[]): string =>
  channels.length < 2 ?
    channels.join('')
  : `${channels.slice(0, -1).join(', ')} and ${channels[channels.length - 1]}`;

/** The stored shape, said where a value is not in it at all. */
const STORED_AS = 'A color is stored as its red, green and blue values (r, g, b)';

/**
 * What is wrong with a value stored as an `rgbcolor`, in plain words; undefined when it is a stored color (qorus#646,
 * David): the hash `{ r, g, b, a? }`, `r`, `g` and `b` whole numbers from 0 to 255 and `a` its opacity, a number from
 * 0 to 1 (without one, the color is opaque). Other fields beside them are left alone (react-color wrote a `hex`).
 *
 * A hex code, bare or as `{ hex }`, is not a stored color: the readers above still draw one, so a value stored that
 * way is seen, and this says why it is wrong. The color field stores the hash when it edits such a value.
 */
export const storedColorProblem = (value: unknown): string | undefined => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return 'No color is set.';
  }
  if (typeof value === 'string') {
    const hex = hexCode(value);
    return `${STORED_AS}, not as ${hex ? `the hex code ${showValue(value)}` : showValue(value)}.`;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return `${STORED_AS}, not as ${showValue(value)}.`;
  }
  const color = value as Record<string, unknown>;
  const missing = STORED_CHANNELS.filter(
    ([key]) => color[key] === undefined || color[key] === null
  );
  if (missing.length === STORED_CHANNELS.length && typeof color.hex === 'string') {
    return `${STORED_AS}, not as the hex code ${showValue(color.hex)}.`;
  }
  const problems: string[] = [];
  if (missing.length) {
    const names = missing.map(([key, name]) => `${name} (${key})`);
    problems.push(`${listChannels(names)} ${missing.length === 1 ? 'is' : 'are'} missing`);
  }
  for (const [key, name] of STORED_CHANNELS) {
    const channel = color[key];
    if (channel !== undefined && channel !== null && !isWholeChannel(channel)) {
      problems.push(
        `${name} (${key}) must be a whole number from 0 to 255, not ${showValue(channel)}`
      );
    }
  }
  // an opacity that is not given is a color that is opaque
  if (color.a !== undefined && color.a !== null && !isOpacity(color.a)) {
    problems.push(`opacity (a) must be a number from 0 to 1, not ${showValue(color.a)}`);
  }
  if (!problems.length) {
    return undefined;
  }
  const said = problems.join('; ');
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
};

/** Whether a value is a stored color, `{ r, g, b, a? }`; see `storedColorProblem`. */
export const isStoredColor = (value: unknown): boolean => storedColorProblem(value) === undefined;
