// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What a code editor does for the text typed in it beyond completion and hovers (qorus#646, David: one DPQL editor
 * with every capability the Monaco editor it replaces had): a bracket typed is closed, a selection typed over with a
 * bracket or a quote is wrapped in it, a closing bracket typed before the same one steps over it, Backspace between
 * an empty pair takes both; the bracket matching the one at the caret is marked; a search finds every place a text
 * is written. Read from the editor's text as its converter projects it, with each chip masked out: a chip is one
 * value, and the braces and quotes of `$data:{a.b}` are not brackets of the text around it.
 */
import { Path, Point } from 'slate';
import { ISlateConverter, ISlateElement } from './types';

/** A bracket or quote pair: typed open, it is closed; a selection typed over with it is wrapped in it. */
export interface IAutoClosingPair {
  open: string;
  close: string;
  /** Not closed in a string: an apostrophe typed in text is one. */
  notInString?: boolean;
}

/** How the editor's language writes its brackets and strings (a Monaco language configuration's equivalent). */
export interface IEditingLanguage {
  /** The pairs that are brackets: what the bracket at the caret is matched with. */
  brackets: Array<[string, string]>;
  /** The pairs closed as they are typed, and that wrap a selection. */
  autoClosingPairs: IAutoClosingPair[];
  /** The characters a pair is closed before (or the end of the line): typed before a word, `(` is only `(`. */
  autoCloseBefore?: string;
  /** The quotes strings are written in: brackets in a string are text. */
  quotes?: string[];
}

/** DPQL's brackets and strings, as the Monaco editor the DPQL field had declared them (`dpqlMonacoSetup`). */
export const DPQL_EDITING_LANGUAGE: IEditingLanguage = {
  brackets: [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '"', close: '"', notInString: true },
    { open: "'", close: "'", notInString: true },
  ],
  autoCloseBefore: ';:.,=}])> \n\t',
  quotes: ['"', "'"],
};

/** A run of the editor's text: a text leaf (`path`, its `text`) or a chip, and where it is in the plain text. */
export interface ITextSegment {
  path: Path;
  start: number;
  end: number;
  chip: boolean;
}

/** The editor's text, run by run, in the plain text its converter projects it to: paragraphs a line each. */
export const textSegments = (
  nodes: ISlateElement[],
  converter: ISlateConverter
): ITextSegment[] => {
  const segments: ITextSegment[] = [];
  let at = 0;
  nodes.forEach((paragraph, p) => {
    if (p > 0) {
      at += 1;
    }
    (paragraph.children ?? []).forEach((child, c) => {
      const isChip = 'type' in child && (child as ISlateElement).type === 'tag';
      const length =
        isChip ?
          converter.fromSlateNodes([{ type: 'paragraph', children: [child] } as ISlateElement])
            .length
        : ((child as { text?: string }).text ?? '').length;
      segments.push({ path: [p, c], start: at, end: at + length, chip: isChip });
      at += length;
    });
  });
  return segments;
};

/** The plain text with each chip's characters masked (`\0`): what is read for brackets, strings and searches. */
export const maskChips = (plainText: string, segments: ITextSegment[]): string => {
  let masked = plainText;
  for (const segment of segments) {
    if (segment.chip && segment.end > segment.start) {
      masked =
        masked.slice(0, segment.start) +
        '\0'.repeat(segment.end - segment.start) +
        masked.slice(segment.end);
    }
  }
  return masked;
};

/** Whether `offset` is in a string literal of `masked` (its quotes in `quotes`). */
export const inString = (
  masked: string,
  offset: number,
  quotes: string[] = ['"', "'"]
): boolean => {
  let quote: string | undefined;
  for (let i = 0; i < offset; i++) {
    const char = masked[i];
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (quotes.includes(char)) {
      quote = char;
    } else if (char === '\n') {
      quote = undefined;
    }
  }
  return !!quote;
};

/**
 * The bracket at the caret (`offset`: the one before it, else the one after it) and the bracket it matches, as
 * plain-text offsets; none where there is no bracket there, it is in a string, or it is not matched.
 */
