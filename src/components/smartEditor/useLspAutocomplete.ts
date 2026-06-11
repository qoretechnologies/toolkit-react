// Copyright 2026 Qore Technologies, s.r.o.

import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseEditor, Transforms } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { ILspCompletionItem } from '../../utils/lspClient.types';
import { mapCompletionKindToIcon } from './helpers';
import { ISlateConverter, ISlateElement, TCompletionInserter } from './types';

const DEFAULT_TRIGGER_CHARS = new Set(['.', ':', ' ']);
const DEBOUNCE_MS = 150;
// Defer `isFetching=true` so the "Loading…" stub only shows for genuinely
// slow responses; sub-250ms responses never set the flag.
const LOADER_DELAY_MS = 250;

const COMPLETION_KIND_LABELS: Record<number, string> = {
  2: 'Methods',
  3: 'Functions',
  5: 'Fields',
  6: 'Variables',
  14: 'Keywords',
  15: 'Snippets',
};

const COMPLETION_KIND_CHIPS: Record<number, string> = {
  1: 'Text',
  2: 'Method',
  3: 'Function',
  4: 'Constructor',
  5: 'Field',
  6: 'Variable',
  7: 'Class',
  8: 'Interface',
  9: 'Module',
  10: 'Property',
  11: 'Unit',
  12: 'Value',
  13: 'Enum',
  14: 'Keyword',
  15: 'Snippet',
  16: 'Color',
  17: 'File',
  18: 'Reference',
  19: 'Folder',
  20: 'EnumMember',
  21: 'Constant',
  22: 'Struct',
  23: 'Event',
  24: 'Operator',
  25: 'TypeParameter',
};

