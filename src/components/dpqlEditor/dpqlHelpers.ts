// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific Slate helpers — recognise `@field`, `@"field"` and `$prefix:value`
// references in plain text, render them as tag elements, account for
// `metadata.quoted` tag spacing in cursor-offset math. The generic
// SmartEditor primitive uses these via the `converter` prop on
// `DpqlEditor`; the SmartEditor itself has no knowledge of DPQL syntax.

import { ISlateConverter, ISlateElement, ISlateText, TSlateNode } from '../smartEditor/types';

// What the editor draws as a chip is what the server's DPQL tokenizer (Qore's DataProvider DpqlTokenizer) reads as
// one reference: a template `$prefix:value` or `$prefix:{value}`, a field `@name`, or a quoted field `@"name"`. The
// text is read one character at a time, as the tokenizer reads it, rather than with one pattern: where a bracketed
// value or a quoted field ends depends on escapes, nested braces and string literals, which no pattern can follow.
//
// A field name is bare in any script, as DPQL reads it (qorus#646): a letter of any script or `_`, then
// letters, combining marks, digits and `_`, with dot-separated parts. `\w` is ASCII only, so
// `@menge_bestätigt` was cut to the tag `@menge_best` and the text `ätigt`.
const NAME_START = '[\\p{L}_]';
const NAME_PART = '[\\p{L}\\p{M}\\p{N}_]';
const FIELD_NAME = `${NAME_START}${NAME_PART}*`;
/** A bare field, `@name.sub`, read where it starts. */
const BARE_FIELD = new RegExp(`@${FIELD_NAME}(?:\\.${FIELD_NAME})*`, 'uy');
/** What a template starts with, `$prefix:`, read where it starts. */
const TEMPLATE_HEAD = /\$\w+:/y;
// A template's value without braces is word characters and dots, not quotes, parens, etc. A dot that starts a
// method call ends the value: the server's readable rendering writes `ends-with` as
// `$local:str.endsWith($local:p, true)`, and a path that took every dot turned `str.endsWith` into one reference.
const TEMPLATE_BARE_VALUE = /(?:\w|\.(?!\w+\())+/y;
/** A character a field cannot start after: one that would make the `@` part of a word (`user@host`) or a path. */
const BEFORE_NO_FIELD = /^[.\p{L}\p{M}\p{N}_]$/u;

/** One reference in a line: where its text starts and ends (`[start, end)`), and the chip drawn for it. */
interface IDpqlReference {
  start: number;
  end: number;
  tag: ISlateElement;
}

/**
 * Where a string literal opened with `quote` at `from - 1` ends: the index after its closing quote, or -1 when the
 * line ends first. A backslash escapes the character after it, as in the tokenizer.
 */
const endOfQuoted = (line: string, from: number, quote: string): number => {
  for (let i = from; i < line.length; i += 1) {
    if (line[i] === '\\') {
      i += 1;
    } else if (line[i] === quote) {
      return i + 1;
    }
  }
  return -1;
};

/**
 * Where a template's bracketed value that opens at `from` (its `{`) ends: the index after the `}` that closes it,
 * or -1 when the line ends first. As the tokenizer reads it: a backslash escapes the character after it (`\{`,
 * `\}`), a brace opens or closes a nested pair, and a string literal inside is read whole.
 */
const endOfBracketed = (line: string, from: number): number => {
  let depth = 0;
  for (let i = from; i < line.length; i += 1) {
    const char = line[i];
    if (char === '\\') {
      i += 1;
    } else if (char === '"' || char === "'") {
      const close = endOfQuoted(line, i + 1, char);
      if (close < 0) {
        return -1;
      }
      i = close - 1;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return -1;
};

/** The template that starts at `at` (its `$`), or undefined when none does. */
const readTemplate = (
  line: string,
  at: number
): { end: number; tag: ISlateElement } | undefined => {
  TEMPLATE_HEAD.lastIndex = at;
  if (!TEMPLATE_HEAD.test(line)) {
    return undefined;
  }
  const valueStart = TEMPLATE_HEAD.lastIndex;
  let end: number;
  if (line[valueStart] === '{') {
    end = endOfBracketed(line, valueStart);
  } else {
    TEMPLATE_BARE_VALUE.lastIndex = valueStart;
    end = TEMPLATE_BARE_VALUE.test(line) ? TEMPLATE_BARE_VALUE.lastIndex : -1;
  }
  if (end < 0) {
    return undefined;
  }
  const value = line.slice(at, end);
  return { end, tag: createTagElement(value, getTagLabel(value)) };
};

/** The character before `at` in `line`, whole: a letter outside the BMP is two code units. */
const charBefore = (line: string, at: number): string =>
  at > 0 ? (Array.from(line.slice(Math.max(0, at - 2), at)).pop() ?? '') : '';

/** The field that starts at `at` (its `@`), bare or quoted, or undefined when none does. */
const readField = (line: string, at: number): { end: number; tag: ISlateElement } | undefined => {
  if (BEFORE_NO_FIELD.test(charBefore(line, at))) {
    return undefined;
  }
  let end: number;
  if (line[at + 1] === '"') {
    end = endOfQuoted(line, at + 2, '"');
  } else {
    BARE_FIELD.lastIndex = at;
    end = BARE_FIELD.test(line) ? BARE_FIELD.lastIndex : -1;
  }
  if (end < 0) {
    return undefined;
  }
  const value = line.slice(at, end);
  return { end, tag: createTagElement(value, getTagLabel(value)) };
};

/**
 * The references in `line`, and the string literal still open at its end. `quote` is the one open at its start: a
 * DPQL string literal may go on over several lines.
 *
 * A field in a string literal is text: `"@name"` is a string, and drawn as a chip it was written back as the field
 * `@name`, its quotes lost. A template in one is still drawn as its chip, as it was before, and a string that is
 * nothing but a template is drawn as the template's chip, quotes included (`metadata.quoted`), so
 * `contains("$local:input", "es")` reads as it does with the reference unquoted.
 */
const readReferences = (
  line: string,
  quote: string | undefined
): { references: IDpqlReference[]; quote: string | undefined } => {
  const references: IDpqlReference[] = [];
  let open = quote;
  // where the string literal open now starts, when it opened on this line
  let openedAt = -1;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (open) {
      if (char === '\\') {
        i += 2;
      } else if (char === open) {
        open = undefined;
        i += 1;
      } else if (char === '$') {
        const template = readTemplate(line, i);
        if (!template) {
          i += 1;
        } else if (open === '"' && openedAt === i - 1 && line[template.end] === '"') {
          template.tag.metadata = { quoted: true };
          references.push({ start: i - 1, end: template.end + 1, tag: template.tag });
          open = undefined;
          i = template.end + 1;
        } else {
          references.push({ start: i, end: template.end, tag: template.tag });
          i = template.end;
        }
      } else {
        i += 1;
      }
    } else if (char === '"' || char === "'") {
      open = char;
      openedAt = i;
      i += 1;
    } else if (char === '$' || char === '@') {
      const reference = char === '$' ? readTemplate(line, i) : readField(line, i);
      if (reference) {
        references.push({ start: i, end: reference.end, tag: reference.tag });
        i = reference.end;
      } else {
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return { references, quote: open };
};

/**
 * Convert plain DPQL text to Slate elements: each reference (`$prefix:value`, `$prefix:{value}`, `@field`,
 * `@"field"`) is a tag element whose value is its text exactly, and everything else is text.
 */
export function plainTextToSlate(text: string): ISlateElement[] {
  if (!text) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  let quote: string | undefined;

  return text.split('\n').map((line) => {
    const read = readReferences(line, quote);
    quote = read.quote;
    // Every chip has a text node on each side, even an empty one: a chip
    // that starts or ends the line otherwise leaves the caret nowhere to go
    // but into the chip, where Slate drops whatever is typed.
    const children: TSlateNode[] = [];
    let lastIndex = 0;
    for (const { start, end, tag } of read.references) {
      children.push({ text: line.slice(lastIndex, start) });
      children.push(tag);
      lastIndex = end;
    }
    children.push({ text: line.slice(lastIndex) });
    return { type: 'paragraph' as const, children };
  });
}

/**
 * `text` as a DPQL editor draws it: a reference is its chip, so the quotes a
 * chip is drawn over do not show. `"$local:name" == "John"` and
 * `$local:name == "John"` read the same.
 */
export function dpqlDisplayedText(text: string): string {
  return plainTextToSlate(text)
    .map((paragraph) =>
      paragraph.children
        .map((node) => ('text' in node ? node.text : String((node as ISlateElement).value ?? '')))
        .join('')
    )
    .join('\n');
}

/**
 * `children` with a text node on each side of every chip, as Slate requires of
 * an inline void: adjacent text nodes are left as they are, and an empty
 * paragraph gets one empty text node. The server's `dpql/toRichtext` writes a
 * chip that starts or ends a line without the empty text beside it, and a
 * document loaded that way is never normalised, so the caret a click puts
 * after such a chip lands back inside it, where typing does nothing.
 */
export function withTextAroundTags(children: TSlateNode[]): TSlateNode[] {
  const out: TSlateNode[] = [];
  for (const child of children) {
    if (!('text' in child) && (out.length === 0 || !('text' in out[out.length - 1]))) {
      out.push({ text: '' } as ISlateText);
    }
    out.push(child);
  }
  if (out.length === 0 || !('text' in out[out.length - 1])) {
    out.push({ text: '' } as ISlateText);
  }
  return out;
}

function createTagElement(
  value: string,
  label: string,
  metadata?: Record<string, any>
): ISlateElement {
  return {
    type: 'tag',
    value,
    label,
    metadata,
    children: [{ text: '' }],
  };
}

/** Convert Slate elements back to plain DPQL text. */
export function slateToPlainText(elements: ISlateElement[]): string {
  return elements.map(processElement).join('\n');
}

function processElement(element: TSlateNode): string {
  if ('text' in element) {
    return element.text;
  }
  if (element.type === 'tag') {
    const val = element.value?.toString() || '';
    return element.metadata?.quoted ? `"${val}"` : val;
  }
  if (element.children) {
    return element.children.map(processElement).join('');
  }
  return '';
}

/**
 * Tag-aware Slate-selection → plain-text-offset. Accounts for
 * `metadata.quoted` (which adds two characters — surrounding quotes — to
 * the plain-text projection of a tag). The non-quoted case matches the
 * generic SmartEditor default.
 */
export function slateSelectionToOffset(
  elements: ISlateElement[],
  anchorPath: number[],
  anchorOffset: number
): number {
  let totalOffset = 0;
  const targetParagraphIdx = anchorPath[0];
  const targetChildIdx = anchorPath[1];

  for (let pIdx = 0; pIdx < elements.length; pIdx++) {
    if (pIdx > 0) {
      totalOffset += 1;
    }
    if (pIdx > targetParagraphIdx) break;

    const paragraph = elements[pIdx];
    const children = paragraph.children || [];

    for (let cIdx = 0; cIdx < children.length; cIdx++) {
      const child = children[cIdx];
      const isTag = 'type' in child && child.type === 'tag';
      const isText = 'text' in child && !isTag;

      if (pIdx === targetParagraphIdx && cIdx === targetChildIdx) {
        if (isText) {
          totalOffset += anchorOffset;
        } else if (isTag) {
          const el = child as ISlateElement;
          const quoted = el.metadata?.quoted;
          totalOffset += quoted ? 1 + anchorOffset : anchorOffset;
        }
        return totalOffset;
      }

      if (isText) {
        totalOffset += (child as ISlateText).text.length;
      } else if (isTag) {
        const el = child as ISlateElement;
        const tagValue = el.value?.toString() || '';
        const quoted = el.metadata?.quoted;
        totalOffset += quoted ? tagValue.length + 2 : tagValue.length;
      }
    }
  }
  return totalOffset;
}

/** Should a completion be inserted as a Slate tag element vs plain text? */
export function isTagCompletion(insertText: string): boolean {
  return insertText.startsWith('@') || insertText.startsWith('$');
}

/**
 * The name a quoted field's text stands for, as the server's parser reads it: a backslash escapes the character
 * after it (`\"` is `"`, `\\` is `\`), and `\n`, `\r` and `\t` are a newline, a return and a tab.
 */
const unescapeDpqlString = (content: string): string => {
  let result = '';
  let escaped = false;
  for (const char of content) {
    if (escaped) {
      result +=
        char === 'n' ? '\n'
        : char === 'r' ? '\r'
        : char === 't' ? '\t'
        : char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else {
      result += char;
    }
  }
  return escaped ? `${result}\\` : result;
};

/**
 * The name of the field a field reference stands for - `@name` is `name`, and the quoted `@"order-id"` is
 * `order-id`, unescaped as the server reads it - or undefined when `value` is not a field reference.
 */
export const dpqlFieldName = (value: string): string | undefined => {
  if (value.startsWith('@"') && value.length > 2 && value.endsWith('"')) {
    return unescapeDpqlString(value.slice(2, -1));
  }
  return value.startsWith('@') ? value.slice(1) : undefined;
};

/**
 * What a reference's chip says: a field's name (`dpqlFieldName`), or a template's prefix and value
 * (`$local:{a.b}` is `local: a.b`).
 */
export function getTagLabel(value: string): string {
  const field = dpqlFieldName(value);
  if (field !== undefined) {
    return field;
  }
  if (value.startsWith('$')) {
    const colonIdx = value.indexOf(':');
    if (colonIdx === -1) {
      return value.slice(1);
    }
    const prefix = value.slice(1, colonIdx);
    const rest = value.slice(colonIdx + 1);
    const displayValue =
      rest.startsWith('{') && rest.endsWith('}') ? rest.slice(1, -1) : rest;
    return `${prefix}: ${displayValue}`;
  }
  return value;
}

/**
 * Whether a character ends the DPQL reference it follows: anything that cannot go on to make a field name or a
 * template path longer - not a letter, a mark, a digit or `_`, nor a `.` (a sub-field) or a `:` / `{` (a
 * template's path).
 */
export const endsDpqlReference = (char: string): boolean =>
  !!char && !/^[\p{L}\p{M}\p{N}_.:{]$/u.test(char);

/** DPQL converter — handed to `SmartEditor` via the `converter` prop. */
export const dpqlSlateConverter: ISlateConverter = {
  toSlateNodes: plainTextToSlate,
  fromSlateNodes: slateToPlainText,
  selectionToOffset: slateSelectionToOffset,
  endsReference: endsDpqlReference,
};

/**
 * Convert the server's `dpql/toRichtext` response into a Slate
 * `ISlateElement[]`. The server returns `{ type: "richtext", value:
 * [...] }` where `value` is already an array of `{type: "paragraph",
 * children: [...]}` nodes — children alternate between
 * `{ text: "..." }` text nodes and `{ type: "tag", value, label,
 * children: [{text: ""}], metadata? }` inline-void tag nodes (see
 * `qorus/Classes/UserApi.qc:_priv_get_richtext_string`).
 *
 * Returns `null` when the response doesn't look like the expected
 * shape — callers should fall back to `plainTextToSlate` in that
 * case. We don't trust the server response unconditionally because
 * (a) the regex used server-side recognises `$template:value`
 * patterns but NOT `@field` references, so DPQL field-ref chips are
 * only produced by the client parser, and (b) network errors / weird
 * shapes shouldn't crash the editor.
 */
export function richtextResponseToSlate(
  response: unknown
): ISlateElement[] | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as { type?: unknown; value?: unknown };
  if (r.type !== 'richtext' || !Array.isArray(r.value)) return null;
  const paragraphs: ISlateElement[] = [];
  for (const node of r.value) {
    if (!node || typeof node !== 'object') return null;
    const n = node as { type?: unknown; children?: unknown };
    if (n.type !== 'paragraph' || !Array.isArray(n.children)) return null;
    const children: TSlateNode[] = [];
    for (const child of n.children) {
      if (!child || typeof child !== 'object') return null;
      const c = child as Record<string, unknown>;
      if (typeof c.text === 'string') {
        children.push({ text: c.text } as ISlateText);
      } else if (c.type === 'tag' && typeof c.value === 'string') {
        children.push({
          type: 'tag',
          value: c.value,
          label:
            typeof c.label === 'string'
              ? c.label
              : getTagLabel(c.value),
          metadata: (c.metadata as Record<string, any>) ?? undefined,
          children: [{ text: '' } as ISlateText],
        } as ISlateElement);
      } else {
        // Unknown child shape — refuse the whole response so the
        // caller falls back to client-side parsing.
        return null;
      }
    }
    paragraphs.push({ type: 'paragraph', children: withTextAroundTags(children) });
  }
  if (paragraphs.length === 0) {
    paragraphs.push({ type: 'paragraph', children: [{ text: '' }] });
  }
  return paragraphs;
}
