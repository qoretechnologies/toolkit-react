// Copyright 2026 Qore Technologies, s.r.o.
// The shell `TemplateField` renders when a field is in expression mode.
// Owns the `IExpression` value and offers two views of the same AST —
// Visual (the builder, Phase 3) and Text (DPQL, this phase) — plus Explain.
// The DPQL text editor bridges to the AST via the LSP `dpql/parse` (text →
// AST on edit) and `dpql/serialize` (AST → text on entering Text mode).
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreMessage,
} from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DpqlEditor, IDpqlEditorRef } from '../../dpqlEditor';
import { ExpressionBuilder } from './builder';
import { IExpression, IExpressionSchema, IExpressionValue } from './types';
import { useExpressions } from './useExpressions';
import { useRenderExpression } from './useRenderExpression';

export type TExpressionMode = 'visual' | 'text';

const PARSE_DEBOUNCE_MS = 300;
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
  /** Optional data-provider context for DPQL `@field` completions in Text mode. */
  provider?: string;
  recordType?: string;
  /** Initial editor mode (default `visual`). */
  defaultMode?: TExpressionMode;
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
    provider,
    recordType,
    defaultMode = 'visual',
    size,
  }: IExpressionFieldProps) => {
    const { expressions } = useExpressions({
      override: expressionsOverride,
      expressionsUrl,
    });
    const { render, serverRendering } = useRenderExpression();

    const [mode, setMode] = useState<TExpressionMode>(defaultMode);
    const [explanation, setExplanation] = useState('');
    const [showExplain, setShowExplain] = useState(false);
    const [preview, setPreview] = useState('');

    // Text mode state. `text` is the DPQL string the editor shows; the AST
    // (`value`) stays the source of truth, kept in sync via parse-on-edit.
    const [text, setText] = useState('');
    const dpqlRef = useRef<IDpqlEditorRef>(null);
    const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ast = useMemo<IExpressionValue | undefined>(() => value?.value, [value]);

    // Keep a readable preview of the current expression in sync.
    useEffect(() => {
      let live = true;
      render(ast ?? {}, expressions).then((t) => {
        if (live) setPreview(t);
      });
      return () => {
        live = false;
      };
    }, [render, ast, expressions]);

    const handleExplain = useCallback(async () => {
      const t = await render(ast ?? {}, expressions);
      setExplanation(t || '(empty expression)');
      setShowExplain(true);
    }, [render, ast, expressions]);

    // Tracks whether the user has typed since entering Text mode, so a
    // slow seed response can't clobber their input.
    const userTypedRef = useRef(false);
    const astRef = useRef(ast);
    useEffect(() => {
      astRef.current = ast;
    }, [ast]);

    // Text mode: parse the DPQL into the AST (debounced).
    const handleDpqlChange = useCallback(
      (next: string) => {
        userTypedRef.current = true;
        setText(next);
        if (parseTimer.current) clearTimeout(parseTimer.current);
        parseTimer.current = setTimeout(async () => {
          const result = await dpqlRef.current?.parse?.(next);
          if (result?.success && result.expression) {
            // `dpql/parse` returns the field-ready `{ is_expression, value }`.
            onChange(result.expression as IExpression);
          }
        }, PARSE_DEBOUNCE_MS);
      },
      [onChange]
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
        const result = await dpqlRef.current?.parse?.(text);
        if (result?.success && result.expression) {
          onChange(result.expression as IExpression);
        }
      }
      setMode('visual');
    }, [mode, text, onChange]);

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
          {/* The ported builder has its own Explain in Visual mode; only the
              DPQL Text editor needs the shell's Explain button. */}
          {mode === 'text' ? (
            <ReqoreButton
              icon='QuestionLine'
              onClick={handleExplain}
              size={size as any}
              fixed
              className='expression-explain'
            >
              Explain
            </ReqoreButton>
          ) : null}
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
            <ReqoreMessage intent='info' size='small' flat opaque={false}>
              Parsed: <code data-testid='expression-preview'>{preview || '(empty)'}</code>
            </ReqoreMessage>
            {showExplain ? (
              <ReqoreMessage intent='info' size='small' title='Explanation' flat>
                {serverRendering ? (
                  // Server rendering shown through a read-only DpqlEditor:
                  // template-ref chips + LSP token colours; diagnostics off
                  // (the rendering is readable text, not parseable DPQL).
                  <div data-testid='expression-explanation' style={{ width: '100%' }}>
                    <DpqlEditor
                      value={explanation}
                      onChange={noop}
                      readOnly
                      showDiagnostics={false}
                      enableHover={false}
                    />
                  </div>
                ) : (
                  <code data-testid='expression-explanation'>{explanation}</code>
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
            size={size}
          />
        )}
      </ReqoreControlGroup>
    );
  }
);

export default ExpressionField;
