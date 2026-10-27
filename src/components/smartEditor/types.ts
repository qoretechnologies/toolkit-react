// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the generic SmartEditor primitive.

import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
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
  /**
   * Whether `char`, typed right after a reference, ends it: it cannot go on to make the reference longer (a
   * space or an operator, not a `.` before a sub-field). A reference typed out in full is drawn as its chip once
   * such a character follows it, as one picked from the completion list is. Without it, a typed reference is
   * drawn as its chip only once the editor is left.
   */
  endsReference?: (char: string) => boolean;
  /**
   * Where in a chip's text (its tag `value`, as written) the server says something of a part of it: the field of
   * `@create.items[*].id`, the `*` of its wildcard, the `id` after it. A chip replaces its text, so the hover a
   * mouse resting on it - or "Details" with it selected - shows is what the server says at each of these, in one
   * card. Without it, the chip's hover is what the server says at its start.
   */
  hoverOffsetsOf?: (tagValue: string) => number[];
  /**
   * How much of the end of `textBefore` (the text before the caret) is a reference still being written: what a chip
   * put in at the caret takes the place of - from the list the editor's templates are browsed in, as from the
   * completion list. 0 when there is none. Without it, a chip goes in beside what is typed.
   */
  referenceBeingWritten?: (textBefore: string) => number;
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

import { ILspCompletionItem, ILspDiagnostic } from '../../utils/lspClient.types';

export type { ILspCompletionItem };

import type { ITemplateNode } from '../../helpers/templateTree';
import type { IEditingLanguage } from './editingAids';

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

  /**
   * Optional **minimum** height of the editable area (CSS value). The
   * editor auto-grows with content; this is a floor, not a fixed size.
   * Omit for a single-line field that grows as you type.
   */
  height?: string;

  /**
   * The size the text is drawn at, as a field of that size draws it - and the chips in it with it. A host
   * drawing the same value as another field (an expression's Value and Expression tabs) gives both one size,
   * so a reference is the same chip in either (qorus#646). The editor's own when not given.
   */
  size?: TSizes;

  /** Read-only mode. */
  readOnly?: boolean;

  /**
   * Whether to render diagnostic decorations (wavy error/warning
   * underlines) from `publishDiagnostics`. Default `true`. Set `false`
   * for read-only display surfaces showing text that is not expected to
   * be valid in the session's language — e.g. the expression "Explain"
   * panel, which renders the server's human-readable rendering through
   * the editor for chips + token colors but is not parseable DPQL.
   */
  showDiagnostics?: boolean;

  /** Called when the editor loses focus. */
  onBlur?: () => void;
  /**
   * What the editor lists when it is clicked, tapped or tabbed into, and inserts as chips - the field's
   * templates (see `useTemplateTags`). The language server's completion stays as it is, opened by typing.
   */
  tags?: IReqoreRichTextEditorProps['tags'];

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
   * How long the mouse rests before its hover is asked for, in ms. Default 300: a mouse passing over the
   * text asks nothing. Only a mouse (or a pen held above the screen) hovers; a finger has "Details".
   */
  hoverDelayMs?: number;

  /**
   * Generic "this editor is busy" flag — when `true`, the loading
   * overlay is shown regardless of `session.isReady`. Used by wrappers
   * that have their own busy state (e.g. DpqlEditor's
   * `useServerParse` mode shows the overlay while awaiting the
   * `dpql/toRichtext` response).
   */
  isLoading?: boolean;

  /**
   * Whether to query `textDocument/signatureHelp` when the user types
   * a server-advertised trigger char (typically `(`, `,`, ` `, `-`,
   * `=`) or moves the cursor inside an open call. Default `true`.
   * Renders a small pinned popover ABOVE the caret line showing the
   * active signature's label with the current parameter highlighted.
   *
   * Silently no-op when the server doesn't advertise
   * `signatureHelpProvider` — degrades cleanly against servers that
   * don't support it.
   */
  enableSignatureHelp?: boolean;

  /**
   * A click, a tap or Tab into the text asks what can be written at the caret, and the completion list opens
   * there if anything can - in place of a browse list (`tags`): one list for what can be written, opened by a
   * click as by typing (qorus#646, David's decision).
   */
  completeOnClick?: boolean;

  /**
   * What the completion list offers at the caret, from what the server offered there: the host's own entries
   * (a field's templates) merged in where they can be written. `serverItems` is undefined where no server can be
   * asked: the list is the host's alone then.
   */
  completionsWith?: (context: ICompletionContext) => ILspCompletionItem[];

  /** What the completion list says where it has nothing to offer at the caret, or undefined for no list there. */
  emptyCompletionMessage?: (plainText: string, offset: number) => string | undefined;

  /**
   * The server's diagnostics as the editor says them, for the text they are of: a host's own words for what it
   * wrote itself (an unfinished expression's placeholders), say.
   */
  presentDiagnostics?: (diagnostics: ILspDiagnostic[], plainText: string) => ILspDiagnostic[];

  /**
   * Whether a reference typed in the text names nothing the field is given: it stays the text it was typed as,
   * not drawn as a chip, which would read as a reference that stands for something (qorus#646).
   */
  referenceNamesNothing?: (reference: string) => boolean;

  /**
   * The field's templates and fields (`templateTree`): what the template picker browses (qorus#646, David's
   * decisions) - a click in the empty text, the template button and a click on a chip open it, and a row of the
   * completion list that is a group opens it at its members.
   */
  templateRoots?: ITemplateNode[];

  /**
   * A button beside the text that opens the template picker for a pick at the caret: shown where the editor has
   * templates and can be edited. `insertableAt` says whether a value can be written after the text before the
   * caret; where it cannot, the button says why and cannot be pressed.
   */
  templateButton?: { insertableAt?: (textBefore: string) => boolean; notInsertable?: string };

  /**
   * How the editor's language writes its brackets and strings: pairs are closed as they are typed, a selection
   * typed over with one is wrapped, the bracket matching the one at the caret is marked (`useEditingAids`).
   */
  editingLanguage?: IEditingLanguage;

  /** Shift+Alt+F: the document formatted (the host asks its language server). */
  formatDocument?: () => void;

  /** `off`: a line does not wrap; the box scrolls sideways inside its border. Default `on`. */
  wordWrap?: 'on' | 'off';

  /** The tallest the text's box grows: the text scrolls within it past that. Unlimited when not given. */
  maxHeight?: string;

  /** Each line's number before it. Default off. */
  lineNumbers?: boolean;
}

/** Where the completion list is asked for: the text, the caret's offset in it, and what the server offered. */
export interface ICompletionContext {
  plainText: string;
  offset: number;
  /** What the server offered at the caret; undefined where no server can be asked. */
  serverItems?: ILspCompletionItem[];
  /**
   * What is typed before the caret in the text it is in, where the editor can say: never a chip's text, which is
   * in `plainText` before the caret but is a value already.
   */
  typedInText?: string;
}
