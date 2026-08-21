// Verbatim port of qorus-ide `src/components/Field/template.tsx` (774 LOC,
// FIELD_STACK_REPORT batch) — keep edits to the documented seams (leaf-API
// onChange adapters, the reqraft `useExpressions` signature, dropped
// SaveValueButton / useGetAppActionData). Full seam list:
// `.tasks/FIELD_STACK_REPORT.md`.
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreErrorBoundary,
  ReqoreMenu,
  ReqoreMenuSection,
  ReqoreMessage,
  ReqorePopover,
  ReqoreSkeleton,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import ReqoreMenuDivider, {
  IReqoreMenuDividerProps,
} from '@qoretechnologies/reqore/dist/components/Menu/divider';
import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import {
  IReqoreFormTemplates,
  IReqoreTextareaProps,
} from '@qoretechnologies/reqore/dist/components/Textarea';
import { IQorusFormFieldSchemaBase, TQorusType } from '@qoretechnologies/ts-toolkit';
import { size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import {
  filterTemplatesByType as templatesFilterFunc,
  findTemplate,
  getTemplateKey,
  getTemplateValue,
  isValueTemplate,
} from '../../../../helpers/templates';
import { getTypeFromValue } from '../../../../helpers/validations';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';
import { useWhyDidYouUpdate } from '../../../../hooks/useWhyDidYouUpdate';
import { ExpressionBuilder } from '../../expressions/builder';
// Direct import — the cycle (TemplateField → ExpressionField → builder →
// TemplateField) is render-time only, safe like the other Field cycles.
import { ExpressionField } from '../../expressions/ExpressionField';
import { IExpression } from '../../expressions/types';
import { useExpressions } from '../../expressions/useExpressions';
import { AutoFormField as Auto, IQorusType as IQorusFormType } from '../auto/AutoFormField';
import BooleanFormField from '../boolean/Boolean';
import { DateFormField } from '../date/Date';
import { ReqraftFileFormField } from '../file/File';
import LongStringFormField from '../long-string/LongString';
import NumberFormField from '../number/Number';
import { ReadOnlyTemplateTag } from './ReadOnlyTemplateTag';
import { RichTextFormField } from '../rich-text/RichText';

// Re-export template utilities for consumers
export { getTemplateKey, getTemplateValue, isValueTemplate };
export type { IQorusFormType as IQorusType };

export const TemplatesListProps: IReqoreDropdownProps = {
  useTargetWidth: true,
  handler: 'focus',
  minWidth: '300px',
  listCustomTheme: {
    main: '#1e0d29',
  },
};

// IDE leaf-field modules take `onChange(name, value)` and a `name` prop;
// reqraft leaf fields are single-arg. These wrappers restore the IDE API for
// the ComponentMap (and the template-string editor below) so the ported
// markup stays verbatim. `type`/`level`/`allowTemplates` are destructured
// only to keep them off the underlying ReQore component / DOM.
/* eslint-disable @typescript-eslint/no-unused-vars */
const LongStringField = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <LongStringFormField {...rest} onChange={(value: string) => onChange?.(name, value)} />
);
const Number = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <NumberFormField {...rest} onChange={(value: number | string) => onChange?.(name, value)} />
);
const BooleanField = ({ name, onChange, value, type, level, allowTemplates, ...rest }: any) => (
  <BooleanFormField
    {...rest}
    checked={!!value}
    onChange={(checked: boolean) => onChange?.(name, checked)}
  />
);
const DateField = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <DateFormField {...rest} onChange={(value: string) => onChange?.(name, value)} />
);
const RichTextField = ({ name, onChange, type, level, ...rest }: any) => (
  <RichTextFormField {...rest} onChange={(value: any) => onChange?.(name, value)} />
);
const FileField = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <ReqraftFileFormField {...rest} onChange={(value: any) => onChange?.(name, value)} />
);
/* eslint-enable @typescript-eslint/no-unused-vars */

export interface ITemplateFieldProps extends Partial<
  Omit<IQorusFormFieldSchemaBase, 'default_value'>
