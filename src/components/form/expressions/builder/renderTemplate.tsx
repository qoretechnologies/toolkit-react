// SEAM (reqraft): the IDE rendered the readable expression via
// `callBackendBasic('render-expression')` over the Creator WebSocket; here the
// same server rendering arrives over the LSP (`dpql/renderExpression`, via
// `useRenderExpression`) and is shown through `ExpressionRendering`, the one
// read-only rendering every expression surface shares — monospace, coloured by
// the language server, template references as chips.
// The component name/shape is kept identical so `index.tsx`'s usage is
// unchanged.
import { ReqoreMessage } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { validateField } from '../../../../helpers/validations';
import { ExpressionRendering } from '../DpqlRendering';
import { IExpression, IExpressionSchema } from '../types';

export interface IExpressionRenderTemplateProps {
  exp: IExpression;
  expressions: IExpressionSchema[];
  /** The builder's template catalogue: a reference in it reads as its name. */
  templates?: IReqoreFormTemplates;
}

export const ExpressionRenderTemplate = ({
  exp,
  expressions,
  templates,
}: IExpressionRenderTemplateProps) => {
  if (!validateField('expression', exp, { expressions })) {
    return (
      <ReqoreMessage size='small' intent='muted' flat opaque={false}>
        Expression is invalid, unable to render summary
      </ReqoreMessage>
    );
  }

  return (
    <ExpressionRendering
      expression={exp.value}
      templates={templates}
      data-testid='expression-explanation'
    />
  );
};
