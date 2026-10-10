// Copyright 2026 Qore Technologies, s.r.o.
// The shell `TemplateField` renders when a field is in expression mode.
// Owns the `IExpression` value and offers two views of the same AST —
// Visual (the builder, Phase 3) and Text (DPQL, this phase). The DPQL text
// editor bridges to the AST via the LSP `dpql/parse` (text → AST on edit)
// and `dpql/serialize` (AST → text on entering Text mode); a debounced
// "Preview" box renders the current AST (`dpql/renderExpression`) when that
// rendering differs from the text the author typed.
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreMessage,
  ReqoreVerticalSpacer,
} from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { memo, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DpqlEditor, IDpqlEditorRef } from '../../dpqlEditor';
import { TemplateBrowser } from '../fields/template/TemplateBrowser';
import { dpqlDisplayedText } from '../../dpqlEditor/dpqlHelpers';
import { TDpqlFields } from '../../dpqlEditor/types';
import { ExpressionBuilder, IExpressionBuilderProps } from './builder';
import { DpqlRendering } from './DpqlRendering';
import { IExpression, IExpressionSchema, IExpressionValue, TExpressionReorder } from './types';
import { incompleteExpressionText, serializableExpression } from './textOfExpression';
import { useExpressions } from './useExpressions';
import { useRenderExpression } from './useRenderExpression';
import { isUntypedOptionType } from '../../../helpers/optionUiTypes';

export type TExpressionMode = 'visual' | 'text';

const PARSE_DEBOUNCE_MS = 300;
/**
 * How long the Preview waits before catching up with the editor.
 *
 * It mirrors the AST, so without this it re-renders on every keystroke — a box
 * appearing, changing and vanishing under the line being typed. Slightly
 * SLOWER than the parse it follows, so the preview settles once after the text
 * has stopped moving rather than twitching on the way there.
 */
const PREVIEW_DEBOUNCE_MS = 400;

export interface IExpressionFieldProps {
  /** The expression value: `{ is_expression:true, value:{ exp, args } }`. */
  value?: IExpression;
  /**
   * `remove` is the builder's exit signal (last expression deleted) — hosts
   * like `TemplateField` use it to leave expression mode.
   */
  onChange: (value: IExpression, remove?: boolean) => void;
  /** The field's declared type — the expression's expected return type. */
  type?: string;
  returnType?: string | string[];
  readOnly?: boolean;
  /** Catalogue override (stories / tests); otherwise fetched from the server. */
  expressions?: IExpressionSchema[];
  /** A data provider's per-action expressions endpoint (extra expressions). */
  expressionsUrl?: string;
  /** Templates for the builder's operand fields (Visual mode). */
  localTemplates?: IReqoreFormTemplates;
  /** Forwarded to the builder — server-handled expression evaluation. */
  serverHandled?: boolean;
  /**
   * SEAM (reqraft): the builder's `extraActions` slot, forwarded. Hosts mount
   * this shell, not the builder, so a seam that stops at the builder is
   * unreachable from the component they actually use — which is how the
   * IDE's AI-assist button vanished the moment it adopted the shell. Same
   * contract as `IExpressionBuilderProps['extraActions']`: a panel-action
   * array, or a factory that receives each card's `selectedExpression` and
   * `value`.
   */
  extraActions?: IExpressionBuilderProps['extraActions'];
  /** Optional data-provider context for DPQL `@field` completions in Text mode. */
  provider?: string;
  recordType?: string;
  /**
   * The record's fields for the Text view, for a record no provider has: every field the expression may
   * use is offered there, as in the Visual view (see `IDpqlEditorProps.fields`).
   */
  fields?: TDpqlFields;
  /** Initial editor mode (default `text`: an expression opens as it is written, Visual beside it). */
  defaultMode?: TExpressionMode;
  /**
   * The Text view's text when the value is not an expression yet: a template or a literal the field held
   * when "Use Template / Expression" opened it. Nothing is emitted until it is edited.
   */
  initialText?: string;
  /**
   * The field holds a plain value the text stands for - a template or a literal written in the Text view
   * (stored as itself, not as an expression). The expression is then gone from `value` but the field is not
   * cleared, so the text being written stays.
   */
  heldAsValue?: boolean;
  /**
   * The view a host's own tabs ask for (Value · Expression · Visual, qorus#646). Followed as the field's own
   * Visual / Text toggle is: leaving the Text view parses what is written first, so nothing is lost.
   */
  requestedMode?: TExpressionMode;
  /** The host draws the views as tabs of its own: the field's Visual / Text toggle is not drawn. */
  hideModeToggle?: boolean;
  /** No language server: the Text view cannot work, and the field shows the Visual view instead. */
  onTextUnavailable?: () => void;
  /**
   * The view the field is on, each time it changes: for a host that mounts the field again (an expression
   * removed and put back empty) to open it where the author was, through `defaultMode`.
   */
  onModeChange?: (mode: TExpressionMode) => void;
  /**
   * Set to a function that reads the text typed and not yet read - its parse still waiting - and gives the
   * expression it is, or nothing. A host leaving the Text view calls it first, so what was just typed is not
   * lost with the editor (qorus#646).
   */
  flushRef?: MutableRefObject<(() => Promise<IExpression | undefined>) | null>;
  /**
   * SEAM (reqraft): the host's per-`ui_type` editors, forwarded to the
   * builder's operand fields. Without them an operand typed with one of the
   * CONSUMER's ui_types renders "Unknown type!".
   */
  componentOverrides?: Record<string, React.FC<any>>;
  size?: string;
  /** Forwarded to the builder — operand reordering for varargs expressions. */
  reorder?: TExpressionReorder;
}