> {
  value?: any;
  name?: string;
  uniqueName?: string;
  label?: string;
  onChange?: (name: string, value: any, type?: TQorusType, isFunction?: boolean) => void;
  // React element
  component?: React.FC<any>;
  interfaceContext?: string;
  allowTemplates?: boolean;
  templates?: IReqoreTextareaProps['templates'];
  componentFromType?: boolean;
  allowCustomValues?: boolean;
  allowFunctions?: boolean;

  filterTemplatesByType?: boolean;
  filterTemplatesFunc?: (templates: IReqoreFormTemplates) => IReqoreFormTemplates;
  returnType?: TQorusType | IQorusFormType[];
  level?: number;
  className?: string;

  isFunction?: boolean;
  isDefaultFunction?: boolean;
  isDefaultTemplate?: boolean;
  menuItems?: TCustomTemplateItems;
  /**
   * SEAM (reqraft, additive): render expression mode through the
   * `ExpressionField` shell — Visual (the ported builder) + Text (the
   * net-new DPQL editor) — instead of the IDE's bare builder. FormEngine
   * turns this on for its (top-level) fields; nested operands (builder
   * arguments, array items) never receive it and stay IDE-verbatim.
   */
  allowTextExpressions?: boolean;
  [key: string]: any;
  default_value?: unknown;
}

export const ComponentMap = {
  string: LongStringField,
  number: Number,
  int: Number,
  float: Number,
  list: LongStringField,
  hash: LongStringField,
  binary: LongStringField,
  bool: BooleanField,
  boolean: BooleanField,
  date: DateField,
  richtext: RichTextField,
  file: FileField,
};

export interface ITemplateDropdownSelectorProps extends IReqoreDropdownProps {
  onRemoveClick?: IReqoreButtonProps['onClick'];
  allowCustomValues?: boolean;
  hasOnlyAllowedValues?: boolean;
  templates?: IReqoreFormTemplates;
  value?: string;
  size?: IReqoreButtonProps['size'];
}

export type TCustomTemplateItems = (
  | (Omit<IReqoreButtonProps, 'onClick'> & {
      onClick?: (e?: React.MouseEvent<HTMLButtonElement>, removeTemplate?: () => void) => void;
    })
  | (IReqoreMenuDividerProps & { isDivider?: true })
)[];

export const CustomMenuItems = memo(
  ({
    items,
    closePopover,
    setIsTemplate,
    setTemplateValue,
    ...rest
  }: {
    items: TCustomTemplateItems | undefined;
    closePopover?: () => void;
    setIsTemplate: React.Dispatch<React.SetStateAction<boolean>>;
    setTemplateValue: React.Dispatch<React.SetStateAction<string | null>>;
  }) => {
    return (
      <ReqoreMenuSection label='Set Custom Value' isCollapsed transparent icon='Text' {...rest}>
        {items.map((menuItem, index) =>
          'isDivider' in menuItem ? (
            <ReqoreMenuDivider key={index} {...menuItem} />
          ) : (
            <ReqoreButton
              {...(rest as any)}
              {...menuItem}
              key={index}
              onClick={(e) => {
                (menuItem as any).onClick?.(e, () => {
                  setIsTemplate(false);
                  setTemplateValue(null);
                  closePopover?.();
                });
              }}
            />
          )
        )}
      </ReqoreMenuSection>
    );
  }
);

