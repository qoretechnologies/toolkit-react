import { ReqoreButton, ReqoreControlGroup, ReqoreModal, ReqoreP } from '@qoretechnologies/reqore';
import { IReqoreModalProps } from '@qoretechnologies/reqore/dist/components/Modal';
import { omit, size } from 'lodash';
import { memo, useState } from 'react';
import { conversionText, getArgumentType } from '../../../../helpers/expressions';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';
import { IExpression, IExpressionSchema } from '../types';

export interface IConfirmMismatchedTypesModalProps extends Omit<IReqoreModalProps, 'onSubmit'> {
  expression: IExpressionSchema;
  expressions: IExpressionSchema[];
  args: IExpression[];
  onSubmit: (args: IExpression[]) => void;
}

export const ConfirmMismatchedTypesModal = memo(
  ({ args, expression, expressions, onSubmit, ...rest }: IConfirmMismatchedTypesModalProps) => {
    const types = useQorusTypes();
    const [fixedArgs, setFixedArgs] = useState<IExpression[]>(() =>
      args.map((a) => (a.types_mismatch ? { ...a, types_mismatch: false } : a))
    );

    const handleArgToggle = (arg: IExpression) => {
      setFixedArgs((prev) =>
        prev.map((a) => (a === arg ? { ...a, types_mismatch: !a.types_mismatch } : a))
      );
    };

    return (
      <ReqoreModal
        isOpen
        intent='warning'
        icon='ErrorWarningLine'
        label='Confirm type selection for mismatched arguments'
        {...rest}
        customZIndex={1000000}
        bottomActions={[
          {
            position: 'left',
            label: 'Discard all',
            icon: 'CloseLine',
            onClick: () => {
              onSubmit(args.map(() => ({})));
            },
          },
          {
            position: 'right',
            label: 'Accept all',
            icon: 'CheckDoubleLine',
            onClick: () => {
              // We need to fix the values now - we accept all transformations
              const finalArgs = fixedArgs.map((arg) => omit(arg, ['types_mismatch']));

              onSubmit(finalArgs);
            },
          },
          {
            position: 'right',
            label: 'Confirm selection',
            icon: 'CheckLine',
            onClick: () => {
              // We need to fix the values now - if an arg still has types_mismatch true, we need to clear its value and type
              // Otherwise, we keep it as is, but we need to remove the types_mismatch flag
              const finalArgs = fixedArgs.map((arg) => {
                if (arg.types_mismatch) {
                  return {};
                }

                return omit(arg, ['types_mismatch']);
              });

              onSubmit(finalArgs);
            },
          },
        ]}
      >
        <ReqoreControlGroup vertical fluid horizontalAlign='center' gapSize='big'>
          <ReqoreP style={{ textAlign: 'center' }}>
            These values have other types than expected. Qorus converts them when it runs.
          </ReqoreP>
          <ReqoreP style={{ textAlign: 'center' }}>
            Please deselect the arguments you do not wish to transform:
          </ReqoreP>
          <ReqoreControlGroup vertical fluid horizontalAlign='center'>
            {args.map((arg, index) => (
              <ReqoreButton
                icon={
                  arg.types_mismatch
                    ? fixedArgs[index].types_mismatch
                      ? 'CheckboxBlankCircleLine'
                      : 'CheckboxCircleFill'
                    : 'CheckDoubleLine'
                }
                key={index}
                description={
                  fixedArgs[index].types_mismatch === false
                    ? // the types named inside a sentence, by their sentence forms (qorus#646)
                      conversionText(
                        types.getTypeSentenceForm(
                          getArgumentType(expressions, arg, expression.args[index])
                        ),
                        types.getTypeSentenceForm(expression.args[index].ui_type)
                      )
                    : fixedArgs[index].types_mismatch === true
                      ? 'Cleared, not converted'
                      : 'No conversion needed'
                }
                disabled={!arg.types_mismatch}
                onClick={() => handleArgToggle(fixedArgs[index])}
                intent={arg.types_mismatch ? 'pending' : undefined}
                minimal
              >
                {expression.args[index].display_name}
              </ReqoreButton>
            ))}
          </ReqoreControlGroup>
          <ReqoreP style={{ textAlign: 'center' }} size='small' intent='muted'>
            {size(fixedArgs.filter((a) => a.types_mismatch === false))} argument(s) will be
            transformed.
          </ReqoreP>
        </ReqoreControlGroup>
      </ReqoreModal>
    );
  }
);
