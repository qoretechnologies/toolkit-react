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
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { memo, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DpqlEditor, IDpqlEditorRef, IDpqlParseResult, useDpqlSession } from '../../dpqlEditor';
import { TemplateBrowser } from '../fields/template/TemplateBrowser';
import { dpqlDisplayedText, dpqlReferenceBeingWritten } from '../../dpqlEditor/dpqlHelpers';
import { dpqlExpectsValue } from '../../dpqlEditor/dpqlCompletions';
import { asLoneValue } from './loneValue';
import { TDpqlFields } from '../../dpqlEditor/types';
import { ExpressionBuilder, IExpressionBuilderProps } from './builder';
import { DpqlRendering } from './DpqlRendering';
import { IExpression, IExpressionSchema, IExpressionValue, TExpressionReorder } from './types';
import { incompleteExpressionText, serializableExpression } from './textOfExpression';
import { useExpressions } from './useExpressions';
import { useRenderExpression } from './useRenderExpression';
import {
  conditionBaseType,
  conditionByTruthinessText,
  conditionErrorText,
  conditionPartsWithMessages,
  conditionVerdict,
  conditionWholeMessage,
} from '../../../helpers/expressions';
import { useQorusTypes } from '../../../hooks/useQorusTypes';
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

/** What a rendering of the Preview is the rendering of: the AST, as its content (a new object of the same content is
 *  the same expression). */
const astKeyOf = (ast: unknown): string => JSON.stringify(ast ?? {});

/**
 * A control in the field's column at its own width: the column stretches what it holds across it. The Text /
 * Visual toggle is as wide as what the two say, not across the form: a control is its own width on any screen
 * wider than a phone's (qorus#646, David's width rule), so it is not fluid either.
 */
const OWN_WIDTH_STYLE: React.CSSProperties = { alignSelf: 'flex-start' };

/** The words of the field's Text / Visual toggle, for a host that translates them. */
export interface IExpressionModeLabels {
  text: string;
  visual: string;
  /** The Text button's hover when there is no language server to write the expression with. */
  textUnavailable: string;
}

export const DEFAULT_EXPRESSION_MODE_LABELS: IExpressionModeLabels = {
  text: 'Text',
  visual: 'Visual',
  textUnavailable: 'The expression language server is not available',
};

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
  /** The base data type of the field's type (`base_type`): what a field of an unlisted type takes. */
  returnBaseType?: string;
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
   * The expression is a condition, read as true or false by its value - true unless it is zero or empty (a
   * Qog transition's condition, an if state's, a while or for block's, a sheet contract's row rule). What it
   * gives is said as a condition, not as a type that fits: the Text view asks the server how it reads it
   * (`condition: true`), the Visual view tells it from the operation. A value of type `bool` is not one.
   */
  condition?: boolean;
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
   * What the author wrote in the Text view on an earlier visit that does not parse, given back by a host that
   * unmounts the field between visits (its tabs): shown as it was written and read again, its error with it,
   * not the value written out. See `onDraftChange`.
   */
  draftText?: string;
  /**
   * The text written in the Text view that the value does not hold yet - typed and not read, or read and not
   * parsed - each time it changes; undefined once it parses or is cleared. For a host that unmounts the field
   * between visits to keep it, and give it back as `draftText` while the value is still the one it was written
   * over (qorus#646: "@create + 1", which did not parse, became the field's 201 when the author came back).
   */
  onDraftChange?: (text: string | undefined) => void;
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
  /** The words of the Text / Visual toggle, for a host that translates them; English where not given. */
  modeLabels?: Partial<IExpressionModeLabels>;
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

/** Why the templates beside the text cannot be used: a value at its end would follow another (qorus#646). */
export const NO_VALUE_AT_THE_END =
  'A template goes where a value can: after an operator, an opening bracket or a comma, or in an empty expression.';

/** A diagnostic that is an error: the server marks one severity 1, or `error`. */
const isErrorDiagnostic = (diagnostic: { severity?: number | string }): boolean =>
  diagnostic.severity === 1 || diagnostic.severity === 'error';

/** What the server says of a condition as a condition: drawn by the builder, on the cards it is about. */
const CONDITION_DIAGNOSTIC_CODES = ['NOT_A_CONDITION', 'CONDITION_BY_TRUTHINESS'];

/** Writes an expression as DPQL text (`dpql/serialize`) through the session given. */
type TWriteExpression = (
  expression: IExpressionValue,
  write: (expression: IExpressionValue) => Promise<string>
) => Promise<string>;