export const TemplateDropdownSelector = memo(
  ({
    onItemSelect,
    onRemoveClick,
    items,
    templates,
    allowCustomValues,
    hasOnlyAllowedValues,
    value,
    size,
    ...rest
  }: ITemplateDropdownSelectorProps) => {
    const template = findTemplate(templates, value);
    const label = template?.label || value || rest.label || 'Select Template';
    const leftIconProps = useMemo(
      (): IReqoreButtonProps['leftIconProps'] => ({
        image: template?.metadata?.image,
        icon: 'ExchangeDollarLine',
      }),
      [template]
    );
    // SEAM (reqraft): the IDE resolves the template's app/action via
    // `useGetAppActionData` and renders the action's display name as a badge
    // here — the app catalogue is IDE-only, so the badge is dropped.

    return (
      <ReqoreControlGroup vertical fluid>
        {hasOnlyAllowedValues && (
          <ReqoreMessage intent='warning' size='small' opaque={false}>
            This field has pre-defined allowed values, make sure the template you select is
            compatible with those
          </ReqoreMessage>
        )}
        <ReqoreControlGroup stack>
          <ReqoreDropdown
            className='template-selector'
            customTheme={TemplatesListProps.listCustomTheme}
            minimal
            compact
            onItemSelect={onItemSelect}
            items={items}
            label={label}
            leftIconProps={leftIconProps}
            caretPosition='right'
            filterable
            size={size}
            {...TemplatesListProps}
          />
          {allowCustomValues || value ? (
            <ReqoreButton
              customTheme={TemplatesListProps.listCustomTheme}
              fixed
              icon='CloseLine'
              tooltip='Remove template value'
              minimal
              className='template-remove'
              compact
              size={size}
              onClick={onRemoveClick}
            />
          ) : null}
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);

export const TemplateField = memo(
  ({
    value,
    name,
    onChange,
    component: Comp = Auto,
    templates,
    interfaceContext, // eslint-disable-line @typescript-eslint/no-unused-vars
    allowTemplates = true,
    allowFunctions,
    allowTextExpressions,
    allowCustomValues = true,
    filterTemplatesByType = true,
    filterTemplatesFunc,
    componentFromType,
    isFunction,
    isDefaultFunction,
    isDefaultTemplate,
    returnType,
    level,
    className,
    menuItems,
    label,
    ...rest
  }: ITemplateFieldProps) => {
    const qorusTypes = useQorusTypes();
    const functions = useExpressions({
      allow: !!allowFunctions,
      expressionsUrl: rest.expressions_url,
      extraExpressions: rest.expressions,
    });
    const type = rest.ui_type || rest.type || rest.defaultType;

    const [isTemplate, setIsTemplate] = useState<boolean>(
      (isDefaultTemplate || isValueTemplate(value) || !allowCustomValues) && allowTemplates
    );
    const [internalIsFunction, setInternalIsFunction] = useState<boolean>(
      !!isDefaultFunction && !!allowFunctions
    );
    const [templateValue, setTemplateValue] = useState<string | null>(value);

    const effectiveIsFunction = isFunction || internalIsFunction;

    useWhyDidYouUpdate(`Template field ${name}`, {
      name,
      onChange,
      value,
      ...rest,
    });

    useEffect(() => {
      if (isTemplate && isValueTemplate(value)) {
        setTemplateValue(value);
      }
    }, [JSON.stringify(value)]);

    useEffect(() => {
      if (allowCustomValues && isTemplate && value && !isValueTemplate(value)) {
        setIsTemplate(false);
      }
    }, [allowCustomValues]);

    useEffect(() => {
      if (!isTemplate && isValueTemplate(value) && allowTemplates) {
        // Do not set the template value if the value is a string in auto mode
        if (type === 'auto' && getTypeFromValue(value) === 'string') {
          return;
        }

        setIsTemplate(true);
        setTemplateValue(value);
      }
    }, [JSON.stringify(value), allowTemplates]);

    // When template key or template value change run the onChange function
    useUpdateEffect(() => {
      if (templateValue) {
        onChange?.(name, templateValue, type as TQorusType, effectiveIsFunction);
      }
    }, [JSON.stringify(templateValue)]);

    const hasOnlyAllowedValues = useMemo(
      () => !!size(rest.allowed_values) && !rest.allowed_values_creatable,
      [rest.allowed_values, rest.allowed_values_creatable]
    );

    const showTemplateToggle = allowCustomValues && allowTemplates && !rest.arg_schema;

    const templateSupportsCustomValues =
      allowCustomValues && type === 'string' && !hasOnlyAllowedValues;
    const showTemplatesDropdown =
      allowTemplates && (!allowCustomValues || (isTemplate && !templateSupportsCustomValues));
    const hasOnlyExpressions = !allowCustomValues && !allowTemplates && allowFunctions;
    // True when some input control renders besides the ⋮ menu. When nothing
    // does (an empty `any` field: custom values are disallowed and the value's
    // type is picked FROM the menu), the menu trigger is the field's only
    // affordance and gets a label — a bare ⋮ alone reads as a broken editor.
    const hasInputAffordance =
      (!isTemplate && allowCustomValues) ||
      (isTemplate && templateSupportsCustomValues) ||
      showTemplatesDropdown;

    const Component = componentFromType ? ComponentMap[type] : Comp;
    const fieldAriaLabel = rest['aria-label'] ?? label ?? rest.display_name ?? name;

    const filteredTemplates = useMemo<IReqoreFormTemplates>(():
      | IReqoreFormTemplates
      | undefined => {
      if (!allowTemplates) {
        return undefined;
      }

      let result: IReqoreFormTemplates = templates;

      if (filterTemplatesByType) {
        result = templatesFilterFunc(templates, type, !!rest.arg_schema);
      }

      if (filterTemplatesFunc) {
        result = filterTemplatesFunc(result);
      }

      return result;
    }, [
      JSON.stringify(templates),
      type,
      allowTemplates,
      filterTemplatesByType,
      JSON.stringify(rest.arg_schema),
      filterTemplatesFunc,
    ]);

    const handleTemplateFieldChange = useCallback(
      (_name: string, val: string) => {
        if (!val) {
          setIsTemplate(false);
          setTemplateValue(null);
          onChange(name, undefined);
        } else {
          setTemplateValue(val);
        }
      },
      [name, onChange]
    );

    const handleSelectTemplateFromList = useCallback(
      // If the field has allowed values and supports templates, we do not want to overwrite the field type with the template type
      (item) => {
        // If the template type is richtext, we need to wrap the template value in the richtext template format
        const value =
          item.badge === 'richtext'
            ? ([
                {
                  type: 'paragraph',
                  children: [
                    {
                      children: [{ text: '' }],
                      label: item.label,
                      type: 'tag',
                      value: item.value,
                      metadata: item.metadata,
                    },
                  ],
                },
              ] as IReqoreRichTextEditorProps['value'])
            : item.value;

        onChange(name, value, hasOnlyAllowedValues ? (type as TQorusType) : (item.badge as TQorusType));
      },
      [name, onChange]
    );

    // SEAM (reqraft): the IDE computes `canSaveValue` here and renders a
    // `SaveValueButton` in the controls menu — the saved-values storage is
    // IDE-only, so the menu item is dropped (`allowSaving` is inert).

    const handleRemoveTemplateClick = useCallback(() => {
      if (allowCustomValues) {
        setIsTemplate(false);
      }

      setTemplateValue(null);
      onChange?.(name, undefined);
    }, [allowCustomValues, name, onChange]);

    const handleSelectFunctionChange = useCallback(() => {
      setInternalIsFunction(true);
      setIsTemplate(false);
      setTemplateValue(null);

      let firstArg: IExpression;

      if (type !== 'bool' && value !== undefined && value !== rest.default_value) {
        firstArg = {
          type: type as TQorusType,
          value,
        };
      }

      onChange?.(
        name,
        {
          args: [firstArg],
        },
        undefined,
        true
      );
    }, [
      JSON.stringify(functions.expressions),
      JSON.stringify(qorusTypes.value),
      name,
      onChange,
      type,
      value,
    ]);

    const handleTemplateToggleClick = useCallback(() => {
      setInternalIsFunction(false);
      onChange(name, undefined, undefined, false);
      setTemplateValue(null);
      setIsTemplate(true);
    }, [onChange, name]);

    const handleExpressionChange = useCallback(
      (expressionValue: IExpression | undefined, remove: boolean) => {
        if (remove) {
          setInternalIsFunction(false);
        }
        onChange(name, expressionValue?.value, type as TQorusType, !remove);
      },
      [name, onChange, type, value]
    );

    const renderControls = useCallback(() => {
      const showFunctionsDropdown =
        allowFunctions && !hasOnlyAllowedValues && !rest.readonly && !internalIsFunction;
      const showTemplatesButton = showTemplateToggle && !isTemplate;

      if (hasOnlyExpressions) {
        return showFunctionsDropdown ? (
          functions.loading ? (
            <ReqoreSkeleton size={rest.size} />
          ) : (
            <ReqoreButton
              compact
              minimal
              label='Create New Expression'
              className='function-selector'
              icon='Functions'
              tooltip='This field only accepts expressions'
              onClick={() => {
                setIsTemplate(false);
                setTemplateValue(null);
                onChange?.(
                  name,
                  {
                    args: [],
                  },
                  undefined,
                  true
                );
              }}
            />
          )
        ) : null;
      }

      if (showFunctionsDropdown || showTemplatesButton || size(menuItems) > 0) {
        return (
          <ReqorePopover
            component={ReqoreButton}
            closeOnTargetClick
            closeOnInsideClick={false}
            isReqoreComponent
            noWrapper
            noArrow
            placement='bottom-end'
            componentProps={
              {
                icon: 'More2Fill',
                className: 'template-more',
                compact: true,
                transparent: true,
                size: rest.size,
                fixed: true,
                // Centre the trailing menu in its flex line so it lines up with
                // sibling action buttons (reqore alignSelf; replaces a reqraft
                // `align-self !important` override of this button).
                alignSelf: 'center',
                label: hasInputAffordance ? undefined : 'Set value',
                style:
                  hasInputAffordance ?
                    {
                      paddingLeft: 0,
                      paddingRight: 0,
                      minWidth: '10px',
                    }
                  : undefined,
                effect: {
                  gradient: {
                    direction: 'to bottom right',
                    colors: {
                      0: '#444444',
                      40: '#161616',
                      60: '#161616',
                      100: '#444444',
                    },
                  },
                },
              } as IReqoreButtonProps
            }
            handler='click'
            content={
              <ReqoreMenu size={rest.size} maxHeight='400px' style={{ overflow: 'auto' }}>
                {showFunctionsDropdown ? (
                  functions.loading ? (
                    <ReqoreSkeleton size={rest.size} />
                  ) : (
                    <ReqoreButton
                      compact
                      transparent
                      label='Use Expression'
                      className='function-selector'
                      icon='Functions'
                      tooltip='Run a function on this value'
                      onClick={handleSelectFunctionChange}
                    />
                  )
                ) : null}

                {showTemplatesButton ? (
                  <ReqoreButton
                    transparent
                    icon='MoneyDollarCircleLine'
                    className='template-toggle'
                    tooltip={'Use a template'}
                    compact
                    size={rest.size}
                    onClick={handleTemplateToggleClick}
                  >
                    {' '}
                    Use Template{' '}
                  </ReqoreButton>
                ) : null}

                {size(menuItems) > 0 ? (
                  <CustomMenuItems
                    items={menuItems}
                    setIsTemplate={setIsTemplate}
                    setTemplateValue={setTemplateValue}
                  />
                ) : null}
              </ReqoreMenu>
            }
          />
        );
      }

      return null;
    }, [
      allowFunctions,
      functions.expressions,
      handleSelectFunctionChange,
      handleTemplateToggleClick,
      hasOnlyAllowedValues,
      isTemplate,
      rest.readonly,
      rest.size,
      showTemplateToggle,
      hasOnlyExpressions,
      type,
      value,
      menuItems,
      internalIsFunction,
      hasInputAffordance,
    ]);

    // When the type is a list, and it has an element type - that element type is different
    // from the field type, so we need to send down the full templates object
    // and the actual rendered field will filter it's own templates
    // This is a special case only for lists with element types
    const componentTemplates = useMemo(
      () =>
        type === 'list' && (rest.ui_element_type || rest.element_type)
          ? templates
          : {
              ...filteredTemplates,
              ...TemplatesListProps,
            },
      [JSON.stringify(filteredTemplates), rest.ui_element_type, rest.element_type, type]
    );

    if (effectiveIsFunction && !hasOnlyAllowedValues) {
      // SEAM (reqraft): `allowTextExpressions` swaps the IDE's bare builder
      // for the ExpressionField shell (Visual = the same builder, Text = the
      // DPQL editor). `handleExpressionChange` serves both — the shell emits
      // the identical `({ is_expression, value }, remove)` contract.
      if (allowTextExpressions) {
        return (
          <ReqoreControlGroup>
            <ReqoreErrorBoundary>
              <ExpressionField
                value={{
                  is_expression: true,
                  value,
                }}
                localTemplates={templates}
                type={type as string}
                returnType={(returnType || type) as any}
                onChange={handleExpressionChange}
                readOnly={rest.readOnly || rest.disabled}
                expressions={rest.expressions}
                expressionsUrl={rest.expressions_url}
                serverHandled={rest.server_expression_handling}
                size={rest.size}
              />
            </ReqoreErrorBoundary>
            {renderControls()}
          </ReqoreControlGroup>
        );
      }

      return (
        <ReqoreControlGroup>
          <ReqoreErrorBoundary>
            <ExpressionBuilder
              value={{
                is_expression: true,
                value,
              }}
              localTemplates={templates}
              level={level}
              type={type as string}
              returnType={(returnType || type) as any}
              onChange={handleExpressionChange}
              readOnly={rest.readOnly || rest.disabled}
              expressions={rest.expressions}
              expressionsUrl={rest.expressions_url}
              serverHandled={rest.server_expression_handling}
            />
          </ReqoreErrorBoundary>
          {renderControls()}
        </ReqoreControlGroup>
      );
    }

    if (rest.disabled) {
      if (isTemplate) {
        // SEAM (reqraft): the IDE renders a bare `<ReqoreTag label={templateValue}/>`
        // here; reqraft upgrades the read-only template to a proper picker chip —
        // the $-dollar icon + resolved display name + app image, coloured by the
        // IDE's intent scheme. Shared with the compact read-first row.
        return <ReadOnlyTemplateTag value={templateValue} templates={templates} size={rest.size} />;
      }

      return <Comp value={value} onChange={onChange} name={name} {...rest} />;
    }

    return (
      // `wrap` is deliberate and must stay AFTER the `{...rest}` spread: the
      // form engine spreads the whole server-provided field descriptor into
      // `rest`, so an unrelated `wrap` key in a schema must not be able to turn
      // it off.
      //
      // This group hosts the field editor next to the template selector /
      // dropdown, so it is a horizontal row. A consumer field component that
      // returns a React fragment has ALL of its top-level elements flattened
      // into that row rather than contributing one child, and a first element
      // that is a full-width panel (`flex: 0 0 auto` — cannot shrink) then
      // leaves the remaining parts no room and pushes them outside the
      // container. Without wrapping, the parts are simply clipped and the row
      // grows a horizontal scrollbar; with it they fall to the next line, which
      // is the vertical stacking such a component was written to expect.
      // See https://github.com/qoretechnologies/toolkit-react/issues/90.
      <ReqoreControlGroup
        fluid={rest.fluid}
        fixed={rest.fixed}
        size={rest.size}
        {...rest}
        stack={false}
        wrap
        verticalAlign='flex-start'
      >
        {!isTemplate && allowCustomValues ? (
          <Component
            value={value}
            allowTemplates={allowTemplates}
            onChange={onChange}
            name={name}
            level={level}
            {...rest}
            aria-label={fieldAriaLabel}
            className={`${className} template-selector`}
            templates={componentTemplates}
          />
        ) : null}

        {isTemplate && templateSupportsCustomValues ? (
          <LongStringField
            className='template-selector'
            type='string'
            name='templateVal'
            level={level}
            value={templateValue}
            templates={{
              ...filteredTemplates,
              ...TemplatesListProps,
            }}
            onChange={handleTemplateFieldChange}
            {...rest}
            aria-label={fieldAriaLabel}
          />
        ) : null}

        {showTemplatesDropdown ? (
          <TemplateDropdownSelector
            allowCustomValues={allowCustomValues}
            templates={templates}
            value={templateValue}
            items={filteredTemplates?.items}
            onItemSelect={handleSelectTemplateFromList}
            onRemoveClick={handleRemoveTemplateClick}
            size={rest.size}
            label={label}
            hasOnlyAllowedValues={hasOnlyAllowedValues}
          />
        ) : null}

        {renderControls()}
      </ReqoreControlGroup>
    );
  }
);
