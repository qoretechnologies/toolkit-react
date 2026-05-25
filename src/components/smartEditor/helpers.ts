// Copyright 2026 Qore Technologies, s.r.o.
// Generic helpers for the SmartEditor primitive — language-agnostic
// plain-text ↔ Slate conversion defaults, cursor-position math, and
// completion-icon mapping. Language-specific behaviour (DPQL's
// `@field` / `$template` tags, Qonsole's command tokens, …) lives in
// the wrapper layer's own helpers and overrides these defaults via the
// `converter` prop on `SmartEditor`.

import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ISlateConverter, ISlateElement, ISlateText } from './types';

/**
 * Default plain-text → Slate conversion. Splits on `\n`; each line becomes
 * a paragraph with a single text child. No tag-element recognition — that's
 * the wrapper's job (e.g. `dpqlEditor/dpqlHelpers.ts`).
 */
export function defaultToSlateNodes(text: string): ISlateElement[] {
  if (!text) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  return text.split('\n').map((line) => ({
    type: 'paragraph' as const,
    children: [{ text: line }],
  }));
}

/**
 * Default Slate → plain-text conversion. Mirrors `defaultToSlateNodes`.
 * Walks paragraph children and concatenates text. Tag-element values are
 * emitted as their raw `value` string (a wrapper that uses tags will
 * usually override this to control quoting/etc.).
 */
export function defaultFromSlateNodes(nodes: ISlateElement[]): string {
  return nodes.map(processElement).join('\n');
}

function processElement(element: any): string {
  if ('text' in element && element.type !== 'tag') {
    return element.text;
  }
  if (element.type === 'tag') {
    return element.value?.toString() ?? '';
  }
  if (element.children) {
    return element.children.map(processElement).join('');
  }
  return '';
}

/**
 * Default Slate-selection → plain-text-offset conversion. Walks the
 * Slate document in order, counting characters from text nodes and tag
 * values until reaching the target node. Generic enough for any wrapper
 * that uses `{type: 'paragraph', children: [text|tag, …]}` structure;
 * DPQL overrides this to handle its `metadata.quoted` tag option.
 */
export function defaultSelectionToOffset(
  nodes: ISlateElement[],
  anchorPath: number[],
  anchorOffset: number
): number {
  let totalOffset = 0;
  const targetParagraphIdx = anchorPath[0];
  const targetChildIdx = anchorPath[1];

  for (let pIdx = 0; pIdx < nodes.length; pIdx++) {
    if (pIdx > 0) {
      totalOffset += 1; // newline between paragraphs
    }
    if (pIdx > targetParagraphIdx) break;

    const paragraph = nodes[pIdx];
    const children = paragraph.children || [];

    for (let cIdx = 0; cIdx < children.length; cIdx++) {
      const child = children[cIdx];
      const isTag = 'type' in child && child.type === 'tag';
      const isText = 'text' in child && !isTag;

      if (pIdx === targetParagraphIdx && cIdx === targetChildIdx) {
        if (isText) {
          totalOffset += anchorOffset;
        } else if (isTag) {
          totalOffset += anchorOffset;
        }
        return totalOffset;
      }

      if (isText) {
        totalOffset += (child as ISlateText).text.length;
      } else if (isTag) {
        const tagValue = (child as ISlateElement).value?.toString() ?? '';
        totalOffset += tagValue.length;
      }
    }
  }

  return totalOffset;
}

/** The default `ISlateConverter` exposed for consumers that pass no override. */
export const defaultSlateConverter: ISlateConverter = {
  toSlateNodes: defaultToSlateNodes,
  fromSlateNodes: defaultFromSlateNodes,
  selectionToOffset: defaultSelectionToOffset,
};

/**
 * Convert a plain-text offset (0-based character count) to an LSP
 * Position (0-based line + UTF-16 character). Used by `useLspSession`
 * to translate Slate cursor positions to LSP coordinates for
 * `textDocument/completion` etc.
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
 * Inverse of `offsetToLspPosition` — convert an LSP `{line, character}`
 * back into a plain-text character offset. Used when applying a
 * `textEdit.range` from a completion item: the server speaks LSP
 * positions, the editor inserter speaks plain-text offsets.
 */
export function lspPositionToOffset(
  plainText: string,
  position: { line: number; character: number }
): number {
  let line = 0;
  for (let i = 0; i < plainText.length; i++) {
    if (line === position.line) {
      return i + position.character;
    }
    if (plainText[i] === '\n') {
      line++;
    }
  }
  // Position is past end of document — clamp to end + character (best-effort).
  return plainText.length;
}

/** Map an LSP CompletionItemKind enum value to a Reqore icon name. */
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
