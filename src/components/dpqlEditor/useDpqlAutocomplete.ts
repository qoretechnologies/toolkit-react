// Copyright 2026 Qore Technologies, s.r.o.
// Autocomplete state for the DpqlEditor — detects trigger characters,
// requests completions via LSP, manages dropdown items + keyboard nav, and
// handles tag-vs-text insertion. Lifted from qorus-ide
// DpqlRichtext/useDpqlAutocomplete.ts on the feature/dpql-editor branch
// with the IDpql* completion-item type swapped for the generic ILsp*.

import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseEditor, Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { ILspCompletionItem } from '../../utils/lspClient.types';
import {
  getTagLabel,
  isTagCompletion,
  mapCompletionKindToIcon,
  slateSelectionToOffset,
  slateToPlainText,
} from './helpers';
import { ISlateElement } from './types';

const TRIGGER_CHARS = new Set(['@', '$', '.', ':', ' ']);
const DEBOUNCE_MS = 150;

/** LSP CompletionItemKind values → group labels for the dropdown. */
const COMPLETION_KIND_LABELS: Record<number, string> = {
  2: 'Methods',
  3: 'Functions',
  5: 'Fields',
  6: 'Variables',
  14: 'Keywords',
  15: 'Snippets',
};

export interface ICompletionDropdownItem {
  label: string;
  value: string;
  icon?: string;
  description?: string;
  metadata?: {
    insertTextFormat?: number;
    retrigger?: boolean;
    kind?: number;
  };
}

export interface ICompletionGroup {
  label: string;
  items: ICompletionDropdownItem[];
}

export interface IUseDpqlAutocompleteOptions {
  getCompletions: (plainText: string, offset: number) => Promise<ILspCompletionItem[]>;
  isReady: boolean;
}

export interface IUseDpqlAutocompleteResult {
  /** Completion dropdown items (empty = hide dropdown). */
  items: ICompletionDropdownItem[];
  /** Items grouped by LSP completion kind. */
  groups: ICompletionGroup[];
  /** Whether the autocomplete dropdown should be shown. */
  isOpen: boolean;
  /** Index of the currently focused item (for keyboard nav). */
  focusedIndex: number;
  /** Close the autocomplete dropdown. */
  close: () => void;
  /** Handle Slate `onChange` — checks for trigger characters and requests completions. */
  onSlateChange: (editor: BaseEditor & ReactEditor, elements: ISlateElement[]) => void;
  /** Handle selecting a completion item. */
  onItemSelect: (
    item: ICompletionDropdownItem,
    editor: BaseEditor & ReactEditor
  ) => void;
  /** Position of the autocomplete popover relative to the editor container. */
  position: { top: number; left: number };
}

/**
 * Manages autocomplete state. Detects trigger characters, requests
 * completions, handles keyboard navigation at the document level so the
 * editor never loses focus.
 */
