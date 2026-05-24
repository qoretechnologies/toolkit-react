// Copyright 2026 Qore Technologies, s.r.o.
// Pure helpers for the DpqlEditor — plain-text ↔ Slate conversion, cursor
// position mapping for LSP, and completion item utilities. Lifted from
// qorus-ide src/components/DpqlRichtext/helpers.ts on the
// feature/dpql-editor branch; no behavioural changes.

import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ISlateElement, ISlateText, TSlateNode } from './types';

// Combined pattern that matches templates, field refs, or plain text segments.
// Template values without braces match only word chars and dots (not quotes, parens, etc.)
const TOKEN_PATTERN = new RegExp(
  `(\\$\\w+:(?:\\{[^}]*\\}|[\\w.]+))|((?<![.\\w])@\\w+(?:\\.\\w+)*)`,
  'g'
);

/**
 * Convert plain DPQL text to Slate elements.
 * Parses `$prefix:{value}` and `@field` patterns into tag elements,
 * everything else becomes text nodes.
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

      // Check if the tag is wrapped in double quotes — if so, consume the quotes
      // so the syntax highlighter doesn't see orphaned quote characters.
      const isQuoted =
        matchStart > 0 &&
        line[matchStart - 1] === '"' &&
        matchEnd < line.length &&
        line[matchEnd] === '"';

      const textStart = isQuoted ? matchStart - 1 : matchStart;
      const textEnd = isQuoted ? matchEnd + 1 : matchEnd;

      // Add text before match (excluding consumed opening quote)
      if (textStart > lastIndex) {
        children.push({ text: line.slice(lastIndex, textStart) });
      }

      const fullMatch = match[0];

      if (match[1]) {
        // Template: $prefix:{value} or $prefix:value
        const colonIdx = fullMatch.indexOf(':');
        const prefix = fullMatch.slice(1, colonIdx);
        const value = fullMatch.slice(colonIdx + 1);
        const displayLabel =
          value.startsWith('{') && value.endsWith('}') ? value.slice(1, -1) : value;

        children.push(
          createTagElement(
            fullMatch,
            `${prefix}: ${displayLabel}`,
            isQuoted ? { quoted: true } : undefined
          )
        );
      } else if (match[2]) {
        // Field ref: @field_name
        const fieldName = fullMatch.slice(1);
        children.push(createTagElement(fullMatch, fieldName));
      }

      lastIndex = textEnd;
    }

    // Add remaining text
    if (lastIndex < line.length) {
      children.push({ text: line.slice(lastIndex) });
    }

    if (children.length === 0) {
      children.push({ text: '' });
    }

    return { type: 'paragraph' as const, children };
  });
}

/** Create a Slate tag element. */
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

/**
 * Convert Slate elements to plain DPQL text.
 * Tag elements emit their `value`, text nodes emit their `text`.
 */
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
 * Check if a completion value should be inserted as a tag element
 * (field references and template variables) vs plain text (keywords, operators).
 */
export function isTagCompletion(insertText: string): boolean {
  return insertText.startsWith('@') || insertText.startsWith('$');
}

/** Get the display label for a completion being inserted as a tag. */
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

/** Color scheme for tag rendering, keyed by template prefix. */
export const TEMPLATE_COLORS: Record<
  string,
  { bg: string; border: string; fg: string }
> = {
  data: {
    bg: 'rgba(56, 132, 244, 0.22)',
    border: 'rgba(56, 132, 244, 0.55)',
    fg: '#7bb8ff',
  },
  local: {
    bg: 'rgba(156, 86, 214, 0.22)',
    border: 'rgba(156, 86, 214, 0.55)',
    fg: '#c9a0f0',
  },
  timestamp: {
    bg: 'rgba(72, 199, 142, 0.22)',
    border: 'rgba(72, 199, 142, 0.55)',
    fg: '#7ee6b8',
  },
  config: {
    bg: 'rgba(230, 162, 60, 0.22)',
    border: 'rgba(230, 162, 60, 0.55)',
    fg: '#f0c878',
  },
  autovar: {
    bg: 'rgba(214, 86, 156, 0.22)',
    border: 'rgba(214, 86, 156, 0.55)',
    fg: '#e8a0d0',
  },
  globalvar: {
    bg: 'rgba(214, 86, 156, 0.22)',
    border: 'rgba(214, 86, 156, 0.55)',
    fg: '#e8a0d0',
  },
  localvar: {
    bg: 'rgba(214, 86, 156, 0.22)',
    border: 'rgba(214, 86, 156, 0.55)',
    fg: '#e8a0d0',
  },
  dynamic: {
    bg: 'rgba(230, 162, 60, 0.22)',
    border: 'rgba(230, 162, 60, 0.55)',
    fg: '#f0c878',
  },
  static: {
    bg: 'rgba(230, 162, 60, 0.22)',
    border: 'rgba(230, 162, 60, 0.55)',
    fg: '#f0c878',
  },
  temp: {
    bg: 'rgba(230, 162, 60, 0.22)',
    border: 'rgba(230, 162, 60, 0.55)',
    fg: '#f0c878',
  },
  step: {
    bg: 'rgba(230, 162, 60, 0.22)',
    border: 'rgba(230, 162, 60, 0.55)',
    fg: '#f0c878',
  },
  foreach: {
    bg: 'rgba(72, 199, 142, 0.22)',
    border: 'rgba(72, 199, 142, 0.55)',
    fg: '#7ee6b8',
  },
  for: {
    bg: 'rgba(72, 199, 142, 0.22)',
    border: 'rgba(72, 199, 142, 0.55)',
    fg: '#7ee6b8',
  },
};

export const DEFAULT_TEMPLATE_COLOR = {
  bg: 'rgba(150, 150, 150, 0.22)',
  border: 'rgba(150, 150, 150, 0.55)',
  fg: '#c8c8c8',
};

export const FIELD_REF_COLOR = {
  bg: 'rgba(86, 182, 214, 0.22)',
  border: 'rgba(86, 182, 214, 0.55)',
  fg: '#7dd4f0',
};

/**
 * Convert a plain-text offset (0-based character count) to an LSP position
 * (0-based line and character). Used to map Slate cursor positions to LSP
 * positions for completions and diagnostics.
 */
export function offsetToLspPosition(
  plainText: string,
  offset: number
): { line: number; character: number } {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < plainText.length; i++) {
    if (plainText[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }

  return { line, character };
}

/**
 * Convert a Slate selection (paragraph/child path + offset within child) to
 * a plain-text offset. Walks the Slate document in order, counting characters
 * from text nodes and tag values until reaching the target node.
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
      totalOffset += 1; // newline between paragraphs
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

      // Count this child's contribution to the plain text
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

/** Map LSP CompletionItemKind to a Reqore icon name. */
export function mapCompletionKindToIcon(kind?: number): IReqoreIconName {
  switch (kind) {
    case 2:
      return 'CodeLine'; // Method
    case 3:
      return 'FunctionLine'; // Function
    case 5:
      return 'Database2Line'; // Field
    case 6:
      return 'ExchangeDollarLine'; // Variable
    case 14:
      return 'Key2Line'; // Keyword
    case 15:
      return 'CodeBoxLine'; // Snippet
    default:
      return 'CodeLine';
  }
}
