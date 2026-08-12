// Copyright 2026 Qore Technologies, s.r.o.
// Pure helpers for the shared <Composer>. No DOM/app coupling — safe on any surface.

import type { ClipboardEvent, KeyboardEvent } from 'react';
import type { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';

/** The Slate value for an empty rich editor — a single empty paragraph. */
export const EMPTY_RICH_VALUE: IReqoreRichTextEditorProps['value'] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

/**
 * Rich editor value → plain string. Top-level blocks join with `\n` so a
 * multi-paragraph message (a support reply, a pasted log) survives as real
 * newlines; within a block, text leaves and `tag` values concatenate. Mirrors
 * qorus-ide's `richtextToString` but newline-preserving for multi-line composers.
 */
export const richValueToString = (value: IReqoreRichTextEditorProps['value']): string => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  const nodeText = (node: any): string => {
    if (node == null) {
      return '';
    }
    if (typeof node.text === 'string') {
      return node.text;
    }
    if (node.type === 'tag') {
      return node.value?.toString() ?? '';
    }
    if (Array.isArray(node.children)) {
      return node.children.map(nodeText).join('');
    }
    return '';
  };
  return value.map(nodeText).join('\n');
};

/** Plain string → rich editor value: one paragraph per line, so `setText`
 *  round-trips with `richValueToString`. */
export const richValueFromString = (text: string): IReqoreRichTextEditorProps['value'] => {
  if (!text) {
    return EMPTY_RICH_VALUE;
  }
  return text.split('\n').map((line) => ({
    type: 'paragraph',
    children: [{ text: line }],
  })) as IReqoreRichTextEditorProps['value'];
};

/** Image files present on a clipboard paste (a screenshot, a copied image), so
 *  pasting-to-attach works on any composer without an IDE dependency. */
export const clipboardImages = (event: ClipboardEvent): File[] => {
  const images: File[] = [];
  for (const item of Array.from(event.clipboardData?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        images.push(file);
      }
    }
  }
  return images;
};

/** Enter with no modifier — the "submit" chord (Shift/Ctrl/Alt/Meta+Enter insert
 *  a newline instead). */
export const isPlainSubmitEnter = (
  e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>
): boolean => e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
