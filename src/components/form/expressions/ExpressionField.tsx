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
} from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DpqlEditor, IDpqlEditorRef } from '../../dpqlEditor';
import { ExpressionBuilder, IExpressionBuilderProps } from './builder';
import { IExpression, IExpressionSchema, IExpressionValue } from './types';
import { useExpressions } from './useExpressions';
import { useRenderExpression } from './useRenderExpression';

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
/** Retry cadence for seeding the Text editor while its LSP session opens. */
const SEED_RETRY_MS = 400;
const SEED_MAX_TRIES = 20;

const noop = (): void => undefined;

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
  /** Initial editor mode (default `visual`). */
  defaultMode?: TExpressionMode;
  /**
   * SEAM (reqraft): the host's per-`ui_type` editors, forwarded to the
   * builder's operand fields. Without them an operand typed with one of the
   * CONSUMER's ui_types renders "Unknown type!".
   */
  componentOverrides?: Record<string, React.FC<any>>;
  size?: string;
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
    recordType,
    defaultMode = 'visual',
    size,
    componentOverrides,
  }: IExpressionFieldProps) => {
    const { expressions } = useExpressions({
      override: expressionsOverride,
      expressionsUrl,
    });
    const { renderRich } = useRenderExpression();

    const [mode, setMode] = useState<TExpressionMode>(defaultMode);
    const [preview, setPreview] = useState<{ text: string; server: boolean }>({
      text: '',
      server: false,
    });

    // Text mode state. `text` is the DPQL string the editor shows; the AST
    // (`value`) stays the source of truth, kept in sync via parse-on-edit.
    const [text, setText] = useState('');
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
      return declared && declared !== 'auto' && declared !== 'any' ? declared : undefined;
    }, [returnType, type]);

    /** Read the type analysis off a parse result, or clear it. */
    const readTypeCheck = useCallback(
      (result?: { type_compatible?: boolean; coercion_may_fail?: boolean;
        inferred_type?: string; target_type?: string;
        suggested_fix?: { text: string } }): void => {
        if (!result || result.type_compatible === undefined) {
          setTypeCheck(null);
          return;
        }
        setTypeCheck({
          compatible: !!result.type_compatible,
          mayFail: !!result.coercion_may_fail,
          inferred: result.inferred_type,
          target: result.target_type,
          fix: result.suggested_fix?.text,
        });
      },
      []
    );

    // Keep a readable rendering of the current expression in sync — the
    // single live mirror of the AST (server `dpql/renderExpression` when
    // reachable, the client-side approximation otherwise).
    //
    // Debounced: it follows the AST, which follows the text, so rendering it
    // eagerly put a box under the cursor that appeared, changed and vanished
    // while the author was still typing.
    useEffect(() => {
      let live = true;
      const timer = setTimeout(() => {
        renderRich(ast ?? {}, expressions).then((r) => {
          if (live) setPreview({ text: r.text, server: r.server });
        });
      }, PREVIEW_DEBOUNCE_MS);
      return () => {
        live = false;
        clearTimeout(timer);
      };
    }, [renderRich, ast, expressions]);

    // Tracks whether the user has typed since entering Text mode, so a
    // slow seed response can't clobber their input.
    const userTypedRef = useRef(false);
    const astRef = useRef(ast);

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
      if (hadExpression.current) {
        hadExpression.current = false;
        userTypedRef.current = false;
        setText('');
      }
    }, [ast]);

    useEffect(() => {
      astRef.current = ast;
    }, [ast]);

    // Text mode: parse the DPQL into the AST (debounced).
    /* The session may not be attached when the debounce fires — the editor
       mounts on the render that flips the mode, and its LSP session comes up
       after that. `dpqlRef.current?.parse?.()` is optional all the way down, so
       an early call resolves `undefined`, `readTypeCheck` CLEARS the analysis,
       and nothing asks again: the author types once into a fresh Text field and
       is told nothing about the type until they happen to type another
       character.

       The seeding effect below already retries for this exact reason
       ("`serialize` resolves '' until the editor's LSP session is ready"); the
       parse path needed the same care and did not have it. Same budget as
       seeding, so a session that never arrives gives up rather than spinning.

       Found by CI, not locally: the session is up before the debounce on a
       fast machine, so the story asserting the type message passed here every
       time and failed on the runner. */
    const handleDpqlChange = useCallback(
      (next: string) => {
        userTypedRef.current = true;
        setText(next);
        if (parseTimer.current) clearTimeout(parseTimer.current);
        let tries = 0;
        const runParse = async (): Promise<void> => {
          const parse = dpqlRef.current?.parse;
          if (!parse) {
            if (++tries < SEED_MAX_TRIES) {
              parseTimer.current = setTimeout(runParse, SEED_RETRY_MS);
            }
            return;
          }
          const result = await parse(next, targetType);
          readTypeCheck(result);
          if (result?.success && result.expression) {
            setAstText(next);
            // `dpql/parse` returns the field-ready `{ is_expression, value }`.
            onChange(result.expression as IExpression);
          }
        };
        parseTimer.current = setTimeout(runParse, PARSE_DEBOUNCE_MS);
      },
      [onChange, targetType, readTypeCheck]
    );

    // Seed the Text editor from the AST whenever Text mode becomes active
    // (including a `defaultMode='text'` mount). This must run as an
    // effect: the editor only mounts on the same render that flips the
    // mode (so `dpqlRef` is null inside the click handler), and
    // `serialize` resolves '' until the editor's LSP session is ready —
    // hence the brief retry loop.
    useEffect(() => {
      if (mode !== 'text') return undefined;
      const seedAst = astRef.current;
      if (!seedAst?.exp) return undefined;
      userTypedRef.current = false;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let tries = 0;
      const seed = async (): Promise<void> => {
        const t = await dpqlRef.current?.serialize?.(seedAst);
        if (cancelled || userTypedRef.current) return;
        if (t) {
          setText(t);
          setAstText(t);
        } else if (++tries < SEED_MAX_TRIES) {
          timer = setTimeout(seed, SEED_RETRY_MS);
        }
      };
      void seed();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [mode]);

    // Switch to Text: the seeding effect above serializes the AST once
    // the editor's session is up.
    const enterTextMode = useCallback(() => {
      setMode('text');
    }, []);

    // Switch to Visual: flush any pending parse so the AST is current.
    const enterVisualMode = useCallback(async () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
      if (mode === 'text' && text) {
        const result = await dpqlRef.current?.parse?.(text, targetType);
        readTypeCheck(result);
        if (result?.success && result.expression) {
          onChange(result.expression as IExpression);
        }
      }
      setMode('visual');
    }, [mode, text, onChange, targetType, readTypeCheck]);

    useEffect(
      () => () => {
        if (parseTimer.current) clearTimeout(parseTimer.current);
      },
      []
    );

    return (
      <ReqoreControlGroup vertical fluid gapSize='small' className='expression-field'>
        <ReqoreControlGroup gapSize='small' fluid>
          <ReqoreButton
            icon='NodeTree'
            active={mode === 'visual'}
            onClick={enterVisualMode}
            disabled={readOnly}
            size={size as any}
          >
            Visual
          </ReqoreButton>
          <ReqoreButton
            icon='CodeLine'
            active={mode === 'text'}
            onClick={enterTextMode}
            disabled={readOnly}
            size={size as any}
          >
            Text
          </ReqoreButton>
        </ReqoreControlGroup>

        {mode === 'text' ? (
          <>
            <DpqlEditor
              ref={dpqlRef}
              value={text}
              onChange={handleDpqlChange}
              provider={provider}
              recordType={recordType}
              readOnly={readOnly}
              height='48px'
            />
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
                {typeCheck.fix ? (
                  <div style={{ marginTop: '6px' }}>
                    <code data-testid='expression-type-fix'>{typeCheck.fix}</code>
                  </div>
                ) : null}
              </ReqoreMessage>
            )}

            {/* Shown only when it ADDS something.

                It is a rendering of the AST, so for most text it repeats the
                line directly above it — `1 + 2` previewing as `1 + 2` is a
                second copy that flickers as you type. It earns the space when
                the rendering DIFFERS: a template reference resolved to a chip,
                or a normalised form. Comparison ignores surrounding whitespace,
                which the renderer does not preserve.

                An empty query has nothing to render either, so the box appears
                once there is a result rather than holding a placeholder. */}
            {preview.text &&
            astText.trim() === text.trim() &&
            preview.text.trim() !== text.trim() ? (
              <ReqoreMessage intent='info' size='small' title='Preview' flat opaque={false}>
                {preview.server ? (
                  // Server rendering shown through a read-only DpqlEditor:
                  // template-ref chips + LSP token colours; diagnostics off
                  // (the rendering is readable text, not parseable DPQL).
                  <div data-testid='expression-preview' style={{ width: '100%' }}>
                    <DpqlEditor
                      value={preview.text}
                      onChange={noop}
                      readOnly
                      showDiagnostics={false}
                      enableHover={false}
                    />
                  </div>
                ) : (
                  <code data-testid='expression-preview'>{preview.text}</code>
                )}
              </ReqoreMessage>
            ) : null}
          </>
        ) : (
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
          />
        )}
      </ReqoreControlGroup>
    );
  }
);

export default ExpressionField;