/**
 * What the server says of an expression built in the Visual view: its errors, in its words, at the danger
 * intent. It writes the expression as DPQL (`dpql/serialize`) and reads it back (`dpql/parse`) on a document
 * bound to the record's fields, as the Text view's document is - so the server judges what is built as it
 * judges what is written. Mounted only while the Visual view shows a whole expression it can type.
 *
 * A condition is read as one (`condition: true`): what the server says of the whole condition and of each part
 * of its `&&`, `||` and `!` goes to `onConditionParts`, for the builder to draw on the cards it is about, and is
 * not repeated here.
 */
const ExpressionServerErrors = memo(
  ({
    expression,
    fields,
    provider,
    recordType,
    condition,
    onConditionParts,
    writeExpression,
  }: {
    expression: IExpressionValue;
    /** The field's writing of an expression as text, which the Text view shares (`ExpressionField`). */
    writeExpression: TWriteExpression;
    fields?: TDpqlFields;
    provider?: string;
    recordType?: string;
    condition?: boolean;
    /**
     * The parts the server judged, for the expression with this key (its JSON), and what it said of the whole
     * condition, in its words.
     */
    onConditionParts?: (
      expressionKey: string,
      parts: IDpqlParseResult['parts'],
      whole: string | undefined
    ) => void;
  }) => {
    const dpql = useDpqlSession({ fields, provider, recordType });
    const ready = dpql.session.isReady && dpql.session.isContextReady;
    const [errors, setErrors] = useState<string[]>([]);
    const expressionKey = JSON.stringify(expression);
    const { serialize, parse } = dpql;

    useEffect(() => {
      if (!ready) return undefined;
      let cancelled = false;
      const check = async (): Promise<void> => {
        let said: string[] = [];
        let parts: IDpqlParseResult['parts'];
        let whole: string | undefined;
        try {
          const text = await writeExpression(JSON.parse(expressionKey), serialize);
          if (text) {
            const result = await parse(
              text,
              undefined,
              condition ? { condition: true } : undefined
            );
            parts = conditionPartsWithMessages(
              result.parts,
              result.inferred_type,
              result.diagnostics
            );
            whole =
              condition ? conditionWholeMessage(result.inferred_type, result.diagnostics) : undefined;
            said = result.diagnostics
              .filter(
                (d) =>
                  isErrorDiagnostic(d) &&
                  !(condition && CONDITION_DIAGNOSTIC_CODES.includes(String(d.code ?? '')))
              )
              .map((d) => d.message);
          }
        } catch {
          // a server that cannot write or read it says nothing about it here
          said = [];
          parts = undefined;
          whole = undefined;
        }
        if (cancelled) return;
        setErrors(said);
        onConditionParts?.(expressionKey, parts, whole);
      };
      void check();
      return () => {
        cancelled = true;
      };
    }, [ready, expressionKey, serialize, parse, condition, onConditionParts, writeExpression]);

    if (!errors.length) return null;
    return (
      <ReqoreControlGroup vertical fluid size='small' className='expression-server-errors'>
        {errors.map((message, index) => (
          <ReqoreMessage
            key={index}
            intent='danger'
            data-severity='danger'
            size='small'
            flat
            opaque={false}
          >
            {message}
          </ReqoreMessage>
        ))}
      </ReqoreControlGroup>
    );
  }
);

