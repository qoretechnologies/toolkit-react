// Copyright 2026 Qore Technologies, s.r.o.
// How a DPQL expression is shown when it is shown but not edited.
//
// ONE rendering for every read-only place an expression appears — the Explain
// panel, the Text view's Preview, the conversion a type-fit message suggests,
// a collapsed expression row — so they read the same everywhere: monospace,
// coloured by the language server's semantic tokens (the canonical tokenizer,
// see `useLspSemanticTokens`), template references as chips. Before, the same
// expression could be highlighted in one place, plain proportional text in the
// next and a bare `<code>` in a third, depending only on which component
// happened to draw it.
import { ReqoreMessage } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useAsync } from 'react-use';
import { DpqlEditor } from '../../dpqlEditor';
import { FormFieldsSkeleton } from '../engine/FormFieldsSkeleton';
import { IExpressionValue } from './types';
import { useRenderExpression } from './useRenderExpression';

const noop = (): void => undefined;

export interface IDpqlRenderingProps {
  /** DPQL, or a readable rendering of it, to show. */
  text: string;
  /** The surface's template catalogue: a reference in it reads as its name. */
  templates?: IReqoreFormTemplates;
  'data-testid'?: string;
}

/** Shows `text` as DPQL: monospace, server-coloured, references as chips. */
export const DpqlRendering = ({ text, templates, 'data-testid': testId }: IDpqlRenderingProps) => (
  <div className='dpql-rendering' data-testid={testId} style={{ width: '100%', minWidth: 0 }}>
    <DpqlEditor
      value={text}
      onChange={noop}
      readOnly
      // The text is a rendering, not something being written: nothing to
      // diagnose, and a hover would describe tokens of a document nobody edits.
      showDiagnostics={false}
      enableHover={false}
      templateTagsUseIntent
      templates={templates}
      // The text is already known; only its colours wait for the server, so
      // nothing is hidden behind "Connecting to language server…".
      loadingIndicator={null}
    />
  </div>
);

export interface IExpressionRenderingProps {
  /** The expression AST to render. */
  expression: IExpressionValue;
  /** The surface's template catalogue: a reference in it reads as its name. */
  templates?: IReqoreFormTemplates;
  'data-testid'?: string;
}

/**
 * The server's readable rendering of `expression`, shown through
 * `DpqlRendering`. It waits for the server — in the form's one waiting shape —
 * and says so plainly if the server cannot render, rather than showing an
 * approximation that reads like the real thing.
 */
export const ExpressionRendering = ({
  expression,
  templates,
  'data-testid': testId,
}: IExpressionRenderingProps) => {
  const { renderRich } = useRenderExpression();
  const rendering = useAsync(() => renderRich(expression), [JSON.stringify(expression)]);

  if (rendering.loading) {
    return <FormFieldsSkeleton rows={1} reason='expression-rendering' />;
  }

  if (!rendering.value) {
    return (
      <ReqoreMessage size='small' intent='muted' flat opaque={false} data-testid={testId}>
        This expression could not be rendered.
      </ReqoreMessage>
    );
  }

  return <DpqlRendering text={rendering.value.text} templates={templates} data-testid={testId} />;
};
