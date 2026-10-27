// Copyright 2026 Qore Technologies, s.r.o.

import {
  ReqoreButton,
  ReqoreCallout,
  ReqoreControlGroup,
  ReqoreFonts,
  ReqoreMessage,
  ReqorePanel,
  ReqoreSpinner,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import { CONTROL_TEXT_FROM_SIZE } from '@qoretechnologies/reqore/dist/constants/sizes';
import {
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { Editor, NodeEntry, Range, Transforms } from 'slate';
import { ReactEditor, RenderLeafProps } from 'slate-react';
import { ILspSignatureHelp } from '../../utils/lspClient.types';
import { useEmittedValues } from '../form/fields/emittedValues';
import { defaultSlateConverter, expandSnippet, lspPositionToOffset } from './helpers';
import { TEMPLATE_BROWSE_LIST_PROPS } from '../form/fields/rich-text/useTemplateTags';
import { CompletionMenu } from './CompletionMenu';
import { MarkdownDoc } from './MarkdownDoc';
import { ISlateElement, ISmartEditorProps, TCompletionInserter, TSlateNode } from './types';
import { IRechippedParagraph, rechipTypedReferences } from './typedReferences';
import { ICompletionDropdownItem, useLspAutocomplete } from './useLspAutocomplete';
import { severityToIntent, useLspDiagnosticDecorations } from './useLspDiagnosticDecorations';
import { useLspHover } from './useLspHover';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';
import { useLspSemanticTokens } from './useLspSemanticTokens';
import { useLspSignatureHelp } from './useLspSignatureHelp';
import { templateNodeFor } from '../../helpers/templateTree';
import { useEditingAids } from './useEditingAids';

// One-Dark-ish palette keyed off the LSP semantic-token legend; absent
// types fall through to Slate's default text color.
const SEMANTIC_TOKEN_COLORS: Record<string, string> = {
  keyword: '#c678dd', // purple — control flow, `in`, `not`, `between`, …
  operator: '#56b6c2', // cyan — ==, !=, &&, ||, =~, !~, …
  string: '#98c379', // green — "Alice", 'foo'
  number: '#d19a66', // orange — 18, 3.14, 2e-3
  comment: '#5c6370', // grey
  variable: '#e06c75', // red-pink — `@field` references
  parameter: '#e06c75', // red-pink — function parameters
  property: '#e06c75', // red-pink — record properties
  function: '#e5c07b', // yellow — DPQL built-ins (abs, now, coalesce…)
  method: '#e5c07b', // yellow
  class: '#e5c07b', // yellow — Qonsole resource names (`services`, …)
  type: '#e5c07b', // yellow
  regexp: '#d16969', // coral — kept distinct from operator cyan + variable pink
  modifier: '#c678dd', // purple
  decorator: '#c678dd', // purple
  namespace: '#e5c07b', // yellow
};

// Applies the server's `textEdit` (replacing the typed partial token so
// `-` + `--desc=` doesn't become `---desc=`), else inserts at the cursor.
// DPQL/Qonsole wrappers override this to insert tag chips.
const defaultCompletionInserter: TCompletionInserter = (item, editor, ctx) => {
  const rawText = item.textEdit?.newText ?? item.insertText ?? item.label;
  // Expand LSP snippet placeholders so `slice(${1:List Value})$0` doesn't
  // leak `${…}$0` into the document.
  const newText = item.insertTextFormat === 2 ? expandSnippet(rawText) : rawText;

  // Replace mode — atomically swap the node at the chip's path.
  if (ctx.replacementPath) {
    const path = ctx.replacementPath;
    Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: path });
      Transforms.insertNodes(editor, [{ text: newText }] as any, {
        at: path,
        select: true,
      });
    });
    try {
      ReactEditor.focus(editor);
    } catch {
      // Editor may not be focusable in this render cycle.
    }
    return;
  }

  if (item.textEdit) {
    const startOffset = lspPositionToOffset(ctx.plainText, item.textEdit.range.start);
    // Delete the partial token between the edit-range start and the caret.
    const charsToDelete = Math.max(0, ctx.cursorOffset - startOffset);
    for (let i = 0; i < charsToDelete; i++) {
      Editor.deleteBackward(editor, { unit: 'character' });
    }
  }

  Transforms.insertText(editor, newText);
  try {
    ReactEditor.focus(editor);
  } catch {
    // Editor may not be focused.
  }
};


interface ISignatureHelpPillProps {
  signature: ILspSignatureHelp;
  position: { left: number; top: number };
}

