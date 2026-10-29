// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreButton, ReqoreInput, ReqoreMessage, useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { HsvaColor, hsvaToRgba, RgbaColor, rgbaToHex, rgbaToHsva } from '@uiw/color-convert';
import Alpha, { BACKGROUND_IMG } from '@uiw/react-color-alpha';
import Hue from '@uiw/react-color-hue';
import Saturation, { SaturationProps } from '@uiw/react-color-saturation';
import { rgba } from 'polished';
import {
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled, { css } from 'styled-components';
import { useCoarsePointer } from '../../../../hooks/useCoarsePointer';
import { hexGivesOpacity, isStoredColor, readHexColor } from '../../../colorValue/colorValue';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';
import { defaultMarkdownRenderer } from '../markdown/MarkdownView';

/** The color an `rgbcolor` field stores: red, green and blue from 0 to 255, alpha from 0 to 1. */
export interface IColorFormFieldValue {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * What the color field reads as a color (qorus#646): a stored color, `{ r, g, b, a? }`, or a value stored the wrong
 * way, which it still reads so it can show it and store it right - a hex code (3, 4, 6 or 8 digits, with or without
 * its `#`), `{ hex }` (with an opacity beside it), or a color with fields beside its own (react-color stored a
 * `hex`). Only the first is a stored color (`isStoredColor`); the field stores that shape whenever it edits any of
 * them, even when the edit leaves the color as it was. A host passes the value as it is stored, not converted.
 */
export type TColorFormFieldInput =
  | IColorFormFieldValue
  | (IColorFormFieldValue & Record<string, unknown>)
  | { hex: string; a?: number }
  | string;

/** A color offered as a swatch: a hex color, or one with a name to read it by. */
export type TColorPreset = string | { color: string; title?: string };

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

/** The colors offered as swatches when a host offers none of its own. */
export const DEFAULT_COLOR_PRESETS: TColorPreset[] = [
  '#D0021B',
  '#F5A623',
  '#F8E61B',
  '#8B572A',
  '#7ED321',
  '#417505',
  '#BD10E0',
  '#9013FE',
  '#4A90E2',
  '#50E3C2',
  '#B8E986',
  '#000000',
  '#4A4A4A',
  '#9B9B9B',
  '#FFFFFF',
];

export interface IColorFormFieldProps {
  /** The value as it is stored: see `TColorFormFieldInput`. */
  value?: TColorFormFieldInput;
  onChange?: (value: Required<IColorFormFieldValue>) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Leave out the transparency slider and keep the stored transparency (the default). */
  disableAlpha?: boolean;
  /** The swatches offered, or `false` for none. */
  presetColors?: false | TColorPreset[];
  className?: string;
  /** The field's words, for a host that translates them. */
  labels?: Partial<IColorFormFieldLabels>;
}

/**
 * What the picker shows while the field holds no color: a starting color. A constant, so clearing the
 * value moves the picker back to it, and an empty field does not reset it on every render.
 */
const NO_COLOR: HsvaColor = { h: 209, s: 36, v: 90, a: 1 };

const isChannel = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * A color as it may be stored: red, green and blue whole numbers from 0 to 255, and the alpha from 0 to 1
 * in hundredths, which is what the opacity field shows. Nothing past these is ever stored.
 */
const toStoredColor = ({ r, g, b, a }: RgbaColor): Required<IColorFormFieldValue> => ({
  r: clamp(Math.round(r), 0, 255),
  g: clamp(Math.round(g), 0, 255),
  b: clamp(Math.round(b), 0, 255),
  a: clamp(Math.round(a * 100) / 100, 0, 1),
});

/**
 * A stored color as red, green, blue and alpha: `{ r, g, b, a? }` as the field stores it, or a hex color,
 * bare or as `{ hex }`, as a value written by hand or by another client can be. Undefined when it is none
 * of these. A channel past its range is brought into it, so what is shown, and stored from it, is a color.
 * Only `{ r, g, b, a? }` is a stored color (`isStoredColor`); the others are read so they can be seen and fixed.
 */
export const colorToRgba = (value: unknown): RgbaColor | undefined => {
  if (typeof value === 'string') {
    // reqraft's one hex reader: 3, 4, 6 or 8 digits, the short ones doubled, the last pair (or digit) the opacity
    const read = readHexColor(value);
    return read ? toStoredColor(read) : undefined;
  }
  if (value && typeof value === 'object') {
    const { r, g, b, a, hex } = value as Partial<RgbaColor> & { hex?: unknown };
    if (isChannel(r) && isChannel(g) && isChannel(b)) {
      return toStoredColor({ r, g, b, a: isChannel(a) ? a : 1 });
    }
    if (typeof hex === 'string') {
      // its own opacity where the code gives one, or the opacity beside it, as the readers paint it
      const read = readHexColor(hex);
      return read ?
          toStoredColor({ ...read, a: !hexGivesOpacity(hex) && isChannel(a) ? a : read.a })
        : undefined;
    }
  }
  return undefined;
};

const sameRgba = (x: RgbaColor, y: RgbaColor): boolean =>
  x.r === y.r && x.g === y.g && x.b === y.b && x.a === y.a;

const hexOf = (color: RgbaColor): string => rgbaToHex(color).replace(/^#/, '').toUpperCase();

/** A finger's target: the smallest a control should be on a touch screen. */
export const TAP_TARGET_PX = 44;

/** The sizes of the picker's parts, for a mouse and for a finger. */
const sizesFor = (coarse: boolean) => ({
  /** The color square's height. */
  area: coarse ? 160 : 100,
  /** A slider's visible bar. */
  track: coarse ? 28 : 12,
  /** A slider's reach: the bar and the room around it a touch still lands on. */
  reach: coarse ? TAP_TARGET_PX : 20,
  /** The preview's side. */
  preview: coarse ? 56 : 40,
  /** A swatch's side. */
  swatch: coarse ? TAP_TARGET_PX : 18,
});

type TChannel = 'r' | 'g' | 'b' | 'a';
type TField = 'hex' | TChannel;

const CHANNEL_MAX: Record<TChannel, number> = { r: 255, g: 255, b: 255, a: 100 };

/** What the field shows in each input for a color. */
const fieldTexts = (color: RgbaColor): Record<TField, string> => ({
  hex: hexOf(color),
  r: String(color.r),
  g: String(color.g),
  b: String(color.b),
  a: String(Math.round(color.a * 100)),
});

/**
 * Text typed into a field, kept to what the field can hold: the characters that can be in it, up to its
 * length. Returns what is kept, the characters dropped, and whether the text was too long.
 */
const keepValid = (field: TField, text: string): { kept: string; dropped: string; long: boolean } => {
  // a hex code's own mark, written or pasted with it, is not a character of the code
  const source = field === 'hex' ? text.trim().replace(/^#/, '') : text.trim();
  const allowed = field === 'hex' ? /[0-9a-f]/i : /[0-9]/;
  const max = field === 'hex' ? 6 : 3;
  let kept = '';
  let dropped = '';
  for (const char of source) {
    if (allowed.test(char)) {
      kept += char;
    } else {
      dropped += char;
    }
  }
  return {
    kept: (field === 'hex' ? kept.toUpperCase() : kept).slice(0, max),
    dropped,
    long: kept.length > max,
  };
};

interface IStyledColorFieldProps {
  $disabled: boolean;
  $text: string;
}

export const StyledColorField = styled.div<IStyledColorFieldProps>`
  display: flex;
  flex-flow: column;
  gap: 8px;
  width: 100%;
  max-width: 400px;
  color: ${({ $text }) => $text};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'auto')};
`;

const StyledArea = styled.div<{ $height: number; $text: string }>`
  position: relative;
  width: 100%;
  height: ${({ $height }) => $height}px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px ${({ $text }) => rgba($text, 0.2)};

  .w-color-saturation:focus-visible {
    outline: 2px solid ${({ $text }) => $text};
    outline-offset: -2px;
  }
`;

const StyledSliders = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StyledSliderStack = styled.div`
  display: flex;
  flex-flow: column;
  flex: 1 1 auto;
  min-width: 0;
  gap: 4px;
`;

/** A checkerboard, under whatever is not solid: the preview and the opacity bar. */
const checkerboard = css`
  background-image: url(${BACKGROUND_IMG});
  background-position: left center;
  background-color: #fff;
`;

const StyledPreview = styled.div<{ $size: number; $text: string; $color?: string }>`
  position: relative;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px ${({ $text }) => rgba($text, 0.3)};
  ${checkerboard}

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px ${({ $text }) => rgba($text, 0.3)};
    ${({ $color }) =>
      $color ?
        css`
          background: ${$color};
        `
      : css`
          /* no color yet: struck through */
          background: linear-gradient(
            to top right,
            transparent calc(50% - 1.5px),
            #d0021b calc(50% - 1.5px),
            #d0021b calc(50% + 1.5px),
            transparent calc(50% + 1.5px)
          );
        `}
  }
`;

/**
 * A slider's bar inside its reach: the room above and below the bar is still the slider's, so a finger
 * that lands just off the bar still moves it. The reach itself is clear (the picker paints it white).
 */
const sliderStyles = (track: number, reach: number) => ({
  height: reach,
  style: { background: 'transparent', backgroundColor: 'transparent' },
  bgProps: { style: { inset: `${(reach - track) / 2}px 0`, borderRadius: track / 2 } },
});

/**
 * Where a thumb travels: its bar or area, less the half of the thumb - and its ring - that would reach past an end.
 * A thumb at an end (the area's corner for black or white, the opacity bar's end for an opaque color) was cut by the
 * area, or by whatever is around the field (qorus#646). Laid out by class, not by an inline style, so the thumb is
 * still the one element with a `left`.
 */
const StyledThumbTrack = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  inset: ${({ $y }) => $y}px ${({ $x }) => $x}px;
  pointer-events: none;
`;

/** A slider thumb's ring, past its edge. */
const THUMB_RING = 1;
/** An area thumb's rings (white, then dark), past its edge. */
const AREA_THUMB_RING = 3;

const StyledThumb = styled.div<{ $height: number; $width: number }>`
  position: absolute;
  top: 50%;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  transform: translate(-50%, -50%);
  border-radius: 4px;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 1px 4px rgba(0, 0, 0, 0.45);
  pointer-events: none;
`;

const StyledAreaThumb = styled.div<{ $size: number }>`
  position: absolute;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 3px rgba(0, 0, 0, 0.4),
    inset 0 0 1px 1px rgba(0, 0, 0, 0.3);
  pointer-events: none;
`;

const StyledInputsBlock = styled.div`
  display: flex;
  flex-flow: column;
`;

/** Where a value's problem is said, under the inputs: set apart from them only while it says something. */
const StyledProblem = styled.div<{ $shown: boolean }>`
  margin-top: ${({ $shown }) => ($shown ? 6 : 0)}px;
`;

const StyledInputs = styled.div`
  display: flex;
  flex-flow: row wrap;
  gap: 8px 6px;
`;

const StyledInputColumn = styled.div<{ $grow: number; $min: number }>`
  display: flex;
  flex-flow: column;
  gap: 2px;
  flex: ${({ $grow, $min }) => `${$grow} 1 ${$min}px`};
  min-width: ${({ $min }) => $min}px;

  input {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
`;

/* Centred over its input, as the value in the input is. */
const StyledLabel = styled.label<{ $text: string; $coarse: boolean }>`
  display: block;
  text-align: center;
  font-size: ${({ $coarse }) => ($coarse ? 14 : 12)}px;
  line-height: 1.3;
  color: ${({ $text }) => rgba($text, 0.85)};
  white-space: nowrap;
`;

const StyledHelp = styled.div<{ $text: string; $coarse: boolean }>`
  display: flex;
  flex-flow: column;
  gap: 6px;
  font-size: ${({ $coarse }) => ($coarse ? 15 : 13)}px;
  line-height: 1.45;
  color: ${({ $text }) => rgba($text, 0.85)};

  /* the help is one markdown document: its paragraphs are spaced as the field's other parts are */
  p {
    margin: 0;
  }
  p + p {
    margin-top: 6px;
  }
`;

/**
 * How far a swatch draws past its edge: its picked ring (2px) and, focused, its outline (2px, 2px off it). The
 * swatches keep that much room on every side, so a swatch at an edge is drawn whole even where something around the
 * field cuts off what reaches past it - a picked swatch's ring was cut on its left and bottom in a host's form
 * (qorus#646).
 */
const SWATCH_REACH = 4;

const StyledSwatches = styled.div<{ $text: string }>`
  display: flex;
  flex-flow: row wrap;
  gap: 8px;
  padding: 10px ${SWATCH_REACH}px ${SWATCH_REACH}px;
  border-top: 1px solid ${({ $text }) => rgba($text, 0.15)};
`;

const StyledSwatch = styled.button<{ $size: number; $color: string; $text: string }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  background: ${({ $color }) => $color};
  box-shadow: inset 0 0 0 1px ${({ $text }) => rgba($text, 0.25)};

  &[aria-pressed='true'] {
    box-shadow:
      inset 0 0 0 1px ${({ $text }) => rgba($text, 0.25)},
      0 0 0 2px ${({ $text }) => $text};
  }

  &:focus-visible {
    outline: 2px solid ${({ $text }) => $text};
    outline-offset: 2px;
  }
`;

interface IFieldProblem {
  field: TField;
  message: string;
  /** The text in the field is not a color while it says so; once put back, only the message stays. */
  invalid: boolean;
}

/**
 * The `rgbcolor` field: a color picker that stores `{ r, g, b, a }`.
 *
 * It is drawn from the `@uiw` picker's parts - the color square, the hue bar and the opacity bar - and
 * around them the field's own: a preview of the color, its hex code and its red, green, blue (and
 * opacity) as labelled inputs that take only what a color can be, a "What do these mean?" help, and
 * swatches. On a touch screen every target is a finger's size.
 *
 * The picker works in hue, saturation and value, and a stored color is red, green and blue. A color the
 * picker sent comes back as the field's value, and turned back into hue it can lose what the picker had:
 * a grey has no hue, so moving the saturation to a grey would throw the hue bar back to red. So the color
 * the picker last showed is kept with the color it sent, and only a value that changed somewhere else is
 * converted.
 */
export const ColorFormField = ({
  value,
  onChange,
  disabled,
  readOnly,
  disableAlpha = true,
  presetColors = DEFAULT_COLOR_PRESETS,
  className,
  labels,
}: IColorFormFieldProps) => {
  const theme = useReqoreTheme();
  const text = getReadableColor(theme);
  const coarse = useCoarsePointer();
  const sizes = sizesFor(coarse);
  const words = useMemo(() => ({ ...DEFAULT_COLOR_FORM_FIELD_LABELS, ...labels }), [labels]);
  // the help's and the messages' markdown: the host's renderer, or reqraft's own (this is the field's own text)
  const renderMarkdown = useMarkdownRenderer() ?? defaultMarkdownRenderer;
  const id = useId();
  const field = useRef<HTMLDivElement>(null);
  const locked = !!(disabled || readOnly);

  const stored = colorToRgba(value);
  const { r, g, b, a } = stored ?? {};
  /** What the picker last showed after a move of its own, and the color it sent for it. */
  const [picked, setPicked] = useState<{ rgba: RgbaColor; hsva: HsvaColor }>();
  /** Text typed into an input that is not (yet) the color: what the input shows instead of the color. */
  const [drafts, setDrafts] = useState<Partial<Record<TField, string>>>({});
  const [problem, setProblem] = useState<IFieldProblem>();
  const [helpOpen, setHelpOpen] = useState(false);
  /** Where the caret goes after characters that could not be typed are left out. */
  const caret = useRef<{ input: HTMLInputElement; at: number }>();

  const shown = useMemo((): HsvaColor => {
    if (!isChannel(r) || !isChannel(g) || !isChannel(b) || !isChannel(a)) {
      return NO_COLOR;
    }
    const rgbaValue = { r, g, b, a };
    return picked && sameRgba(picked.rgba, rgbaValue) ? picked.hsva : rgbaToHsva(rgbaValue);
  }, [r, g, b, a, picked]);

  /** The color the inputs show: the stored one, or the picker's starting color. */
  const current: RgbaColor = useMemo(
    () => (stored ? { r: stored.r, g: stored.g, b: stored.b, a: stored.a } : hsvaToRgba(NO_COLOR)),
    [r, g, b, a]
  );
  const texts = fieldTexts(current);

  // `inert` takes the picker out of reach of the pointer, the keyboard and assistive technology at once:
  // its sliders are focusable and move with the arrow keys. Set on the element, as React 18 and React 19
  // disagree about the attribute's value.
  useEffect(() => {
    if (field.current) {
      field.current.inert = locked;
    }
  }, [locked]);

  useLayoutEffect(() => {
    if (caret.current) {
      const { input, at } = caret.current;
      caret.current = undefined;
      if (document.activeElement === input) {
        input.setSelectionRange(at, at);
      }
    }
  });

  /**
   * Store a color. `hsva` is how the picker showed it, when the picker made it: kept, so a grey keeps its
   * hue. A color typed in keeps the hue (and for black the strength) it cannot say.
   */
  const store = useCallback(
    (next: RgbaColor, hsva?: HsvaColor) => {
      if (locked) {
        return;
      }
      // Without its slider the transparency is not the picker's to change. It would: a hex code typed in,
      // or a swatch, is opaque.
      const color = toStoredColor({ ...next, a: disableAlpha ? (stored?.a ?? 1) : next.a });
      let showAs = hsva ?? rgbaToHsva(color);
      if (!hsva) {
        showAs =
          showAs.v === 0 ? { ...showAs, h: shown.h, s: shown.s }
          : showAs.s === 0 ? { ...showAs, h: shown.h }
          : showAs;
      }
      setPicked({ rgba: color, hsva: { ...showAs, a: color.a } });
      // A hue moved on a grey is the same color: nothing to store - unless the value is not stored as a color
      // is (a hex code, `{ hex }`, a channel past its range): an edit stores it as one (qorus#646, David).
      if (stored && sameRgba(stored, color) && isStoredColor(value)) {
        return;
      }
      onChange?.(color);
    },
    [locked, disableAlpha, stored, shown, onChange, value]
  );

  const pickerMoved = useCallback(
    (hsva: HsvaColor) => store(hsvaToRgba(hsva), hsva),
    [store]
  );

  const setDraft = (name: TField, draft?: string) =>
    setDrafts((was) => {
      const next = { ...was };
      if (draft === undefined) {
        delete next[name];
      } else {
        next[name] = draft;
      }
      return next;
    });

  const fieldName = (name: TField): string =>
    name === 'hex' ? words.hex
    : name === 'r' ? words.red
    : name === 'g' ? words.green
    : name === 'b' ? words.blue
    : words.opacity.replace(/\s*%$/, '');

  /** The color with one input's number in it. */
  const withChannel = (name: TChannel, n: number): RgbaColor =>
    name === 'a' ? { ...current, a: n / 100 } : { ...current, [name]: n };

  const typed = (name: TField) => (event: ChangeEvent<HTMLInputElement>) => {
    if (locked) {
      return;
    }
    const input = event.target;
    const { kept, dropped, long } = keepValid(name, input.value);
    if (dropped && input.selectionStart !== null) {
      // the caret stays after what was typed, not at the end
      const before = keepValid(name, input.value.slice(0, input.selectionStart)).kept.length;
      caret.current = { input, at: before };
    }
    setDraft(name, kept);

    let message: string | undefined;
    if (dropped) {
      message = name === 'hex' ? words.notHex(dropped) : words.notDigits(dropped, fieldName(name));
    } else if (long && name === 'hex') {
      message = words.hexTooLong;
    }

    if (name === 'hex') {
      // Six characters are a color as they are typed; three may be the start of six, so they are one
      // when the field is left (see `committed`).
      const typedColor = kept.length === 6 ? readHexColor(kept) : undefined;
      if (typedColor) {
        store({ ...typedColor, a: current.a });
      }
      setProblem(message ? { field: name, message, invalid: false } : undefined);
      return;
    }

    const max = CHANNEL_MAX[name];
    if (kept === '') {
      setProblem(message ? { field: name, message, invalid: true } : undefined);
      return;
    }
    const n = Number(kept);
    if (n > max) {
      const range = words.outOfRange(fieldName(name), max);
      setProblem({ field: name, message: message ? `${message} ${range}` : range, invalid: true });
      return;
    }
    store(withChannel(name, n));
    setProblem(message ? { field: name, message, invalid: false } : undefined);
  };

  /** The field was left, or Enter pressed in it: what it holds is a color, or it shows the color again. */
  const committed = (name: TField) => {
    const draft = drafts[name];
    if (draft === undefined) {
      return;
    }
    setDraft(name, undefined);
    if (name === 'hex') {
      const shortColor = draft.length === 3 ? readHexColor(draft) : undefined;
      if (shortColor) {
        store({ ...shortColor, a: current.a });
      } else if (draft === '') {
        setProblem({ field: name, message: words.hexEmpty, invalid: false });
      } else if (draft.length !== 6) {
        setProblem({ field: name, message: words.hexLength(draft), invalid: false });
      }
      return;
    }
    const max = CHANNEL_MAX[name];
    if (draft === '') {
      setProblem({ field: name, message: words.empty(fieldName(name), max), invalid: false });
    } else if (Number(draft) > max) {
      setProblem({ field: name, message: words.outOfRange(fieldName(name), max), invalid: false });
    }
  };

  const keyDown = (name: TField) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      committed(name);
      return;
    }
    if (name === 'hex' || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
    // a number steps with the arrow keys, by ten with Shift, and stays in its range
    event.preventDefault();
    const step = (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1);
    const from = Number(drafts[name] ?? texts[name]);
    const n = clamp((Number.isFinite(from) ? Math.min(from, CHANNEL_MAX[name]) : 0) + step, 0, CHANNEL_MAX[name]);
    setDraft(name, undefined);
    setProblem(undefined);
    store(withChannel(name, n));
  };

  const inputFor = (name: TField, label: string, grow: number, min: number): ReactNode => {
    const inputId = `${id}-${name}`;
    const invalid = problem?.field === name && problem.invalid;
    return (
      <StyledInputColumn key={name} $grow={grow} $min={min}>
        <StyledLabel htmlFor={inputId} $text={text} $coarse={coarse}>
          {label}
        </StyledLabel>
        <ReqoreInput
          id={inputId}
          className={`reqraft-color-field-${name}`}
          data-field={name}
          size={coarse ? 'big' : 'normal'}
          fluid
          value={drafts[name] ?? texts[name]}
          intent={invalid ? 'danger' : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={problem?.field === name ? `${id}-problem` : undefined}
          inputMode={name === 'hex' ? 'text' : 'numeric'}
          autoCapitalize={name === 'hex' ? 'characters' : 'off'}
          autoComplete='off'
          autoCorrect='off'
          spellCheck={false}
          onChange={typed(name)}
          onBlur={() => committed(name)}
          onKeyDown={keyDown(name)}
        />
      </StyledInputColumn>
    );
  };

  const shownRgba = hsvaToRgba(shown);
  const opacityPercent = Math.round(current.a * 100);
  const previewColor = stored ? `rgba(${stored.r}, ${stored.g}, ${stored.b}, ${stored.a})` : undefined;
  const colorOpaque = `rgb(${shownRgba.r}, ${shownRgba.g}, ${shownRgba.b})`;
  const slider = sliderStyles(sizes.track, sizes.reach);
  const thumbWidth = coarse ? 14 : 8;
  const thumb = useCallback(
    ({ left }: { left?: string }) => (
      <StyledThumbTrack $x={thumbWidth / 2 + THUMB_RING} $y={0}>
        <StyledThumb
          className='reqraft-color-field-thumb'
          style={{ left }}
          $height={sizes.track + 6}
          $width={thumbWidth}
        />
      </StyledThumbTrack>
    ),
    [sizes.track, thumbWidth]
  );
  const areaThumbSize = coarse ? 28 : 14;
  const areaThumb = useCallback(
    ({ left, top, color }: Parameters<NonNullable<SaturationProps['pointer']>>[0]) => (
      <StyledThumbTrack
        $x={areaThumbSize / 2 + AREA_THUMB_RING}
        $y={areaThumbSize / 2 + AREA_THUMB_RING}
      >
        <StyledAreaThumb
          className='reqraft-color-field-area-thumb'
          style={{ left, top, background: color }}
          $size={areaThumbSize}
        />
      </StyledThumbTrack>
    ),
    [areaThumbSize]
  );
  const presets = presetColors === false ? [] : presetColors;
  const currentHex = `#${texts.hex}`;

  return (
    <StyledColorField
      ref={field}
      className={className ? `reqraft-color-field ${className}` : 'reqraft-color-field'}
      aria-disabled={locked || undefined}
      $disabled={!!disabled}
      $text={text}
    >
      <StyledArea $height={sizes.area} $text={text}>
        <Saturation
          hsva={shown}
          onChange={pickerMoved}
          pointer={areaThumb}
          style={{ width: '100%', height: '100%' }}
          role='slider'
          aria-label={words.area}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown.s)}
          aria-valuetext={`${Math.round(shown.s)}%, ${Math.round(shown.v)}%`}
        />
      </StyledArea>
      <StyledSliders>
        <StyledPreview
          className='reqraft-color-field-preview'
          role='img'
          aria-label={stored ? words.preview(currentHex, opacityPercent) : words.noColor}
          $size={sizes.preview}
          $text={text}
          $color={previewColor}
        />
        <StyledSliderStack>
          <Hue
            className='reqraft-color-field-hue'
            hue={shown.h}
            width='100%'
            height={slider.height}
            style={slider.style}
            bgProps={slider.bgProps}
            pointer={thumb}
            innerProps={{
              role: 'slider',
              'aria-label': words.hue,
              'aria-valuemin': 0,
              'aria-valuemax': 360,
              'aria-valuenow': Math.round(shown.h),
            }}
            onChange={({ h }) => pickerMoved({ ...shown, h })}
          />
          {!disableAlpha && (
            <Alpha
              className='reqraft-color-field-alpha'
              hsva={shown}
              width='100%'
              height={slider.height}
              style={slider.style}
              bgProps={{
                style: {
                  ...slider.bgProps.style,
                  background: `linear-gradient(to right, rgba(0, 0, 0, 0), ${colorOpaque}), url(${BACKGROUND_IMG}) left center #fff`,
                },
              }}
              pointer={thumb}
              innerProps={{
                role: 'slider',
                'aria-label': fieldName('a'),
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round(shown.a * 100),
              }}
              onChange={({ a: alpha }) => pickerMoved({ ...shown, a: alpha })}
            />
          )}
        </StyledSliderStack>
      </StyledSliders>
      <StyledInputsBlock>
        <StyledInputs>
          {inputFor('hex', words.hex, 2, coarse ? 96 : 80)}
          {inputFor('r', words.red, 1, coarse ? 52 : 44)}
          {inputFor('g', words.green, 1, coarse ? 52 : 44)}
          {inputFor('b', words.blue, 1, coarse ? 52 : 44)}
          {!disableAlpha && inputFor('a', words.opacity, 1, coarse ? 64 : 56)}
        </StyledInputs>
        {/* always there, so what appears in it is read out */}
        <StyledProblem
          id={`${id}-problem`}
          aria-live='polite'
          className='reqraft-color-field-problem'
          $shown={!!problem}
        >
          {problem && (
            <ReqoreMessage intent='danger' size='small' opaque={false}>
              {renderMarkdown({ value: problem.message, compact: true })}
            </ReqoreMessage>
          )}
        </StyledProblem>
      </StyledInputsBlock>
      <div>
        <ReqoreButton
          className='reqraft-color-field-help-toggle'
          icon='QuestionLine'
          size={coarse ? 'big' : 'small'}
          flat
          minimal
          fixed
          aria-expanded={helpOpen}
          aria-controls={`${id}-help`}
          onClick={() => setHelpOpen((open) => !open)}
        >
          {words.help}
        </ReqoreButton>
      </div>
      {helpOpen && (
        <StyledHelp id={`${id}-help`} className='reqraft-color-field-help' $text={text} $coarse={coarse}>
          {renderMarkdown({
            value: [
              words.helpArea,
              words.helpHex,
              words.helpChannels,
              ...(disableAlpha ? [] : [words.helpOpacity]),
            ].join('\n\n'),
            compact: !coarse,
          })}
        </StyledHelp>
      )}
      {presets.length > 0 && (
        <StyledSwatches className='reqraft-color-field-swatches' $text={text}>
          {presets.map((preset) => {
            const color = typeof preset === 'string' ? preset : preset.color;
            const title = typeof preset === 'string' ? preset : (preset.title ?? preset.color);
            const rgbaColor = colorToRgba(color);
            return (
              <StyledSwatch
                key={color}
                type='button'
                className='reqraft-color-field-swatch'
                data-color={color.toUpperCase()}
                aria-label={words.swatch(title)}
                aria-pressed={!!stored && !!rgbaColor && hexOf(rgbaColor) === hexOf(stored)}
                disabled={!rgbaColor}
                $size={sizes.swatch}
                $color={color}
                $text={text}
                onClick={() => {
                  if (rgbaColor) {
                    setDrafts({});
                    setProblem(undefined);
                    // a swatch is a color: the opacity stays as it was
                    store({ ...rgbaColor, a: current.a });
                  }
                }}
              />
            );
          })}
        </StyledSwatches>
      )}
    </StyledColorField>
  );
};

export default ColorFormField;