export const ExpressionField = memo(
  ({
    value,
    onChange,
    type,
    returnType,
    readOnly,
    expressions: expressionsOverride,
    expressionsUrl,
    localTemplates,
    serverHandled,
    extraActions,
    provider,
    fields,
    recordType,
    defaultMode = 'text',
    initialText,
    heldAsValue,
    requestedMode,
    hideModeToggle,
    onTextUnavailable,
    onModeChange,
    flushRef,
    size,
    componentOverrides,
    reorder,
  }: IExpressionFieldProps) => {
    const { expressions } = useExpressions({
      override: expressionsOverride,
      expressionsUrl,
    });
    const { renderRich } = useRenderExpression();

    const [mode, setMode] = useState<TExpressionMode>(defaultMode);
    const onModeChangeRef = useRef(onModeChange);
    onModeChangeRef.current = onModeChange;
    useEffect(() => {
      onModeChangeRef.current?.(mode);
    }, [mode]);
    /* The server's rendering of the current AST; empty until it has one. There is
       no client-side stand-in — see `useRenderExpression`. */
    const [preview, setPreview] = useState('');

    // Text mode state. `text` is the DPQL string the editor shows; the AST
    // (`value`) stays the source of truth, kept in sync via parse-on-edit.
    const [text, setText] = useState(initialText ?? '');
    /** The text the editor was given, for its echo of that text to be told from typing. */
    const textRef = useRef(text);
    textRef.current = text;
    /* No language server to parse or write the text: the Text view cannot work, so the field shows the
       Visual view, which needs none, and says why (qorus#646). */
    const [textUnavailable, setTextUnavailable] = useState(false);
    /* Why the server would not write this value as text, or null. The field is then built in Visual: an empty
       Text view would be one the author types over, replacing the value (qorus#646). */
    const [textRefused, setTextRefused] = useState<string | null>(null);
    // read when a refusal lands, so a host's new callback on each render does not restart the seed
    const onTextUnavailableRef = useRef(onTextUnavailable);
    onTextUnavailableRef.current = onTextUnavailable;
    /* Whether the Text view's language server can parse and write its text - the session's own signal
       (`onReady`), never a guess by time. Typed text waits for it; it is not asked of a session that is not
       up, whose answer is "nothing parsed" (qorus#646: under load, text typed before the session was up
       never reached the value). Each visit to the Text view opens a session of its own. */
    const [sessionReady, setSessionReady] = useState(false);
    const sessionReadyRef = useRef(false);
    /** Who waits for the session: told true when it is ready, false when it cannot be reached or goes. */
    const sessionWaiters = useRef<Array<(ready: boolean) => void>>([]);
    const settleSessionWaiters = useCallback((ready: boolean) => {
      const waiters = sessionWaiters.current;
      sessionWaiters.current = [];
      waiters.forEach((resolve) => resolve(ready));
    }, []);
    const whenSessionReady = useCallback(
      (): Promise<boolean> =>
        sessionReadyRef.current ?
          Promise.resolve(true)
        : new Promise<boolean>((resolve) => sessionWaiters.current.push(resolve)),
      []
    );
    const handleTextReady = useCallback(() => {
      sessionReadyRef.current = true;
      setSessionReady(true);
      settleSessionWaiters(true);
    }, [settleSessionWaiters]);
    useEffect(() => {
      if (mode === 'text') return;
      sessionReadyRef.current = false;
      setSessionReady(false);
      settleSessionWaiters(false);
    }, [mode, settleSessionWaiters]);
    useEffect(() => () => settleSessionWaiters(false), [settleSessionWaiters]);
    const handleTextUnavailable = useCallback(() => {
      setTextUnavailable(true);
      settleSessionWaiters(false);
      onTextUnavailable?.();
      // text typed and not read stays as typed, in the Text view, with the reason under it: nothing is lost
      if (pendingParse.current !== null) return;
      setMode('visual');
    }, [onTextUnavailable, settleSessionWaiters]);
    /* The text the current AST was parsed FROM.
     *
     * The preview renders the AST, and the AST only moves on a SUCCESSFUL
     * parse — so while an edit is mid-flight or simply invalid, the AST still
     * describes the last thing that parsed. Showing it then states something
     * the editor does not contain: deleting the `2` from `1 + 2` left
     * "Unexpected end of input" sitting directly above a Preview confidently
     * reading `1 + 2`. */
    const [astText, setAstText] = useState('');
    /**
     * The server's answer to "can this expression's result satisfy the type
     * this field declares?". `null` when nothing has been asked, or when the
     * field declares no type worth asking about.
     */
    const [typeCheck, setTypeCheck] = useState<{
      compatible: boolean;
      mayFail: boolean;
      inferred?: string;
      target?: string;
      fix?: string;
    } | null>(null);
    const dpqlRef = useRef<IDpqlEditorRef>(null);
    const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** The text typed whose parse is still waiting on the debounce, or null. */
    const pendingParse = useRef<string | null>(null);

    const ast = useMemo<IExpressionValue | undefined>(() => value?.value, [value]);

    /**
     * The type the expression's result has to satisfy, sent with every parse.
     *
     * `auto` and `any` are left out deliberately: they accept anything, so the
     * server would answer "compatible" for everything and the round trip would
     * buy nothing. A field offering a CHOICE of return types has no single
     * answer either, so it asks nothing rather than asking about the wrong one.
     */
    const targetType = useMemo<string | undefined>(() => {
      const declared = Array.isArray(returnType) ? undefined : (returnType ?? type);
      return declared && !isUntypedOptionType(declared) ? declared : undefined;
    }, [returnType, type]);

    /**
     * Read the type analysis off a parse result, or clear it.
     *
     * "Fits" is read from the whole answer, not `type_compatible` alone. A
     * conversion that exists and cannot fail — a number used as text — is a
     * fit as far as the author is concerned, and reporting it is exactly the
     * noise the message below is written to avoid.
     */
    const readTypeCheck = useCallback(
      (result?: {
        type_compatible?: boolean;
        auto_coercible?: boolean;
        coercion_may_fail?: boolean;
        inferred_type?: string;
        target_type?: string;
        suggested_fix?: { text: string };
      }): void => {
        if (!result || result.type_compatible === undefined) {
          setTypeCheck(null);
          return;
        }
        const convertsSafely = !!result.auto_coercible && !result.coercion_may_fail;
        setTypeCheck({
          compatible: !!result.type_compatible || convertsSafely,
          mayFail: !!result.coercion_may_fail,
          inferred: result.inferred_type,
          target: result.target_type,
          fix: result.suggested_fix?.text,
        });
      },
      []
    );

    // Keep a readable rendering of the current expression in sync — the
    // single live mirror of the AST (the server's `dpql/renderExpression`).
    //
    // Debounced: it follows the AST, which follows the text, so rendering it
    // eagerly put a box under the cursor that appeared, changed and vanished
    // while the author was still typing.
    useEffect(() => {
      let live = true;
      const timer = setTimeout(() => {
        renderRich(ast ?? {}).then((r) => {
          if (live) setPreview(r?.text ?? '');
        });
      }, PREVIEW_DEBOUNCE_MS);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }, [renderRich, ast]);

    // Tracks whether the user has typed since entering Text mode, so a
    // slow seed response can't clobber their input.
    const userTypedRef = useRef(false);

    /* A cleared value must clear the editor with it.
     *
     * "Clear value" empties the option (`handleValueChange(name, undefined)`),
     * but the DPQL text is local state seeded once on entering Text mode, and
     * the seeding effect returns early for an empty AST — it exists to fill the
     * editor, not to empty it. So the value went and the text stayed: the row
     * reported "This field is required" while still showing `1 + 2`, which
     * reads as the clear having silently failed.
     *
     * Only an AST that HAD content and lost it clears the box. A field that
     * simply starts empty is left alone, so this cannot wipe what an author is
     * part-way through typing before their first parse lands.
     */
    const hadExpression = useRef(false);
    useEffect(() => {
      /* GONE, not merely incomplete.
       *
       * The first cut asked whether the AST still had an `exp`, and that is a
       * state the value passes THROUGH while the author types: a half-written
       * expression parses to something without one. So typing `1 + 2` cleared
       * the editor mid-keystroke and the text vanished under the cursor.
       *
       * A clear removes the value itself, so that is what to watch: `value`
       * empty, not an AST that is between shapes. Typing never produces that —
       * `handleDpqlChange` only emits on a SUCCESSFUL parse, so an incomplete
       * expression leaves the previous value in place. */
      if (ast) {
        hadExpression.current = true;
        return;
      }
      // a template or a literal written here is held as itself: the text stands for it, and stays
      if (heldAsValue) {
        hadExpression.current = false;
        return;
      }
      if (hadExpression.current) {
        hadExpression.current = false;
        userTypedRef.current = false;
        setText('');
      }
    }, [ast, heldAsValue]);

    /* Read the text typed and not yet read: once the session is ready, however long that takes, and the
       latest text typed by then. Gives the expression it is, or nothing. The debounce, the host leaving the
       Text view (its tabs) and the session coming up all read through here. */
    const flushPendingParse = useCallback(async (): Promise<IExpression | undefined> => {
      if (pendingParse.current === null) return undefined;
      if (!(await whenSessionReady())) return undefined;
      const pending = pendingParse.current;
      const parse = dpqlRef.current?.parse;
      if (pending === null || !parse) return undefined;
      if (parseTimer.current) clearTimeout(parseTimer.current);
      pendingParse.current = null;
      const result = await parse(pending, targetType);
      readTypeCheck(result);
      if (!result?.success || !result.expression) return undefined;
      setAstText(pending);
      // `dpql/parse` returns the field-ready `{ is_expression, value }`.
      onChange(result.expression as IExpression);
      return result.expression as IExpression;
    }, [onChange, targetType, readTypeCheck, whenSessionReady]);

    // Text mode: parse the DPQL into the AST, debounced, once the session can read it.
    const handleDpqlChange = useCallback(
      (next: string) => {
        /* The editor reports the text it was given back as a change (Slate's first operation after the
           value is set). That is not typing: counted as such it stopped the session from writing the
           expression into the view once it was ready. */
        if (next === textRef.current) return;
        userTypedRef.current = true;
        setText(next);
        if (parseTimer.current) clearTimeout(parseTimer.current);
        pendingParse.current = next;
        parseTimer.current = setTimeout(() => void flushPendingParse(), PARSE_DEBOUNCE_MS);
      },
      [flushPendingParse]
    );

    /** Whether this visit to Text mode has already put the AST in the editor. The host's own text for the
     *  first visit (`initialText`, such as the value written as `concat("SUP-", $record:{pos})`) is that visit's
     *  text: the session does not write over it once it is ready. */
    const seededRef = useRef(!!initialText);

    /* Seed the Text editor from the AST whenever Text mode becomes active
     * (including a `defaultMode='text'` mount). This must run as an effect: the
     * editor only mounts on the same render that flips the mode (so `dpqlRef`
     * is null inside the click handler), and `serialize` resolves '' until the
     * editor's LSP session is ready — hence the brief retry loop.
     *
     * It waits for an AST, because the AST can arrive AFTER the mode does. A
     * host flips this shell into Text mode on the very render that accepts an
     * expression, and the value it passes on that render is still the TEXT the
     * author typed — the parsed AST only comes back through the form one render
     * later. Keyed on the mode alone, the effect had already had its only turn
     * by then: it found nothing to serialize, returned, and nothing asked
     * again. The author landed in an empty editor with a Preview of their own
     * expression sitting beside it, which reads as the text having been thrown
     * away.
     *
     * Seeding happens at most ONCE per visit, and that is what makes watching
     * the AST safe: `userTypedRef` guards what is being typed, but the AST
     * MOVES as the author types — every successful parse replaces it — so an
     * effect that re-seeded on each new AST would fight them for the editor. */
    useEffect(() => {
      if (mode !== 'text') {
        // Leaving Text asks the question again on the next visit; the typing
        // flag goes with it, or a stale one would suppress that visit's seed.
        seededRef.current = false;
        userTypedRef.current = false;
        return undefined;
      }
      if (seededRef.current || userTypedRef.current) return undefined;
      if (!ast?.exp) return undefined;
      /* Only what DPQL can write is serialized. An operand whose operation is not
         chosen yet, or that is not filled in, has no text; handed to serialize as
         it was, it came back as the server's (or a stand-in's) rendering of a hash:
         `{args=(null)} > {type=int}`. The Text view shows the expression with a hole
         for each part not filled in instead - `… > …`, as the row's summary does -
         and serialize gets custom Text values as the strings or templates they are. */
      const seedAst = serializableExpression(ast);
      if (!seedAst) {
        const holes = incompleteExpressionText(ast, expressions);
        seededRef.current = true;
        setText(holes);
        setAstText(holes);
        return undefined;
      }
      // written by the session once it is ready, as the session says it - not asked of it before
      if (!sessionReady) return undefined;
      let cancelled = false;
      const seed = async (): Promise<void> => {
        let t: string | undefined;
        try {
          t = await dpqlRef.current?.serialize?.(seedAst);
        } catch (error) {
          if (cancelled || userTypedRef.current) return;
          setTextRefused(String((error as { message?: unknown })?.message ?? error));
          setMode('visual');
          // a host drawing the views as tabs follows: the Visual tab
          onTextUnavailableRef.current?.();
          return;
        }
        if (cancelled || userTypedRef.current) return;
        setTextRefused(null);
        if (t) {
          seededRef.current = true;
          setText(t);
          setAstText(t);
          /* The text shown is checked against the field's type, as typed text is. It was checked only when the
             editor reported it back as a change, which it does only while it has the focus: with the focus in
             the picker (opened at once, qorus#646) an expression that does not fit said nothing. */
          if (targetType) {
            const result = await dpqlRef.current?.parse?.(t, targetType);
            if (!cancelled && !userTypedRef.current) readTypeCheck(result);
          }
        }
      };
      void seed();
      return () => {
        cancelled = true;
      };
    }, [mode, ast, expressions, targetType, readTypeCheck, sessionReady]);

    /** The field's templates, its catalogue's entries, for the Text view's picker. */
    const templateItems = useMemo(
      () => (localTemplates?.items ?? []) as NonNullable<IReqoreFormTemplates['items']>,
      [localTemplates]
    );
    /* A template chosen from the picker goes in after the text, as a chip, and is parsed as typed text is:
       the editor keeps no caret the field can reach, so the end of the text is where it is put. */
    const insertTemplate = useCallback(
      (item: { value?: unknown }) => {
        if (typeof item?.value !== 'string' || !item.value) return;
        const current = text.trimEnd();
        handleDpqlChange(current ? `${current} ${item.value}` : item.value);
      },
      [text, handleDpqlChange]
    );

    // Switch to Text: the seeding effect above serializes the AST once
    // the editor's session is up.
    const enterTextMode = useCallback(() => {
      setMode('text');
    }, []);

    // Switch to Visual: flush any pending parse so the AST is current.
    const enterVisualMode = useCallback(async () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
      pendingParse.current = null;
      /* Only an edit is read back. The text is the value written by the session (or the host's own text for
         it), and reading it back unedited made a view switch change the value: a writer that cannot say all
         of it - Qore's DPQL serializer wrote `a + b` for a `+` of three arguments - dropped the third from the
         stored expression the moment it was looked at in Visual (qorus#646). */
      const edited = text !== astText && userTypedRef.current;
      // read by the session once it is ready; one that cannot be reached leaves the text unread, as asked
      if (mode === 'text' && text && edited && (await whenSessionReady())) {
        const result = await dpqlRef.current?.parse?.(text, targetType);
        readTypeCheck(result);
        if (result?.success && result.expression) {
          onChange(result.expression as IExpression);
        }
      }
      setMode('visual');
    }, [mode, text, astText, onChange, targetType, readTypeCheck, whenSessionReady]);

    // the host's tabs: followed as the toggle is (see `requestedMode`)
    useEffect(() => {
      if (!requestedMode || requestedMode === mode) return;
      if (requestedMode === 'visual') void enterVisualMode();
      else if (!textUnavailable) enterTextMode();
    }, [requestedMode]);

    useEffect(() => {
      if (!flushRef) return undefined;
      flushRef.current = flushPendingParse;
      return () => {
        if (flushRef.current === flushPendingParse) flushRef.current = null;
      };
    }, [flushRef, flushPendingParse]);

    useEffect(
      () => () => {
        if (parseTimer.current) clearTimeout(parseTimer.current);
      },
      []
    );

    /* What the Preview has to add: `none` until the server's rendering of the
       text now showing exists, `repeats` when it reads exactly as that text does
       (so it is not drawn — see below), `shown` otherwise. Exposed on the field,
       because a Preview correctly left out leaves nothing else to observe. */
    const previewState =
      !preview || astText.trim() !== text.trim() ? 'none'
      : dpqlDisplayedText(preview).trim() === dpqlDisplayedText(text).trim() ? 'repeats'
      : 'shown';

    return (
      <ReqoreControlGroup
        vertical
        fluid
        gapSize='small'
        className='expression-field'
        data-preview={mode === 'text' ? previewState : undefined}
      >
        {hideModeToggle ? null : (
          <ReqoreControlGroup gapSize='small' fluid>
            {/* Text first, and the view an expression opens in: as the value's tabs read (Value · Expression ·
                Visual), the written form before the built one (qorus#646, David) */}
            <ReqoreButton
              icon='CodeLine'
              active={mode === 'text'}
              onClick={enterTextMode}
              disabled={readOnly || textUnavailable}
              tooltip={
                textUnavailable ? 'The expression language server is not available' : undefined
              }
              size={size as any}
            >
              Text
            </ReqoreButton>
            <ReqoreButton
              icon='NodeTree'
              active={mode === 'visual'}
              onClick={enterVisualMode}
              disabled={readOnly}
              size={size as any}
            >
              Visual
            </ReqoreButton>
          </ReqoreControlGroup>
        )}

        {mode === 'text' ?
          <>
            {textUnavailable ?
              <ReqoreMessage
                intent='warning'
                size='small'
                flat
                opaque={false}
                className='expression-text-unavailable'
              >
                The expression language server is not available, so this text cannot be read yet. It
                is kept as you typed it; the Visual view builds the expression without the server.
              </ReqoreMessage>
            : null}
            <ReqoreControlGroup gapSize='small' fluid verticalAlign='flex-start'>
              <DpqlEditor
                ref={dpqlRef}
                value={text}
                onChange={handleDpqlChange}
                provider={provider}
                recordType={recordType}
                fields={fields}
                // the field's own templates name the chips as its catalogue names them
                templates={localTemplates}
                readOnly={readOnly}
                // no floor of its own: one line as tall as the text it shows, growing with its lines - a
                // 48px floor left an empty strip under the text, which the picker beside it could not match
                onUnavailable={handleTextUnavailable}
                onReady={handleTextReady}
              />
              {/* The field's templates and fields, as its catalogue names them, inserted as chips - next to
                  the server's `$` completion, which offers every context but not these names. */}
              {templateItems.length && !readOnly ?
                <TemplateBrowser
                  className='expression-text-template-picker'
                  icon='MoneyDollarCircleLine'
                  aria-label='Insert a template'
                  tooltip='Insert a template'
                  // the size of the text it inserts into - the DPQL editor is drawn at the normal size in
                  // any form - so the two are as tall as each other
                  size='normal'
                  fixed
                  templates={localTemplates}
                  focusFilter
                  onItemSelect={insertTemplate}
                />
              : null}
            </ReqoreControlGroup>
            {/* What the server said about the result's type, when the field
                declares one to check against.

                Nothing is shown when the expression already fits, and nothing
                is shown when the conversion is CERTAIN either — a number used
                as text always works, and a warning about something that cannot
                fail is what teaches people to ignore the ones that can. So this
                appears for exactly two cases: the conversion is impossible
                (danger), or it is attempted and may fail on the day (warning,
                and the run checks the value itself). */}
            {typeCheck && !typeCheck.compatible && (
              <ReqoreMessage
                intent={typeCheck.mayFail ? 'warning' : 'danger'}
                size='small'
                flat
                opaque={false}
                title={typeCheck.mayFail ? 'This may not fit' : 'This does not fit'}
              >
                {`The expression returns ${typeCheck.inferred}, and this field holds ${typeCheck.target}.`}
                {typeCheck.mayFail ?
                  ' That conversion is attempted rather than guaranteed, so the value itself is checked when it runs.'
                : ''}
                {typeCheck.fix ?
                  <>
                    <ReqoreVerticalSpacer height={6} />
                    <DpqlRendering text={typeCheck.fix} data-testid='expression-type-fix' />
                  </>
                : null}
              </ReqoreMessage>
            )}

            {/* Shown only when it ADDS something.

                It is a rendering of the AST, so for most text it repeats the
                line directly above it — `1 + 2` previewing as `1 + 2` is a
                second copy that flickers as you type. It earns the space when
                the rendering DIFFERS: a normalised form, or wording the DPQL
                does not have (`contains "es" (ignore case)`). Both are compared
                as they are DRAWN — a reference is a chip in either, so the quotes
                DPQL writes around one do not count — and ignoring surrounding
                whitespace, which the renderer does not preserve.

                An empty query has nothing to render either, so the box appears
                once there is a result rather than holding a placeholder. */}
            {previewState === 'shown' ?
              <ReqoreMessage intent='info' size='small' title='Preview' flat opaque={false}>
                <DpqlRendering text={preview} data-testid='expression-preview' />
              </ReqoreMessage>
            : null}
          </>
        : <>
            {textRefused ?
              <ReqoreMessage
                intent='warning'
                size='small'
                flat
                opaque={false}
                className='expression-text-refused'
              >
                This expression cannot be shown as text, so it is built here: {textRefused}
              </ReqoreMessage>
            : null}
            {textUnavailable ?
              <ReqoreMessage
                intent='muted'
                size='small'
                flat
                opaque={false}
                className='expression-text-unavailable'
              >
                The Text view needs the expression language server, which is not available: the
                expression is built here instead.
              </ReqoreMessage>
            : null}
            <ExpressionBuilder
              value={value}
              onChange={(v, remove) => onChange(v, remove)}
              expressions={expressions}
              // Default to `auto` when the field declares no return type, so a
              // valid expression renders `muted` rather than `danger` (the
              // builder's intent requires a truthy returnType).
              returnType={(returnType ?? type ?? 'auto') as any}
              readOnly={readOnly}
              localTemplates={localTemplates ?? { items: [] }}
              serverHandled={serverHandled}
              componentOverrides={componentOverrides}
              extraActions={extraActions}
              size={size}
              reorder={reorder}
            />
          </>
        }
      </ReqoreControlGroup>
    );
  }
);

export default ExpressionField;