// Memoized signature pill. Prefers ABOVE the caret line, falling back to
// BELOW when that would clip the viewport top; horizontally clamped to the
// viewport.
const SignatureHelpPill = memo(({ signature, position }: ISignatureHelpPillProps) => {
  const theme = useReqoreTheme();

  const sig = signature.signatures[signature.activeSignature ?? 0];
  if (!sig) return null;

  const activeIdx = sig.activeParameter ?? signature.activeParameter ?? 0;
  const params = sig.parameters ?? [];
  const activeParam = params[activeIdx];

  const activeParamColor = theme.intents?.info ?? getReadableColor(theme);

  // Bold the active parameter inside the label — by [start, end] tuple or
  // by literal-name match. Plain `<strong>` (not `ReqoreSpan`, whose
  // `inline-block` would break the flowing label text).
  let label: React.ReactNode = sig.label;
  if (activeParam) {
    if (Array.isArray(activeParam.label)) {
      const [start, end] = activeParam.label;
      label = (
        <>
          {sig.label.slice(0, start)}
          <strong style={{ color: activeParamColor }}>{sig.label.slice(start, end)}</strong>
          {sig.label.slice(end)}
        </>
      );
    } else {
      const name = activeParam.label;
      const idx = sig.label.indexOf(name);
      if (idx >= 0) {
        label = (
          <>
            {sig.label.slice(0, idx)}
            <strong style={{ color: activeParamColor }}>{name}</strong>
            {sig.label.slice(idx + name.length)}
          </>
        );
      }
    }
  }

  const paramDoc =
    activeParam && activeParam.documentation ?
      typeof activeParam.documentation === 'string' ?
        activeParam.documentation
      : activeParam.documentation.value
    : null;

  const PILL_HEIGHT_ESTIMATE = 64;
  const PILL_WIDTH_ESTIMATE = 480; // matches maxWidth below
  const VIEWPORT_MARGIN = 8;
  const lineHeightEstimate = 18;
  const placeBelow = position.top < PILL_HEIGHT_ESTIMATE + 8;
  const pillTop = placeBelow ? position.top + lineHeightEstimate + 4 : position.top - 6;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const maxLeft = viewportWidth - PILL_WIDTH_ESTIMATE - VIEWPORT_MARGIN;
  const pillLeft = Math.max(VIEWPORT_MARGIN, Math.min(position.left, maxLeft));

  return (
    <ReqorePanel
      // Remount on placement flip so `transform` recalculates cleanly.
      key={`sig-${position.left}-${position.top}-${placeBelow}`}
      size='small'
      opacity={0.85}
      customTheme={{ main: '#11181c' }}
      blur={5}
      style={{
        position: 'fixed',
        top: pillTop,
        left: pillLeft,
        transform: placeBelow ? undefined : 'translate(0, -100%)',
        maxWidth: 480,
        minWidth: 280,
        fontSize: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      <ReqoreCallout
        size='small'
        paddingSize='tiny'
        style={{ fontFamily: ReqoreFonts.mono }}
        label={label}
      />

      {paramDoc && (
        <div style={{ marginTop: 4, opacity: 0.85 }}>
          <MarkdownDoc content={paramDoc} markdown />
        </div>
      )}
    </ReqorePanel>
  );
});
SignatureHelpPill.displayName = 'SignatureHelpPill';

/** Distinguishes the completion lists of the editors on a page, for each editor's `aria-controls`. */
let completionMenuCounter = 0;

/* The text's box in its row: it takes the row, and gives it up to the Details button beside it on a touch
   screen. */
/** The width of the editor's row (Reqore's phone width) at or below which its Details button is its icon alone. */
const DETAILS_WORD_MIN_ROW_WIDTH = 480;

/**
 * The box the text is drawn in, as a code editor draws it where asked: lines that do not wrap (`wordWrap: off`),
 * scrolled inside the box, no wider than it; a height the text scrolls within (`maxHeight`); each line's number
 * before it (`lineNumbers`), counted by its paragraph.
 */
const StyledEditorBox = styled.div<{ $wordWrap: 'on' | 'off'; $maxHeight?: string; $lineNumbers: boolean }>`
  [data-slate-editor] {
    ${({ $wordWrap }) =>
      $wordWrap === 'off' ? 'white-space: pre !important; overflow-wrap: normal !important; overflow-x: auto;' : ''}
    ${({ $maxHeight }) => ($maxHeight ? `max-height: ${$maxHeight}; overflow-y: auto;` : '')}
    ${({ $lineNumbers }) => ($lineNumbers ? 'counter-reset: smart-editor-line; padding-left: 3em !important;' : '')}
  }
  ${({ $lineNumbers }) =>
    $lineNumbers ?
      `[data-slate-editor] > [data-slate-node='element'] {
        position: relative;
        counter-increment: smart-editor-line;
      }
      [data-slate-editor] > [data-slate-node='element']::before {
        content: counter(smart-editor-line);
        position: absolute;
        left: -3em;
        width: 2.2em;
        text-align: right;
        opacity: 0.45;
        user-select: none;
        pointer-events: none;
      }`
    : ''}
`;

const EDITOR_BOX_STYLE: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 auto',
  minWidth: 0,
};

/**
 * The button beside the text that opens the template picker for a pick at the caret (qorus#646): where a value
 * cannot be written after the text before the caret (`insertableAt`), it says why and cannot be pressed. Its press
 * keeps the focus, and the caret the pick goes at, in the text.
 */
const TemplateButton = ({
  size,
  insertable,
  notInsertable,
  open,
}: {
  size?: ISmartEditorProps['size'];
  /** A value can be written at the caret: the button can be pressed. */
  insertable: boolean;
  notInsertable?: string;
  open: (rect: { left: number; bottom: number }) => void;
}) => {
  return (
    <ReqoreButton
      className='smart-editor-template-button'
      icon='MoneyDollarCircleLine'
      fixed
      size={size ?? 'normal'}
      aria-label='Insert a template'
      tooltip={insertable ? 'Insert a template' : notInsertable}
      disabled={!insertable}
      onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        const { left, bottom } = event.currentTarget.getBoundingClientRect();
        open({ left, bottom });
      }}
    />
  );
};

