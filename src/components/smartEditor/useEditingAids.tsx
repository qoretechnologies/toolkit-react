// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreButton, ReqoreControlGroup, ReqoreInput, ReqoreTag } from '@qoretechnologies/reqore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, Element, NodeEntry, Range, Text, Transforms } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import {
  autoClosingPairFor,
  closesBefore,
  findMatches,
  IEditingLanguage,
  inString,
  maskChips,
  matchingBracket,
  pointAt,
  spansInLeaf,
  textSegments,
} from './editingAids';
import { ISlateConverter, ISlateElement } from './types';

type TEditor = Editor & ReactEditor & HistoryEditor;

/** The marks the aids paint, for the editor's leaves to style. */
export interface IEditingAidMarks {
  bracketMatch?: true;
  findMatch?: true;
  findCurrent?: true;
}

export interface IUseEditingAidsOptions {
  editorRef: React.RefObject<unknown>;
  converter: ISlateConverter;
  /** The editor's document as last drawn. */
  nodes: ISlateElement[];
  /** How the language writes its brackets and strings; no pairs closed or matched without it. */
  language?: IEditingLanguage;
  readOnly?: boolean;
  /** Shift+Alt+F: the document formatted, as the language server formats it. */
  onFormat?: () => void;
  /** Ctrl+Space with no list open: what can be written at the caret, listed. */
  onComplete?: () => void;
}

const modKey = (event: React.KeyboardEvent) => event.metaKey || event.ctrlKey;

/** The editors whose `insertText` and `deleteBackward` close, step over and take back pairs (`useEditingAids`). */
const PAIRED_EDITORS = new WeakSet<object>();

/**
 * The editing aids of a code editor (`editingAids`), for a Slate editor: the keys - pairs closed, a selection
 * wrapped, a closing bracket stepped over, an empty pair taken back whole, a line's indent kept on Enter, a line
 * moved (Alt+↑/↓) or copied (Shift+Alt+↑/↓), the document formatted (Shift+Alt+F), completion asked for
 * (Ctrl+Space), the search opened (Ctrl+F, Cmd+F) with its replace (Ctrl+H, Cmd+Alt+F) - and the marks: the
 * bracket matching the one at the caret, and every match of the search.
 */