export function useDpqlAutocomplete(
  opts: IUseDpqlAutocompleteOptions
): IUseDpqlAutocompleteResult {
  const { getCompletions, isReady } = opts;

  const [items, setItems] = useState<ICompletionDropdownItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const focusedIndexRef = useRef(0);
  const tokenStartRef = useRef<number>(0);
  const editorRef = useRef<(BaseEditor & ReactEditor) | null>(null);

  // Keep ref in sync with state.
  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // Group items by LSP completion kind.
  const groups = useMemo((): ICompletionGroup[] => {
    if (items.length === 0) return [];

    const groupMap = new Map<string, ICompletionDropdownItem[]>();

    for (const item of items) {
      const kind = item.metadata?.kind;
      const groupLabel = (kind && COMPLETION_KIND_LABELS[kind]) || 'Other';

      if (!groupMap.has(groupLabel)) {
        groupMap.set(groupLabel, []);
      }
      groupMap.get(groupLabel)!.push(item);
    }

    // If only one group, don't bother with headers.
    if (groupMap.size <= 1) {
      return [{ label: '', items }];
    }

    return Array.from(groupMap.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }, [items]);

  // Debounced completion request.
  const requestCompletions = useMemo(
    () =>
      debounce(async (plainText: string, offset: number) => {
        if (!isReady) return;

        try {
          const lspItems = await getCompletions(plainText, offset);

          if (lspItems.length === 0) {
            setItems([]);
            setIsOpen(false);
            return;
          }

          const mapped: ICompletionDropdownItem[] = lspItems.map((item) => ({
            label: item.label,
            value: item.insertText || item.label,
            icon: mapCompletionKindToIcon(item.kind),
            description: item.detail,
            metadata: {
              insertTextFormat: item.insertTextFormat,
              retrigger: (item.insertText || item.label).endsWith(':'),
              kind: item.kind,
            },
          }));

          setItems(mapped);
          setFocusedIndex(0);
          setIsOpen(true);
        } catch {
          setItems([]);
          setIsOpen(false);
        }
      }, DEBOUNCE_MS),
    [getCompletions, isReady]
  );

  // Cancel debounced request on unmount.
  useEffect(() => {
    return () => {
      requestCompletions.cancel();
    };
  }, [requestCompletions]);

  const close = useCallback(() => {
    setIsOpen(false);
    setItems([]);
    setFocusedIndex(0);
    requestCompletions.cancel();
  }, [requestCompletions]);

  // Compute popover position relative to the editor container.
  const positionTrigger = useCallback((editor: BaseEditor & ReactEditor) => {
    if (!editor.selection) return;

    try {
      const domRange = ReactEditor.toDOMRange(editor, editor.selection);
      const rect = domRange.getBoundingClientRect();
      const editorEl = ReactEditor.toDOMNode(editor, editor);
      const editorRect = editorEl.getBoundingClientRect();

      setPosition({
        left: rect.left - editorRect.left,
        top: rect.bottom - editorRect.top,
      });
    } catch {
      // Editor may not be focused / mounted.
    }
  }, []);

  /**
   * Scan backwards from cursor to find the start of the current token.
   * Returns the start offset (0-based) in the plain text.
   */
  const findTokenStart = useCallback(
    (plainText: string, cursorOffset: number): number => {
      let i = cursorOffset - 1;

      // Walk back over word chars, dots, colons, braces, hyphens.
      while (i >= 0 && /[\w.:{}-]/.test(plainText[i])) {
        i--;
      }

      // Include a leading $ or @ if present.
      if (i >= 0 && (plainText[i] === '$' || plainText[i] === '@')) {
        i--;
      }

      return i + 1;
    },
    []
  );

  // Shared item selection logic used by both click and keyboard handlers.
  const selectItem = useCallback(
    (item: ICompletionDropdownItem) => {
      const editor = editorRef.current;
      if (!editor) return;

      const { selection } = editor;
      if (!selection) {
        close();
        return;
      }

      // Delete the partial token the user typed.
      const elements = editor.children as ISlateElement[];
      const plainText = slateToPlainText(elements);
      const cursorOffset = slateSelectionToOffset(
        elements,
        selection.anchor.path as number[],
        selection.anchor.offset
      );
      const tokenStart = findTokenStart(plainText, cursorOffset);
      const charsToDelete = cursorOffset - tokenStart;

      if (charsToDelete > 0) {
        for (let i = 0; i < charsToDelete; i++) {
          Editor.deleteBackward(editor, { unit: 'character' });
        }
      }

      const insertValue = item.value;

      if (isTagCompletion(insertValue)) {
        // Insert as a tag element.
        const tagElement: ISlateElement = {
          type: 'tag',
          value: insertValue,
          label: getTagLabel(insertValue),
          children: [{ text: '' }],
        };
        Transforms.insertNodes(editor, tagElement as any);
        Transforms.move(editor);
      } else {
        // Insert as plain text (keywords, operators, functions).
        Transforms.insertText(editor, insertValue);
      }

      ReactEditor.focus(editor);
      close();

      // Re-trigger completions for partial items (e.g., `$timestamp:` should
      // show sub-completions for the value).
      if (item.metadata?.retrigger) {
        setTimeout(() => {
          const newElements = editor.children as ISlateElement[];
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          onSlateChangeImpl(editor, newElements);
        }, 50);
      }
    },
    // onSlateChangeImpl is referenced below — selectItem is stable because
    // findTokenStart / close are stable. The deps list intentionally
    // excludes onSlateChangeImpl to avoid a circular dependency.
    [close, findTokenStart]
  );

  // Keyboard navigation: intercept ArrowDown/Up/Enter/Escape on the document
  // when autocomplete is open. Uses capture phase so we get the event before
  // Slate's own handlers.
  useEffect(() => {
    if (!isOpen || items.length === 0) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab': {
          e.preventDefault();
          e.stopPropagation();
          const item = items[focusedIndexRef.current];
          if (item && editorRef.current) {
            selectItem(item);
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          close();
          break;
        default:
          // No-op for other keys.
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, items, close, selectItem]);

  const onSlateChangeImpl = useCallback(
    (editor: BaseEditor & ReactEditor, elements: ISlateElement[]) => {
      // Store editor ref for keyboard selection.
      editorRef.current = editor;

      if (!editor.selection || !isReady) {
        close();
        return;
      }

      const { anchor } = editor.selection;
      const plainText = slateToPlainText(elements);
      const cursorOffset = slateSelectionToOffset(
        elements,
        anchor.path as number[],
        anchor.offset
      );

      const charBefore = cursorOffset > 0 ? plainText[cursorOffset - 1] : '';

      // Trigger on specific characters.
      if (TRIGGER_CHARS.has(charBefore)) {
        tokenStartRef.current = findTokenStart(plainText, cursorOffset);
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Also trigger if we're typing inside a token that started with @ or $.
      const tokenStart = findTokenStart(plainText, cursorOffset);
      const tokenPrefix = plainText[tokenStart];
      if (tokenPrefix === '@' || tokenPrefix === '$') {
        tokenStartRef.current = tokenStart;
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // If we're typing alphanumeric and the dropdown is already open, keep
      // requesting (lets the user narrow the completion list).
      if (isOpen && /\w/.test(charBefore)) {
        tokenStartRef.current = tokenStart;
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      close();
    },
    [isReady, isOpen, close, findTokenStart, positionTrigger, requestCompletions]
  );

  const onItemSelect = useCallback(
    (item: ICompletionDropdownItem, editor: BaseEditor & ReactEditor) => {
      editorRef.current = editor;
      selectItem(item);
    },
    [selectItem]
  );

  return {
    items,
    groups,
    isOpen,
    focusedIndex,
    close,
    onSlateChange: onSlateChangeImpl,
    onItemSelect,
    position,
  };
}
