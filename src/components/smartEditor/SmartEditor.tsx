// Copyright 2026 Qore Technologies, s.r.o.
// Generic Slate-based smart editor primitive. Wraps Reqore's
// `ReqoreRichTextEditor` plus a caller-provided `useLspSession` result —
// rendering of completions, diagnostics, and language-specific styling
// flows from the props. The primitive itself has no language semantics:
// language wrappers (e.g. `DpqlEditor`) own the session (via
// `useLspSession`), react to prop changes by dispatching `<lang>/*` custom
// methods on the live client, and pass everything down here.

import {
  ReqoreControlGroup,
  ReqoreMenu,
  ReqoreMenuDivider,
  ReqoreMenuItem,
  ReqoreMessage,
  ReqoreSpinner,
} from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import {
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import ReactMarkdown from 'react-markdown';
import { Editor, NodeEntry, Range, Transforms } from 'slate';
import { ReactEditor, RenderLeafProps } from 'slate-react';
import { defaultSlateConverter, lspPositionToOffset } from './helpers';
import { ISlateElement, ISmartEditorProps, TCompletionInserter } from './types';
import {
  ICompletionDropdownItem,
  useLspAutocomplete,
} from './useLspAutocomplete';
import {
  COMPLETION_KIND_INTENTS,
  DIAGNOSTIC_SEVERITY_EFFECTS,
  SMART_EDITOR_OVERLAY_EFFECT,
  SMART_EDITOR_POPOVER_CUSTOM_THEME,
} from './styling';
import {
  severityToIntent,
  useLspDiagnosticDecorations,
} from './useLspDiagnosticDecorations';
import { useLspHover } from './useLspHover';
import { useLspSemanticTokens } from './useLspSemanticTokens';
import { useLspSignatureHelp } from './useLspSignatureHelp';

/**
 * Theme-leaning colour palette keyed off the LSP-standard
 * `SemanticTokenType` legend. Maps to a One-Dark-ish vocabulary that
 * reads on both light and dark Reqore themes. Token types absent from
 * this map fall through with no colour — Slate's default text colour
 * applies, which is the right behaviour for `namespace` / `decorator` /
 * tokens we don't have a strong opinion about.
 */
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
  regexp: '#d16969', // coral — /pattern/flags. Distinct from operator
  //                    cyan so `=~ /…/` reads as two tokens, not one
  //                    cyan run. Matches VS Code Dark+ regex hue;
  //                    distinct from variable's `#e06c75` pink.
  modifier: '#c678dd', // purple
  decorator: '#c678dd', // purple
  namespace: '#e5c07b', // yellow
};

/**
 * Build the `badge` prop for a completion row's right-side kind chip
 * (e.g. `Field`, `Keyword`). Returns `undefined` when the item has no
 * kind, so the badge is simply not rendered. The chip uses Reqore's
 * `minimal` style + smaller size for a subdued, IntelliSense-style
 * appearance that doesn't compete with the label.
 */
/**
 * Build the `badge` prop for a completion row. Returns the kind chip
 * (Field / Method / …) plus a "Warning" chip when the item carries
 * server-side warning copy (Qonsole emits this on mutating verbs).
 * Both chips are right-aligned on the row.
 *
 * Returns `undefined` when neither applies — keeps Reqore's prop
 * shape clean.
 */
