// Copyright 2026 Qore Technologies, s.r.o.
// DpqlEditor — Slate-based DPQL smart text field. Thin wrapper over the
// generic `SmartEditor` primitive, configured with DPQL-flavored knobs:
// regex-driven syntax highlighting, tag rendering for $template / @field,
// plain-text↔Slate conversion that recognises DPQL tag patterns, and
// tag-element insertion for completions whose `insertText` starts with
// `@` or `$`.
//
// Templates and fields are BOTH served by the LSP server through the
// completion stream: typing `$` opens templates, `@` opens field
// references (the server's `dpql-get-completions` is position-aware).
// Given templates, it lists them in that one list on a click as well, and
// a picker beside the text browses them as their catalogue nests them
// (`TemplateBrowser`), as a Qog field's are.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { SmartEditor } from '../smartEditor/SmartEditor';
import { ISlateConverter, ISlateElement } from '../smartEditor/types';
import { dpqlReferencesIn, dpqlSlateConverter, richtextResponseToSlate } from './dpqlHelpers';
import { dpqlCompletionInserter } from './dpqlInserter';
import { makeDpqlTagRenderer } from './dpqlTags';
import {
  dpqlCompletionsWith,
  dpqlEmptyCompletionMessage,
  dpqlExpectsValue,
  NO_VALUE_AT_THE_END,
  presentDpqlDiagnostics,
} from './dpqlCompletions';
import { IDpqlEditorProps, IDpqlEditorRef } from './types';
import { useDpqlSession } from './useDpqlSession';
import {
  referenceNamesNothing,
  referenceNamesNothingMessage,
  templateTree,
} from '../../helpers/templateTree';
import { ILspDiagnostic } from '../../utils/lspClient.types';
import { DPQL_EDITING_LANGUAGE } from '../smartEditor/editingAids';
import { useDescriptionTooltips } from '../../helpers/descriptionTooltip';
import { useTypeLabel, useTypeSentenceForm } from '../form/typeSentenceForm';

export type { IDpqlEditorProps, IDpqlEditorRef };

// Trigger characters that open the autocomplete on typing. Space is
// deliberately NOT in the set — typing a space after a chip (or after a
// keyword like `==`) shouldn't pop the dropdown. Sigils (`@`, `$`) and
// in-token punctuation (`.`, `:`) cover the meaningful cases; the rest
// of completion is handled by typing inside an already-open token.
const DPQL_TRIGGERS = new Set(['@', '$', '.', ':']);

