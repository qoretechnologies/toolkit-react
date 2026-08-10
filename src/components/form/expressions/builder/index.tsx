import {
  ReqoreControlGroup,
  ReqoreErrorBoundary,
  ReqoreMessage,
  ReqoreP,
  ReqorePanel,
  ReqorePanelSkeleton,
  ReqoreSpinner,
  ReqoreTag,
  ReqoreVerticalSpacer,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import {
  TReqoreEffectColor,
  TReqoreHexColor,
} from '@qoretechnologies/reqore/dist/components/Effect';
import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { clone, cloneDeep, get, isArray, set, size, unset } from 'lodash';
import { darken, rgba } from 'polished';
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { areQorusTypesCompatible, getArgumentType } from '../../../../helpers/expressions';
import { findTemplate } from '../../../../helpers/templates';
import { validateField, validateFieldWithResult } from '../../../../helpers/validations';
import { IQorusTypeObject, useQorusTypes } from '../../../../hooks/useQorusTypes';
import { useReqraftStorage } from '../../../../hooks/useStorage/useStorage';
import { useTemplates } from '../../../../hooks/useTemplates';
import { AutoFormField as auto } from '../../fields/auto/AutoFormField';
import { SelectFormField as Select } from '../../fields/select/Select';
import { TCustomTemplateItems, TemplateField } from '../../fields/template/TemplateField';
import {
  ExpressionDefaultValue,
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
} from '../types';
import { useExpressions } from '../useExpressions';
import { ExpressionArgumentDetail } from './argumentDetail';
import { ExpressionBuilderArgumentWrapper } from './argumentWrapper';
import { ConfirmMismatchedTypesModal } from './confirmMismatchedTypesModal';
import { ConfirmUnsupportedTypeModal } from './confirmUnsupportedTypeModal';
import { ExpressionItem } from './item';
import { ExpressionRenderTemplate } from './renderTemplate';

const noopUseRegisterHintView = (...args: unknown[]): void => {
  void args;
};

export interface IExpressionBuilderProps {
  localTemplates?: IReqoreFormTemplates;
  value?: IExpression;
  isChild?: boolean;
  level?: number;
  type?: string;
  path?: string;
  index?: number;
  returnType?: TQorusType | TQorusType[];
  group?: '&&' | '||';
  onChange?: (value: IExpression, remove?: boolean) => void;
  onValueChange?: (value: IExpression, path: string, remove?: boolean) => void;
  readOnly?: boolean;
  id?: string;
  expressions?: IExpressionSchema[];
  expressionsUrl?: string;
  serverHandled?: boolean;
  size?: string;
  /**
   * SEAM (reqraft): extra hover actions prepended to each expression card —
   * where the IDE renders its `AiAssistanceAction` (AI-assist button). The
   * button itself depends on IDE-only AI infrastructure, so reqraft exposes
   * the slot and the consumer (the IDE) injects it.
   *
   * Pass a factory to get the per-card context the IDE's AI button needs
   * (`selectedExpression` — the catalogue schema of the function chosen in
   * that card — and the card's `value`), mirroring how the IDE builds
   * `AiAssistanceAction({ context: selectedExpression, ... })` inline.
   */
  extraActions?:
    | IReqorePanelAction[]
    | ((context: {
        selectedExpression?: IExpressionSchema;
        value?: IExpression;
      }) => IReqorePanelAction[]);
}

const StyledExpressionItemLabel = styled.div`
  position: absolute;
  text-orientation: upright;
  writing-mode: vertical-rl;
  top: calc(50%);
  transform: translateY(-50%);
  white-space: nowrap;
  height: calc(100% - 24px);
  // Centered flex
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid ${() => rgba('#fff', 0.3)};
`;

export interface IExpressionProps extends IExpressionBuilderProps {}

export const Expression = ({
  localTemplates,
  value = ExpressionDefaultValue,
  isChild,
  index,
  type,
  level,
  path,
  onValueChange,
  group,
  returnType,
  readOnly,
  id,
  expressionsUrl,
  serverHandled,
  extraActions,
  ...props
}: IExpressionProps) => {
  const types = useQorusTypes();
  const [showSummary, setShowSummary] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<
    | {
        isOpen: boolean;
        acceptedTypes: string[];
        children?: React.ReactNode;
        onConfirm: () => void;
        onCancel?: () => void;
        confirmText?: string;
        cancelText?: string;
      }
    | undefined
  >(undefined);
  const [doNotShowTypeConfirmation] = useReqraftStorage<boolean>(
    'doNotShowTypeExpressionConfirmation',
    false,
    true
  );

  const [firstArgument, ...rest] = value.value?.args || [];

  const _expressions = useExpressions({
    allow: true,
    expressionsUrl,
    // SEAM (reqraft): the catalogue is provided whole (by ExpressionField /
    // stories), so it overrides the fetch rather than merging as "extras".
    // When undefined, useExpressions fetches the live catalogue.
    override: props.expressions,
  });
  const expressions = useMemo(
    () => ({
      ..._expressions,
      value: _expressions.expressions || [],
    }),
    [_expressions]
  );

  const selectedExpression = useMemo(
    () => expressions.value?.find((exp) => exp.name === value.value?.exp),
    [JSON.stringify(value), JSON.stringify(expressions.value)]
  );

  // SEAM (reqraft): resolve the consumer-injected hover actions. A factory
  // gets this card's context — exactly what the IDE's `AiAssistanceAction`
  // captured when it was built inline here.
  const resolvedExtraActions = useMemo<IReqorePanelAction[]>(
    () =>
      typeof extraActions === 'function'
        ? extraActions({ selectedExpression, value })
        : (extraActions ?? []),
    [extraActions, selectedExpression, JSON.stringify(value)]
  );

  // If the `return_type_first_arg` is set, we need to get the return type from the first arguments type
  const expressionReturnType = useMemo(() => {
    if (selectedExpression?.return_type_first_arg && firstArgument) {
      if (firstArgument.is_expression && firstArgument.value?.exp) {
        const firstArgExpression = expressions.value?.find(
          (exp) => exp.name === firstArgument.value.exp
        );

        return firstArgExpression?.ui_return_type;
      }

      return firstArgument.type;
    }

    return selectedExpression?.ui_return_type;
  }, [
    JSON.stringify(selectedExpression),
    JSON.stringify(firstArgument),
    returnType,
    JSON.stringify(expressions.value),
  ]);
  const expectedReturnTypeText = isArray(returnType)
    ? returnType.map(types.getTypeDisplayName).join(' or ')
    : types.getTypeDisplayName(returnType);

  // Server Handler expressions is either defined by the option
  // then it's always the first level
  // Or if the first argument is a field (data_role: 'record') or the first selected expression is
  // a server expression
  const isFirstArgumentField =
    findTemplate(localTemplates, firstArgument?.value)?.metadata?.dataRole === 'record';
  const isExpressionServerHandled =
    selectedExpression?.from_server ||
    (selectedExpression?.from_both && isFirstArgumentField) ||
    (level === 0 && serverHandled);
  const serverExpression = isFirstArgumentField || isExpressionServerHandled;
  const qorusExpression = selectedExpression && !serverExpression;
  const serverAndQorusExpression = selectedExpression?.from_both;

  const updateType = useCallback(
    (val: string, conformsCurrentType?: boolean) => {
      if (conformsCurrentType) {
        onValueChange(
          {
            ...value,
            value: {
              ...value.value,
              args: [
                {
                  ...value.value.args[0],
                  type: val,
                },
                ...value.value.args.slice(1),
              ],
            },
          },
          path
        );

        return;
      }

      onValueChange(
        {
          value: {
            args: [
              {
                type: val,
              },
            ],
          },
        },
        path
      );
    },
    [onValueChange, JSON.stringify(value), path]
  );

  const addMissingArgs = useCallback(
    (expression: string, args: IExpression[] = []): IExpression[] => {
      const newArgs = [...args];
      // Check if this expression has variable arguments
      const selectedExpression = expressions.value?.find((exp) => exp.name === expression);

      if (selectedExpression.varargs) {
        if (selectedExpression.subtype === 2) {
          newArgs.push({
            is_expression: true,
            value: {
              args: [],
            },
          });
        } else {
          // Add the number of arguments equal to min_args - 1
          newArgs.push(
            ...Array.from({ length: selectedExpression.min_args - 1 }, () => ({
              type:
                selectedExpression.args[0].ui_type === 'richtext' ||
                selectedExpression.args[0].ui_type === 'number'
                  ? selectedExpression.args[0].ui_type
                  : undefined,
            }))
          );
        }
      } else {
        // Check if any of the arguments have a default value
        selectedExpression.args.forEach((arg, index) => {
          if (
            newArgs[index] === undefined ||
            size(newArgs[index]) === 0 ||
            (arg.default_value && 'value' in newArgs[index] === false)
          ) {
            if (arg.default_value) {
              newArgs[index] = {
                value: arg.default_value,
                type: arg.ui_type,
              };
            } else {
              newArgs[index] = {
                type:
                  arg.ui_type === 'richtext' || arg.ui_type === 'number' || arg.ui_type === 'bool'
                    ? arg.ui_type
                    : undefined,
              };
            }
          }
        });
      }

      return newArgs;
    },
    [JSON.stringify(expressions.value)]
  );

  const updateExp = useCallback(
    (val: string) => {
      // We need to get the new expression data and its arguments to see if we need to reset any of the arguments
      const newExpression = expressions.value?.find((exp) => exp.name === val);
      const newArgs = [];

      newExpression.args.forEach((arg, index) => {
        const argumentType = getArgumentType(expressions.value, value.value?.args[index], arg);

        if (argumentType) {
          // We need to check if the first argument type conforms to the new expression first argument type
          // 1) If it matches directly (matches `ui_type` on the argument), we are good
          // 2) If it matches inside `types_accepted` of the server type (ui_type of the arg),
          // we are also good, but we need to let the user know that transformation may occur
          // 3) If the type does not match, we need to reset the first argument type and value
          const exactMatch = types.getExactMatches(arg.ui_type);
          const acceptedTypes = types.getAcceptedTypes(arg.ui_type);

          // If the types match exactly
          if (exactMatch.includes(argumentType) || exactMatch.includes('any')) {
            // All good, do nothing
            newArgs.push(value.value.args[index]);
          } else if (acceptedTypes.includes(argumentType) || acceptedTypes.includes('any')) {
            // If the types is accepted but not exact, we need to show a confirmation dialog, but we will still
            // add the argument and then later in the confirmation we will decide to keep it or not
            newArgs.push({
              ...value.value.args[index],
              types_mismatch: true,
            });
          } else {
            // Type does not conform, we need to reset the argument
            newArgs.push({});
          }
        } else {
          // If there is no type set, we can just add the argument as is
          newArgs.push(value.value.args[index]);
        }
      });

      onValueChange(
        {
          ...value,
          value: {
            ...value.value,
            exp: val,
            args: addMissingArgs(val, newArgs),
          },
        },
        path
      );
    },
    [addMissingArgs, onValueChange, JSON.stringify(value), path, types.value]
  );

  const wrapExpression = useCallback(
    (expression: string) => {
      onValueChange(
        {
          value: {
            exp: expression,
            args: addMissingArgs(expression, [value]),
          },
          is_expression: true,
        },
        path
      );
    },
    [onValueChange, JSON.stringify(value), path, addMissingArgs]
  );

  const unwrapExpression = useCallback(() => {
    onValueChange(value.value.args[0], path);
  }, [onValueChange, JSON.stringify(value), path]);

  const updateExpToAndOr = useCallback(
    (val: '&&' | '||') => {
      onValueChange(
        {
          value: {
            exp: val,
            args: [value, ExpressionDefaultValue],
          },
          is_expression: true,
        },
        path
      );
    },
    [onValueChange, JSON.stringify(value), path]
  );

  const removeVarArg = useCallback(
    (index: number) => {
      const args = value.value.args.filter((_, i) => i !== index);

      onValueChange(
        {
          ...value,
          value: {
            ...value.value,
            args,
          },
        },
        path
      );
    },
    [onValueChange, JSON.stringify(value), path]
  );

  const updateMultipleArgs = useCallback(
    (args: IExpression[]) => {
      onValueChange(
        {
          ...value,
          value: {
            ...value.value,
            args: addMissingArgs(value.value.exp, args),
          },
        },
        path
      );
    },
    [onValueChange, JSON.stringify(value), path, addMissingArgs]
  );

  const updateArg = useCallback(
    (
      val: any,
      index: number = 0,
      type?: string,
      isFunction?: boolean,
      isRequired?: boolean
    ) => {
      const args = clone(value.value.args);
      const newVal = clone(val);

      if (newVal?.exp) {
        newVal.args = addMissingArgs(newVal.exp, newVal.args);
      }

      args[index] = {
        ...args[index],
        value: newVal,
        type: !isFunction ? type || args[index]?.type : undefined,
        is_expression: isFunction,
        required: isRequired,
      };

      onValueChange(
        {
          ...value,
          value: {
            ...value.value,
            args,
          },
        },
        path
      );
    },
    [addMissingArgs, onValueChange, JSON.stringify(value), path]
  );

  const handleRemoveClick = useCallback(() => {
    onValueChange?.(undefined, path, true);
  }, [onValueChange, path]);

  const firstArgSchema = selectedExpression?.args[0];
  const firstParamType = firstArgument?.is_expression
    ? firstArgSchema?.ui_type
    : firstArgument?.type || type || 'context';
  let restOfArgs = selectedExpression?.args.slice(1);

  if (selectedExpression?.varargs) {
    restOfArgs = [
      ...restOfArgs,
      ...rest.map(() => ({
        ...selectedExpression.args[0],
      })),
    ];
  }

  const isReturnTypeMatching =
    expressionReturnType === 'any' ||
    (isArray(returnType)
      ? areQorusTypesCompatible(returnType, expressionReturnType)
      : returnType === 'auto' ||
        returnType === 'any' ||
        returnType === 'context' ||
        expressionReturnType === 'any' ||
        areQorusTypesCompatible(returnType, expressionReturnType) ||
        returnType === expressionReturnType ||
        !returnType);

  const defaultItems = useMemo(
    () =>
      expressions.value
        .map((exp) => ({
          name: exp.name,
          value: exp.name,
          display_name: exp.display_name,
          short_desc: exp.short_desc,
          desc: exp.desc,
          badge: exp.symbol,
          from_server: exp.from_server,
          from_both: exp.from_both,
          groups: exp.groups,
        }))
        .filter((exp) =>
          serverExpression
            ? exp.from_server || exp.from_both
            : firstArgument?.value && !isFirstArgumentField
              ? !exp.from_server
              : true
        ),
    [JSON.stringify(expressions.value), serverExpression, level]
  );

  // SEAM (reqraft): reqraft's `SelectFormField` calls `onChange(value)` with
  // the value directly (the IDE's Select used `(name, value)`).
  const handleOperatorChange = useCallback(
    (value: unknown) => {
      updateExp(value as string);
    },
    [updateExp]
  );

  const handleAddArgumentClick = useCallback(() => {
    updateArg(undefined, size(value.value.args), undefined, false);
  }, [updateArg, JSON.stringify(value)]);

  const handleWrapExpressionClick = useCallback(
    (value: unknown) => {
      wrapExpression(value as string);
    },
    [wrapExpression]
  );

  const handleUpdateExpToAnd = useCallback(() => {
    updateExpToAndOr('&&');
  }, [updateExpToAndOr]);

  const handleUpdateExpToOr = useCallback(() => {
    updateExpToAndOr('||');
  }, [updateExpToAndOr]);

  const handleUpdateTypeChange = useCallback(
    (value) => {
      updateType(value === 'context' ? undefined : value, true);
    },
    [updateType]
  );

  const handleFirstParamChange = useCallback(
    (_name, value, type, isFunction) => {
      if (isFunction || (type !== 'any' && type !== 'auto')) {
        updateArg(
          value,
          0,
          isFunction ? undefined : type,
          isFunction,
          selectedExpression?.args?.[0]?.required
        );
      }
    },
    [updateArg, JSON.stringify(selectedExpression)]
  );

  const buildCustomTemplateItems = useCallback(
    (
      arg: IExpressionSchemaArg,
      onClick: (type: IQorusTypeObject, removeTemplate: () => void) => void
    ) => {
      // If the argument has allowed values or element allowed values, do not allow type changing
      if (arg?.allowed_values || arg?.element_allowed_values) {
        return [];
      }
      // For every type in the types we need to check if it matches a type in the args accepted types
      // We need to sort these types at the top, and but the rest at the bottom with a warning intent
      const serverAcceptedTypes = types.getAcceptedTypes(arg?.ui_type);
      const acceptedTypes = types.compactValue?.filter(
        (type) =>
          !arg || serverAcceptedTypes.includes(type.name) || serverAcceptedTypes.includes('any')
      );

      const otherTypes = types.compactValue?.filter(
        (type) =>
          arg && !serverAcceptedTypes.includes(type.name) && !serverAcceptedTypes.includes('any')
      );

      let result: TCustomTemplateItems = [];

      if (size(acceptedTypes)) {
        result = acceptedTypes?.map((type) => ({
          label: type.display_name,
          description: type.short_desc,
          minimal: true,
          onClick: (_e, removeTemplate) => {
            removeTemplate?.();
            onClick?.(type, removeTemplate);
          },
        }));
      }

      if (size(otherTypes)) {
        result = [
          ...result,
          {
            isDivider: true,
            line: true,
          },
          ...(otherTypes?.map((type) => ({
            label: type.display_name,
            description: type.short_desc,
            minimal: true,
            intent: 'warning',
            onClick: (_e, removeTemplate) => {
              if (doNotShowTypeConfirmation) {
                removeTemplate?.();
                onClick?.(type, removeTemplate);
                return;
              }

              setConfirmDialogData({
                isOpen: true,
                acceptedTypes: serverAcceptedTypes,
                onConfirm: () => {
                  removeTemplate?.();
                  onClick?.(type, removeTemplate);
                },
              });
            },
          })) as TCustomTemplateItems),
        ];
      }

      return result;
    },
    [types?.compactValue]
  );

  const hasArgumentsWithTypeMismatch = useMemo(() => {
    return value.value?.args?.some((arg) => arg?.types_mismatch);
  }, [JSON.stringify(value)]);

  // The type hook is seeded with the complete built-in catalogue and refreshes
  // it in the background.  Do not hide an otherwise usable expression behind
  // a skeleton while that optional refresh is in flight.
  if (expressions.loading || (types.loading && !size(types.value))) {
    return <ReqorePanelSkeleton size='small' />;
  }

  const validationData = validateFieldWithResult('expression', value, {
    expressions: expressions.value,
  });

  return (
    <ExpressionItem
      index={index}
      as={ReqorePanel}
      intent={validationData.isValid && !!returnType && isReturnTypeMatching ? 'muted' : 'danger'}
      description={
        isExpressionServerHandled ? 'This expression will be executed outside of Qorus' : ''
      }
      flat
      readOnly={readOnly}
      minimal
      size='small'
      isChild={isChild}
      className='expression'
      customTheme={{
        main: `main:darken:${level}` as TReqoreEffectColor,
      }}
      id={id}
      label={
        <Select
          size='tiny'
          className='expression-operator-selector'
          value={value?.value?.exp}
          icon='Functions'
          placeholder='Select operation'
          fluid={false}
          fixed={true}
          flat
          // The operation catalogue is long and every entry carries a description,
          // so it belongs in the searchable collection modal rather than an inline
          // dropdown. `SelectFormField` defaults `forceDropdown` to `true`, which
          // would otherwise collapse this picker into the dropdown presentation.
          forceDropdown={false}
          minimal
          items={defaultItems}
          onChange={handleOperatorChange}
          showDescription='tooltip'
          disabled={readOnly}
          id='expression-builder-select-function'
        />
      }
      style={{
        marginLeft: isChild ? 10 : undefined,
        borderStyle: 'dashed',
        flexShrink: 1,
      }}
      contentStyle={{
        overflowX: 'hidden',
      }}
      floatingActions
      actions={[
        // SEAM (reqraft): the IDE renders `AiAssistanceAction` first here;
        // consumers inject it (or anything else) via `extraActions`.
        ...resolvedExtraActions,
        {
          className: 'expression-add-arg',
          tooltip: 'Add argument',
          icon: 'AddCircleLine',
          fixed: true,
          disabled: !validateField('expression', value, {
            expressions: expressions.value,
          }),
          onClick: handleAddArgumentClick,
          show: !!selectedExpression && selectedExpression.varargs === true && !readOnly,
        },
        {
          as: Select,
          show: readOnly ? false : 'hover',
          props: {
            className: 'expression-wrap',
            id: 'expression-builder-wrap',
            placeholder: 'Wrap',
            icon: 'Functions',
            showRightIcon: false,
            fluid: false,
            transparent: false,
            fixed: true,
            minimal: false,
            // Same catalogue as the operation selector above — keep the collection
            // modal rather than the `forceDropdown` default's inline dropdown.
            forceDropdown: false,
            items: defaultItems,
            hideItemCount: true,
            onChange: handleWrapExpressionClick,
            showDescription: 'tooltip',
            tooltip: 'Wrap this expression in another expression',
            size: 'tiny',
          },
        },
        {
          className: 'expression-unwrap',
          label: 'Remove',
          textAlign: 'center',
          icon: 'CloseLine',
          tooltip: 'Remove this expression but keep the children',
          fixed: true,
          onClick: unwrapExpression,
          show: value.value?.args?.[0]?.is_expression === true && !readOnly ? 'hover' : false,
        },
        {
          className: 'expression-explain',
          label: showSummary ? 'Hide Explanation' : 'Explain',
          show: level === 0,
          onClick: () => setShowSummary(!showSummary),
          icon: 'InformationLine',
          tooltip: showSummary
            ? 'Hide explanation of this expression'
            : 'Show explanation of this expression',
          fixed: true,
        },
        {
          className: 'expression-group-remove',
          intent: 'danger',
          textAlign: 'center',
          icon: 'DeleteBinLine',
          tooltip: 'Remove this expression and its children',
          fixed: true,
          minimal: true,
          show: readOnly ? false : 'hover',
          onClick: handleRemoveClick,
        },
      ]}
      bottomActions={[
        {
          show: !!selectedExpression && areQorusTypesCompatible('bool', returnType) && !readOnly,
          group: [
            {
              flat: true,
              className: 'expression-and',
              label: 'AND',
              textAlign: 'center',
              icon: 'AddLine',
              fixed: true,
              compact: true,
              size: 'tiny',
              show: (!group || group === '||') && !readOnly,
              onClick: handleUpdateExpToAnd,
            },
            {
              flat: true,
              className: 'expression-or',
              label: 'OR',
              textAlign: 'center',
              icon: 'AddLine',
              show: (!group || group === '&&') && !readOnly,
              fixed: true,
              compact: true,
              size: 'tiny',
              onClick: handleUpdateExpToOr,
            },
          ],
        },
      ]}
    >
      {hasArgumentsWithTypeMismatch && (
        <ConfirmMismatchedTypesModal
          args={value.value?.args}
          expression={selectedExpression}
          onSubmit={updateMultipleArgs}
          expressions={expressions.value}
        />
      )}
      {confirmDialogData?.isOpen && (
        <ConfirmUnsupportedTypeModal
          acceptedTypes={confirmDialogData.acceptedTypes}
          onClose={() => {
            setConfirmDialogData(undefined);
          }}
          maxSize='550px'
          bottomActions={[
            {
              label: confirmDialogData?.cancelText || 'Cancel',
              onClick: () => {
                confirmDialogData?.onCancel?.();
                setConfirmDialogData(undefined);
              },
              icon: 'CloseFill',
              minimal: true,
            },
            {
              label: confirmDialogData?.confirmText || 'Confirm',
              intent: 'warning',
              icon: 'CheckFill',
              minimal: true,
              position: 'right',
              onClick: () => {
                confirmDialogData.onConfirm?.();
                setConfirmDialogData(undefined);
              },
            },
          ]}
        >
          {confirmDialogData.children}
        </ConfirmUnsupportedTypeModal>
      )}
      {showSummary && <ExpressionRenderTemplate exp={value} expressions={expressions.value} />}
      {!selectedExpression && !serverExpression && !firstArgument?.value && level === 0 ? (
        <ReqoreMessage size='small' opaque={false} intent='info'>
          Select an operation to start building your expression
        </ReqoreMessage>
      ) : (
        <ReqoreControlGroup
          fluid={false}
          style={{ maxWidth: '100%' }}
          wrap
          verticalAlign='flex-start'
          size='normal'
          gapSize='big'
        >
          {firstArgSchema?.label_before && (
            <ExpressionArgumentDetail label={firstArgSchema.label_before} />
          )}
          <ExpressionBuilderArgumentWrapper
            expressions={expressions.value}
            arg={firstArgument}
            schema={firstArgSchema}
            onTypeChange={handleUpdateTypeChange}
            readOnly={readOnly}
          >
            <TemplateField
              component={auto}
              minimal
              label={
                serverAndQorusExpression
                  ? 'Select Template Or Field'
                  : serverExpression
                    ? 'Select Field'
                    : qorusExpression
                      ? 'Select Template'
                      : 'Select Template Or Field'
              }
              allowFunctions={
                !serverExpression &&
                !!selectedExpression &&
                !firstArgSchema?.allowed_values &&
                !firstArgSchema?.element_allowed_values
              }
              level={level + 1}
              key={`${firstParamType}${selectedExpression?.name}`}
              type={firstParamType}
              defaultType={
                firstArgument?.allowed_values || firstArgument?.element_allowed_values
                  ? firstArgument?.type.base_type
                  : firstParamType
              }
              returnType={types.getAcceptedTypes(firstArgSchema?.ui_type) as any}
              value={firstArgument?.value}
              isFunction={firstArgument?.is_expression}
              onChange={handleFirstParamChange as any}
              templates={localTemplates}
              allowTemplates
              filterTemplatesByType={false}
              allowCustomValues={
                !!firstArgument?.allowed_values ||
                !!firstArgument?.element_allowed_values ||
                (!!firstArgument?.type && !serverExpression)
              }
              filterTemplatesFunc={(templates) => {
                // PORT NOTE: `?.` on `items` added — with no templates at all
                // (FormEngine with templates off) the IDE original crashes on
                // `{}.items.filter`.
                const filteredTemplates = templates?.items?.filter((item) => {
                  return serverExpression ? item.metadata?.dataRole === 'record' : true;
                });

                return {
                  ...templates,
                  items: filteredTemplates,
                };
              }}
              fluid={false}
              fixed={true}
              disableManagement
              disabled={readOnly}
              allowed_values={firstArgSchema?.allowed_values}
              element_allowed_values={firstArgSchema?.element_allowed_values}
              menuItems={
                isExpressionServerHandled
                  ? undefined
                  : buildCustomTemplateItems(firstArgSchema, (type, removeTemplate) => {
                      removeTemplate?.();
                      updateArg(
                        undefined,
                        0,
                        type.name === 'context' ? undefined : (type.name as string)
                      );
                    })
              }
              expressions={props.expressions as any}
              expressions_url={expressionsUrl}
            />
          </ExpressionBuilderArgumentWrapper>
          {firstArgSchema?.label_after && (
            <ExpressionArgumentDetail label={firstArgSchema.label_after} />
          )}
          {selectedExpression
            ? restOfArgs?.map((arg, index) => (
                <React.Fragment key={`${index}-${arg.ui_type}-${arg.display_name}`}>
                  {arg?.label_before && <ExpressionArgumentDetail label={arg.label_before} />}
                  <ExpressionBuilderArgumentWrapper
                    readOnly={readOnly}
                    expressions={expressions.value}
                    arg={{
                      ...rest[index],
                      type: getArgumentType(expressions.value, rest[index], arg),
                    }}
                    schema={arg}
                    onTypeChange={(value) => {
                      updateArg(
                        undefined,
                        index + 1,
                        value === 'context' ? undefined : (value as string)
                      );
                    }}
                    onRemoveArgClick={() => {
                      removeVarArg(index + 1);
                    }}
                    hasMultipleArgs={selectedExpression.varargs && size(rest) > 1}
                  >
                    <TemplateField
                      minimal
                      component={auto}
                      noSoft
                      level={level + 1}
                      allowFunctions={!arg?.allowed_values && !arg?.element_allowed_values}
                      isFunction={rest[index]?.is_expression}
                      key={`${index}-${arg.ui_type}-${arg.display_name}-${level + 1}`}
                      type={rest[index]?.type}
                      defaultType={
                        arg.allowed_values || arg.element_allowed_values
                          ? arg.ui_type
                          : rest[index]?.type
                      }
                      returnType={types.getAcceptedTypes(arg.ui_type) as any}
                      canBeNull={false}
                      value={rest[index]?.value}
                      templates={localTemplates}
                      allowTemplates={!arg?.allowed_values && !arg?.element_allowed_values}
                      filterTemplatesByType={false}
                      allowCustomValues={
                        !!arg.allowed_values ||
                        !!arg.element_allowed_values ||
                        !!rest[index]?.type ||
                        !!arg.default_value
                      }
                      onChange={((_name, value, type, isFunction) => {
                        updateArg(
                          value,
                          index + 1,
                          isFunction ? undefined : type,
                          isFunction,
                          arg.required
                        );
                      }) as any}
                      fluid={false}
                      fixed={true}
                      disableManagement
                      disabled={readOnly}
                      menuItems={buildCustomTemplateItems(arg, (type, removeTemplate) => {
                        removeTemplate?.();
                        updateArg(
                          undefined,
                          index + 1,
                          type.name === 'context' ? undefined : (type.name as string)
                        );
                      })}
                      expressions={props.expressions as any}
                      expressions_url={expressionsUrl}
                      allowed_values={arg?.allowed_values}
                      element_allowed_values={arg?.element_allowed_values}
                      ui_element_type={(arg as any)?.ui_element_type}
                    />
                  </ExpressionBuilderArgumentWrapper>
                  {arg?.label_after && <ExpressionArgumentDetail label={arg.label_after} />}
                </React.Fragment>
              ))
            : null}
        </ReqoreControlGroup>
      )}
      {!isReturnTypeMatching && (
        <>
          <ReqoreVerticalSpacer height={5} />
          <ReqoreTag
            minimal
            icon='ErrorWarningLine'
            intent='danger'
            size='tiny'
            wrap
            label={`This expression returns ${types.getTypeDisplayName(expressionReturnType) || 'nothing'} but the expected return type is ${expectedReturnTypeText}. Please select an expression that returns ${expectedReturnTypeText} or wrap this expression inside another one that does.`}
          />
        </>
      )}
      {selectedExpression && !validationData.isValid ? (
        <>
          <ReqoreVerticalSpacer height={5} />
          <ReqoreTag
            minimal
            icon='ErrorWarningLine'
            intent='danger'
            size='tiny'
            wrap
            label={validationData.reason || 'Expression is not valid for unknown reasons'}
          />
        </>
      ) : null}
    </ExpressionItem>
  );
};

export const ExpressionBuilder = ({
  localTemplates,
  value = ExpressionDefaultValue,
  isChild,
  level = 0,
  index = 0,
  path,
  type,
  returnType,
  group,
  onChange,
  onValueChange,
  readOnly,
  expressions,
  expressionsUrl,
  serverHandled,
  extraActions,
}: IExpressionBuilderProps) => {
  const templates = useTemplates(!isChild, localTemplates);
  const theme = useReqoreTheme();
  const [showSummary, setShowSummary] = useState(false);
  const _expressions = useExpressions({
    allow: true,
    expressionsUrl,
    // SEAM (reqraft): the catalogue is provided whole; override the fetch
    // (and thread it through the group recursion above) so offline stories /
    // CI are deterministic.
    override: expressions,
  });

  noopUseRegisterHintView('expression_builder', level === 0 && index === 0);

  const handleChange = useCallback(
    (newValue: IExpression, newPath: string, remove?: boolean) => {
      if (onChange) {
        if (!newPath) {
          onChange(newValue, remove);
          return;
        }

        const clonedValue = cloneDeep(value);

        if (remove) {
          unset(clonedValue, newPath);
          const pathArray = newPath.split('.');

          pathArray.pop();

          const parentPath = pathArray.join('.');
          let parent = get(clonedValue, parentPath);

          parent = parent.filter((item: any) => item);

          if (size(parent) === 1) {
            pathArray.pop();

            const grandParentPath = pathArray.join('.');

            if (grandParentPath === '') {
              onChange(parent[0].value, remove);
              return;
            }

            set(clonedValue, grandParentPath, parent[0].value);
          } else {
            set(clonedValue, parentPath, parent);
          }
        } else {
          set(clonedValue, newPath, newValue);
        }

        onChange(clonedValue, remove && !newPath);
      } else if (onValueChange) {
        onValueChange(newValue, newPath, remove);
      }
    },
    [JSON.stringify(value), onChange, onValueChange]
  );

  if (templates.loading) {
    return (
      <ReqoreSpinner type={5} size='normal'>
        Loading...
      </ReqoreSpinner>
    );
  }

  if (
    value.is_expression &&
    value.value &&
    (value.value?.exp === '&&' || value.value?.exp === '||')
  ) {
    return (
      <ReqoreErrorBoundary>
        <ExpressionItem
          index={index}
          as={ReqorePanel}
          isChild={isChild}
          isAndOr
          minimal
          readOnly={readOnly}
          size='small'
          flat
          customTheme={{
            main: darken(`0.0${level * 25}`, theme.main) as TReqoreHexColor,
          }}
          label={isChild ? (value.value.exp === '||' ? 'OR group' : 'AND group') : 'IF group'}
          style={{
            marginLeft: isChild ? 10 : 0,
          }}
          actions={[
            {
              icon: 'AddCircleLine',
              show: !readOnly,
              onClick: () => {
                handleChange(
                  ExpressionDefaultValue,
                  `${path ? `${path}.` : ''}value.args.${size(value.value.args)}`
                );
              },
              tooltip: 'Add condition parameter',
            },
            {
              className: 'expression-explain',
              label: showSummary ? 'Hide Explanation' : 'Explain',
              show: level === 0,
              onClick: () => setShowSummary(!showSummary),
              icon: 'InformationLine',
              tooltip: showSummary
                ? 'Hide explanation of this expression'
                : 'Show explanation of this expression',
              fixed: true,
            },
          ]}
        >
          <ReqoreControlGroup vertical fluid size='normal' style={{ position: 'relative' }} wrap>
            {showSummary && (
              <ExpressionRenderTemplate exp={value} expressions={_expressions.expressions} />
            )}
            <StyledExpressionItemLabel
              as={ReqoreP}
              color='transparent'
              className='expression-operator'
            ></StyledExpressionItemLabel>
            {value.value.args?.map((arg, index) => (
              <React.Fragment key={index}>
                <ExpressionBuilder
                  value={arg}
                  localTemplates={templates.value}
                  isChild
                  path={`${path ? `${path}.` : ''}value.args.${index}`}
                  level={level + 1}
                  index={index}
                  type={type}
                  onValueChange={handleChange}
                  returnType='bool'
                  group={value.value.exp}
                  readOnly={readOnly}
                  expressions={expressions}
                  expressionsUrl={expressionsUrl}
                  serverHandled={serverHandled}
                  extraActions={extraActions}
                />
                {index < size(value.value.args) - 1 && (
                  <ExpressionArgumentDetail
                    label={value.value.exp === '||' ? 'OR' : 'AND'}
                    align='left'
                    style={{
                      marginLeft: 10,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </ReqoreControlGroup>
        </ExpressionItem>
      </ReqoreErrorBoundary>
    );
  }

  return (
    <ReqoreErrorBoundary>
      <Expression
        localTemplates={templates.value}
        value={value}
        isChild={isChild}
        type={type}
        returnType={returnType}
        level={level}
        path={path}
        index={index}
        onValueChange={handleChange}
        group={group}
        readOnly={readOnly}
        expressions={expressions}
        expressionsUrl={expressionsUrl}
        id={level === 0 && index === 0 ? 'expression-builder' : undefined}
        serverHandled={serverHandled}
        extraActions={extraActions}
      />
    </ReqoreErrorBoundary>
  );
};
