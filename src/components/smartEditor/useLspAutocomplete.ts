// Copyright 2026 Qore Technologies, s.r.o.
// Generic autocomplete state for the SmartEditor — trigger character
// detection, debounced LSP completion requests, dropdown item state,
// keyboard navigation, and item insertion. Lifted and generalized from
// qorus-ide's DPQL `useDpqlAutocomplete` hook. Language-specific behaviour
// (which characters trigger, how items are inserted) is supplied by the
// SmartEditor caller via props.

import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseEditor } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { ILspCompletionItem } from '../../utils/lspClient.types';
import { mapCompletionKindToIcon } from './helpers';
import { ISlateConverter, ISlateElement, TCompletionInserter } from './types';

const DEFAULT_TRIGGER_CHARS = new Set(['.', ':', ' ']);
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
  /** Raw LSP item — passed to the inserter so wrappers can use any LSP field. */
  raw: ILspCompletionItem;
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

export interface IUseLspAutocompleteOptions {
  /** Function that requests completions at a plain-text offset. */
  getCompletions: (plainText: string, offset: number) => Promise<ILspCompletionItem[]>;
  /** Whether the LSP session is ready to serve requests. */
  isReady: boolean;
  /** Characters that open the dropdown. Defaults to `{., :, space}`. */
  triggerCharacters?: Set<string>;
  /** Converter for Slate ↔ plain text and cursor-offset math. */
  converter: ISlateConverter;
  /**
   * Called when the user selects an item. Wrappers control whether the
   * value is inserted as a tag element, plain text, with re-trigger, etc.
   */
  inserter: TCompletionInserter;
}

export interface IUseLspAutocompleteResult {
  items: ICompletionDropdownItem[];
  groups: ICompletionGroup[];
  isOpen: boolean;
  focusedIndex: number;
  close: () => void;
  onSlateChange: (
    editor: BaseEditor & ReactEditor & HistoryEditor,
    nodes: ISlateElement[]
  ) => void;
  onItemSelect: (
    item: ICompletionDropdownItem,
    editor: BaseEditor & ReactEditor & HistoryEditor
  ) => void;
  position: { top: number; left: number };
}

export function useLspAutocomplete(
  opts: IUseLspAutocompleteOptions
): IUseLspAutocompleteResult {
  const {
    getCompletions,
    isReady,
    triggerCharacters = DEFAULT_TRIGGER_CHARS,
    converter,
    inserter,
  } = opts;

  const [items, setItems] = useState<ICompletionDropdownItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const focusedIndexRef = useRef(0);
  const editorRef = useRef<(BaseEditor & ReactEditor & HistoryEditor) | null>(null);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

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
    if (groupMap.size <= 1) {
      return [{ label: '', items }];
    }
    return Array.from(groupMap.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }, [items]);

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
          const mapped: ICompletionDropdownItem[] = lspItems.map((item) => {
            const insertText = item.insertText || item.label;
            return {
              label: item.label,
              value: insertText,
              icon: mapCompletionKindToIcon(item.kind),
              description: item.detail,
              raw: item,
              metadata: {
                insertTextFormat: item.insertTextFormat,
                retrigger: insertText.endsWith(':'),
                kind: item.kind,
              },
            };
          });
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

  const positionTrigger = useCallback(
    (editor: BaseEditor & ReactEditor & HistoryEditor) => {
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
    },
    []
  );

  /**
   * Scan backwards from cursor to find the start of the current token.
   * Generic enough for any language whose tokens are alphanumeric word
   * sequences possibly prefixed with a special character (DPQL: `@` / `$`;
   * Qonsole: `/`). Returns the start offset in `plainText`.
   */
  const findTokenStart = useCallback(
    (plainText: string, cursorOffset: number): number => {
      let i = cursorOffset - 1;
      while (i >= 0 && /[\w.:{}-]/.test(plainText[i])) {
        i--;
      }
      // Include a leading sigil if present — `@`, `$`, `/`, `-`.
      if (i >= 0 && /[@$/-]/.test(plainText[i])) {
        i--;
      }
      return i + 1;
    },
    []
  );

  const selectItem = useCallback(
    (item: ICompletionDropdownItem) => {
      const editor = editorRef.current;
      if (!editor || !editor.selection) return;
      // Reconstruct the inserter context from the live editor state so the
      // inserter can apply `textEdit` ranges (the server's authoritative
      // "delete this span, then insert this text" instruction). Without
      // this context the inserter has no way to know how many chars of
      // partial token the user typed before requesting completions.
      const nodes = editor.children as ISlateElement[];
      const plainText = converter.fromSlateNodes(nodes);
      const cursorOffset = converter.selectionToOffset(
        nodes,
        editor.selection.anchor.path as number[],
        editor.selection.anchor.offset
      );
      inserter(item.raw, editor, { plainText, cursorOffset });
      close();
      // Re-trigger completions for partial items (e.g. `$timestamp:` shows
      // sub-completions for the value).
      if (item.metadata?.retrigger) {
        setTimeout(() => {
          const newNodes = editor.children as ISlateElement[];
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          onSlateChangeImpl(editor, newNodes);
        }, 50);
      }
    },
    // onSlateChangeImpl is referenced below; deps deliberately omit it.
    [close, inserter, converter]
  );

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
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, items, close, selectItem]);

  const onSlateChangeImpl = useCallback(
    (
      editor: BaseEditor & ReactEditor & HistoryEditor,
      nodes: ISlateElement[]
    ) => {
      editorRef.current = editor;
      if (!editor.selection || !isReady) {
        close();
        return;
      }
      const { anchor } = editor.selection;
      const plainText = converter.fromSlateNodes(nodes);
      const cursorOffset = converter.selectionToOffset(
        nodes,
        anchor.path as number[],
        anchor.offset
      );
      const charBefore = cursorOffset > 0 ? plainText[cursorOffset - 1] : '';

      // Trigger on the configured trigger chars.
      if (triggerCharacters.has(charBefore)) {
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Also trigger if we're typing inside a sigil-prefixed token.
      const tokenStart = findTokenStart(plainText, cursorOffset);
      const tokenPrefix = plainText[tokenStart];
      if (tokenPrefix && /[@$/]/.test(tokenPrefix)) {
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // If dropdown is open and the user is typing alphanumeric, keep
      // narrowing — re-request with the new cursor position.
      if (isOpen && /\w/.test(charBefore)) {
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      close();
    },
    [
      isReady,
      isOpen,
      close,
      findTokenStart,
      positionTrigger,
      requestCompletions,
      triggerCharacters,
      converter,
    ]
  );

  const onItemSelect = useCallback(
    (
      item: ICompletionDropdownItem,
      editor: BaseEditor & ReactEditor & HistoryEditor
    ) => {
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