export interface ICompletionDropdownItem {
  label: string;
  value: string;
  icon?: string;
  description?: string;
  documentation?: ILspCompletionItem['documentation'];
  kindLabel?: string;
  // Non-standard LSP field; Qonsole emits it on mutating verbs.
  warning?: string;
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
  // True while anchored at a chip (via `openAtChip`); keeps the popover
  // open with a stub even when `items` is empty, unlike normal typing.
  isReplaceMode: boolean;
  isFetching: boolean;
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
  // Open in "replace mode" anchored at an existing tag chip; `chipRect`
  // is the chip's viewport rect, `chipPath` is forwarded to the inserter.
  openAtChip: (
    editor: BaseEditor & ReactEditor & HistoryEditor,
    chipPath: number[],
    chipRect: { left: number; bottom: number }
  ) => void;
  // Drops the spurious close Reqore's outside-click detector fires on the
  // same click that opened the popover; without it the chip click would
  // open then immediately close.
  handleExternalClose: (open: boolean) => void;
  // Bumped on every (re)open; used as the ReqorePopover `key` to force a
  // fresh mount so its internal `showing` state stays in sync with ours.
  popoverKey: number;
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
  const [isFetching, setIsFetching] = useState(false);
  // Handle for the deferred `setIsFetching(true)`; cleared on resolve or
  // close so the loader never flashes on a fast-resolved request.
  const fetchingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Partial token typed since the trigger opened the dropdown; the list
  // narrows to items whose `filterText || label` matches it.
  const [filterPrefix, setFilterPrefix] = useState('');
  const focusedIndexRef = useRef(0);
  const editorRef = useRef<(BaseEditor & ReactEditor & HistoryEditor) | null>(null);
  // "Replace mode": the user clicked a chip and the chosen completion
  // should replace that node. Holds the chip's Slate path, consumed by
  // the inserter via `ctx.replacementPath`.
  const replacingChipPathRef = useRef<number[] | null>(null);
  // Holds a chip-click request made before `isReady`; fired by the effect
  // below once the session connects so the click isn't dropped.
  const pendingChipRequestRef = useRef<{
    plainText: string;
    offset: number;
  } | null>(null);
  // Timestamp of the last `openAtChip`; `handleExternalClose` uses it to
  // suppress the close Reqore fires on the same mousedown that opened it.
  const justOpenedAtChipAtRef = useRef(0);
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  // See `popoverKey` in the result interface — forces a popover re-mount.
  const [popoverKey, setPopoverKey] = useState(0);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // Server completions omit the sigil from `label`/`filterText` (Qonsole
  // returns `list` not `/list`, DPQL `name` not `@name`), so strip it off
  // both sides before matching or the filter hides everything after the
  // trigger char.
  const filteredItems = useMemo(() => {
    if (!filterPrefix) return items;
    // Strip the leading sigil AND any member-access/namespace prefix up to
    // the last `.`/`:`. The token deliberately includes `.`/`:` (for paths
    // like `$data:state.field`), but filtering wants only the trailing
    // word — else after `arr.` typing `for` yields needle `arr.for`, which
    // matches no `forEach`-style label and hides every suggestion.
    const segment = filterPrefix
      .replace(/^[@$/-]+/, '')
      .replace(/^.*[.:]/, '');
    const needle = segment.toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const haystack = (item.raw.filterText ?? item.label)
        .toLowerCase()
        .replace(/^[@$/-]+/, '');
      return haystack.startsWith(needle) || haystack.includes(needle);
    });
  }, [items, filterPrefix]);

  useEffect(() => {
    if (focusedIndex >= filteredItems.length) {
      setFocusedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, focusedIndex]);

  const groups = useMemo((): ICompletionGroup[] => {
    if (filteredItems.length === 0) return [];

    // When the server populates `sortText` it has already ranked items;
    // use the flat list directly rather than re-ordering across kinds.
    // Qonsole takes this path; DPQL has no sortText and falls through.
    const hasSortText = filteredItems.some((i) => i.raw.sortText);
    if (hasSortText) {
      return [{ label: '', items: filteredItems }];
    }

    const groupMap = new Map<string, ICompletionDropdownItem[]>();
    for (const item of filteredItems) {
      const kind = item.metadata?.kind;
      const groupLabel = (kind && COMPLETION_KIND_LABELS[kind]) || 'Other';
      if (!groupMap.has(groupLabel)) {
        groupMap.set(groupLabel, []);
      }
      groupMap.get(groupLabel)!.push(item);
    }
    if (groupMap.size <= 1) {
      return [{ label: '', items: filteredItems }];
    }
    return Array.from(groupMap.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }, [filteredItems]);

  // Fires the LSP request and commits results into state. Separate from
  // the debounced wrapper so imperative callers (`openAtChip`) can bypass
  // the typing debounce.
  const performCompletionRequest = useCallback(
    async (
      plainText: string,
      offset: number,
      opts: { eager?: boolean } = {}
    ) => {
      // `eager` (default) opens the popover immediately, for explicit
      // triggers where items are coming. Autosuggest passes `eager: false`
      // so the popover stays closed until items arrive and doesn't flicker
      // in no-suggestion spots (inside a string, a dead-end identifier).
      const { eager = true } = opts;
      if (!isReady) return;
      // Re-measure the caret now that the debounce expired and Slate has
      // committed the char to the DOM. The earlier measure in
      // `onSlateChangeImpl` can fire before the DOM commit, where
      // `toDOMRange` throws or returns a stale range and the popover lands
      // at {top: 0, left: 0}.
      const editor = editorRef.current;
      if (editor && editor.selection) {
        try {
          const domRange = ReactEditor.toDOMRange(editor, editor.selection);
          const rect = domRange.getBoundingClientRect();
          // A 0,0,0,0 rect means the DOM still isn't ready — keep the
          // earlier measure rather than slamming back to origin.
          if (rect.width || rect.height || rect.left || rect.top) {
            setPosition({ left: rect.left, top: rect.bottom });
          }
        } catch {
          // Editor unmounted mid-request.
        }
      }
      if (eager) {
        setIsOpen(true);
        if (fetchingTimerRef.current !== null) {
          clearTimeout(fetchingTimerRef.current);
        }
        fetchingTimerRef.current = setTimeout(() => {
          setIsFetching(true);
          fetchingTimerRef.current = null;
        }, LOADER_DELAY_MS);
      }
      try {
        const lspItems = await getCompletions(plainText, offset);
        if (lspItems.length === 0) {
          setItems([]);
          // Replace mode keeps the popover open to show "No alternatives".
          if (!replacingChipPathRef.current) {
            setIsOpen(false);
          }
          return;
        }
        // Sort by `sortText` when present (Qonsole encodes rank into it);
        // otherwise preserve server order, as DPQL doesn't populate it.
        const sortedLspItems = lspItems.some((i) => i.sortText)
          ? [...lspItems].sort((a, b) =>
              (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label)
            )
          : lspItems;

        const mapped: ICompletionDropdownItem[] = sortedLspItems.map((item) => {
          const insertText = item.insertText || item.label;
          return {
            label: item.label,
            value: insertText,
            icon: mapCompletionKindToIcon(item.kind),
            description: item.detail,
            documentation: item.documentation,
            kindLabel:
              item.kind !== undefined
                ? COMPLETION_KIND_CHIPS[item.kind]
                : undefined,
            warning: item.warning,
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
      } finally {
        if (fetchingTimerRef.current !== null) {
          clearTimeout(fetchingTimerRef.current);
          fetchingTimerRef.current = null;
        }
        setIsFetching(false);
      }
    },
    [getCompletions, isReady]
  );

  const requestCompletions = useMemo(
    () => debounce(performCompletionRequest, DEBOUNCE_MS),
    [performCompletionRequest]
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
    setFilterPrefix('');
    setIsReplaceMode(false);
    setIsFetching(false);
    if (fetchingTimerRef.current !== null) {
      clearTimeout(fetchingTimerRef.current);
      fetchingTimerRef.current = null;
    }
    replacingChipPathRef.current = null;
    pendingChipRequestRef.current = null;
    requestCompletions.cancel();
  }, [requestCompletions]);

  const positionTrigger = useCallback(
    (editor: BaseEditor & ReactEditor & HistoryEditor) => {
      if (!editor.selection) return;
      try {
        const domRange = ReactEditor.toDOMRange(editor, editor.selection);
        const rect = domRange.getBoundingClientRect();
        // Viewport coordinates (+ `position: fixed` on the wrapper) avoid
        // parent-offset math that broke when the editor sat in a padded
        // panel and Popper overlapped the popover onto the input.
        setPosition({
          left: rect.left,
          top: rect.bottom,
        });
      } catch {
        // Editor may not be focused / mounted.
      }
    },
    []
  );

  // Scan back from the cursor to the start offset of the current token
  // (a word sequence optionally prefixed with `@` / `$` / `/`).
  const findTokenStart = useCallback(
    (plainText: string, cursorOffset: number): number => {
      let i = cursorOffset - 1;
      while (i >= 0 && /[\w.:{}-]/.test(plainText[i])) {
        i--;
      }
      if (i >= 0 && /[@$/-]/.test(plainText[i])) {
        i--;
      }
      return i + 1;
    },
    []
  );

  // Live ref to the change handler defined below — selectItem's retrigger
  // path runs in a timeout and must see the CURRENT impl, not whatever its
  // own (intentionally narrow) deps closed over. Same workaround as
  // `stableOnTagClick` in SmartEditor.
  const onSlateChangeImplRef = useRef<
    (editor: BaseEditor & ReactEditor & HistoryEditor, nodes: ISlateElement[]) => void
  >(() => undefined);

  const selectItem = useCallback(
    (item: ICompletionDropdownItem) => {
      const editor = editorRef.current;
      if (!editor) return;
      const replacementPath = replacingChipPathRef.current;
      // The typing path needs a live selection so the inserter knows how
      // much partial token to delete; replace mode works off a path.
      if (!editor.selection && !replacementPath) return;

      const nodes = editor.children as ISlateElement[];
      const plainText = converter.fromSlateNodes(nodes);
      const cursorOffset = editor.selection
        ? converter.selectionToOffset(
            nodes,
            editor.selection.anchor.path as number[],
            editor.selection.anchor.offset
          )
        : converter.selectionToOffset(nodes, replacementPath as number[], 0);

      inserter(item.raw, editor, {
        plainText,
        cursorOffset,
        replacementPath: replacementPath ?? undefined,
      });
      close();
      // Re-trigger completions for partial items (e.g. `$timestamp:` shows
      // sub-completions for the value).
      if (item.metadata?.retrigger) {
        setTimeout(() => {
          const newNodes = editor.children as ISlateElement[];
          onSlateChangeImplRef.current(editor, newNodes);
        }, 50);
      }
    },
    [close, inserter, converter]
  );

  useEffect(() => {
    // Keyboard nav operates on the filtered list, not the raw items.
    if (!isOpen || filteredItems.length === 0) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setFocusedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
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
          const item = filteredItems[focusedIndexRef.current];
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
        default: {
          // `commitCharacters`: typing a commit char accepts the item and
          // inserts the char (VS Code semantics).
          if (e.key.length !== 1) break;
          const focusedItem = filteredItems[focusedIndexRef.current];
          const commits = focusedItem?.raw.commitCharacters;
          if (!commits || !commits.includes(e.key)) break;
          const editor = editorRef.current;
          if (!editor) break;
          e.preventDefault();
          e.stopPropagation();
          // Don't double-insert when the server's edit already ends with
          // the committed char (e.g. `--limit=` for an `=`-committed flag).
          const inserted =
            focusedItem.raw.textEdit?.newText ??
            focusedItem.raw.insertText ??
            focusedItem.raw.label;
          selectItem(focusedItem);
          if (!inserted.endsWith(e.key)) {
            Transforms.insertText(editor, e.key);
          }
          break;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredItems, close, selectItem]);

  const onSlateChangeImpl = useCallback(
    (
      editor: BaseEditor & ReactEditor & HistoryEditor,
      nodes: ISlateElement[]
    ) => {
      editorRef.current = editor;
      if (!editor.selection || !isReady) {
        // Don't tear down replace mode just because the click that
        // opened it momentarily left the selection null — clicking a
        // void inline can do that.
        if (replacingChipPathRef.current) return;
        close();
        return;
      }
      // `onChange` fires for content edits AND selection-only changes
      // (cursor moves, click-to-focus). Only OPEN on content edits — else
      // clicking after a trigger char (e.g. the space in `/list services `)
      // pops the dropdown without the user typing. An all-`set_selection`
      // op batch is selection-only.
      const isContentChange = editor.operations.some(
        (op) => op.type !== 'set_selection'
      );
      if (!isContentChange) {
        // Replace mode anchors on a chip; the selection echo from the
        // opening click must not close it (outside-click handler does).
        if (isOpen && !replacingChipPathRef.current) {
          close();
        }
        return;
      }
      // A content edit in replace mode means the user typed instead of
      // picking a replacement — fall back to normal flow.
      if (replacingChipPathRef.current) {
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

      // After accepting a tag completion the cursor sits at offset 0 of a
      // fresh text node right after the tag, which in plain text looks
      // mid-`@field` token and would re-fire completions. Detect it via
      // Slate structure (prev sibling is a `tag` element) and don't reopen.
      const cursorPath = anchor.path as number[];
      if (
        anchor.offset === 0 &&
        cursorPath.length === 2 &&
        cursorPath[1] > 0
      ) {
        const paragraph = nodes[cursorPath[0]];
        const prevSibling = paragraph?.children[cursorPath[1] - 1];
        if (
          prevSibling &&
          'type' in prevSibling &&
          (prevSibling as ISlateElement).type === 'tag'
        ) {
          if (isOpen) {
            close();
          }
          return;
        }
      }

      if (triggerCharacters.has(charBefore)) {
        setFilterPrefix('');
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Typing inside a sigil-prefixed token.
      const tokenStart = findTokenStart(plainText, cursorOffset);
      const tokenPrefix = plainText[tokenStart];
      if (tokenPrefix && /[@$/]/.test(tokenPrefix)) {
        setFilterPrefix(plainText.slice(tokenStart, cursorOffset));
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Dropdown open and typing alphanumeric — keep narrowing.
      if (isOpen && /\w/.test(charBefore)) {
        setFilterPrefix(plainText.slice(tokenStart, cursorOffset));
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Autosuggest inside a bare identifier: quiet request. The DPQL
      // server is position-aware — it returns `[]` inside strings etc., so
      // `eager: false` keeps the dropdown from flickering where there's
      // nothing to suggest.
      if (/\w/.test(charBefore) && tokenPrefix && /\w/.test(tokenPrefix)) {
        setFilterPrefix(plainText.slice(tokenStart, cursorOffset));
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset, { eager: false });
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
  onSlateChangeImplRef.current = onSlateChangeImpl;

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

  // Imperative entry for the "replace this chip" flow. Anchors at the
  // chip's viewport rect and fires a request immediately, bypassing the
  // typing debounce.
  const openAtChip = useCallback(
    (
      editor: BaseEditor & ReactEditor & HistoryEditor,
      chipPath: number[],
      chipRect: { left: number; bottom: number }
    ) => {
      // Clicking the chip the dropdown is already anchored to closes it;
      // without this the outside-click suppression below re-opens it on
      // every chip click.
      const prevPath = replacingChipPathRef.current;
      if (
        isOpen &&
        prevPath &&
        prevPath.length === chipPath.length &&
        prevPath.every((seg, i) => seg === chipPath[i])
      ) {
        close();
        return;
      }
      editorRef.current = editor;
      replacingChipPathRef.current = chipPath;
      justOpenedAtChipAtRef.current = Date.now();
      setFilterPrefix('');
      setPosition({ left: chipRect.left, top: chipRect.bottom });
      // Pre-open for immediate feedback even before the LSP is ready (the
      // popover shows a "Connecting…" stub); items populate on response.
      setItems([]);
      setFocusedIndex(0);
      setIsReplaceMode(true);
      setIsOpen(true);
      setPopoverKey((k) => k + 1);
      const nodes = editor.children as ISlateElement[];
      const plainText = converter.fromSlateNodes(nodes);
      // Request at the END of the chip's span — the natural "what could
      // complete this token" position, so the server returns swappable
      // candidates.
      const chipChildIdx = chipPath[chipPath.length - 1];
      const paragraph = nodes[chipPath[0]];
      const chipNode = paragraph?.children?.[chipChildIdx];
      const chipText =
        chipNode && 'value' in chipNode
          ? String((chipNode as ISlateElement).value ?? '')
          : '';
      const chipStart = converter.selectionToOffset(nodes, chipPath, 0);
      const chipEnd = chipStart + chipText.length;
      if (isReady) {
        performCompletionRequest(plainText, chipEnd);
      } else {
        pendingChipRequestRef.current = { plainText, offset: chipEnd };
      }
    },
    [isReady, isOpen, close, converter, performCompletionRequest]
  );

  const handleExternalClose = useCallback(
    (open: boolean) => {
      if (open) return;
      // Within ~300ms of `openAtChip`, this close is the popover reacting
      // to the same mousedown that opened it — ignore.
      if (Date.now() - justOpenedAtChipAtRef.current < 300) {
        return;
      }
      close();
    },
    [close]
  );

  // Fire a deferred chip-click request once the session connects — covers
  // a click made during the initialize handshake.
  useEffect(() => {
    if (
      isReady &&
      pendingChipRequestRef.current &&
      replacingChipPathRef.current
    ) {
      const { plainText, offset } = pendingChipRequestRef.current;
      pendingChipRequestRef.current = null;
      performCompletionRequest(plainText, offset);
    }
  }, [isReady, performCompletionRequest]);

  return {
    // Expose the post-filter list as `items`; `groups` is filter-derived too.
    items: filteredItems,
    groups,
    isOpen,
    isReplaceMode,
    isFetching,
    focusedIndex,
    close,
    onSlateChange: onSlateChangeImpl,
    onItemSelect,
    openAtChip,
    handleExternalClose,
    popoverKey,
    position,
  };
}