export const DpqlEditor = forwardRef<IDpqlEditorRef, IDpqlEditorProps>(
  (
    {
      value,
      onChange,
      provider,
      recordType,
      options,
      actionCode,
      height,
      size,
      readOnly = false,
      wordWrap,
      maxHeight,
      lineNumbers,
      showDiagnostics = true,
      enableHover = true,
      templateTagsUseIntent = true,
      loadingIndicator,
      templates,
      onBlur,
      useServerParse = false,
      fields,
      alertPayloadContext = false,
      fsmContext,
      onUnavailable,
      onReady,
      completeOnClick = !!templates,
      browseTemplates = true,
    },
    ref
  ) => {
    const dpql = useDpqlSession({
      provider,
      recordType,
      options,
      fields,
      actionCode,
      initialText: value,
      alertPayloadContext,
      fsmContext,
    });

    // Server-parse state: when `useServerParse` is true, we ask the
    // LSP server's `dpql/toRichtext` to convert the plain-text value
    // into a structured Slate tree. The result is cached against the
    // `value` it parsed — so subsequent renders with the same text
    // reuse it without another roundtrip. `null` until the first
    // response arrives (or when the request errored — caller falls
    // back to the client-side regex parser via `dpqlSlateConverter`).
    const [serverParsedNodes, setServerParsedNodes] = useState<ISlateElement[] | null>(null);
    const [serverParsedFor, setServerParsedFor] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    // Tracks the most recent in-flight request so a slow response
    // can't overwrite a newer one (the user typed faster than the
    // server replied).
    const parseRequestIdRef = useRef(0);

    useEffect(() => {
      if (!useServerParse) {
        // Clear any cached server-parsed nodes when the prop is
        // toggled off — next render uses the client-side converter.
        setServerParsedNodes(null);
        setServerParsedFor(null);
        setIsParsing(false);
        return;
      }
      const client = dpql.session.client;
      if (!client || !dpql.session.isReady) return;
      // Empty value — short-circuit to the empty document so the user
      // doesn't see a spinner for a no-op parse.
      if (!value) {
        setServerParsedNodes([{ type: 'paragraph', children: [{ text: '' }] }]);
        setServerParsedFor('');
        setIsParsing(false);
        return;
      }
      // Already parsed this exact text — no need to re-request.
      if (serverParsedFor === value && serverParsedNodes) {
        return;
      }
      const reqId = ++parseRequestIdRef.current;
      setIsParsing(true);
      client
        .customRequest<unknown>('dpql/toRichtext', { text: value })
        .then((response) => {
          if (reqId !== parseRequestIdRef.current) return;
          const nodes = richtextResponseToSlate(response);
          if (nodes) {
            setServerParsedNodes(nodes);
            setServerParsedFor(value);
          } else {
            // Bad shape — fall back to client-side parsing by leaving
            // the cache empty for this value. The custom converter
            // below detects the miss and uses `plainTextToSlate`.
            setServerParsedNodes(null);
            setServerParsedFor(null);
          }
        })
        .catch(() => {
          // Network / server error — same fallback as bad-shape.
          if (reqId !== parseRequestIdRef.current) return;
          setServerParsedNodes(null);
          setServerParsedFor(null);
        })
        .finally(() => {
          if (reqId === parseRequestIdRef.current) {
            setIsParsing(false);
          }
        });
    }, [
      useServerParse,
      value,
      dpql.session.client,
      dpql.session.isReady,
      serverParsedFor,
      serverParsedNodes,
    ]);

    // When server-parse is active, override `toSlateNodes` so SmartEditor
    // gets the server's tree for the matching value, falling through to
    // the client regex parser for anything else (initial empty string,
    // mid-edit echoes, error fallbacks). Other converter methods are
    // delegated to the base — slate→plain text and offset math are pure
    // and don't need server input.
    const converter = useMemo<ISlateConverter>(() => {
      if (!useServerParse) return dpqlSlateConverter;
      return {
        ...dpqlSlateConverter,
        toSlateNodes: (text: string) => {
          if (text === serverParsedFor && serverParsedNodes) {
            return serverParsedNodes;
          }
          return dpqlSlateConverter.toSlateNodes(text);
        },
      };
    }, [useServerParse, serverParsedFor, serverParsedNodes]);

    // no language server to talk to: said once, for the host to show what works without one
    const unavailable = dpql.session.isUnavailable;
    useEffect(() => {
      if (unavailable) onUnavailable?.();
    }, [unavailable]);
    // the language server can now parse and write the text: said once, as the session says it
    const ready = dpql.session.isReady && dpql.session.isContextReady;
    useEffect(() => {
      if (ready) onReady?.();
    }, [ready]);

    /* What the field can refer to (qorus#646, David's decisions): its templates as their catalogue nests them, and
       the record's fields as a group of their own - one tree, browsed in the template picker (a click in the empty
       text, the template button, a chip, a group's row) and reached by what is typed (`dpqlCompletionsWith`). */
    const templateRoots = useMemo(
      // an expression takes a record whole: a state's data or a record is offered whole as well as opened
      () => templateTree(templates, { fields: dpql.fieldMeta, wholeRecords: true }),
      [templates, dpql.fieldMeta]
    );
    /* A reference that names none of the field's templates says so where it is written, and stays the text it
       was typed as (qorus#646, David's review: a half-typed reference was taken as it was). */
    const namesNothing = useCallback(
      (reference: string) => referenceNamesNothing(templateRoots, reference),
      [templateRoots]
    );
    const presentDiagnostics = useCallback(
      (diagnostics: ILspDiagnostic[], plainText: string): ILspDiagnostic[] => [
        ...presentDpqlDiagnostics(diagnostics, plainText),
        ...dpqlReferencesIn(plainText)
          .filter(({ value }) => namesNothing(value))
          .map(({ line, start, end, value }) => ({
            range: { start: { line, character: start }, end: { line, character: end } },
            severity: 1 as const,
            source: 'templates',
            message: referenceNamesNothingMessage(value),
          })),
      ],
      [namesNothing]
    );
    // a template's type named in its row by the catalogue the surrounding form has, never its code
    const typeLabel = useTypeLabel();
    const completionsWith = useMemo(
      () => dpqlCompletionsWith(templateRoots, typeLabel),
      [templateRoots, typeLabel]
    );

    const descriptions = useDescriptionTooltips();
    // a chip's hover says its type in the server's words for it
    const typeSentenceForm = useTypeSentenceForm();
    const tagRenderer = useMemo(
      () =>
        makeDpqlTagRenderer(dpql.fieldMeta, {
          templateTagsUseIntent,
          templates,
          descriptions,
          typeSentenceForm,
        }),
      [dpql.fieldMeta, templateTagsUseIntent, templates, descriptions, typeSentenceForm]
    );

    useImperativeHandle(
      ref,
      (): IDpqlEditorRef => ({
        format: async () => {
          const formatted = await dpql.session.format();
          if (formatted !== null && formatted !== value) {
            onChange(formatted);
          }
        },
        validate: dpql.validate,
        parse: dpql.parse,
        serialize: dpql.serialize,
      }),
      [dpql, value, onChange]
    );

    // Shift+Alt+F: the text as the language server formats it
    const formatDocument = useCallback(() => {
      dpql.session
        .format()
        .then((formatted) => {
          if (formatted !== null && formatted !== value) {
            onChange(formatted);
          }
        })
        .catch(() => {
          // the server could not format it: the text stays as it is
        });
    }, [dpql.session, value, onChange]);

    // the button beside the text that opens the picker for a pick at the caret, where a value can be written there
    const templateButton = useMemo(
      () =>
        browseTemplates && !readOnly && templates?.items?.length ?
          { insertableAt: dpqlExpectsValue, notInsertable: NO_VALUE_AT_THE_END }
        : undefined,
      [browseTemplates, readOnly, templates]
    );

    const editor = (
      <SmartEditor
        session={dpql.session}
        value={value}
        onChange={onChange}
        tagRenderer={tagRenderer}
        triggerCharacters={DPQL_TRIGGERS}
        converter={converter}
        completionInserter={dpqlCompletionInserter}
        height={height}
        size={size}
        readOnly={readOnly}
        showDiagnostics={showDiagnostics}
        enableHover={enableHover}
        onBlur={onBlur}
        templateRoots={readOnly ? undefined : templateRoots}
        // DPQL's brackets and strings, as a code editor closes, wraps and matches them
        editingLanguage={DPQL_EDITING_LANGUAGE}
        formatDocument={formatDocument}
        wordWrap={wordWrap}
        maxHeight={maxHeight}
        lineNumbers={lineNumbers}
        templateButton={templateButton}
        completeOnClick={completeOnClick}
        completionsWith={completionsWith}
        // "No record fields here" is the server's to say: with none, there may be a record it would know
        emptyCompletionMessage={dpql.session.isUnavailable ? undefined : dpqlEmptyCompletionMessage}
        presentDiagnostics={presentDiagnostics}
        referenceNamesNothing={namesNothing}
        isLoading={isParsing}
        loadingIndicator={loadingIndicator}
      />
    );

    return editor;
  }
);

DpqlEditor.displayName = 'DpqlEditor';