export const useEditingAids = ({
  editorRef,
  converter,
  nodes,
  language,
  readOnly,
  onFormat,
  onComplete,
}: IUseEditingAidsOptions) => {
  const editorOf = () => editorRef.current as TEditor | null;

  /* A key whose pair is closed, stepped over or taken back whole is not done in its keydown: it is marked here and
     done as the editor makes the edit the key asks for (its `insertText`, its `deleteBackward`), at the caret the
     editor has then. An edit made in the keydown came before the editor read where the page's caret was: a click's
     caret still to be read was read at the next key, after the pair, and put the caret back before the quotes, so
     `"a" + 1` came out `a" + 1""` (qorus#646, PullRequestTests). */
  const pendingKeyRef = useRef<string | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;
  const converterRef = useRef(converter);
  converterRef.current = converter;
  useEffect(() => {
    const editor = editorOf();
    if (!editor || PAIRED_EDITORS.has(editor)) return;
    PAIRED_EDITORS.add(editor);
    const { insertText, deleteBackward } = editor;
    // the text and the caret as the editor holds them now, chips masked
    const live = () => {
      const at = editor.selection;
      if (!at || !Range.isCollapsed(at)) return null;
      const nodes = editor.children as unknown as ISlateElement[];
      const conv = converterRef.current;
      try {
        const masked = maskChips(conv.fromSlateNodes(nodes), textSegments(nodes, conv));
        const offset = conv.selectionToOffset(nodes, at.anchor.path as number[], at.anchor.offset);
        return { masked, offset, next: masked[offset] ?? '', before: masked[offset - 1] ?? '' };
      } catch {
        // a selection the editor no longer has
        return null;
      }
    };
    editor.insertText = (text, options) => {
      const key = pendingKeyRef.current;
      pendingKeyRef.current = null;
      const lang = languageRef.current;
      const at = key === text && lang && !options?.at ? live() : null;
      if (lang && at) {
        const { opens, closes } = autoClosingPairFor(lang, text);
        const isQuote = !!opens && opens.open === opens.close;
        /* A closing bracket typed before the same one steps over it; a quote does, where it closes the string the
           caret is in. */
        if (closes && at.next === text && (!isQuote || inString(at.masked, at.offset, lang.quotes))) {
          Transforms.move(editor, { distance: 1, unit: 'character' });
          return;
        }
        /* a pair opened is closed, where it is opened before nothing, a space or what closes - and a quote typed
           after a word is an apostrophe */
        if (
          opens &&
          closesBefore(lang, at.next) &&
          !(opens.notInString && inString(at.masked, at.offset, lang.quotes)) &&
          !(isQuote && /[\p{L}\p{N}_]/u.test(at.before))
        ) {
          insertText(opens.open + opens.close, options);
          Transforms.move(editor, { distance: 1, unit: 'character', reverse: true });
          return;
        }
      }
      insertText(text, options);
    };
    editor.deleteBackward = (unit) => {
      const key = pendingKeyRef.current;
      pendingKeyRef.current = null;
      const lang = languageRef.current;
      const at = key === 'Backspace' && unit === 'character' && lang ? live() : null;
      // Backspace between an empty pair takes both
      if (
        lang &&
        at &&
        lang.autoClosingPairs.some((pair) => pair.open === at.before && pair.close === at.next)
      ) {
        Transforms.delete(editor, { distance: 1, unit: 'character' });
      }
      deleteBackward(unit);
    };
  });
  // the caret the bracket match is drawn for: the selection, as the editor last reported it
  const [caret, setCaret] = useState<number | null>(null);
  const [find, setFind] = useState<{
    open: boolean;
    replace: boolean;
    query: string;
    replacement: string;
    caseSensitive: boolean;
    current: number;
  }>({
    open: false,
    replace: false,
    query: '',
    replacement: '',
    caseSensitive: false,
    current: 0,
  });
  // the search, drawn: its box is selected when it opens
  const findBarRef = useRef<HTMLDivElement | null>(null);

  const segments = useMemo(() => textSegments(nodes, converter), [nodes, converter]);
  const masked = useMemo(
    () => maskChips(converter.fromSlateNodes(nodes), segments),
    [nodes, converter, segments]
  );

  /** The editor's caret, as a plain-text offset; null for none or a selection. */
  const caretOffset = useCallback((): number | null => {
    const editor = editorOf();
    const at = editor?.selection;
    if (!at || !Range.isCollapsed(at)) return null;
    try {
      return converter.selectionToOffset(
        editor.children as unknown as ISlateElement[],
        at.anchor.path as number[],
        at.anchor.offset
      );
    } catch {
      // a selection the editor no longer has
      return null;
    }
  }, [converter]);

  /** Told of each change of the editor, its selection's included: the bracket match follows the caret. */
  const onEditorChange = useCallback(() => {
    setCaret(caretOffset());
  }, [caretOffset]);

  const bracketPair = useMemo(
    () => (language && caret !== null ? matchingBracket(masked, caret, language) : undefined),
    [language, caret, masked]
  );

  const matches = useMemo(
    () => (find.open ? findMatches(masked, find.query, { caseSensitive: find.caseSensitive }) : []),
    [find.open, find.query, find.caseSensitive, masked]
  );
  const current = matches.length ? Math.min(find.current, matches.length - 1) : -1;

  const decorate = useCallback(
    (entry: NodeEntry) => {
      const [node, path] = entry;
      if (!Text.isText(node)) return [];
      const ranges: Range[] = [];
      if (bracketPair) {
        for (const [start, end] of spansInLeaf(segments, path, [
          [bracketPair[0], bracketPair[0] + 1],
          [bracketPair[1], bracketPair[1] + 1],
        ])) {
          ranges.push({
            anchor: { path, offset: start },
            focus: { path, offset: end },
            bracketMatch: true,
          } as Range);
        }
      }
      if (matches.length) {
        matches.forEach((span, index) => {
          for (const [start, end] of spansInLeaf(segments, path, [span])) {
            ranges.push({
              anchor: { path, offset: start },
              focus: { path, offset: end },
              findMatch: true,
              ...(index === current ? { findCurrent: true } : {}),
            } as Range);
          }
        });
      }
      return ranges;
    },
    [bracketPair, matches, current, segments]
  );

  /** The match `index` selected in the editor, as a search moves to it. */
  const selectMatch = useCallback(
    (index: number) => {
      const editor = editorOf();
      const span = matches[index];
      if (!editor || !span) return;
      const anchor = pointAt(segments, span[0]);
      const focus = pointAt(segments, span[1]);
      if (anchor && focus) {
        try {
          Transforms.select(editor, { anchor, focus });
        } catch {
          // a point the editor no longer has: the search marks it all the same
        }
      }
    },
    [matches, segments]
  );

  const step = useCallback(
    (by: number) => {
      if (!matches.length) return;
      const next = (current + by + matches.length) % matches.length;
      setFind((state) => ({ ...state, current: next }));
      selectMatch(next);
    },
    [matches.length, current, selectMatch]
  );

  const replaceSpans = useCallback(
    (spans: Array<[number, number]>) => {
      const editor = editorOf();
      if (!editor || readOnly) return;
      // from the last to the first: a replacement does not move the spans before it
      Editor.withoutNormalizing(editor, () => {
        for (const [start, end] of [...spans].sort((a, b) => b[0] - a[0])) {
          const anchor = pointAt(segments, start);
          const focus = pointAt(segments, end);
          if (anchor && focus && anchor.path.join() === focus.path.join()) {
            Transforms.insertText(editor, find.replacement, { at: { anchor, focus } });
          }
        }
      });
    },
    [segments, find.replacement, readOnly]
  );

  const openFind = useCallback((replace: boolean) => {
    const editor = editorOf();
    let query: string | undefined;
    if (editor?.selection && !Range.isCollapsed(editor.selection)) {
      try {
        const selected = Editor.string(editor, editor.selection);
        if (selected && !selected.includes('\n')) query = selected;
      } catch {
        // nothing selected the search can start with
      }
    }
    setFind((state) => ({
      ...state,
      open: true,
      replace,
      query: query ?? state.query,
      current: 0,
    }));
    setTimeout(
      () =>
        findBarRef.current
          ?.querySelector<HTMLInputElement>('.smart-editor-find-input input, input')
          ?.select(),
      0
    );
  }, []);

  const closeFind = useCallback(() => {
    setFind((state) => ({ ...state, open: false }));
    try {
      const editor = editorOf();
      if (editor) ReactEditor.focus(editor);
    } catch {
      // the editor is not in the document
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent): boolean => {
      const editor = editorOf();
      if (!editor) return false;
      // a key marked before and never inserted (an input method took it) is no longer this key's
      pendingKeyRef.current = null;
      const take = () => {
        event.preventDefault();
        event.stopPropagation();
        return true;
      };
      // the search, opened over the text: Ctrl+F, Cmd+F; its replace: Ctrl+H, Cmd+Alt+F
      if (modKey(event) && !event.shiftKey && event.key.toLowerCase() === 'f') {
        openFind(event.altKey);
        return take();
      }
      if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'h') {
        openFind(true);
        return take();
      }
      if (event.ctrlKey && event.key === ' ' && !event.metaKey && !event.altKey) {
        if (!onComplete) return false;
        onComplete();
        return take();
      }
      if (readOnly) return false;
      if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'f' && onFormat) {
        onFormat();
        return take();
      }
      const at = editor.selection;
      if (!at) return false;
      // a line moved up or down (Alt+↑/↓), or copied there (Shift+Alt+↑/↓)
      if (
        event.altKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
        !modKey(event)
      ) {
        const line = at.anchor.path[0];
        const target = event.key === 'ArrowUp' ? line - 1 : line + 1;
        if (event.shiftKey) {
          const copy = JSON.parse(JSON.stringify(editor.children[line]));
          Transforms.insertNodes(editor, copy, { at: [event.key === 'ArrowUp' ? line : line + 1] });
          return take();
        }
        if (target < 0 || target >= editor.children.length) return take();
        Transforms.moveNodes(editor, { at: [line], to: [target] });
        return take();
      }
      if (!language) return false;
      const collapsed = Range.isCollapsed(at);
      // Enter keeps the line's indent
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !modKey(event) &&
        !event.altKey &&
        collapsed
      ) {
        const [lineNode] = Editor.node(editor, [at.anchor.path[0]]);
        const first = (Element.isElement(lineNode) ? lineNode.children[0] : undefined) as
          { text?: string } | undefined;
        const indent = /^[ \t]*/.exec(first?.text ?? '')?.[0] ?? '';
        if (!indent) return false;
        Editor.insertBreak(editor);
        Transforms.insertText(editor, indent);
        return take();
      }
      // Backspace between an empty pair takes both: done as the editor deletes (`deleteBackward` above)
      if (event.key === 'Backspace' && collapsed) {
        pendingKeyRef.current = 'Backspace';
        return false;
      }
      if (event.key.length !== 1 || modKey(event) || event.altKey) return false;
      const { opens, closes } = autoClosingPairFor(language, event.key);
      // a selection typed over with a bracket or a quote is wrapped in it
      if (!collapsed && opens) {
        const [start, end] = Range.edges(at);
        Editor.withoutNormalizing(editor, () => {
          Transforms.insertText(editor, opens.close, { at: end });
          Transforms.insertText(editor, opens.open, { at: start });
        });
        const startAfter = { path: start.path, offset: start.offset + opens.open.length };
        const endAfter =
          start.path.join() === end.path.join() ?
            { path: end.path, offset: end.offset + opens.open.length }
          : end;
        Transforms.select(editor, { anchor: startAfter, focus: endAfter });
        return take();
      }
      /* a bracket or a quote typed at the caret: closed or stepped over as the editor inserts it (`insertText`
         above), at the caret the editor has then */
      if (collapsed && (opens || closes)) {
        pendingKeyRef.current = event.key;
      }
      return false;
    },
    [language, readOnly, onFormat, onComplete, openFind]
  );

  // a search open on a text that changes keeps its place among the matches
  useEffect(() => {
    if (find.current >= matches.length && matches.length) {
      setFind((state) => ({ ...state, current: matches.length - 1 }));
    }
  }, [matches.length, find.current]);

  const findBar =
    find.open ?
      <div ref={findBarRef} className='smart-editor-find-bar'>
        <ReqoreControlGroup
          className='smart-editor-find'
          size='small'
          fluid
          wrap
          role='search'
          aria-label='Find in the text'
          onKeyDown={(event: React.KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeFind();
            }
          }}
        >
          <ReqoreInput
            className='smart-editor-find-input'
            icon='SearchLine'
            placeholder='Find'
            aria-label='Find'
            value={find.query}
            focusRules={{ type: 'auto' }}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setFind((state) => ({ ...state, query: event.target.value, current: 0 }))
            }
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }
            }}
            fluid
            minimal
          />
          <ReqoreTag
            className='smart-editor-find-count'
            size='small'
            minimal
            label={
              !find.query ? 'No search'
              : matches.length ?
                `${current + 1} of ${matches.length}`
              : 'No results'
            }
          />
          <ReqoreButton
            className='smart-editor-find-case'
            fixed
            compact
            minimal
            active={find.caseSensitive}
            aria-pressed={find.caseSensitive}
            aria-label='Match case'
            tooltip='Match case'
            onClick={() =>
              setFind((state) => ({ ...state, caseSensitive: !state.caseSensitive, current: 0 }))
            }
          >
            Aa
          </ReqoreButton>
          <ReqoreButton
            className='smart-editor-find-previous'
            fixed
            compact
            minimal
            icon='ArrowUpSLine'
            aria-label='Previous match'
            tooltip='Previous match (Shift+Enter)'
            disabled={!matches.length}
            onClick={() => step(-1)}
          />
          <ReqoreButton
            className='smart-editor-find-next'
            fixed
            compact
            minimal
            icon='ArrowDownSLine'
            aria-label='Next match'
            tooltip='Next match (Enter)'
            disabled={!matches.length}
            onClick={() => step(1)}
          />
          {!readOnly ?
            <ReqoreButton
              className='smart-editor-find-toggle-replace'
              fixed
              compact
              minimal
              icon={find.replace ? 'ArrowUpSLine' : 'ArrowDownSLine'}
              aria-label={find.replace ? 'Hide replace' : 'Replace'}
              tooltip={find.replace ? 'Hide replace' : 'Replace'}
              onClick={() => setFind((state) => ({ ...state, replace: !state.replace }))}
            />
          : null}
          <ReqoreButton
            className='smart-editor-find-close'
            fixed
            compact
            minimal
            icon='CloseLine'
            aria-label='Close the search'
            tooltip='Close (Escape)'
            onClick={closeFind}
          />
          {find.replace && !readOnly ?
            <ReqoreControlGroup fluid size='small' wrap className='smart-editor-replace'>
              <ReqoreInput
                className='smart-editor-replace-input'
                icon='EditLine'
                placeholder='Replace with'
                aria-label='Replace with'
                value={find.replacement}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setFind((state) => ({ ...state, replacement: event.target.value }))
                }
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === 'Enter' && current >= 0) {
                    event.preventDefault();
                    replaceSpans([matches[current]]);
                  }
                }}
                fluid
                minimal
              />
              <ReqoreButton
                className='smart-editor-replace-one'
                fixed
                compact
                disabled={current < 0}
                onClick={() => replaceSpans([matches[current]])}
              >
                Replace
              </ReqoreButton>
              <ReqoreButton
                className='smart-editor-replace-all'
                fixed
                compact
                disabled={!matches.length}
                onClick={() => replaceSpans(matches)}
              >
                Replace all
              </ReqoreButton>
            </ReqoreControlGroup>
          : null}
        </ReqoreControlGroup>
      </div>
    : null;

  return { decorate, onKeyDown, onEditorChange, findBar, findOpen: find.open };
};
