// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific Slate helpers — recognise `@field` and `$prefix:value`
// patterns in plain text, render them as tag elements, account for
// `metadata.quoted` tag spacing in cursor-offset math. The generic
// SmartEditor primitive uses these via the `converter` prop on
// `DpqlEditor`; the SmartEditor itself has no knowledge of DPQL syntax.

import { ISlateConverter, ISlateElement, ISlateText, TSlateNode } from '../smartEditor/types';

// Combined pattern that matches templates, field refs, or plain text segments.
// Template values without braces match only word chars and dots (not quotes,
// parens, etc.); the `(?<![.\w])` lookbehind on `@` prevents matching inside
// an email-like string.
const TOKEN_PATTERN = new RegExp(
  `(\\$\\w+:(?:\\{[^}]*\\}|[\\w.]+))|((?<![.\\w])@\\w+(?:\\.\\w+)*)`,
  'g'
);

/**
 * Convert plain DPQL text to Slate elements. Parses `$prefix:{value}` and
 * `@field` patterns into tag elements; everything else becomes text nodes.
 */
export function plainTextToSlate(text: string): ISlateElement[] {
  if (!text) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  const lines = text.split('\n');

  return lines.map((line) => {
    const children: TSlateNode[] = [];
    if (!line) {
      children.push({ text: '' });
      return { type: 'paragraph' as const, children };
    }
    let lastIndex = 0;
    TOKEN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_PATTERN.exec(line)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const isQuoted =
        matchStart > 0 &&
        line[matchStart - 1] === '"' &&
        matchEnd < line.length &&
        line[matchEnd] === '"';
      const textStart = isQuoted ? matchStart - 1 : matchStart;
      const textEnd = isQuoted ? matchEnd + 1 : matchEnd;

      if (textStart > lastIndex) {
        children.push({ text: line.slice(lastIndex, textStart) });
      }

      const fullMatch = match[0];
      if (match[1]) {
        const colonIdx = fullMatch.indexOf(':');
        const prefix = fullMatch.slice(1, colonIdx);
        const valueText = fullMatch.slice(colonIdx + 1);
        const displayLabel =
          valueText.startsWith('{') && valueText.endsWith('}')
            ? valueText.slice(1, -1)
            : valueText;
        children.push(
          createTagElement(
            fullMatch,
            `${prefix}: ${displayLabel}`,
            isQuoted ? { quoted: true } : undefined
          )
        );
      } else if (match[2]) {
        const fieldName = fullMatch.slice(1);
        children.push(createTagElement(fullMatch, fieldName));
      }

      lastIndex = textEnd;
    }
    if (lastIndex < line.length) {
      children.push({ text: line.slice(lastIndex) });
    }
    if (children.length === 0) {
      children.push({ text: '' });
    }
    return { type: 'paragraph' as const, children };
  });
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

function processElement(element: any): string {
  if ('text' in element && element.type !== 'tag') {
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

/** Display label for a completion being inserted as a tag. */
export function getTagLabel(value: string): string {
  if (value.startsWith('@')) {
    return value.slice(1);
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

/** DPQL converter — handed to `SmartEditor` via the `converter` prop. */
export const dpqlSlateConverter: ISlateConverter = {
  toSlateNodes: plainTextToSlate,
  fromSlateNodes: slateToPlainText,
  selectionToOffset: slateSelectionToOffset,
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
    if (children.length === 0) children.push({ text: '' } as ISlateText);
    paragraphs.push({ type: 'paragraph', children });
  }
  if (paragraphs.length === 0) {
    paragraphs.push({ type: 'paragraph', children: [{ text: '' }] });
  }
  return paragraphs;
}
