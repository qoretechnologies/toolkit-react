// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the generic SmartEditor primitive.

import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { BaseEditor } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor, RenderLeafProps } from 'slate-react';
import { EditableProps } from 'slate-react/dist/components/editable';
import type { IUseLspSessionResult } from './useLspSession';

/** Slate custom element — paragraph (block) or tag (inline void). */
export interface ISlateElement {
  type: 'paragraph' | 'tag';
  value?: string | number;
  label?: string | number;
  metadata?: Record<string, any>;
  children: TSlateNode[];
}

/** Slate text node with optional decoration / mark flags. */
export interface ISlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  // Arbitrary mark flags — populated by `decorate` and consumed by `customRenderLeaf`.
  [mark: string]: unknown;
}

export type TSlateNode = ISlateElement | ISlateText;

/**
 * Plain text ↔ Slate conversion. Language-specific implementations can
 * recognise patterns (e.g. DPQL's `@field` / `$template`) and represent
 * them as tag elements. The default just maps paragraphs split on newlines.
 */
export interface ISlateConverter {
  toSlateNodes: (plainText: string) => ISlateElement[];
  fromSlateNodes: (nodes: ISlateElement[]) => string;
  /**
   * Convert a Slate selection (paragraph index, child index, offset within
   * child) to a plain-text character offset. Used to map cursor positions
   * to LSP `Position`s and to slice the partial token under the caret.
   */
  selectionToOffset: (
    nodes: ISlateElement[],
    anchorPath: number[],
    anchorOffset: number
  ) => number;
}

/**
 * Context passed to the completion inserter. Includes the live Slate
 * editor, the plain-text projection of its current document, and the
 * cursor's offset within that plain text — enough state for the inserter
 * to compute how many characters to delete before inserting (so the
 * partial token the user typed isn't duplicated).
 */
export interface ICompletionInserterContext {
  plainText: string;
  cursorOffset: number;
  /**
   * Set when the dropdown was opened via the "replace this chip" flow
   * (user clicked an existing tag chip). The inserter should atomically
   * swap the node at this Slate path for the chosen completion —
   * skipping the usual "delete partial token then insert at cursor"
   * dance. Absent for normal typing-triggered completions.
   */
  replacementPath?: number[];
}

/**
 * Hook callback that decides what happens when a completion item is
 * accepted. The generic default uses the item's `textEdit.range` when
 * the server provided one (LSP-compliant: delete the typed partial
 * token then insert the server's `newText`); otherwise falls back to
 * a heuristic that strips the partial token before inserting
 * `insertText ?? label`. Wrappers can override entirely — e.g. DPQL
 * inserts Slate tag elements for `@field` / `$template` completions.
 */
export type TCompletionInserter = (
  item: ILspCompletionItem,
  editor: BaseEditor & ReactEditor & HistoryEditor,
  context: ICompletionInserterContext
) => void;

import { ILspCompletionItem } from '../../utils/lspClient.types';

export type { ILspCompletionItem };

export interface ISmartEditorProps {
  /**
   * LSP session. Created by the consumer via `useLspSession({ languageId,
   * initialMetadata, uri, url, initialText })`. The consumer owns the
   * session so it can subscribe to `session.client` / `session.isReady`
   * changes in effects (e.g. to dispatch `dpql/setContext` when its
   * provider prop changes). Lifting the session up rather than embedding
   * it in `SmartEditor` keeps language-specific lifecycle logic in the
   * language-specific layer.
   */
  session: IUseLspSessionResult;

  /** Controlled plain-text value. */
  value: string;
  /** Called with the new plain-text value whenever the document changes. */
  onChange: (value: string) => void;

  /** Slate `decorate` function for client-side syntax highlighting. */
  decorate?: EditableProps['decorate'];

  /** Custom leaf renderer — consumes the `decorate` ranges. */
  customRenderLeaf?: (props: RenderLeafProps) => JSX.Element;

  /** Per-tag `ReqoreTag` props — color, icon, tooltip etc. */
  tagRenderer?: (tag: ISlateElement) => IReqoreTagProps;

  /**
   * Called when a rendered tag chip is clicked. Default behavior:
   * unwrap the tag back to plain text at its position so the editor's
   * autocomplete fires for that token — effectively "open the dropdown
   * for this completion so the user can swap it for a different one".
   *
   * Pass an explicit override (or a no-op `() => {}`) to disable this
   * behavior — useful for read-only-feel editors that should accept
   * clicks without mutating.
   */
  onTagClick?: (
    tag: ISlateElement,
    editor: BaseEditor & ReactEditor & HistoryEditor
  ) => void;

  /** Characters that open the autocomplete dropdown. */
  triggerCharacters?: Set<string>;

  /** Plain-text ↔ Slate conversion. Defaults to single-paragraph plain text. */
  converter?: ISlateConverter;

  /**
   * Called when a completion item is accepted. Defaults to plain-text
   * insertion. Wrappers override to insert tag elements, re-trigger
   * completions, etc.
   */
  completionInserter?: TCompletionInserter;

  /** Optional React node rendered above the editor (e.g. a templates dropdown). */
  topActions?: React.ReactNode;

  /** CSS height of the editable area. Default: `'200px'`. */
  height?: string;

  /** Read-only mode. */
  readOnly?: boolean;

  /** Called when the editor loses focus. */
  onBlur?: () => void;

  /**
   * Custom loading indicator rendered as an overlay on top of the
   * editor body while `session.isReady` is false. Defaults to a
   * `ReqoreSpinner` with copy "Connecting to language server…".
   * Pass `null` to suppress the default overlay entirely (useful
   * if the wrapper handles loading state at a higher level).
   */
  loadingIndicator?: React.ReactNode;

  /**
   * Whether to query `textDocument/hover` when the user mouse-rests
   * over a token in the editor. Default `true`. The popover renders
   * the server's markdown content via `react-markdown`. Set `false`
   * to opt out — e.g. for short input fields where hover would be
   * distracting.
   */
  enableHover?: boolean;

  /**
   * Generic "this editor is busy" flag — when `true`, the loading
   * overlay is shown regardless of `session.isReady`. Used by wrappers
   * that have their own busy state (e.g. DpqlEditor's
   * `useServerParse` mode shows the overlay while awaiting the
   * `dpql/toRichtext` response).
   */
  isLoading?: boolean;
}
