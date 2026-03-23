import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreMenu,
  ReqoreMenuSection,
  ReqoreMessage,
  ReqorePopover,
  ReqoreTag,
  ReqoreTagGroup,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import ReqoreMenuDivider, {
  IReqoreMenuDividerProps,
} from '@qoretechnologies/reqore/dist/components/Menu/divider';
import {
  IReqoreFormTemplates,
  IReqoreTextareaProps,
} from '@qoretechnologies/reqore/dist/components/Textarea';
import { IQorusFormFieldSchemaBase, TQorusType } from '@qoretechnologies/ts-toolkit';
import { size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import {
  filterTemplatesByType,
  findTemplate,
  getTemplateKey,
  getTemplateValue,
  isValueTemplate,
} from '../../../../helpers/templates';
import { getTypeFromValue } from '../../../../helpers/validations';
import { TFormFieldType } from '../../../../types/Form';
import { FormField } from '../Field';
import { LongStringFormField } from '../long-string/LongString';

// Re-export template utilities for consumers
export { getTemplateKey, getTemplateValue, isValueTemplate };

export const TemplatesListProps: IReqoreDropdownProps = {
  useTargetWidth: true,
  handler: 'focus',
  minWidth: '300px',
  listCustomTheme: {
    main: '#1e0d29',
  },
};

export const mapQorusTypeToFormFieldType = (type: string): TFormFieldType => {
  switch (type) {
    case 'richtext':
      return 'richtext';
    case 'bool':
    case 'boolean':
      return 'bool';
    case 'int':
    case 'integer':
    case 'float':
    case 'number':
      return 'int';
    case 'date':
      return 'date';
    case 'file':
      return 'file';
    case 'rgbcolor':
      return 'rgbcolor';
    case 'hash':
    case 'free-hash':
      return 'hash';
    case 'list':
    case 'free-list':
      return 'list';
    default:
      // string, auto, any, binary → textarea
      return 'long-string';
  }
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
          'isDivider' in menuItem ?
            <ReqoreMenuDivider key={index} {...menuItem} />
          : <ReqoreButton
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
    size: fieldSize,
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
            size={fieldSize}
            {...TemplatesListProps}
          />
          {allowCustomValues || value ?
            <ReqoreButton
              customTheme={TemplatesListProps.listCustomTheme}
              fixed
              icon='CloseLine'
              tooltip='Remove template value'
              minimal
              className='template-remove'
              compact
              size={fieldSize}
              onClick={onRemoveClick}
            />
          : null}
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);

export interface ITemplateFieldProps extends Partial<
  Omit<IQorusFormFieldSchemaBase, 'default_value'>
> {
  value?: any;
  name?: string;
  label?: string;
  onChange?: (name: string, value: any, type?: TQorusType) => void;
  component?: React.FC<any>;
  allowTemplates?: boolean;
  templates?: IReqoreTextareaProps['templates'];
  componentFromType?: boolean;
  allowCustomValues?: boolean;
  filterTemplatesByType?: boolean;
  filterTemplatesFunc?: (templates: IReqoreFormTemplates) => IReqoreFormTemplates;
  returnType?: TQorusType;
  level?: number;
  className?: string;
  isDefaultTemplate?: boolean;
  menuItems?: TCustomTemplateItems;
  default_value?: unknown;
  [key: string]: any;
}

export const TemplateField = memo(
  ({
    value,
    name,
    onChange,
    component: Comp,
    templates,
    allowTemplates = true,
    allowCustomValues = true,
    filterTemplatesByType: filterByType = true,
    filterTemplatesFunc,
    componentFromType,
    isDefaultTemplate,
    returnType: _returnType, // eslint-disable-line @typescript-eslint/no-unused-vars
    level,
    className,
    menuItems,
    label,
    ...rest
  }: ITemplateFieldProps) => {
    const type: string = (rest.ui_type || rest.type || rest.defaultType) as string;

    const [isTemplate, setIsTemplate] = useState<boolean>(
      (isDefaultTemplate || isValueTemplate(value) || !allowCustomValues) && allowTemplates
    );
    const [templateValue, setTemplateValue] = useState<string | null>(value);

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
        if (type === 'auto' && getTypeFromValue(value) === 'string') {
          return;
        }

        setIsTemplate(true);
        setTemplateValue(value);
      }
    }, [JSON.stringify(value), allowTemplates]);

    // When templateValue changes, fire onChange
    useUpdateEffect(() => {
      if (templateValue) {
        onChange?.(name, templateValue, type as TQorusType);
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

    // Determine which component to render for the raw field
    const Component: React.FC<any> = useMemo(() => {
      if (Comp) return Comp;
      if (componentFromType) {
        const mappedType = mapQorusTypeToFormFieldType(type);
        return (props: any) => <FormField {...props} type={mappedType} />;
      }
      return (props: any) => <FormField {...props} type={mapQorusTypeToFormFieldType(type)} />;
    }, [Comp, componentFromType, type]);

    const filteredTemplates = useMemo<IReqoreFormTemplates>(():
      | IReqoreFormTemplates
      | undefined => {
      if (!allowTemplates) {
        return undefined;
      }

      let result: IReqoreFormTemplates = templates;

      if (filterByType) {
        result = filterTemplatesByType(templates, type, !!rest.arg_schema);
      }

      if (filterTemplatesFunc) {
        result = filterTemplatesFunc(result);
      }

      return result;
    }, [
      JSON.stringify(templates),
      type,
      allowTemplates,
      filterByType,
      JSON.stringify(rest.arg_schema),
      filterTemplatesFunc,
    ]);

    const handleTemplateFieldChange = useCallback(
      (_name: string, val: string) => {
        if (!val) {
          setIsTemplate(false);
          setTemplateValue(null);
          onChange?.(name, undefined);
        } else {
          setTemplateValue(val);
        }
      },
      [name, onChange]
    );

    const handleSelectTemplateFromList = useCallback(
      (item: any) => {
        onChange?.(
          name,
          item.value,
          hasOnlyAllowedValues ? (type as TQorusType) : (item.badge as TQorusType)
        );
      },
      [name, onChange, hasOnlyAllowedValues, type]
    );

    const handleRemoveTemplateClick = useCallback(() => {
      if (allowCustomValues) {
        setIsTemplate(false);
      }
      setTemplateValue(null);
      onChange?.(name, undefined);
    }, [allowCustomValues, name, onChange]);

    const handleTemplateToggleClick = useCallback(() => {
      onChange?.(name, undefined);
      setTemplateValue(null);
      setIsTemplate(true);
    }, [onChange, name]);

    const renderControls = useCallback(() => {
      const showTemplatesButton = showTemplateToggle && !isTemplate;

      if (showTemplatesButton || size(menuItems) > 0) {
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
                style: {
                  paddingLeft: 0,
                  paddingRight: 0,
                  minWidth: '10px',
                },
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
                {showTemplatesButton ?
                  <ReqoreButton
                    transparent
                    icon='MoneyDollarCircleLine'
                    className='template-toggle'
                    tooltip='Use a template'
                    compact
                    size={rest.size}
                    onClick={handleTemplateToggleClick}
                  >
                    {' '}
                    Use Template{' '}
                  </ReqoreButton>
                : null}

                {size(menuItems) > 0 ?
                  <CustomMenuItems
                    items={menuItems}
                    setIsTemplate={setIsTemplate}
                    setTemplateValue={setTemplateValue}
                  />
                : null}
              </ReqoreMenu>
            }
          />
        );
      }

      return null;
    }, [handleTemplateToggleClick, isTemplate, rest.size, showTemplateToggle, menuItems]);

    // When the type is a list with element type, pass full templates so the child can filter
    const componentTemplates = useMemo(
      () =>
        type === 'list' && (rest.ui_element_type || rest.element_type) ?
          templates
        : {
            ...filteredTemplates,
            ...TemplatesListProps,
          },
      [JSON.stringify(filteredTemplates), rest.ui_element_type, rest.element_type, type]
    );

    const handleChange = useCallback(
      (value: unknown) => {
        onChange?.(name, value);
      },
      [onChange, name]
    );

    if (rest.disabled) {
      if (isTemplate) {
        return (
          <ReqoreTagGroup size={rest.size}>
            <ReqoreTag label={templateValue} />
          </ReqoreTagGroup>
        );
      }

      return <Component value={value} onChange={handleChange} name={name} {...rest} />;
    }

    return (
      <ReqoreControlGroup
        fluid={rest.fluid}
        fixed={rest.fixed}
        size={rest.size}
        stack={false}
        verticalAlign='flex-start'
      >
        {!isTemplate && allowCustomValues ?
          <Component
            value={value}
            allowTemplates={allowTemplates}
            onChange={handleChange}
            name={name}
            level={level}
            {...rest}
            className={`${className || ''} template-selector`}
            templates={componentTemplates}
          />
        : null}

        {isTemplate && templateSupportsCustomValues ?
          <LongStringFormField
            className='template-selector'
            name='templateVal'
            value={templateValue}
            templates={{
              ...filteredTemplates,
              ...TemplatesListProps,
            }}
            onChange={(val) => handleTemplateFieldChange('templateVal', val)}
            {...(rest as any)}
          />
        : null}

        {showTemplatesDropdown ?
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
        : null}

        {renderControls()}
      </ReqoreControlGroup>
    );
  }
);