function buildKindBadge(item: ICompletionDropdownItem):
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | undefined {
  const kindIntent =
    item.metadata?.kind !== undefined
      ? COMPLETION_KIND_INTENTS[item.metadata.kind]
      : undefined;
  const kindBadge = item.kindLabel
    ? {
        label: item.kindLabel,
        minimal: true as const,
        size: 'small' as const,
        intent: kindIntent,
      }
    : null;
  const warningBadge = item.warning
    ? {
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

/**
 * Build the tooltip prop for a completion row. Returns a JSX-rendering
 * tooltip when the item has LSP `documentation` (markdown or plaintext);
 * `undefined` otherwise. The tooltip body is constrained in width and
 * scrollable so long docs don't blow up the layout.
 */
function buildDocTooltip(item: ICompletionDropdownItem) {
  const doc = item.documentation;
  if (!doc) return undefined;
  const isMarkdown =
    typeof doc === 'object' && doc !== null && doc.kind === 'markdown';
  const text = typeof doc === 'string' ? doc : doc?.value ?? '';
  if (!text) return undefined;
  return {
    content: (
      <div style={{ maxWidth: 360, maxHeight: 240, overflow: 'auto' }}>
        {isMarkdown ? <ReactMarkdown>{text}</ReactMarkdown> : <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</pre>}
      </div>
    ),
    placement: 'right' as const,
    delay: 200,
  };
}

/**
 * Default completion inserter — applies the server-provided `textEdit`
 * when present (LSP-compliant: replace the exact span the server
 * specified with `newText`), or falls back to inserting `insertText` at
 * the cursor. Without the `textEdit` path, the partial token the user
 * typed before requesting completions would be duplicated — e.g. typed
 * `-` + inserted `--desc=` becomes `---desc=`. Wrappers (DPQL) override
 * this entirely to insert Slate tag elements for `@field` / `$template`.
 */
const defaultCompletionInserter: TCompletionInserter = (item, editor, ctx) => {
  const newText = item.textEdit?.newText ?? item.insertText ?? item.label;

  // Replace mode — atomically swap the node at the chip's path for the
  // chosen completion as plain text. (Language wrappers that need tag
  // chips override this entirely.)
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
    // `cursorOffset - startOffset` is the number of plain-text characters
    // between the start of the LSP-specified replacement range and the
    // current caret. Those characters are the partial token the user
    // typed; delete them before inserting.
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
      height = '200px',
      readOnly = false,
      onBlur,
      loadingIndicator,
      enableHover = true,
      isLoading = false,
      enableSignatureHelp = true,
    },
    ref
  ) => {
    const editorRef = useRef<TReqoreRichTextEditorRef>(null);
    const lastPlainTextRef = useRef(value);
    // Cached Slate nodes. Updated only on EXTERNAL value changes (initial
    // mount, programmatic setValue, format result, etc.) — not on the
    // round-trip echo from user typing. Slate's internal state is the
    // source of truth between renders; passing a fresh `slateValue` ref
    // on every keystroke triggers `useUpdateEffect` in ReqoreRichTextEditor
    // which re-runs `plainTextToSlate` and aggressively re-tokenizes
    // partial input (e.g. typed `@s` collapses to a single tag chip,
    // making the rest of the field name impossible to type).
    const slateValueRef = useRef<ISlateElement[] | null>(null);

    // Forward the underlying Slate editor ref so wrappers can do
    // programmatic focus / selection / transforms.
    useImperativeHandle(ref, () => editorRef.current as TReqoreRichTextEditorRef, []);

    // Combined readiness signal — gates ALL LSP-driven hooks. We want
    // both (a) the LSP connection established (`isReady`) AND (b) any
    // wrapper-defined context binding to have resolved
    // (`isContextReady`). Without (b), typing `@` during the
    // ~50–200ms window between LSP-ready and `dpql/setContext`-bound
    // hits the server context-less and gets empty results — the
    // dropdown auto-closes silently. Generic primitive sessions have
    // `isContextReady: true` so this collapses to `isReady` for them.
    const lspReady = session.isReady && session.isContextReady;

    const autocomplete = useLspAutocomplete({
      getCompletions: session.getCompletions,
      isReady: lspReady,
      triggerCharacters,
      converter,
      inserter: completionInserter,
    });

    // Hover support — disabled when `enableHover === false`. The hook
    // attaches a mousemove listener to the editor's contenteditable
    // element via `editorRef.current` and resolves LSP hover content
    // after 300ms of idle.
    const hover = useLspHover(
      session,
      editorRef as React.RefObject<any>,
      converter,
      { enabled: enableHover }
    );

    // Signature help — small pill above the caret showing the active
    // function/operator call's signature with the current parameter
    // highlighted. Silently no-ops when the server doesn't advertise
    // `signatureHelpProvider` capability.
    // (Hook needs `slateValue` so its `plainText` memo recomputes on
    // document changes — it's declared further down, so we use a
    // forward reference via the editor's live children inside the
    // hook. We call the hook AFTER slateValue is defined.)

    const slateValue = useMemo(() => {
      // Return the cached Slate nodes when `value` is just the echo of the
      // last plainText we emitted from the editor — Slate's internal state
      // already reflects that text, no need to re-tokenize.
      if (
        slateValueRef.current !== null &&
        value === lastPlainTextRef.current
      ) {
        return slateValueRef.current;
      }
      const next = converter.toSlateNodes(value);
      slateValueRef.current = next;
      return next;
    }, [value, converter]);

    // Build the diagnostic-decoration function from `session.diagnostics`.
    // Composed below with the caller's `decorate` so syntax highlighting
    // and error underlines can coexist on the same leaf.
    const diagnosticDecorate = useLspDiagnosticDecorations(
      session.diagnostics,
      converter,
      slateValue
    );

    // LSP-driven syntax highlighting. Replaces the previous client-side
    // regex highlighter (which was SQL-keyword copy-paste — see design
    // doc §7). The server is the source of truth for token types.
    const semanticDecorate = useLspSemanticTokens(
      session,
      converter,
      slateValue
    );

    // Signature help. Hook self-fires on document changes; renders
    // as a small pinned popover ABOVE the caret line (so it can
    // coexist with the completion popover, which anchors below).
    // Silently no-ops when the server doesn't advertise
    // `signatureHelpProvider` capability.
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
        const diagRanges = diagnosticDecorate(entry);
        // Order matters when the same leaf carries multiple marks —
        // diagnostics last so the wavy underline isn't overdrawn by
        // anything else.
        return [...userRanges, ...semanticRanges, ...diagRanges];
      },
      [decorate, semanticDecorate, diagnosticDecorate]
    );

    /**
     * Render-leaf wrapper that paints both LSP-driven syntax
     * highlighting (`tokenType` / `tokenModifiers` marks from
     * `useLspSemanticTokens`) and diagnostic underlines (`error` /
     * `errorMessage` / `severity` marks from
     * `useLspDiagnosticDecorations`). Falls through to the
     * consumer-supplied `customRenderLeaf` for anything else, so
     * wrappers can still inject extra marks via a caller `decorate`.
     */
    const renderLeafWithMarks = useCallback(
      (props: RenderLeafProps) => {
        const leaf = props.leaf as RenderLeafProps['leaf'] & {
          error?: true;
          errorMessage?: string;
          severity?: number;
          tokenType?: string;
          tokenModifiers?: string[];
        };

        // Start from the consumer's renderLeaf (or a plain span) so
        // any caller-defined marks render first.
        let child = customRenderLeaf ? (
          customRenderLeaf(props)
        ) : (
          <span {...props.attributes}>{props.children}</span>
        );

        // Apply semantic-token colouring. Wrap in an extra span when
        // the type is in our palette; absent types fall through with
        // default text colour.
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

        // Diagnostic underline goes outermost so it overlays the
        // syntax colour. Native `title` tooltip carries the message.
        if (leaf.error) {
          const underlineColor =
            leaf.severity === 2
              ? '#f0a500'
              : leaf.severity && leaf.severity >= 3
                ? '#3a86ff'
                : '#d62828';
          child = (
            <span
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
      [customRenderLeaf]
    );

    const handleSlateChange = useCallback(
      (newNodes: ISlateElement[]) => {
        const plainText = converter.fromSlateNodes(newNodes);

        if (plainText !== lastPlainTextRef.current) {
          lastPlainTextRef.current = plainText;
          onChange(plainText);
          session.didChange(plainText);
        }

        if (editorRef.current && !readOnly) {
          autocomplete.onSlateChange(editorRef.current as any, newNodes);
        }
      },
      [onChange, session, readOnly, autocomplete, converter]
    );

    /**
     * Default tag-click handler — Replace mode. The clicked chip stays
     * visible, the autocomplete dropdown opens anchored at the chip's
     * viewport rect, and the chosen completion atomically swaps the
     * chip for the new value (no flicker, no partial plain-text state).
     *
     * Picking up the chip's DOM rect (via `ReactEditor.toDOMNode`) avoids
     * relying on the editor selection — clicks on a Slate VOID inline
     * don't always update `editor.selection` reliably. The chip path
     * (from `findPath`) is what the autocomplete forwards to the inserter
     * via `ctx.replacementPath` to do the atomic swap.
     */
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

    // Reqore's `ReqoreRichTextEditor` memoizes its `renderElement` over
    // deps that do NOT include `onTagClick`. That means whichever
    // `onTagClick` we passed on the FIRST render gets captured forever —
    // subsequent renders' fresh closures (with up-to-date `isReady`,
    // `autocomplete`, etc.) are silently ignored. The chip click ends up
    // calling a stale handler with a stale `isReady`, which is why we
    // see `isReady: false` in `openAtChip` even after the LSP has long
    // since connected.
    //
    // Workaround: pass a STABLE wrapper to Reqore that internally reads
    // the latest `resolvedTagClick` from a ref. Reqore captures the
    // wrapper once, but every call indirects through the ref so the
    // user-visible behaviour is always current.
    const resolvedTagClickRef = useRef(resolvedTagClick);
    resolvedTagClickRef.current = resolvedTagClick;
    const stableOnTagClick = useCallback((tag: any) => {
      if (editorRef.current) {
        resolvedTagClickRef.current(
          tag as ISlateElement,
          editorRef.current
        );
      }
    }, []);

    const handleCompletionSelect = useCallback(
      (item: { value?: string }) => {
        if (!item.value || !editorRef.current) return;
        const matching = autocomplete.items.find((i) => i.value === item.value);
        if (matching) {
          autocomplete.onItemSelect(matching, editorRef.current as any);
        }
      },
      [autocomplete]
    );

    // Loading overlay rendered on top of the editor while the LSP
    // session is still connecting, the wrapper's language-specific
    // context binding is still resolving, OR the wrapper has signalled
    // a higher-level busy state via `isLoading` (e.g. DpqlEditor's
    // `useServerParse` mode while awaiting `dpql/toRichtext`).
    //
    // The default copy varies by which signal is the cause:
    //   - `!isReady`         → "Connecting to language server…"
    //   - `!isContextReady`  → "Loading schema…"
    //   - `isLoading` only   → "Loading…"
    //
    // The editor stays mounted so the initial value is visible
    // underneath; the overlay just signals "completions / diagnostics
    // / hover are temporarily unavailable". `loadingIndicator === null`
    // opts out entirely; a non-null override replaces the default
    // entirely.
    const showLoadingOverlay =
      (!session.isReady || !session.isContextReady || isLoading) &&
      loadingIndicator !== null;
    const defaultLoadingLabel = !session.isReady
      ? 'Connecting to language server…'
      : !session.isContextReady
        ? 'Loading schema…'
        : 'Loading…';
    const overlayContent =
      loadingIndicator !== undefined && loadingIndicator !== null ? (
        loadingIndicator
      ) : (
        <ReqoreSpinner
          iconColor='info:lighten:2'
          size='small'
          centered
          labelEffect={{ textSize: 'small' }}
        >
          {defaultLoadingLabel}
        </ReqoreSpinner>
      );

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
                minHeight: height,
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
                // Viewport-positioned anchor placed at the cursor's
                // screen coordinates (computed in `positionTrigger`).
                // `fixed` avoids parent-offset math (panel padding,
                // scroll position, etc.).
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
                  padded={false}
                  customTheme={SMART_EDITOR_POPOVER_CUSTOM_THEME}
                  effect={SMART_EDITOR_OVERLAY_EFFECT}
                >
                  {autocomplete.items.length === 0 &&
                    (autocomplete.isReplaceMode ||
                      autocomplete.isFetching) && (
                      <ReqoreMenuItem
                        icon='LoaderLine'
                        label={
                          !session.isReady
                            ? 'Connecting to language server…'
                            : !session.isContextReady
                              ? 'Loading schema…'
                              : autocomplete.isFetching
                                ? 'Loading completions…'
                                : 'No alternatives available'
                        }
                        disabled
                        compact
                      />
                    )}
                  {(() => {
                    let flatIndex = 0;
                    return autocomplete.groups.map((group) => (
                      <React.Fragment key={group.label || '_default'}>
                        {group.label && (
                          <ReqoreMenuDivider
                            label={group.label}
                            // Muted intent: section labels read as
                            // navigation chrome, not as content.
                            // Matches qorus-ide's "tiny label" pattern.
                            // @ts-expect-error — intent type not in older Reqore
                            intent='muted'
                          />
                        )}
                        {group.items.map((item) => {
                          const itemIndex = flatIndex++;
                          const badge = buildKindBadge(item);
                          const tooltip = buildDocTooltip(item);
                          const isFocused =
                            itemIndex === autocomplete.focusedIndex;
                          return (
                            <ReqoreMenuItem
                              key={item.value}
                              icon={item.icon as any}
                              label={item.label}
                              description={item.description}
                              badge={badge as any}
                              tooltip={tooltip as any}
                              selected={isFocused}
                              // Apply info intent on the focused row for
                              // better contrast against the dark
                              // `#1a1a1a` popover surface.
                              intent={isFocused ? 'info' : undefined}
                              scrollIntoView={isFocused}
                              onClick={() =>
                                handleCompletionSelect({ value: item.value })
                              }
                              compact
                              // Monospace makes code-shaped tokens (`@field`,
                              // `--flag=`, `$template:value`) line up
                              // predictably and matches the editor's own
                              // monospace body — feels like a code-editor
                              // intellisense list, which is what users
                              // expect here.
                              style={{ fontFamily: 'monospace' }}
                            />
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
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
              onToggleChange={autocomplete.handleExternalClose}
            />
          )}
          {hover.hoverContent && hover.hoverPosition && (
            // Hover popover anchored at the mouse coordinates. Pure
            // markdown content via `react-markdown` (or plaintext when
            // the server says so). The popover is non-interactive
            // (`pointerEvents: none` on the wrapper) so the user can
            // continue typing / clicking without dismissing it via
            // accidental focus traps.
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
                <div
                  style={{
                    maxWidth: 360,
                    maxHeight: 240,
                    overflow: 'auto',
                    fontSize: 12,
                    padding: 4,
                  }}
                >
                  {hover.hoverContent.kind === 'markdown' ? (
                    <ReactMarkdown>{hover.hoverContent.value}</ReactMarkdown>
                  ) : (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {hover.hoverContent.value}
                    </pre>
                  )}
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
              // @ts-expect-error — customTheme on popovers is valid but
              // not in the older Reqore type declarations
              customTheme={SMART_EDITOR_POPOVER_CUSTOM_THEME}
              onToggleChange={(open: boolean) => {
                if (!open) hover.clearHover();
              }}
            />
          )}
          {signatureHelp.signature && signatureHelp.position && (() => {
            // Render the signature-help pill ABOVE the caret line.
            // Pulled into an IIFE so we can compute the active
            // parameter once per render.
            const sig =
              signatureHelp.signature.signatures[
                signatureHelp.signature.activeSignature ?? 0
              ];
            if (!sig) return null;
            const activeIdx =
              sig.activeParameter ??
              signatureHelp.signature.activeParameter ??
              0;
            const params = sig.parameters ?? [];
            const activeParam = params[activeIdx];

            // Highlight the active parameter substring inside the
            // signature label when `label` is a [start, end] tuple
            // (LSP spec allows either substring positions or literal
            // names). For literal names we fall back to bolding the
            // matching word.
            const renderLabel = (): React.ReactNode => {
              if (!activeParam) return sig.label;
              if (Array.isArray(activeParam.label)) {
                const [start, end] = activeParam.label;
                return (
                  <>
                    {sig.label.slice(0, start)}
                    <strong style={{ color: '#56b6c2' }}>
                      {sig.label.slice(start, end)}
                    </strong>
                    {sig.label.slice(end)}
                  </>
                );
              }
              const name = activeParam.label;
              const idx = sig.label.indexOf(name);
              if (idx < 0) return sig.label;
              return (
                <>
                  {sig.label.slice(0, idx)}
                  <strong style={{ color: '#56b6c2' }}>{name}</strong>
                  {sig.label.slice(idx + name.length)}
                </>
              );
            };

            const paramDoc =
              activeParam && activeParam.documentation
                ? typeof activeParam.documentation === 'string'
                  ? activeParam.documentation
                  : activeParam.documentation.value
                : null;

            return (
              <ReqorePopover
                key={`sig-${signatureHelp.position.left}-${signatureHelp.position.top}`}
                component='span'
                wrapperStyle={{
                  position: 'fixed',
                  top: signatureHelp.position.top,
                  left: signatureHelp.position.left,
                  width: '1px',
                  height: '1px',
                  pointerEvents: 'none',
                }}
                content={
                  <div
                    style={{
                      maxWidth: 480,
                      fontSize: 12,
                      padding: 6,
                      fontFamily: 'monospace',
                    }}
                  >
                    <div>{renderLabel()}</div>
                    {paramDoc && (
                      <div
                        style={{
                          marginTop: 4,
                          fontFamily: 'inherit',
                          fontSize: 11,
                          opacity: 0.85,
                        }}
                      >
                        <ReactMarkdown>{paramDoc}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                }
                openOnMount
                noArrow
                placement='top-start'
                handler='click'
                closeOnOutsideClick={false}
                minWidth='280px'
                flat
                transparent
                backgroundBlur={20}
                // @ts-expect-error — customTheme on popovers is valid
                customTheme={SMART_EDITOR_POPOVER_CUSTOM_THEME}
              />
            );
          })()}
        </div>
        {session.diagnostics.length > 0 && (
          // Stacked `ReqoreMessage`s under the editor — one per active
          // diagnostic. Severity drives the intent (`danger` / `warning`
          // / `info`); the inline wavy underline above and this panel
          // both speak to the same `session.diagnostics` array, so they
          // can never disagree.
          <ReqoreControlGroup vertical fluid size='small'>
            {session.diagnostics.map((diag, i) => (
              <ReqoreMessage
                key={`${diag.range.start.line}:${diag.range.start.character}:${i}`}
                intent={severityToIntent(diag.severity)}
                icon={
                  diag.severity === 2
                    ? 'AlertLine'
                    : diag.severity && diag.severity >= 3
                      ? 'InformationLine'
                      : 'ErrorWarningLine'
                }
                size='small'
                flat
                // `opaque={false}` matches every Qonsole sub-surface —
                // message blends with the host page gradient rather
                // than putting its own opaque background on top.
                opaque={false}
                // Per-severity coloured gradient effect — matches the
                // `NegativeColorEffect` / `WarningColorEffect` /
                // `PendingColorEffect` vocabulary from qorus-ide.
                effect={
                  DIAGNOSTIC_SEVERITY_EFFECTS[diag.severity ?? 1] ??
                  DIAGNOSTIC_SEVERITY_EFFECTS[1]
                }
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
