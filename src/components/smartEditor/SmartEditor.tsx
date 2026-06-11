// Copyright 2026 Qore Technologies, s.r.o.

import {
  ReqoreCallout,
  ReqoreControlGroup,
  ReqoreMenu,
  ReqoreMenuDivider,
  ReqoreMenuItem,
  ReqoreMessage,
  ReqorePanel,
  ReqoreSpinner,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import {
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import React, { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Editor, NodeEntry, Range, Transforms } from 'slate';
import { ReactEditor, RenderLeafProps } from 'slate-react';
import { ILspSignatureHelp } from '../../utils/lspClient.types';
import { defaultSlateConverter, expandSnippet, lspPositionToOffset } from './helpers';
import { MarkdownDoc } from './MarkdownDoc';
import { COMPLETION_KIND_INTENTS, SMART_EDITOR_OVERLAY_EFFECT } from './styling';
import { ISlateElement, ISmartEditorProps, TCompletionInserter } from './types';
import { ICompletionDropdownItem, useLspAutocomplete } from './useLspAutocomplete';
import { severityToIntent, useLspDiagnosticDecorations } from './useLspDiagnosticDecorations';
import { useLspHover } from './useLspHover';
import { useLspSemanticTokens } from './useLspSemanticTokens';
import { useLspSignatureHelp } from './useLspSignatureHelp';

// One-Dark-ish palette keyed off the LSP semantic-token legend; absent
// types fall through to Slate's default text colour.
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

// Kind chip + a Warning chip (Qonsole flags mutating verbs) for a
// completion row; undefined when neither applies.
function buildKindBadge(
  item: ICompletionDropdownItem
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  const kindIntent =
    item.metadata?.kind !== undefined ? COMPLETION_KIND_INTENTS[item.metadata.kind] : undefined;
  const kindBadge =
    item.kindLabel ?
      {
        label: item.kindLabel,
        minimal: true as const,
        size: 'small' as const,
        intent: kindIntent,
      }
    : null;
  const warningBadge =
    item.warning ?
      {
        label: 'Warning',
        size: 'small' as const,
        intent: 'warning' as const,
        tooltip: item.warning,
      }
    : null;
  if (warningBadge && kindBadge) return [kindBadge, warningBadge];
  if (warningBadge) return [warningBadge];
  if (kindBadge) return kindBadge;
  return undefined;
}

// Tooltip prop rendering a row's LSP `documentation` (markdown/plaintext),
// or undefined when there is none.
function buildDocTooltip(item: ICompletionDropdownItem) {
  const doc = item.documentation;
  if (!doc) return undefined;
  const isMarkdown = typeof doc === 'object' && doc !== null && doc.kind === 'markdown';
  const text = typeof doc === 'string' ? doc : (doc?.value ?? '');
  if (!text) return undefined;
  return {
    content: <MarkdownDoc content={text} markdown={isMarkdown} />,
    placement: 'right' as const,
    delay: 200,
    // The cast covers popover props missing from the older tooltip type.
    flat: true,
    transparent: true,
    backgroundBlur: 20,
  } as IReqoreTooltip;
}

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

// Module-scoped so the reference is stable across renders — an inline
// object would defeat ReqoreMenuItem's memoization.
const COMPLETION_ITEM_STYLE: React.CSSProperties = { fontFamily: 'monospace' };

interface ICompletionMenuItemProps {
  item: ICompletionDropdownItem;
  isFocused: boolean;
  onSelect: (item: ICompletionDropdownItem) => void;
}

// Memoized completion row so badge/tooltip derivation runs once per item,
// not on every SmartEditor re-render.
const CompletionMenuItem = memo(({ item, isFocused, onSelect }: ICompletionMenuItemProps) => {
  const badge = useMemo(() => buildKindBadge(item), [item]);
  const tooltip = useMemo(() => buildDocTooltip(item), [item]);
  const handleClick = useCallback(() => onSelect(item), [onSelect, item]);

  return (
    <ReqoreMenuItem
      icon={item.icon as any}
      label={item.label}
      description={item.description}
      badge={badge as any}
      tooltip={tooltip as any}
      selected={isFocused}
      active={isFocused}
      minimal
      scrollIntoView={isFocused}
      onClick={handleClick}
      compact
      style={COMPLETION_ITEM_STYLE}
    />
  );
});
CompletionMenuItem.displayName = 'CompletionMenuItem';

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
        style={{ fontFamily: 'monospace' }}
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
      readOnly = false,
      showDiagnostics = true,
      onBlur,
      loadingIndicator,
      enableHover = true,
      isLoading = false,
      enableSignatureHelp = true,
    },
    ref
  ) => {
    const theme = useReqoreTheme();
    const editorRef = useRef<TReqoreRichTextEditorRef>(null);
    const lastPlainTextRef = useRef(value);
    // Cached Slate nodes, refreshed only on EXTERNAL value changes — not on
    // the typing echo. Passing a fresh ref every keystroke re-runs
    // ReqoreRichTextEditor's tokenizer mid-token (typed `@s` collapses to a
    // tag chip, making the rest of the field name impossible to type).
    const slateValueRef = useRef<ISlateElement[] | null>(null);

    useImperativeHandle(ref, () => editorRef.current as TReqoreRichTextEditorRef, []);

    // Gates all LSP hooks on both the connection (`isReady`) and any
    // wrapper context binding (`isContextReady`) — without the latter,
    // typing `@` in the ~50–200ms before `dpql/setContext` resolves hits
    // the server context-less and the dropdown silently closes. Generic
    // sessions set `isContextReady: true`, collapsing this to `isReady`.
    const lspReady = session.isReady && session.isContextReady;

    const autocomplete = useLspAutocomplete({
      getCompletions: session.getCompletions,
      isReady: lspReady,
      triggerCharacters,
      converter,
      inserter: completionInserter,
    });

    const hover = useLspHover(session, editorRef as React.RefObject<any>, converter, {
      enabled: enableHover,
    });

    const slateValue = useMemo(() => {
      // Reuse the cache when `value` is just the editor's own typing echo.
      if (slateValueRef.current !== null && value === lastPlainTextRef.current) {
        return slateValueRef.current;
      }
      const next = converter.toSlateNodes(value);
      slateValueRef.current = next;
      return next;
    }, [value, converter]);

    const diagnosticDecorate = useLspDiagnosticDecorations(
      session.diagnostics,
      converter,
      slateValue
    );

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

    const composedDecorate = useCallback(
      (entry: NodeEntry): Range[] => {
        const userRanges = decorate?.(entry) ?? [];
        const semanticRanges = semanticDecorate(entry);
        const diagRanges = showDiagnostics ? diagnosticDecorate(entry) : [];
        // Diagnostics last so the wavy underline isn't overdrawn.
        return [...userRanges, ...semanticRanges, ...diagRanges];
      },
      [decorate, semanticDecorate, diagnosticDecorate, showDiagnostics]
    );

    // Paints semantic-token colours and diagnostic underlines, falling
    // through to the consumer's `customRenderLeaf` for everything else.
    const renderLeafWithMarks = useCallback(
      (props: RenderLeafProps) => {
        const leaf = props.leaf as RenderLeafProps['leaf'] & {
          error?: true;
          errorMessage?: string;
          severity?: number;
          tokenType?: string;
          tokenModifiers?: string[];
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

        // Underline outermost so it overlays the syntax colour; hex
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

    const handleSlateChange = useCallback(
      (newNodes: ISlateElement[]) => {
        const plainText = converter.fromSlateNodes(newNodes);

        if (plainText !== lastPlainTextRef.current) {
          lastPlainTextRef.current = plainText;
          // CRITICAL: refresh `slateValueRef` to the live nodes too. The
          // next render's `value` equals `lastPlainTextRef` (the typing
          // echo), so `slateValue`'s cache returns this ref — leave it
          // stale and downstream hooks (signature help, semantic tokens)
          // never recompute, so the signature pill's active parameter
          // never advances.
          slateValueRef.current = newNodes;
          onChange(plainText);
          session.didChange(plainText);
        }

        if (editorRef.current && !readOnly) {
          autocomplete.onSlateChange(editorRef.current as any, newNodes);
        }
      },
      [onChange, session, readOnly, autocomplete, converter]
    );

    // Replace mode: open the dropdown at the chip's DOM rect (not the
    // editor selection — clicks on a Slate VOID inline don't reliably
    // update `editor.selection`) and atomically swap the chip on select.
    const handleTagClickDefault = useCallback(
      (tag: ISlateElement, editor: TReqoreRichTextEditorRef) => {
        if (readOnly) return;
        try {
          const tagPath = ReactEditor.findPath(editor, tag as any);
          const domNode = ReactEditor.toDOMNode(editor, tag as any);
          const rect = (domNode as HTMLElement).getBoundingClientRect();
          autocomplete.openAtChip(editor, tagPath, {
            left: rect.left,
            bottom: rect.bottom,
          });
        } catch {
          // Tag may have been removed mid-render — ignore.
        }
      },
      [readOnly, autocomplete]
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

    // Flatten groups into rows carrying a flat index to compare against
    // `focusedIndex` (which is flat across all groups).
    const completionGroups = useMemo(() => {
      let flatIndex = 0;
      return autocomplete.groups.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({ item, index: flatIndex++ })),
      }));
    }, [autocomplete.groups]);

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
        <div style={{ position: 'relative' }}>
          <ReqoreRichTextEditor
            ref={editorRef}
            value={slateValue as any}
            onChange={handleSlateChange as any}
            readOnly={readOnly}
            customRenderLeaf={renderLeafWithMarks}
            decorate={composedDecorate}
            getTagProps={tagRenderer as any}
            onTagClick={stableOnTagClick}
            onBlur={onBlur}
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
                fontFamily: 'monospace',
                fontSize: '13px',
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
          {autocomplete.isOpen &&
            (autocomplete.items.length > 0 ||
              autocomplete.isReplaceMode ||
              autocomplete.isFetching) && (
              <ReqorePopover
                key={autocomplete.popoverKey}
                component='span'
                wrapperStyle={{
                  // `fixed` anchor at the cursor's screen coords — avoids
                  // parent-offset math.
                  position: 'fixed',
                  top: autocomplete.position.top,
                  left: autocomplete.position.left,
                  width: '1px',
                  height: '1px',
                  pointerEvents: 'none',
                }}
                content={
                  <ReqoreMenu
                    rounded
                    flat
                    maxHeight='300px'
                    width='300px'
                    effect={SMART_EDITOR_OVERLAY_EFFECT}
                    customTheme={{ main: '#1e0d29' }}
                  >
                    {autocomplete.items.length === 0 &&
                      (autocomplete.isReplaceMode || autocomplete.isFetching) && (
                        <ReqoreMenuItem
                          icon='LoaderLine'
                          label={
                            !session.isReady ? 'Connecting to language server…'
                            : !session.isContextReady ?
                              'Loading schema…'
                            : autocomplete.isFetching ?
                              'Loading completions…'
                            : 'No alternatives available'
                          }
                          disabled
                          compact
                        />
                      )}
                    {completionGroups.map((group) => (
                      <React.Fragment key={group.label || '_default'}>
                        {group.label && (
                          <ReqoreMenuDivider
                            label={group.label}
                            // @ts-expect-error — intent type not in older Reqore
                            intent='muted'
                          />
                        )}
                        {group.items.map(({ item, index }) => (
                          <CompletionMenuItem
                            key={item.value}
                            item={item}
                            isFocused={index === autocomplete.focusedIndex}
                            onSelect={handleCompletionSelect}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                  </ReqoreMenu>
                }
                openOnMount
                noArrow
                placement='bottom-start'
                handler='click'
                closeOnOutsideClick
                closeOnInsideClick={false}
                minWidth='300px'
                flat
                // Transparent so the popover wrapper doesn't frame the menu.
                transparent
                onToggleChange={autocomplete.handleExternalClose}
              />
            )}
          {hover.hoverContent && hover.hoverPosition && (
            // Non-interactive (`pointerEvents: none`) so typing/clicking
            // doesn't dismiss it via a focus trap.
            <ReqorePopover
              key={`hover-${hover.hoverPosition.left}-${hover.hoverPosition.top}`}
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
              placement='top'
              handler='hover'
              closeOnOutsideClick
              minWidth='220px'
              flat
              transparent
              backgroundBlur={20}
              onToggleChange={(open: boolean) => {
                if (!open) hover.clearHover();
              }}
            />
          )}
          {signatureHelp.signature && signatureHelp.position && (
            <SignatureHelpPill
              signature={signatureHelp.signature}
              position={signatureHelp.position}
            />
          )}
        </div>
        {showDiagnostics && session.diagnostics.length > 0 && (
          // One ReqoreMessage per diagnostic, severity → intent. Same
          // `session.diagnostics` source as the inline underline above.
          <ReqoreControlGroup vertical fluid size='small'>
            {session.diagnostics.map((diag, i) => (
              <ReqoreMessage
                key={`${diag.range.start.line}:${diag.range.start.character}:${i}`}
                intent={severityToIntent(diag.severity)}
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
