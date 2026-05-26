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
/**
 * Delay before `isFetching=true` is set after a completion request
 * fires. Mirrors VS Code's "delay progress indicator" pattern — only
 * show the "Loading completions…" stub for genuinely slow responses.
 * Fast responses (mock, warm cache, sub-250ms live) never set the
 * flag at all, so no visible flash.
 */
const LOADER_DELAY_MS = 250;

/** LSP CompletionItemKind values → group labels for the dropdown. */
/** LSP `CompletionItemKind` → plural group header in the dropdown. */
const COMPLETION_KIND_LABELS: Record<number, string> = {
  2: 'Methods',
  3: 'Functions',
  5: 'Fields',
  6: 'Variables',
  14: 'Keywords',
  15: 'Snippets',
};

/**
 * LSP `CompletionItemKind` → short singular chip label rendered on the
 * right of each row (e.g. "Field", "Keyword"). Falls back to no chip
 * when the kind isn't in the table.
 */
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
  /**
   * Short type hint (LSP `item.detail`) — rendered as the row's
   * subtitle. Typically a single word like "string", "int", "boolean".
   */
  description?: string;
  /**
   * Rich documentation (LSP `item.documentation`). Wrappers can render
   * it as markdown (when `kind === 'markdown'`) or plain text. Currently
   * surfaced via the hover-tooltip on each row.
   */
  documentation?: ILspCompletionItem['documentation'];
  /**
   * Short singular kind label (e.g. "Field", "Keyword") rendered as a
   * right-aligned chip on the row. `undefined` when the LSP kind isn't
   * one of the standard values.
   */
  kindLabel?: string;
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
  /**
   * True while the dropdown is anchored at an existing chip (via
   * `openAtChip`) — SmartEditor uses this to keep the popover rendered
   * with a "Connecting…" / "No alternatives" stub even when `items` is
   * empty (whereas normal typing closes the popover on empty results).
   */
  isReplaceMode: boolean;
  /**
   * True while a completion request is in flight. SmartEditor uses
   * this together with `items.length === 0` to render a "Loading…"
   * stub inside the popover during slow LSP roundtrips.
   */
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
  /**
   * Open the dropdown in "replace mode" at the position of an existing
   * tag chip. The chip stays visible while the user picks a new
   * completion; the inserter then atomically swaps the chip for the
   * chosen value. Triggered by SmartEditor's default chip click handler.
   *
   * `chipRect` is the chip's viewport-coordinate bounding rect — the
   * popover anchors at `(left, bottom)`. `chipPath` and `chipOffset`
   * are forwarded to the inserter so it knows which node to replace
   * and where (in plain text) the replacement falls.
   */
  openAtChip: (
    editor: BaseEditor & ReactEditor & HistoryEditor,
    chipPath: number[],
    chipRect: { left: number; bottom: number }
  ) => void;
  /**
   * Callback for the popover's `onToggleChange` — drops the spurious
   * close event that Reqore's outside-click detector fires on the same
   * click that opened the popover (via `openAtChip`). Without this
   * filter, the chip click would open and immediately close, and a
   * second chip click would no-op.
   */
  handleExternalClose: (open: boolean) => void;
  /**
   * Monotonically-increasing key that changes whenever the dropdown is
   * (re)opened — particularly via `openAtChip`. SmartEditor passes this
   * as the popover's `key` so a fresh `ReqorePopover` is mounted each
   * time, keeping its internal `showing` state in sync with ours.
   */
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
  // True while a completion request is in flight AND we've shown the
  // popover. Used by SmartEditor to render a "Loading…" stub instead
  // of the bare empty-list flash on slow LSP responses. Set on a
  // `LOADER_DELAY_MS` timer rather than synchronously — fast
  // responses clear before the timer fires, so the stub never flashes
  // on a sub-250ms response.
  const [isFetching, setIsFetching] = useState(false);
  // The setTimeout handle for the deferred `setIsFetching(true)`.
  // Cleared by either: (a) the request resolving (success / error),
  // or (b) `close()` being called. Either path nulls the ref and
  // calls clearTimeout to ensure the loader never flashes on a
  // fast-resolved request.
  const fetchingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The partial token the user has typed since the trigger opened the
  // dropdown — e.g. when typing `@status`, the prefix evolves as `@` →
  // `@s` → `@st` → … The dropdown should narrow to items whose
  // `filterText || label` starts with this prefix (LSP convention: the
  // server returns a candidate set, the client filters as the user
  // types). Empty string when no token is being typed yet.
  const [filterPrefix, setFilterPrefix] = useState('');
  const focusedIndexRef = useRef(0);
  const editorRef = useRef<(BaseEditor & ReactEditor & HistoryEditor) | null>(null);
  // When set, the dropdown is open in "replace mode" — the user clicked
  // an existing tag chip and the chosen completion should atomically
  // replace that node (rather than insert at the cursor). The path
  // points to the chip's Slate location; the inserter consumes it via
  // `ctx.replacementPath`.
  const replacingChipPathRef = useRef<number[] | null>(null);
  // Set when the user clicked a chip before the LSP session was ready.
  // The completion request is deferred and fired by the effect below
  // once `isReady` flips on — so a click made during the connection
  // race doesn't get silently dropped.
  const pendingChipRequestRef = useRef<{
    plainText: string;
    offset: number;
  } | null>(null);
  // Timestamp of the most recent `openAtChip` call. SmartEditor's
  // `handleExternalClose` consults this to suppress the close that
  // Reqore's popover fires from its own mousedown-outside detector on
  // the very same click that opened the dropdown. Without the
  // suppression, the chip click would open AND immediately close the
  // popover — and a second chip click would no-op because the popover's
  // toggle state is already "open then closed" from the first burst.
  const justOpenedAtChipAtRef = useRef(0);
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  // Bumped on every `openAtChip` call. SmartEditor uses it as the
  // ReqorePopover `key` — when it changes, React unmounts and re-mounts
  // the popover, which re-fires its `openOnMount` and resyncs Reqore's
  // internal open state with ours. Without this bump, ReqorePopover's
  // outside-click detector can close its internal state while our
  // `isOpen` stays true, leaving the popover stuck mounted-but-closed
  // (no amount of `setIsOpen(true)` re-opens it).
  const [popoverKey, setPopoverKey] = useState(0);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // Items the dropdown actually shows after the client-side prefix
  // filter is applied. Case-insensitive match against the
  // server-supplied `filterText` (falls back to `label`).
  //
  // The needle is built by stripping any leading sigil character
  // (`@`, `$`, `/`, `-`) from `filterPrefix` — the server normally
  // returns items WITHOUT the sigil baked into `label` / `filterText`
  // (e.g. Qonsole returns `list` not `/list`, DPQL returns `name`
  // not `@name` in completion items). A literal-prefix match on the
  // sigil-ful form filters everything out as soon as the user types
  // one more char after the trigger; stripping the sigil restores the
  // expected "narrow as you type" behaviour.
  //
  // We also try a substring match as a fallback so e.g. `@stat` still
  // matches an item whose label is `status` — common when the LSP
  // returns a static catalog and lets the client narrow.
  const filteredItems = useMemo(() => {
    if (!filterPrefix) return items;
    const stripped = filterPrefix.replace(/^[@$/-]+/, '');
    const needle = stripped.toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const haystack = (item.raw.filterText ?? item.label)
        .toLowerCase()
        .replace(/^[@$/-]+/, '');
      // Prefer prefix match (typical LSP completion shape); fall
      // through to a substring match if no prefix hit.
      return haystack.startsWith(needle) || haystack.includes(needle);
    });
  }, [items, filterPrefix]);

  // Keep the focused index from running off the end of the filtered list.
  useEffect(() => {
    if (focusedIndex >= filteredItems.length) {
      setFocusedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, focusedIndex]);

  const groups = useMemo((): ICompletionGroup[] => {
    if (filteredItems.length === 0) return [];

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

  // Underlying fetch — synchronously kicks off the LSP request and
  // commits results into state. Extracted from the debounced wrapper so
  // imperative entry points (e.g. `openAtChip` on tag-click) can fire it
  // immediately, bypassing the typing-debounce.
  const performCompletionRequest = useCallback(
    async (plainText: string, offset: number) => {
      if (!isReady) return;
      // Re-measure the caret position just before opening — by this
      // point the typing-debounce has expired (~150ms) and Slate has
      // committed the new character to the DOM, so
      // `ReactEditor.toDOMRange` returns a valid rect. The earlier
      // call inside `onSlateChangeImpl` can fire during Slate's
      // onChange BEFORE the DOM commit, in which case `toDOMRange`
      // throws or returns the previous (stale) range and the popover
      // ends up at the initial `{top: 0, left: 0}`.
      const editor = editorRef.current;
      if (editor && editor.selection) {
        try {
          const domRange = ReactEditor.toDOMRange(editor, editor.selection);
          const rect = domRange.getBoundingClientRect();
          // Only update when we got a meaningful rect — a 0,0,0,0 rect
          // means the DOM still isn't ready; keep whatever the earlier
          // measure produced rather than slamming back to origin.
          if (rect.width || rect.height || rect.left || rect.top) {
            setPosition({ left: rect.left, top: rect.bottom });
          }
        } catch {
          // Editor unmounted mid-request — proceed with whatever
          // position state we last computed.
        }
      }
      // Open the popover immediately so the user sees feedback on
      // the click / keystroke. `isFetching` is set ONLY after a
      // delay — fast responses (mock, warm cache, sub-250ms live)
      // never set the flag and never flash the "Loading…" stub.
      setIsOpen(true);
      if (fetchingTimerRef.current !== null) {
        clearTimeout(fetchingTimerRef.current);
      }
      fetchingTimerRef.current = setTimeout(() => {
        setIsFetching(true);
        fetchingTimerRef.current = null;
      }, LOADER_DELAY_MS);
      try {
        const lspItems = await getCompletions(plainText, offset);
        if (lspItems.length === 0) {
          setItems([]);
          // Keep popover open in replace mode so the user sees "No
          // alternatives available" rather than a silent close.
          if (!replacingChipPathRef.current) {
            setIsOpen(false);
          }
          return;
        }
        const mapped: ICompletionDropdownItem[] = lspItems.map((item) => {
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
        // Cancel the pending "show loader" timer AND clear any
        // already-set fetching state. Idempotent.
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
    // Cancel any pending "show loader" timer — the popover is closing,
    // we don't want the stub to pop up mid-close.
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
        // Position the popover anchor in VIEWPORT coordinates. Earlier
        // versions used offset-from-editor-container which broke when the
        // editor was wrapped in a panel with non-zero padding — the
        // anchor span ended up inside the editor body and Popper put the
        // popover overlapping the input. Viewport coords + `position:
        // fixed` on the wrapper avoids any parent-offset math.
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
      if (!editor) return;
      const replacementPath = replacingChipPathRef.current;
      // Normal (typing) path requires a live selection — the inserter
      // computes how many chars of partial token to delete before
      // inserting. Replace mode (chip-click) operates on a path instead
      // and doesn't need a selection.
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
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          onSlateChangeImpl(editor, newNodes);
        }, 50);
      }
    },
    // onSlateChangeImpl is referenced below; deps deliberately omit it.
    [close, inserter, converter]
  );

  useEffect(() => {
    // Keyboard nav operates on the FILTERED list (what the user sees),
    // not the server-returned raw items.
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
        default:
          break;
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
      // Slate's `onChange` fires for BOTH content edits and selection-only
      // changes (cursor moves, click-to-focus, etc.). The trigger-detection
      // logic below should only OPEN the dropdown on content edits —
      // otherwise clicking into a document whose char-before-cursor happens
      // to be a trigger character (e.g. cursor lands after a space in
      // `/list services `) pops the dropdown open without the user typing
      // anything.
      //
      // `editor.operations` is the array of operations applied in this
      // change batch. If every operation is `set_selection`, the change
      // is selection-only — keep any open dropdown closed and bail.
      const isContentChange = editor.operations.some(
        (op) => op.type !== 'set_selection'
      );
      if (!isContentChange) {
        // Replace mode anchors on a chip — selection echoes from the
        // click that opened the dropdown must NOT close it. The popover's
        // outside-click handler closes the dropdown when the user moves
        // focus elsewhere.
        if (isOpen && !replacingChipPathRef.current) {
          close();
        }
        return;
      }
      // Any content edit while in replace mode cancels — the user
      // started typing instead of picking a replacement, so step back
      // to normal completion flow.
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

      // After inserting a tag completion (e.g. accepting `@status`), the
      // cursor lands at offset 0 of a fresh text node immediately after
      // the tag element. Plain-text-wise, the cursor appears to be in
      // the middle of an `@field` token, so `findTokenStart` below would
      // happily re-fire completions for the just-inserted tag.
      //
      // Detect this case via Slate's structure: cursor at the start of
      // a text node whose previous sibling is a `tag` element. The user
      // has finished selecting that completion; don't reopen.
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

      // Trigger on the configured trigger chars.
      if (triggerCharacters.has(charBefore)) {
        // A trigger character was just typed — the token is fresh, no
        // prefix typed yet.
        setFilterPrefix('');
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // Also trigger if we're typing inside a sigil-prefixed token.
      const tokenStart = findTokenStart(plainText, cursorOffset);
      const tokenPrefix = plainText[tokenStart];
      if (tokenPrefix && /[@$/]/.test(tokenPrefix)) {
        // Narrow the dropdown to items matching the partial token the
        // user has typed since the trigger fired.
        setFilterPrefix(plainText.slice(tokenStart, cursorOffset));
        positionTrigger(editor);
        requestCompletions(plainText, cursorOffset);
        return;
      }

      // If dropdown is open and the user is typing alphanumeric, keep
      // narrowing — update the filter prefix and re-request with the new
      // cursor position.
      if (isOpen && /\w/.test(charBefore)) {
        setFilterPrefix(plainText.slice(tokenStart, cursorOffset));
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

  /**
   * Imperative entry point for "replace this chip" flow. Anchors the
   * popover at the chip's viewport rect, records the chip path for the
   * inserter to consume, and fires a completion request immediately
   * (bypassing the typing debounce — the user expects the dropdown to
   * appear instantly on click).
   */
  const openAtChip = useCallback(
    (
      editor: BaseEditor & ReactEditor & HistoryEditor,
      chipPath: number[],
      chipRect: { left: number; bottom: number }
    ) => {
      // Toggle behaviour: clicking the SAME chip that the dropdown is
      // already anchored to closes it. Without this, the user has no
      // way to dismiss replace mode via the chip itself (the outside-
      // click suppression below would re-open it on every chip click).
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
      // Pre-open the popover so the user gets immediate visual feedback
      // on the click — even if the LSP isn't ready yet, the popover
      // appears anchored at the chip (showing a "Connecting…" stub
      // rendered by SmartEditor). Items populate when the request
      // returns; until then, `items` is empty.
      setItems([]);
      setFocusedIndex(0);
      setIsReplaceMode(true);
      setIsOpen(true);
      // Force the popover to re-mount so its internal open state
      // syncs with ours — see comment on `popoverKey` above.
      setPopoverKey((k) => k + 1);
      const nodes = editor.children as ISlateElement[];
      const plainText = converter.fromSlateNodes(nodes);
      // Request completions at the END of the chip's plain-text span —
      // that's the natural "what could complete this token" position for
      // the LSP server. For chip `@status` the cursor sits right after
      // `@status`, so the server returns matching `@field` candidates
      // the user can swap in.
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
        // Defer until isReady — see effect below.
        pendingChipRequestRef.current = { plainText, offset: chipEnd };
      }
    },
    [isReady, isOpen, close, converter, performCompletionRequest]
  );

  const handleExternalClose = useCallback(
    (open: boolean) => {
      if (open) return;
      // Within ~300ms of `openAtChip`, the close event is the popover's
      // own outside-click handler reacting to the same mousedown that
      // opened it — ignore.
      if (Date.now() - justOpenedAtChipAtRef.current < 300) {
        return;
      }
      close();
    },
    [close]
  );

  // Auto-fire a deferred chip-click request once the LSP session is
  // ready. Covers the race where the user clicks a chip during the
  // initialize handshake.
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
    // Expose the post-filter list as `items` — consumers (SmartEditor's
    // render, click handlers) iterate this and don't need to see the
    // raw server set. `groups` is also already filter-derived.
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