export const matchingBracket = (
  masked: string,
  offset: number,
  language: IEditingLanguage
): [number, number] | undefined => {
  const opens = new Map(language.brackets.map(([open, close]) => [open, close]));
  const closes = new Map(language.brackets.map(([open, close]) => [close, open]));
  const at = [offset - 1, offset].find(
    (index) =>
      index >= 0 &&
      index < masked.length &&
      (opens.has(masked[index]) || closes.has(masked[index])) &&
      !inString(masked, index, language.quotes)
  );
  if (at === undefined) {
    return undefined;
  }
  const char = masked[at];
  const forward = opens.has(char);
  const partner = forward ? opens.get(char)! : closes.get(char)!;
  // brackets in strings are text: the strings are read from the start, once
  const stringAt: boolean[] = [];
  {
    let quote: string | undefined;
    for (let i = 0; i < masked.length; i++) {
      const c = masked[i];
      if (quote) {
        stringAt[i] = true;
        if (c === '\\') {
          stringAt[i + 1] = true;
          i++;
        } else if (c === quote) {
          quote = undefined;
        }
      } else if ((language.quotes ?? []).includes(c)) {
        stringAt[i] = true;
        quote = c;
      } else if (c === '\n') {
        quote = undefined;
      }
    }
  }
  let depth = 0;
  for (
    let i = at + (forward ? 1 : -1);
    forward ? i < masked.length : i >= 0;
    i += forward ? 1 : -1
  ) {
    if (stringAt[i]) continue;
    if (masked[i] === char) {
      depth++;
    } else if (masked[i] === partner) {
      if (depth === 0) {
        return forward ? [at, i] : [i, at];
      }
      depth--;
    }
  }
  return undefined;
};

/** Every place `query` is written in the text that is not a chip, as plain-text spans. */
export const findMatches = (
  masked: string,
  query: string,
  { caseSensitive = false }: { caseSensitive?: boolean } = {}
): Array<[number, number]> => {
  if (!query) {
    return [];
  }
  const haystack = caseSensitive ? masked : masked.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (
    let at = haystack.indexOf(needle);
    at >= 0;
    at = haystack.indexOf(needle, at + Math.max(1, needle.length))
  ) {
    spans.push([at, at + needle.length]);
  }
  return spans;
};

/** The point in a text leaf a plain-text offset is at; at a chip's edge, the text beside it. */
export const pointAt = (segments: ITextSegment[], offset: number): Point | undefined => {
  const text = segments.filter((segment) => !segment.chip);
  const within = text.find((segment) => offset >= segment.start && offset <= segment.end);
  return within ? { path: within.path, offset: offset - within.start } : undefined;
};

/** The parts of `spans` in the text leaf at `path`, as offsets in it. */
export const spansInLeaf = (
  segments: ITextSegment[],
  path: Path,
  spans: Array<[number, number]>
): Array<[number, number]> => {
  const leaf = segments.find((segment) => !segment.chip && Path.equals(segment.path, path));
  if (!leaf) {
    return [];
  }
  return spans
    .map(([start, end]): [number, number] => [Math.max(start, leaf.start), Math.min(end, leaf.end)])
    .filter(([start, end]) => start < end)
    .map(([start, end]) => [start - leaf.start, end - leaf.start]);
};

/** What a pair typed at the caret does: the pair it opens, closes over, or none. */
export const autoClosingPairFor = (
  language: IEditingLanguage,
  key: string
): { opens?: IAutoClosingPair; closes?: IAutoClosingPair } => ({
  opens: language.autoClosingPairs.find((pair) => pair.open === key),
  closes: language.autoClosingPairs.find((pair) => pair.close === key),
});

/** Whether a pair is closed when it is opened before `next` (the character after the caret, '' at a line's end). */
export const closesBefore = (language: IEditingLanguage, next: string): boolean =>
  !next || (language.autoCloseBefore ?? ' \n\t').includes(next);