export const SmartEditor = forwardRef<TReqoreRichTextEditorRef, ISmartEditorProps>(
  (
    {
      session,
      value,
      onChange,
      decorate,
      customRenderLeaf,
      tagRenderer,
      onTagClick,
      triggerCharacters,
      converter = defaultSlateConverter,
      completionInserter = defaultCompletionInserter,
      topActions,
      height,
      size,
      readOnly = false,
      showDiagnostics = true,
      onBlur,
      tags,
      loadingIndicator,
      enableHover = true,
      hoverDelayMs,
      isLoading = false,
      enableSignatureHelp = true,
      completeOnClick = false,
      completionsWith,
      emptyCompletionMessage,
      presentDiagnostics,
      templateRoots,
      templateButton,
      editingLanguage,
      formatDocument,
      wordWrap = 'on',
      maxHeight,
      lineNumbers = false,
    },
    ref
  ) => {
    const theme = useReqoreTheme();
    const editorRef = useRef<TReqoreRichTextEditorRef>(null);
    const completionMenuId = useMemo(() => `completion-menu-${++completionMenuCounter}`, []);
    const lastPlainTextRef = useRef(value);
    // Cached Slate nodes, refreshed only on EXTERNAL value changes — not on
    // the typing echo. Passing a fresh ref every keystroke re-runs
    // ReqoreRichTextEditor's tokenizer mid-token (typed `@s` collapses to a
    // tag chip, making the rest of the field name impossible to type).
    const slateValueRef = useRef<ISlateElement[] | null>(null);
    /* Counts the node trees the editor has reported. The tree a value converts
       to is not always the tree the editor holds: Slate normalises a value set
       from outside — a leading chip gains an empty text leaf before it — without
       changing its text, so `value` never changes and the cache above kept the
       tree the editor no longer had. Every offset computed from it (token
       colors, diagnostics, signature help) then pointed one leaf off: a Text
       view seeded with `"$local:name" == "John"` was never highlighted. */
    const [editorTreeVersion, noteEditorTree] = useReducer((count: number) => count + 1, 0);

    useImperativeHandle(ref, () => editorRef.current as TReqoreRichTextEditorRef, []);

    // Gates all LSP hooks on both the connection (`isReady`) and any
    // wrapper context binding (`isContextReady`) — without the latter,
    // typing `@` in the ~50–200ms before `dpql/setContext` resolves hits
    // the server context-less and the dropdown silently closes. Generic
    // sessions set `isContextReady: true`, collapsing this to `isReady`.
    const lspReady = session.isReady && session.isContextReady;

    /* What the list offers at the caret: the server's answer, with the host's own entries merged in where they
       can be written (`completionsWith`). Where no server can be asked, the host's alone. */
    const noServer = session.isUnavailable && !!completionsWith;
    const { getCompletions: askServer } = session;
    const getCompletions = useCallback(
      async (plainText: string, offset: number, typedInText?: string) => {
        const serverItems = noServer ? undefined : await askServer(plainText, offset);
        return completionsWith ?
            completionsWith({ plainText, offset, serverItems, typedInText })
          : (serverItems ?? []);
      },
      [noServer, askServer, completionsWith]
    );

    const autocomplete = useLspAutocomplete({
      getCompletions,
      isReady: lspReady || noServer,
      triggerCharacters,
      converter,
      inserter: completionInserter,
      emptyMessage: emptyCompletionMessage,
    });

    const hover = useLspHover(session, editorRef as React.RefObject<any>, converter, {
      enabled: enableHover,
      debounceMs: hoverDelayMs,
      // a chip whose props carry a tooltip (a field the record describes) shows that, not the server's hover too
      chipHasOwnHover: (tag) =>
        !!(tagRenderer as ((tag: ISlateElement) => { tooltip?: unknown }) | undefined)?.(tag)
          ?.tooltip,
    });
    /* The hover the popover drawn in this render is of: what it dismisses when it closes, and nothing newer. */
    const shownHoverId = hover.hoverId;
    /* A finger cannot hover: where the pointer is one, "Details" shows what the server says of the word at the
       caret, in the same pop-up a mouse gets by hovering. Only where the server says anything (`hoverProvider`). */
    const coarse = useCoarsePointer();
    /* The row the text and its Details button share, measured: in a row a phone's width or narrower, Details is its
       icon alone - its word took the text's room (Foxhoundn on qlip #383: "The details button should be just an icon
       on such small screen / container size"). The row, not the screen: an editor in a narrow card on a wide
       screen is as short of room. */
    const [rowRef, { width: rowWidth }] = useMeasure<HTMLDivElement>();
    const detailsSaysItsWord = !rowWidth || rowWidth > DETAILS_WORD_MIN_ROW_WIDTH;
    const showDetailsButton =
      coarse &&
      // Details says what the word at the caret is, and a read-only text has no caret: a tap on a read-only
      // rendering (a collapsed row's expression) opens what holds it, where Details is
      !readOnly &&
      enableHover &&
      session.isReady &&
      !!(session.client?.capabilities as { hoverProvider?: unknown } | null | undefined)?.hoverProvider;
    /* The hover Details showed, drawn as a card under the button rather than over the text (`showAtCaret`). */
    const [detailsHoverId, setDetailsHoverId] = useState<number>();
    const detailsShown = detailsHoverId !== undefined && hover.hoverId === detailsHoverId;

    /* What the editor has reported and the host has not handed back yet. A host can hand an emit back
       after the next key is already in the editor - one that debounces, or a render that lands between
       two keys - and that stale value is not a change: rebuilding the document from it replaced the text
       and put the caret at its end, so the next key followed the stale text (`name` typed came out
       `nae`). See `EmittedValues`. */
    const emitted = useEmittedValues<string>();
    /* The value the host last handed down. The editor re-renders between keys for its own reasons (it
       has just reported a new tree), and the host has not caught up then: the value it still holds is
       not a change either. */
    // nothing until the first value is committed, so the server is sent the first value too
    const committedValueRef = useRef<string | undefined>(undefined);

    const slateValue = useMemo(() => {
      // Reuse the cache unless the host handed down something new: the same value again, the editor's
      // own typing echo - the latest, or one still in flight - is not
      if (
        slateValueRef.current !== null &&
        (value === committedValueRef.current || value === lastPlainTextRef.current || emitted.includes(value))
      ) {
        return slateValueRef.current;
      }
      const next = converter.toSlateNodes(value);
      slateValueRef.current = next;
      return next;
      // `editorTreeVersion` re-reads the cache once the editor reports its own tree.
    }, [value, converter, editorTreeVersion]);

    /* A value set from outside is a change to the document as much as typing
       is — a Text view seeded after mount, a Preview following the author. The
       server colors and diagnoses its own copy of the text, so it must hold
       this one; typing already sent its text, and is not resent. */
    const { didChange: syncDocument } = session;
    useEffect(() => {
      // the echo of an emit is acknowledged, and is not sent: the server already has the newer text
      // typing sent; anything else is a change from outside
      if (committedValueRef.current === value) return;
      committedValueRef.current = value;
      if (emitted.isEcho(value)) return;
      lastPlainTextRef.current = value;
      syncDocument(value);
    }, [syncDocument, value, emitted]);

    /* The server's diagnostics as the editor says them: in the host's words for what it wrote itself
       (`presentDiagnostics`), and without the error of a reference half-typed at the caret while its list is open
       or on its way - a `$` typed to ask for a template is not a mistake yet (qorus#646, David's decision). It
       is said once the list is put away. */
    const listActive = autocomplete.isActive;
    const shownDiagnostics = useMemo(() => {
      const editor = editorRef.current as unknown as Editor | null;
      const nodes = (editor?.children as unknown as ISlateElement[] | undefined) ?? slateValue;
      const said =
        presentDiagnostics ?
          presentDiagnostics(session.diagnostics, converter.fromSlateNodes(nodes))
        : session.diagnostics;
      const at = editor?.selection;
      if (!listActive || !converter.referenceBeingWritten || !at || !Range.isCollapsed(at)) {
        return said;
      }
      const [index, child] = at.anchor.path;
      const paragraph = nodes[index];
      if (at.anchor.path.length !== 2 || !paragraph) {
        return said;
      }
      const end = converter.selectionToOffset([paragraph], [0, child], at.anchor.offset);
      const written = converter.referenceBeingWritten(
        converter.fromSlateNodes([paragraph]).slice(0, end)
      );
      return written > 0 ?
          said.filter(
            ({ range: { start } }) =>
              !(start.line === index && start.character >= end - written && start.character < end)
          )
        : said;
    }, [session.diagnostics, presentDiagnostics, converter, slateValue, listActive]);

    const diagnosticDecorate = useLspDiagnosticDecorations(shownDiagnostics, converter, slateValue);

    // Server-driven syntax highlighting (replaces the old client-side regex
    // highlighter — see design doc §7).
    const semanticDecorate = useLspSemanticTokens(session, converter, slateValue);

    // No-ops when the server doesn't advertise `signatureHelpProvider`.
    const signatureHelp = useLspSignatureHelp(
      session,
      editorRef as React.RefObject<any>,
      converter,
      slateValue,
      { enabled: enableSignatureHelp }
    );

    /* What a code editor does for what is typed (`useEditingAids`): pairs closed, a selection wrapped, the
       bracket at the caret matched, the search (Ctrl+F) and its replace, lines moved and copied, the document
       formatted (Shift+Alt+F), completion asked for (Ctrl+Space). */
    // the editing aids follow every change of the editor, its caret's included (the bracket match)
    const aidsChangeRef = useRef<() => void>(() => undefined);
    const aids = useEditingAids({
      editorRef,
      converter,
      nodes: slateValue,
      language: editingLanguage,
      readOnly,
      onFormat: formatDocument,
      onComplete: () => {
        const editor = editorRef.current;
        const at = editor?.selection;
        if (!editor || !at) return;
        try {
          const rect = ReactEditor.toDOMRange(editor, at).getBoundingClientRect();
          autocomplete.openAtCaret(editor as any, at.anchor, { left: rect.left, bottom: rect.bottom });
        } catch {
          // the caret is not drawn: nothing is asked
        }
      },
    });

    aidsChangeRef.current = aids.onEditorChange;

    const composedDecorate = useCallback(
      (entry: NodeEntry): Range[] => {
        const userRanges = decorate?.(entry) ?? [];
        const semanticRanges = semanticDecorate(entry);
        const aidRanges = aids.decorate(entry);
        const diagRanges = showDiagnostics ? diagnosticDecorate(entry) : [];
        // Diagnostics last so the wavy underline isn't overdrawn.
        return [...userRanges, ...semanticRanges, ...aidRanges, ...diagRanges];
      },
      [decorate, semanticDecorate, diagnosticDecorate, showDiagnostics, aids.decorate]
    );

    // Paints semantic-token colors and diagnostic underlines, falling
    // through to the consumer's `customRenderLeaf` for everything else.
    const renderLeafWithMarks = useCallback(
      (props: RenderLeafProps) => {
        const leaf = props.leaf as RenderLeafProps['leaf'] & {
          error?: true;
          errorMessage?: string;
          severity?: number;
          tokenType?: string;
          tokenModifiers?: string[];
          bracketMatch?: true;
          findMatch?: true;
          findCurrent?: true;
        };

        let child =
          customRenderLeaf ?
            customRenderLeaf(props)
          : <span {...props.attributes}>{props.children}</span>;

        if (leaf.tokenType) {
          const color = SEMANTIC_TOKEN_COLORS[leaf.tokenType];
          const italic = leaf.tokenModifiers?.includes('declaration');
          const dim = leaf.tokenModifiers?.includes('deprecated');
          if (color || italic || dim) {
            child = (
              <span
                style={{
                  color,
                  fontStyle: italic ? 'italic' : undefined,
                  opacity: dim ? 0.6 : undefined,
                  textDecoration: dim ? 'line-through' : undefined,
                }}
              >
                {child}
              </span>
            );
          }
        }

        // the bracket matching the one at the caret, and the search's matches (the current one stronger)
        if (leaf.bracketMatch || leaf.findMatch) {
          child = (
            <span
              className={
                leaf.findCurrent ? 'smart-editor-find-current'
                : leaf.findMatch ? 'smart-editor-find-match'
                : 'smart-editor-bracket-match'
              }
              style={{
                borderRadius: 2,
                background:
                  leaf.findCurrent ? 'rgba(255, 200, 0, 0.55)'
                  : leaf.findMatch ? 'rgba(255, 200, 0, 0.25)'
                  : 'rgba(255, 255, 255, 0.12)',
                outline: leaf.bracketMatch ? '1px solid rgba(255, 255, 255, 0.45)' : undefined,
              }}
            >
              {child}
            </span>
          );
        }

        // Underline outermost so it overlays the syntax color; hex
        // fallbacks cover host themes that omit a diagnostic intent.
        if (leaf.error) {
          const underlineColor =
            leaf.severity === 2 ? (theme.intents?.warning ?? '#f0a500')
            : leaf.severity && leaf.severity >= 3 ? (theme.intents?.info ?? '#3a86ff')
            : (theme.intents?.danger ?? '#d62828');
          child = (
            <span
              data-testid='diagnostic-underline'
              title={leaf.errorMessage}
              style={{
                textDecoration: 'underline wavy',
                textDecorationColor: underlineColor,
                textDecorationSkipInk: 'none',
              }}
            >
              {child}
            </span>
          );
        }

        return child;
      },
      [customRenderLeaf, theme]
    );

    /* A reference typed out in full is drawn as its chip, as one picked from the completion list is: the
       paragraph is redrawn from its text, which the converter reads it in (`rechipTypedReferences`). The text is
       the same, so nothing is reported for it. */
    const drawTypedReferences = (editor: Editor, index: number, rechipped: IRechippedParagraph) => {
      Editor.withoutNormalizing(editor, () => {
        const paragraph = editor.children[index] as unknown as ISlateElement;
        for (let child = paragraph.children.length - 1; child >= 0; child -= 1) {
          Transforms.removeNodes(editor, { at: [index, child] });
        }
        Transforms.insertNodes(editor, rechipped.children as TSlateNode[] as never[], {
          at: [index, 0],
        });
      });
      if (rechipped.caret) {
        Transforms.select(editor, rechipped.caret);
      }
    };

    // the editor has been left: every reference typed in it is drawn as its chip
    const handleBlur = useCallback(() => {
      const editor = editorRef.current as unknown as Editor | null;
      if (editor && !readOnly) {
        (editor.children as unknown as ISlateElement[]).forEach((paragraph, index) => {
          const rechipped = rechipTypedReferences(converter, paragraph, index);
          if (rechipped) {
            drawTypedReferences(editor, index, rechipped);
          }
        });
      }
      onBlur?.();
    }, [converter, readOnly, onBlur]);

    /* A chip put in at the caret takes the place of the reference being written there, wherever it is picked
       from (qorus#646, David's review). The completion list's inserter takes it away itself; the list the
       editor's templates are browsed in is reqore's, which puts a chip in at the caret as it is: a `$` typed to
       ask for a template stayed in front of the one picked, and `pos + 1 + $pos` is refused by the server. A
       Slate plugin on the editor reqore made for this one (its `insertNodes`), so both are one step of one
       change - one text sent, one undo. A chip put in at a place of its own (`at`: a typed reference drawn as its
       chip, a chip replaced) is left alone. */
    const referenceBeingWritten = readOnly ? undefined : converter.referenceBeingWritten;
    useEffect(() => {
      const editor = editorRef.current as unknown as Editor | null;
      if (!editor || !referenceBeingWritten) {
        return undefined;
      }
      const { insertNodes } = editor;
      editor.insertNodes = (nodes, options) => {
        const at = editor.selection;
        const inserted = Array.isArray(nodes) ? nodes : [nodes];
        const chip = inserted.length === 1 && (inserted[0] as { type?: string }).type === 'tag';
        if (chip && !options?.at && at && Range.isCollapsed(at) && at.anchor.path.length === 2) {
          const [index, child] = at.anchor.path;
          const paragraph = editor.children[index] as unknown as ISlateElement | undefined;
          if (paragraph) {
            const before = converter
              .fromSlateNodes([paragraph])
              .slice(0, converter.selectionToOffset([paragraph], [0, child], at.anchor.offset));
            const written = referenceBeingWritten(before);
            // what is being written is typed text, in the text the caret is in
            if (written > 0 && written <= at.anchor.offset) {
              Transforms.delete(editor, {
                at: {
                  anchor: { path: at.anchor.path, offset: at.anchor.offset - written },
                  focus: at.anchor,
                },
              });
            }
          }
        }
        insertNodes(nodes, options);
      };
      return () => {
        editor.insertNodes = insertNodes;
      };
    }, [converter, referenceBeingWritten]);

    /* Whether a template can be written at the caret, for the template button: asked again at every change of the
       editor, a move of its caret included, so the button is never left as it was for a caret that has moved. */
    const [insertableAtCaret, setInsertableAtCaret] = useState(true);
    const insertableAt = templateButton?.insertableAt;
    const askInsertable = useCallback(() => {
      const editor = editorRef.current;
      if (!editor || !insertableAt) return;
      try {
        const nodes = editor.children as unknown as ISlateElement[];
        const plainText = converter.fromSlateNodes(nodes);
        const at = editor.selection?.anchor;
        const offset = at ? converter.selectionToOffset(nodes, at.path as number[], at.offset) : plainText.length;
        setInsertableAtCaret(insertableAt(plainText.slice(0, offset)));
      } catch {
        // a selection the editor no longer has: the end of the text is asked about
        setInsertableAtCaret(insertableAt(converter.fromSlateNodes(editor.children as unknown as ISlateElement[])));
      }
    }, [insertableAt, converter]);
    useEffect(askInsertable, [askInsertable, value]);
    const askInsertableRef = useRef(askInsertable);
    askInsertableRef.current = askInsertable;

    const handleSlateChange = useCallback(
      (newNodes: ISlateElement[]) => {
        const plainText = converter.fromSlateNodes(newNodes);

        // A selection change reports the same tree; anything else is the tree
        // the editor now holds, and the one every offset is computed against.
        if (newNodes !== slateValueRef.current) {
          slateValueRef.current = newNodes;
          noteEditorTree();
        }

        if (plainText !== lastPlainTextRef.current) {
          lastPlainTextRef.current = plainText;
          emitted.record(plainText);
          // CRITICAL: the next render's `value` equals `lastPlainTextRef` (the
          // typing echo), so `slateValue`'s cache returns the live nodes set
          // above — leave them stale and downstream hooks (signature help,
          // semantic tokens) never recompute, so the signature pill's active
          // parameter never advances.
          onChange(plainText);
          session.didChange(plainText);

          // a reference typed out in full, and left by the character just typed, is drawn as its chip
          const editor = editorRef.current as unknown as Editor | null;
          const at = editor?.selection;
          if (editor && at && Range.isCollapsed(at) && !readOnly && converter.endsReference) {
            const [index, child] = at.anchor.path;
            const paragraph = newNodes[index];
            const rechipped =
              paragraph &&
              rechipTypedReferences(
                converter,
                paragraph,
                index,
                converter.selectionToOffset([paragraph], [0, child], at.anchor.offset)
              );
            if (rechipped) {
              drawTypedReferences(editor, index, rechipped);
            }
          }
        }

        if (editorRef.current && !readOnly) {
          autocomplete.onSlateChange(editorRef.current as any, newNodes);
        }
        aidsChangeRef.current();
        askInsertableRef.current();
      },
      [onChange, session, readOnly, autocomplete, converter, emitted]
    );

    // Replace mode: open the dropdown at the chip's DOM rect (not the
    // editor selection — clicks on a Slate VOID inline don't reliably
    // update `editor.selection`) and atomically swap the chip on select.
    const hasBrowseList = !!tags && Object.keys(tags).length > 0;
    const handleTagClickDefault = useCallback(
      (tag: ISlateElement, editor: TReqoreRichTextEditorRef) => {
        if (readOnly) return;
        /* An editor with a browse list (`tags`) answers a click on a chip with that list, as a click anywhere
           in its text, and as a value's text does: one list at a time. Opening the chip's replacements beside
           it put two lists over the text, and what was typed then reached neither (qorus#646, David: "you
           can't type"). */
        if (hasBrowseList) return;
        try {
          const tagPath = ReactEditor.findPath(editor, tag as any);
          const domNode = ReactEditor.toDOMNode(editor, tag as any);
          const rect = (domNode as HTMLElement).getBoundingClientRect();
          /* A chip the field's templates or fields list opens the picker where it is - its group, its row the
             keyboard's - and the pick takes its place (qorus#646). A second click on it puts the picker away. */
          const listed =
            templateRoots?.length && typeof tag.value === 'string' ?
              templateNodeFor(templateRoots, tag.value)
            : undefined;
          if (listed) {
            if (autocomplete.browse && autocomplete.isReplaceMode) {
              autocomplete.close();
              return;
            }
            autocomplete.openBrowse(editor as any, {
              rect: { left: rect.left, bottom: rect.bottom },
              replacementPath: tagPath,
              levelId: listed.trailIds[listed.trailIds.length - 1],
              selectedValue: tag.value as string,
            });
            return;
          }
          /* An editor that completes on a click lists what can stand in the chip's place - the fields and
             templates the chip is one of - and the pick replaces it (qorus#646, David: a click on pos listed
             nothing). */
          autocomplete.openAtChip(
            editor,
            tagPath,
            { left: rect.left, bottom: rect.bottom },
            { inItsPlace: completeOnClick }
          );
        } catch {
          // Tag may have been removed mid-render — ignore.
        }
      },
      [readOnly, autocomplete, hasBrowseList, completeOnClick, templateRoots]
    );

    /* A click, a tap or Tab into the text asks what can be written at the caret (`completeOnClick`): the caret the
       page put there, which Slate's selection follows only later. Not a click on a chip, which is a control of
       its own, nor anything outside the text: the list's rows are drawn elsewhere, and their clicks reach this
       box through React. */
    const { openAtCaret, openBrowse } = autocomplete;
    const browsesOnClick = !!templateRoots?.length;
    const completeAtPageCaret = useCallback(
      (target: EventTarget | null) => {
        const editor = editorRef.current;
        if ((!completeOnClick && !browsesOnClick) || readOnly || !editor) return;
        try {
          const root = ReactEditor.toDOMNode(editor, editor);
          if (!(target instanceof Node) || !root.contains(target)) return;
          if (target instanceof Element && target.closest('[data-slate-void="true"]')) return;
          const page = ReactEditor.getWindow(editor).getSelection();
          if (!page || page.rangeCount === 0 || !page.isCollapsed) return;
          const caret = ReactEditor.toSlateRange(editor, page, {
            exactMatch: false,
            suppressThrow: true,
          });
          if (!caret) return;
          const box = page.getRangeAt(0).getBoundingClientRect();
          // a caret in an empty line has no box of its own: the text's
          const at = box.width || box.height ? box : root.getBoundingClientRect();
          /* An empty text offers its templates and fields: the picker, at its top (qorus#646, David: a click in an
             empty field shows the templates, the record's fields among them). */
          const empty = !converter.fromSlateNodes(editor.children as unknown as ISlateElement[]).trim();
          if (browsesOnClick && (empty || !completeOnClick)) {
            openBrowse(editor as any, {
              rect: { left: at.left, bottom: at.bottom },
              caret: caret.anchor,
              arrows: empty,
            });
            return;
          }
          openAtCaret(editor, caret.anchor, { left: at.left, bottom: at.bottom });
        } catch {
          // the editor is not drawn, or the page's caret is not in it: nothing is asked
        }
      },
      [completeOnClick, browsesOnClick, readOnly, openAtCaret, openBrowse, converter]
    );

    const resolvedTagClick = onTagClick ?? handleTagClickDefault;

    // ReqoreRichTextEditor memoizes `renderElement` without `onTagClick` in
    // its deps, so it captures the FIRST render's handler forever (stale
    // `isReady` etc.). Pass a stable wrapper that indirects through a ref
    // to the latest handler.
    const resolvedTagClickRef = useRef(resolvedTagClick);
    resolvedTagClickRef.current = resolvedTagClick;
    const stableOnTagClick = useCallback((tag: any) => {
      if (editorRef.current) {
        resolvedTagClickRef.current(tag as ISlateElement, editorRef.current);
      }
    }, []);

    const handleCompletionSelect = useCallback(
      (item: ICompletionDropdownItem) => {
        if (!editorRef.current) return;
        autocomplete.onItemSelect(item, editorRef.current as any);
      },
      [autocomplete]
    );


    // Overlay shown while the session connects, a context binding resolves,
    // or the wrapper signals `isLoading` (e.g. DpqlEditor awaiting
    // `dpql/toRichtext`). The editor stays mounted underneath;
    // `loadingIndicator === null` opts out, a non-null value overrides.
    const showLoadingOverlay =
      (!session.isReady || !session.isContextReady || isLoading) && loadingIndicator !== null;
    const defaultLoadingLabel =
      !session.isReady ? 'Connecting to language server…'
      : !session.isContextReady ? 'Loading schema…'
      : 'Loading…';
    // Built only when shown — skips a ReqoreSpinner alloc on every render
    // of an already-connected editor.
    const overlayContent =
      !showLoadingOverlay ? null
      : loadingIndicator !== undefined && loadingIndicator !== null ? loadingIndicator
      : <ReqoreSpinner
          iconColor='info:lighten:2'
          size='small'
          centered
          labelEffect={{ textSize: 'small' }}
        >
          {defaultLoadingLabel}
        </ReqoreSpinner>;

    return (
      <ReqoreControlGroup vertical fluid>
        {topActions}
        {aids.findBar}
        {/* The text and, on a touch screen, its Details button beside it, in one row: under the text the button
            was far from it, and what it showed was drawn over the text (Foxhoundn, qlip #361). Always the row,
            so the text is not remounted when the button appears. */}
        <ReqoreControlGroup
          ref={rowRef}
          fluid
          verticalAlign='flex-start'
          className='smart-editor-row'
          // where its completion list is: open, asked for and on its way, or neither - for a host or a test to
          // tell "nothing can be written here" from "not answered yet"
          data-completion={
            autocomplete.isOpen ? 'open'
            : autocomplete.isActive ?
              'asking'
            : 'idle'
          }
        >
          <StyledEditorBox
            style={EDITOR_BOX_STYLE}
            $wordWrap={wordWrap}
            $maxHeight={maxHeight}
            $lineNumbers={lineNumbers}
            className='smart-editor-box'
            onClick={(event) => completeAtPageCaret(event.target)}
            // Tab's key comes up in the editor it moved the focus into
            onKeyUp={(event) => {
              if (event.key === 'Tab') completeAtPageCaret(event.target);
            }}
          >
            <ReqoreRichTextEditor
              ref={editorRef}
              value={slateValue as any}
              onChange={handleSlateChange as any}
              readOnly={readOnly}
              customRenderLeaf={renderLeafWithMarks}
              decorate={composedDecorate}
              getTagProps={tagRenderer as any}
              onTagClick={stableOnTagClick}
              size={size}
              onBlur={handleBlur}
              onKeyDown={(event: React.KeyboardEvent) => {
                aids.onKeyDown(event);
              }}
              // the field's templates, browsed when the text is clicked, tapped or tabbed into: the browse list,
              // drawn as the completion list is
              tags={tags}
              tagsListProps={{ useTargetWidth: true, ...TEMPLATE_BROWSE_LIST_PROPS }}
              // what is typed is completed in the list at the caret: a screen reader is told it completes, and where
              aria-autocomplete='list'
              aria-expanded={autocomplete.isOpen}
              aria-controls={completionMenuId}
              panelProps={{
                fluid: true,
                flat: true,
                style: {
                  // Auto-grow: the editor sizes to its content and grows
                  // as lines are added. `height` is an optional *minimum*
                  // floor (e.g. a multi-line code editor); when omitted,
                  // a single comfortable line so the empty field stays
                  // clickable and the diagnostics panel hugs the input
                  // instead of sitting below a tall reserved box.
                  minHeight: height ?? '2.4em',
                  /* reqore's mono stack, as every other code-like text: the bare generic keyword is the browser's
                     default fixed-width font (Courier in Chrome on macOS), larger than the field's own face */
                  fontFamily: ReqoreFonts.mono,
                  /* the size the text is written in (the text area's, for this size), so the frame and its `em`
                     floor are the text's: a fixed 13px was larger than a small field's text, and the panel's own
                     size larger again, which made the frame taller than the field's other tabs */
                  fontSize: CONTROL_TEXT_FROM_SIZE[size ?? 'normal'],
                },
              }}
            />
            {showLoadingOverlay && (
              <div
                // Absolutely-positioned, centred panel covering the
                // editor body. `backdrop-filter: blur` matches the
                // 20px backdrop blur Reqore uses for drawers — keeps
                // the editor content faintly readable underneath while
                // signalling "this surface is paused". Pointer events
                // pass through; the LSP-dependent paths short-circuit
                // on `!isReady` / `!isContextReady` anyway.
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10, 10, 10, 0.35)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                {overlayContent}
              </div>
            )}
            <CompletionMenu
              autocomplete={autocomplete}
              id={completionMenuId}
              onSelect={handleCompletionSelect}
              templateRoots={templateRoots}
              pendingLabel={
                !session.isReady ? 'Connecting to language server…'
                : !session.isContextReady ? 'Loading schema…'
                : undefined
              }
            />
            {hover.hoverContent && hover.hoverPosition && (
              // Non-interactive (`pointerEvents: none`) so typing/clicking
              // doesn't dismiss it via a focus trap.
              <ReqorePopover
                // one popover per hover: the next one is a popover of its own, wherever it is
                key={`hover-${hover.hoverId}`}
                component='span'
                wrapperStyle={{
                  position: 'fixed',
                  top: hover.hoverPosition.top,
                  left: hover.hoverPosition.left,
                  width: '1px',
                  height: '1px',
                  pointerEvents: 'none',
                }}
                content={
                  <div style={{ padding: 4 }}>
                    <MarkdownDoc
                      content={hover.hoverContent.value}
                      markdown={hover.hoverContent.kind === 'markdown'}
                    />
                  </div>
                }
                openOnMount
                noArrow
                /* A mouse's hover is over the word it is of; what Details shows is under the button, beside the
                   text. Both are a popover's card, the surface a chip's hover is drawn on: drawn as glass, a hover
                   over an empty page was its words with nothing under them (Foxhoundn, qlip #392: "It looks like
                   the background is transparent? Is it not using a ReqorePopover / the tags tooltip?"). */
                placement={detailsShown ? 'bottom-end' : 'top'}
                handler='hover'
                closeOnOutsideClick
                minWidth='220px'
                onToggleChange={(open: boolean) => {
                  // this hover only: a popover replaced by the next hover says it closed as it goes
                  if (!open) hover.clearHover(shownHoverId);
                }}
              />
            )}
            {signatureHelp.signature && signatureHelp.position && (
              <SignatureHelpPill
                signature={signatureHelp.signature}
                position={signatureHelp.position}
              />
            )}
          </StyledEditorBox>
          {templateButton && templateRoots?.length && !readOnly ?
            <TemplateButton
              size={size}
              insertable={insertableAtCaret}
              notInsertable={templateButton.notInsertable}
              open={(rect) => {
                const editor = editorRef.current;
                if (!editor) return;
                if (autocomplete.browse && !autocomplete.isReplaceMode) {
                  autocomplete.close();
                  return;
                }
                openBrowse(editor as any, {
                  rect,
                  arrows: !converter.fromSlateNodes(editor.children as unknown as ISlateElement[]).trim(),
                });
              }}
            />
          : null}
          {showDetailsButton && (
            <ReqoreButton
              className='smart-editor-details'
              icon='InformationLine'
              fixed
              flat
              minimal
              aria-label='Show what the word at the cursor is'
              tooltip={detailsSaysItsWord ? undefined : 'Details'}
              // the press keeps the focus, and the caret the details are of, in the text
              onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                // anchored under the button's right edge: the card opens beside the text, not over it
                /* Under the row, not only under the button: an editor of more than one line is taller than
                   the button, and the card drawn under the button covered the lines below the first
                   (DpqlEditor · Details On A Chip On A Touch Screen, at 390px). */
                const { right, bottom } = event.currentTarget.getBoundingClientRect();
                const row = event.currentTarget.closest('.smart-editor-row');
                const rowBottom = row?.getBoundingClientRect().bottom ?? bottom;
                void hover
                  .showAtCaret({ left: right, top: Math.max(bottom, rowBottom) })
                  .then(setDetailsHoverId);
              }}
            >
              {detailsSaysItsWord ? 'Details' : undefined}
            </ReqoreButton>
          )}
        </ReqoreControlGroup>
        {showDiagnostics && shownDiagnostics.length > 0 && (
          // One ReqoreMessage per diagnostic, severity → intent. The same
          // diagnostics as the inline underline above (`shownDiagnostics`).
          <ReqoreControlGroup vertical fluid size='small'>
            {shownDiagnostics.map((diag, i) => (
              <ReqoreMessage
                key={`${diag.range.start.line}:${diag.range.start.character}:${i}`}
                intent={severityToIntent(diag.severity)}
                // what the message is - an error, a warning, a note - for a test or a host to tell apart
                data-severity={severityToIntent(diag.severity)}
                icon={
                  diag.severity === 2 ? 'AlertLine'
                  : diag.severity && diag.severity >= 3 ?
                    'InformationLine'
                  : 'ErrorWarningLine'
                }
                size='small'
                opaque={false}
              >
                {diag.message}
              </ReqoreMessage>
            ))}
          </ReqoreControlGroup>
        )}
      </ReqoreControlGroup>
    );
  }
);

SmartEditor.displayName = 'SmartEditor';