export const ExpressionField = memo(
  ({
    value,
    onChange,
    type,
    returnType,
    returnBaseType,
    readOnly,
    expressions: expressionsOverride,
    expressionsUrl,
    localTemplates,
    serverHandled,
    condition,
    extraActions,
    provider,
    fields,
    recordType,
    defaultMode = 'text',
    initialText,
    draftText,
    onDraftChange,
    heldAsValue,
    requestedMode,
    hideModeToggle,
    modeLabels,
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
    const modeWords = useMemo(
      () => ({ ...DEFAULT_EXPRESSION_MODE_LABELS, ...modeLabels }),
      [modeLabels]
    );
    const onModeChangeRef = useRef(onModeChange);
    onModeChangeRef.current = onModeChange;
    useEffect(() => {
      onModeChangeRef.current?.(mode);
    }, [mode]);
    /* The server's rendering of an AST, with the AST it renders (`key`, see `astKeyOf`); none until it has one.
       There is no client-side stand-in — see `useRenderExpression`. */
    const [preview, setPreview] = useState<{ key: string; text: string } | null>(null);
    /* The AST whose rendering was asked for last, or none: an answer for any other AST - one arriving late, or
       out of order - is dropped, whenever it comes. */
    const previewAskedFor = useRef<string | null>(null);

    // Text mode state. `text` is the DPQL string the editor shows; the AST
    // (`value`) stays the source of truth, kept in sync via parse-on-edit.
    const [text, setText] = useState(draftText ?? initialText ?? '');
    /* What the author wrote in the Text view that the value does not hold (see `onDraftChange`): it is this
       field's text until it parses or is cleared, so a later visit to the Text view shows it, not the value
       written out. */
    const draftRef = useRef<string | undefined>(draftText);
    const onDraftChangeRef = useRef(onDraftChange);
    onDraftChangeRef.current = onDraftChange;
    const setDraft = useCallback((next: string | undefined) => {
      if (draftRef.current === next) return;
      draftRef.current = next;
      onDraftChangeRef.current?.(next);
    }, []);
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
      /** what is said of a condition that is not plainly true or false */
      condition?: 'error' | 'warning';
      /** the server's own words for it, in its presentation language, when it gave them */
      message?: string;
    } | null>(null);
    const dpqlRef = useRef<IDpqlEditorRef>(null);
    /*
     * The field's writing of its latest expression as text, shared by its two views: the Visual view has the server
     * write what it builds to check it, and the Text view opens on the same writing rather than asking the server
     * for it again. Entering the Text view while the Visual view's check was on its way asked twice
     * (qorus#646). An answer with no text (no session yet) or a refusal is not kept: the next asks again.
     */
    const writtenRef = useRef<{ key: string; text: Promise<string> }>();
    const writeExpression = useCallback<TWriteExpression>((expression, write) => {
      const key = JSON.stringify(expression);
      const written = writtenRef.current;
      if (written?.key === key) {
        return written.text;
      }
      const forget = () => {
        if (writtenRef.current?.key === key) {
          writtenRef.current = undefined;
        }
      };
      const text = write(expression).then(
        (result) => {
          if (!result) {
            forget();
          }
          return result;
        },
        (error: unknown) => {
          forget();
          throw error;
        }
      );
      writtenRef.current = { key, text };
      return text;
    }, []);
    const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** The text typed whose parse is still waiting on the debounce, or null. */
    const pendingParse = useRef<string | null>(null);

    const ast = useMemo<IExpressionValue | undefined>(() => value?.value, [value]);
    // what a rendering of the Preview must be of to be drawn (`astKeyOf`)
    const astKey = useMemo(() => astKeyOf(ast), [ast]);
    // a lone template, as the server parses one written alone, is the lone value it is (`asLoneValue`)
    const builderValue = useMemo(
      () => (value?.value ? { ...value, value: asLoneValue(value.value) } : value),
      [value]
    );

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

    /** A condition is asked as one, not as a type to fit. */
    const parseOptions = useMemo(() => (condition ? { condition: true } : undefined), [condition]);

    /**
     * The expression built in the Visual view, as the server is asked about it (qorus#646): whole, and only
     * where the server can type its operands - with the record's fields or a provider's. The server refuses
     * operands its operators cannot combine (DPQL-E050, `@create + 1` with `create` a hash), which nothing
     * on this side can tell; the Text view shows it as the server publishes it, and so does this view.
     */
    const serverCheckable = useMemo(
      () =>
        (
          mode === 'visual' &&
          ((!!fields && Object.keys(fields).length > 0) || !!provider || !!condition)
        ) ?
          serializableExpression(ast)
        : undefined,
      [mode, fields, provider, condition, ast]
    );

    /* What the server said of each part of the condition built in the Visual view (qorus#646), for the
       expression it was said of: an answer about an expression since edited is not drawn on it. */
    const [conditionParts, setConditionParts] = useState<{
      key: string;
      parts: IDpqlParseResult['parts'];
      whole: string | undefined;
    }>();
    const onConditionParts = useCallback(
      (key: string, parts: IDpqlParseResult['parts'], whole: string | undefined) =>
        setConditionParts({ key, parts, whole }),
      []
    );
    const currentCondition =
      serverCheckable && conditionParts?.key === JSON.stringify(serverCheckable) ?
        conditionParts
      : undefined;
    const currentConditionParts = currentCondition?.parts;
    /* What the server says of the whole condition built in the Visual view, in its words: drawn there as the
       Text view draws it, in place of the builder's own fallback. */
    const currentConditionMessage = currentCondition?.whole;
    const qorusTypes = useQorusTypes();
    /** A type named inside a sentence: the sentence form of what it is ("a whole number"), or nothing (qorus#646). */
    const typeInSentence = useCallback(
      (type: string | undefined) =>
        qorusTypes.getTypeSentenceForm(conditionBaseType(type)) ?? 'nothing',
      [qorusTypes]
    );

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
        condition_reading?: IDpqlParseResult['condition_reading'];
        diagnostics?: IDpqlParseResult['diagnostics'];
      }): void => {
        /* A condition is not a type to fit (qorus#646): the server reads it as true unless its value is
           zero or empty, so it is said as every condition editor says it - a number accepted with a warning,
           text refused. The server's reading, with its own words, when it gave one; the inferred type read
           the same way when it did not (a server that does not know the question). */
        if (condition) {
          if (!result) {
            setTypeCheck(null);
            return;
          }
          const reading = result.condition_reading;
          const verdict =
            reading === 'not_a_condition' ? 'error'
            : reading === 'truthiness' ? 'warning'
            : reading ? undefined
            : conditionVerdict(result.inferred_type);
          const said = result.diagnostics?.find((d) =>
            verdict === 'error' ? d.code === 'NOT_A_CONDITION' : d.code === 'CONDITION_BY_TRUTHINESS'
          )?.message;
          setTypeCheck(
            verdict ?
              {
                compatible: verdict !== 'error',
                mayFail: false,
                inferred: result.inferred_type,
                condition: verdict,
                ...(said ? { message: said } : {}),
              }
            : null
          );
          return;
        }
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
      [condition]
    );

    // Keep a readable rendering of the current expression in sync — the
    // single live mirror of the AST (the server's `dpql/renderExpression`).
    //
    // Debounced: it follows the AST, which follows the text, so rendering it
    // eagerly put a box under the cursor that appeared, changed and vanished
    // while the author was still typing.
    //
    // A rendering is kept with the AST it renders, and drawn only for that AST (`previewState`): after an edit,
    // for the pause and the server's answer, the previous expression's rendering was drawn under the new text
    // (qorus#646: "record: pos" under `bezeichnung == bezeichnung`).
    useEffect(() => {
      const key = astKey;
      previewAskedFor.current = key;
      const timer = setTimeout(() => {
        renderRich(ast ?? {}).then((r) => {
          if (previewAskedFor.current === key) setPreview({ key, text: r?.text ?? '' });
        });
      }, PREVIEW_DEBOUNCE_MS);
      return () => {
        previewAskedFor.current = null;
        clearTimeout(timer);
      };
    }, [renderRich, ast, astKey]);

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
    /** Whether this visit to Text mode has already put the AST in the editor. The host's own text for the
     *  first visit (`initialText`, such as the value written as `concat("SUP-", $record:{pos})`) is that visit's
     *  text: the session does not write over it once it is ready. */
    const seededRef = useRef(!!initialText);
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
        /* Emptied, the editor holds nothing of the value: an expression that comes back (a revert, an undo) is
           written into it, as on entering Text. Left marked seeded, the visit kept the empty text, and a revert
           put `pos + 1` back in the form with nothing in the editor (FormEngine · Reverting A Removed Expression
           Puts It Back, qorus#646). */
        seededRef.current = false;
        setText('');
      }
    }, [ast, heldAsValue]);

    /* Read the text typed and not yet read: once the session is ready, however long that takes, and the
       latest text typed by then. Gives the expression it is, or nothing. The debounce, the host leaving the
       Text view (its tabs) and the session coming up all read through here. */
    const flushPendingParse = useCallback(async (): Promise<IExpression | undefined> => {
      if (pendingParse.current === null) return undefined;
      /* An emptied text is no value, as an emptied Value tab is: the field holds nothing. It stayed what it
         was, and came back on the next visit (qorus#646: the text's × left the 201). */
      if (!pendingParse.current.trim()) {
        if (parseTimer.current) clearTimeout(parseTimer.current);
        pendingParse.current = null;
        setDraft(undefined);
        if (ast || heldAsValue) onChange({ is_expression: true } as IExpression, true);
        return undefined;
      }
      if (!(await whenSessionReady())) return undefined;
      const pending = pendingParse.current;
      const parse = dpqlRef.current?.parse;
      if (pending === null || !parse) return undefined;
      if (parseTimer.current) clearTimeout(parseTimer.current);
      pendingParse.current = null;
      const result = await parse(pending, targetType, parseOptions);
      readTypeCheck(result);
      // not parsed: the value keeps what it held, and the text stays the author's (see `onDraftChange`)
      if (!result?.success || !result.expression) return undefined;
      setDraft(undefined);
      setAstText(pending);
      // `dpql/parse` returns the field-ready `{ is_expression, value }`.
      onChange(result.expression as IExpression);
      return result.expression as IExpression;
    }, [
      onChange,
      targetType,
      parseOptions,
      readTypeCheck,
      whenSessionReady,
      setDraft,
      ast,
      heldAsValue,
    ]);

    // the latest reader, for the seeding below, which is not run again for a new one
    const flushLatest = useRef(flushPendingParse);
    flushLatest.current = flushPendingParse;

    // Text mode: parse the DPQL into the AST, debounced, once the session can read it.
    const handleDpqlChange = useCallback(
      (next: string) => {
        /* The editor reports the text it was given back as a change (Slate's first operation after the
           value is set). That is not typing: counted as such it stopped the session from writing the
           expression into the view once it was ready. */
        if (next === textRef.current) return;
        userTypedRef.current = true;
        setText(next);
        // the value does not hold it until it parses
        setDraft(next);
        if (parseTimer.current) clearTimeout(parseTimer.current);
        pendingParse.current = next;
        parseTimer.current = setTimeout(() => void flushPendingParse(), PARSE_DEBOUNCE_MS);
      },
      [flushPendingParse, setDraft]
    );

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
      /* What was written and does not parse is this visit's text, read again so its error is said again: not the
         value written out over it. */
      if (draftRef.current !== undefined) {
        seededRef.current = true;
        setText(draftRef.current);
        pendingParse.current = draftRef.current;
        void flushLatest.current();
        return undefined;
      }
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
          const editor = dpqlRef.current;
          t =
            editor?.serialize ?
              await writeExpression(seedAst, (expression) => editor.serialize!(expression))
            : undefined;
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
          if (targetType || condition) {
            const result = await dpqlRef.current?.parse?.(t, targetType, parseOptions);
            if (!cancelled && !userTypedRef.current) readTypeCheck(result);
          }
        }
      };
      void seed();
      return () => {
        cancelled = true;
      };
    }, [
      mode,
      ast,
      expressions,
      targetType,
      parseOptions,
      condition,
      readTypeCheck,
      sessionReady,
      writeExpression,
    ]);

    /** The field's templates, its catalogue's entries, for the Text view's picker. */
    const templateItems = useMemo(
      () => (localTemplates?.items ?? []) as NonNullable<IReqoreFormTemplates['items']>,
      [localTemplates]
    );
    /* A template chosen from the picker goes in after the text, as a chip, and is parsed as typed text is:
       the editor keeps no caret the field can reach, so the end of the text is where it is put - in place of a
       reference being written there (a `$` typed to ask for one), as a template picked in the text goes
       (qorus#646, David's review: `pos + 1 + $pos`). */
    // whether a value can be written at the end of the text, where the picker puts one
    const valueCanEnd = dpqlExpectsValue(text);
    const insertTemplate = useCallback(
      (item: { value?: unknown }) => {
        if (typeof item?.value !== 'string' || !item.value || !dpqlExpectsValue(text)) return;
        const current = text.trimEnd();
        const written = dpqlReferenceBeingWritten(current);
        const before = current.slice(0, current.length - written);
        handleDpqlChange(
          !before.trim() ? item.value
          : written ? `${before}${item.value}`
          : `${before} ${item.value}`
        );
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
        const result = await dpqlRef.current?.parse?.(text, targetType, parseOptions);
        readTypeCheck(result);
        if (result?.success && result.expression) {
          onChange(result.expression as IExpression);
        }
      }
      setMode('visual');
    }, [mode, text, astText, onChange, targetType, parseOptions, readTypeCheck, whenSessionReady]);

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

    /* What the Preview has to add: `none` while the text showing is not the expression's, or the rendering says
       nothing; `pending` until the server's rendering of the expression now held arrives (nothing is drawn);
       `repeats` when it reads exactly as the text does (so it is not drawn — see below), `shown` otherwise.
       Exposed on the field, because a Preview correctly left out leaves nothing else to observe. */
    const previewState =
      astText.trim() !== text.trim() ? 'none'
        // asked for, not answered yet: nothing is drawn, least of all an earlier expression's rendering
      : preview?.key !== astKey ? 'pending'
      : !preview.text ? 'none'
      : dpqlDisplayedText(preview.text).trim() === dpqlDisplayedText(text).trim() ? 'repeats'
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
          <ReqoreControlGroup
            gapSize='small'
            fluid={false}
            className='expression-mode-toggle'
            style={OWN_WIDTH_STYLE}
          >
            {/* Text first, and the view an expression opens in: as the value's tabs read (Value · Expression ·
                Visual), the written form before the built one (qorus#646, David) */}
            <ReqoreButton
              icon='CodeLine'
              active={mode === 'text'}
              onClick={enterTextMode}
              disabled={readOnly || textUnavailable}
              tooltip={textUnavailable ? modeWords.textUnavailable : undefined}
              size={size as any}
            >
              {modeWords.text}
            </ReqoreButton>
            <ReqoreButton
              icon='NodeTree'
              active={mode === 'visual'}
              onClick={enterVisualMode}
              disabled={readOnly}
              size={size as any}
            >
              {modeWords.visual}
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
                // the field's size, as its Value tab draws the same value: a reference is the same chip in both
                size={size as TSizes | undefined}
                // no floor of its own: one line as tall as the text it shows, growing with its lines - a
                // 48px floor left an empty strip under the text, which the picker beside it could not match
                onUnavailable={handleTextUnavailable}
                onReady={handleTextReady}
                // a click, a tap or Tab lists what can be written at the caret, the field's templates with it
                completeOnClick
              />
              {/* The field's templates and fields, browsed as its catalogue nests them and put in at the end of
                  the text - where a value can go there: after a value (`12`), one would be refused, and the
                  picker says why it cannot be used (qorus#646, David's decision). */}
              {templateItems.length && !readOnly ?
                <TemplateBrowser
                  className='expression-text-template-picker'
                  icon='MoneyDollarCircleLine'
                  aria-label='Insert a template'
                  disabled={!valueCanEnd}
                  tooltip={valueCanEnd ? 'Insert a template' : NO_VALUE_AT_THE_END}
                  // the size of the text it inserts into, so the two are as tall as each other
                  size={(size as TSizes | undefined) ?? 'normal'}
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
            {typeCheck?.condition && (
              <ReqoreMessage
                className='expression-condition-verdict'
                intent={typeCheck.condition === 'error' ? 'danger' : 'warning'}
                size='small'
                flat
                opaque={false}
              >
                {typeCheck.message ??
                  (typeCheck.condition === 'error' ?
                    conditionErrorText(typeInSentence(typeCheck.inferred), typeCheck.inferred)
                  : conditionByTruthinessText(typeCheck.inferred))}
              </ReqoreMessage>
            )}
            {typeCheck && !typeCheck.compatible && !typeCheck.condition && (
              <ReqoreMessage
                intent={typeCheck.mayFail ? 'warning' : 'danger'}
                size='small'
                flat
                opaque={false}
                title={typeCheck.mayFail ? 'This may not fit' : 'This does not fit'}
              >
                {`The expression gives ${typeInSentence(typeCheck.inferred)}, and this field takes ${typeInSentence(typeCheck.target)}.`}
                {typeCheck.mayFail ? ' Qorus converts the value when it runs, and checks it then.' : ''}
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
                <DpqlRendering text={preview?.text} data-testid='expression-preview' />
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
              value={builderValue}
              onChange={(v, remove) => onChange(v, remove)}
              expressions={expressions}
              // Default to `auto` when the field declares no return type, so a
              // valid expression renders `muted` rather than `danger` (the
              // builder's intent requires a truthy returnType).
              returnType={(returnType ?? type ?? 'auto') as any}
              returnBaseType={returnBaseType}
              readOnly={readOnly}
              localTemplates={localTemplates ?? { items: [] }}
              serverHandled={serverHandled}
              condition={condition}
              conditionParts={currentConditionParts}
              conditionMessage={currentConditionMessage}
              componentOverrides={componentOverrides}
              extraActions={extraActions}
              size={size}
              reorder={reorder}
            />
            {/* What the server says of the expression built here, where it can tell: with the record's
                fields to type its operands by, and of a condition, each part as a condition. */}
            {serverCheckable ?
              <ExpressionServerErrors
                expression={serverCheckable}
                fields={fields}
                provider={provider}
                recordType={recordType}
                condition={condition}
                onConditionParts={condition ? onConditionParts : undefined}
                writeExpression={writeExpression}
              />
            : null}
          </>
        }
      </ReqoreControlGroup>
    );
  }
);

export default ExpressionField;
