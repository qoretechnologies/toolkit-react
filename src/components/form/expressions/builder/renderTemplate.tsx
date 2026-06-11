// SEAM (reqraft): the IDE rendered the readable expression via
// `callBackendBasic('render-expression')` over the Creator WebSocket; here
// the same server rendering arrives over the LSP (`dpql/renderExpression`,
// via `useRenderExpression`), with a client-side approximation as fallback.
//
// Server path: the rendering is displayed through a read-only `DpqlEditor`,
// which gives template-reference chips (the `$context:value` converter) AND
// LSP-backed token colours (semantic tokens) — diagnostics are suppressed
// because the rendering is human-readable text, not parseable DPQL. The
// fallback path keeps the plain rich-text rendering plus an explicit
// "Approximate" tag so the serving path is never ambiguous.
// The component name/shape is kept identical so `index.tsx`'s usage is
// unchanged.
import { ReqoreTag } from '@qoretechnologies/reqore';
import { useAsyncRetry } from 'react-use';
import { DpqlEditor } from '../../../dpqlEditor';
import { validateField } from '../../../../helpers/validations';
import { RichTextFormField } from '../../fields/rich-text/RichText';
import { useRenderExpression } from '../useRenderExpression';
import { IExpression, IExpressionSchema } from '../types';

const noop = (): void => undefined;

export interface IExpressionRenderTemplateProps {
  exp: IExpression;
  expressions: IExpressionSchema[];
}

export const ExpressionRenderTemplate = ({ exp, expressions }: IExpressionRenderTemplateProps) => {
  const { renderRich } = useRenderExpression();

  const isValid = validateField('expression', exp, { expressions });

  const renderTemplate = useAsyncRetry(async () => {
    if (!isValid) return null;
    return renderRich(exp.value, expressions);
  }, [JSON.stringify(exp), JSON.stringify(expressions)]);

  if (!isValid || !renderTemplate.value || !renderTemplate.value.server) {
    return (
      <>
        <RichTextFormField
          readOnly
          value={
            isValid
              ? renderTemplate.value?.text
              : 'Expression is invalid, unable to render summary'
          }
          flat
          panelProps={{ style: { flexGrow: 0, flexShrink: 0 } }}
          size='small'
        />
        {isValid && renderTemplate.value ? (
          <ReqoreTag
            size='small'
            minimal
            intent='muted'
            label='Approximate — server rendering unavailable'
          />
        ) : null}
      </>
    );
  }

  return (
    <DpqlEditor
      value={renderTemplate.value.text}
      onChange={noop}
      readOnly
      showDiagnostics={false}
      enableHover={false}
    />
  );
};
