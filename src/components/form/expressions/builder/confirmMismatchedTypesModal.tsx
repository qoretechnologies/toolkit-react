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

/**
 * How wide a type confirmation is: as wide as its title and its three buttons, not reqore's 80% of the screen, which
 * stretched a few short lines across a wide one (Foxhoundn, qlip #400: "Please make the dialog narrower"). On a
 * screen narrower than that, the screen's width.
 */
export const CONFIRM_DIALOG_WIDTH = 560;
export const CONFIRM_DIALOG_WIDTH_CSS = `min(${CONFIRM_DIALOG_WIDTH}px, 100vw)`;

/* Its three buttons are its answers: each is always there, by its name, never folded into a menu. The bar's two
   responsive groups split its width in half, and in a dialog this narrow "Accept all" folded into the "...". */
const ANSWER = { responsive: false } as const;

/** How many arguments will be transformed, in words: "1 argument will be transformed." */
export const transformedCountText = (count: number): string =>
  `${count} ${count === 1 ? 'argument' : 'arguments'} will be transformed.`;

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
        width={CONFIRM_DIALOG_WIDTH_CSS}
        {...rest}
        customZIndex={1000000}
        bottomActions={[
          {
            position: 'left',
            ...ANSWER,
            label: 'Discard all',
            icon: 'CloseLine',
            // it clears every argument's value: a discard (BRAND_DESIGN §7)
            intent: 'danger',
            onClick: () => {
              onSubmit(args.map(() => ({})));
            },
          },
          {
            position: 'right',
            ...ANSWER,
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
            ...ANSWER,
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
        {/* read as a dialog's text is read: from the left, as the arguments listed under it are */}
        <ReqoreControlGroup vertical fluid gapSize='big'>
          <ReqoreP>
            These values have other types than expected. Qorus converts them when it runs.
          </ReqoreP>
          <ReqoreP>Please deselect the arguments you do not wish to transform:</ReqoreP>
          <ReqoreControlGroup vertical fluid>
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
          <ReqoreP size='small' intent='muted'>
            {transformedCountText(size(fixedArgs.filter((a) => a.types_mismatch === false)))}
          </ReqoreP>
        </ReqoreControlGroup>
      </ReqoreModal>
    );
  }
);
