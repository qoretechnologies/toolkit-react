import {
  IReqoreLabelProps,
  ReqoreCheckbox,
  ReqoreControlGroup,
  ReqoreSkeleton,
  ReqoreSpan,
} from '@qoretechnologies/reqore';
import { IWithReqoreSize } from '@qoretechnologies/reqore/dist/types/global';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IQorusAllowedValue, IQorusFormFieldSchemaBase, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { isEqual, size } from 'lodash';
import { useId } from 'react';
import { typedToYaml } from '../../../helpers/common';
import { useArgSchema } from '../../../hooks/useArgSchema';
import { TFormFieldType, TFormFieldValueType } from '../../../types/Form';
import BooleanFormField from './boolean/Boolean';
import ColorFormField, { IColorFormFieldProps } from './color/Color';
import CronFormField from './cron/Cron';
import { DateFormField } from './date/Date';
import { IFileFormFieldValue, ReqraftFileFormField } from './file/File';
import LongStringFormField from './long-string/LongString';
import MarkdownFormField from './markdown/Markdown';
import { MultiSelectFormField } from './multi-select/MultiSelectFormField';
import NumberFormField from './number/Number';
import { ReqraftObjectFormField } from './object/Object';
import { RichTextFormField } from './rich-text/RichText';
import { SelectFormField } from './select/Select';
import { getSelectItemShortDescription } from './select/SelectCollection';
import { StringFormField } from './string/String';
import { ArrayAutoField } from './array/ArrayAutoField';
import { AutoFormField } from './auto/AutoFormField';
import { ByteSizeFormField } from './byte-size/ByteSize';
import { TimeoutFormField } from './timeout/Timeout';
import { UrlFormField } from './url/Url';
import { SchemaDefinitionEditor } from './schema-definition';
import { IDataSchemaDefinition } from './schema-definition/types';
// Direct import — circular dep (FormEngine → TemplateField → FormField → FormEngine) is safe
// because modules are all loaded before any component renders
import { FormEngine } from '../engine/FormEngine';

const mapQorusTypeToFormFieldType = (type: string): TFormFieldType => {
  // Soft Qore types (softint, softstring, …) render as their concrete base.
  const base = type?.startsWith('soft') ? type.slice(4) : type;
  switch (base) {
    case 'richtext': return 'richtext';
    case 'bool': case 'boolean': return 'bool';
    case 'int': case 'integer': case 'float': case 'number': return 'int';
    // `timeout` is an integer count of milliseconds (a connection's
    // connect_timeout / timeout); without it the default below renders it
    // as a long-string text box.
    case 'timeout': return 'timeout';
    case 'date': return 'date';
    case 'file': return 'file';
    case 'rgbcolor': return 'rgbcolor';
    case 'hash': case 'free-hash': return 'hash';
    case 'list': case 'free-list': return 'list';
    case 'auto': case 'any': return 'auto';
    case 'schema-definition': return 'schema-definition';
    default: return 'long-string';
  }
};

// Re-export for consumers who need to construct allowed values
export type { IQorusAllowedValue };

export interface IFormFieldProps<T extends TFormFieldType = TFormFieldType> extends Omit<
  IQorusFormFieldSchemaBase,
  'value' | 'default_value' | 'arg_schema' | 'element_type' | 'ui_element_type'
>, IWithReqoreSize {
  type?: T;
  value: TFormFieldValueType<T>;
  onChange: (value: TFormFieldValueType<T>, event?: unknown) => void;

  /** Field name — used by hash/list sub-renderers */
  name?: string;

  validateSelf?: boolean;
  onValidateChange?: (isValid: boolean) => void;

  /** Nested schema for hash/file Build tab — either an inline schema or a URL to fetch */
  arg_schema?: string | IQorusFormSchema;
  /** For list fields: the type of each element */
  element_type?: string;
  ui_element_type?: string;
  /** Fixed allowed values for list items */
  element_allowed_values?: IQorusAllowedValue[];
  element_allowed_values_creatable?: boolean;

  fieldProps?: Record<string, any>;

  label?: IReqoreLabelProps['label'];
  labelPosition?: 'top' | 'left' | 'right' | 'bottom';
}

export const FormField = <T extends TFormFieldType>({
  type,
  onChange,
  value,
  fieldProps,
  label, // eslint-disable-line @typescript-eslint/no-unused-vars
  labelPosition = 'top', // eslint-disable-line @typescript-eslint/no-unused-vars
  allowed_values,
  allowed_values_creatable,
  arg_schema,
  element_type,
  ui_element_type,
  element_allowed_values,
  element_allowed_values_creatable,
  // Pulled out explicitly so they're properly typed for hash/list rendering
  name,
  display_name,
  readonly,
  size: fieldSize,
  // Destructured to prevent type conflicts when spreading into specific field components;
  // pass these through fieldProps if a specific field needs them.
  tags, // eslint-disable-line @typescript-eslint/no-unused-vars
  options, // eslint-disable-line @typescript-eslint/no-unused-vars
  ...rest
}: IFormFieldProps<T>) => {
  const id = useId();
  const { schema: finalArgSchema, loading: argSchemaLoading } = useArgSchema(arg_schema);

  const handleChange = (value: TFormFieldValueType<T>, event?: unknown) => {
    onChange(value, event);
  };

  const renderField = (type: T) => {
    // Soft Qore types (softint, softstring, …) render identically to their
    // concrete counterpart — the soft/hard distinction is value-level, not UI.
    const renderType = (type as string)?.startsWith('soft')
      ? (type as string).slice(4)
      : (type as string);

    // Multi-select consumes `allowed_values` directly as its option list and
    // is always an array value, so it must render even when the values are
    // fixed — unlike the single-value short-circuit below.
    if (renderType === 'multi-select' || renderType === 'select-array') {
      return (
        <MultiSelectFormField
          items={allowed_values ?? []}
          value={(value as unknown[]) ?? []}
          onChange={(selected) => handleChange(selected as TFormFieldValueType<T>)}
          canCreateItems={allowed_values_creatable || !size(allowed_values)}
          disabled={(rest as { disabled?: boolean }).disabled}
          size={fieldSize}
        />
      );
    }

    // When allowed_values are set without creatable, hide the raw field
    if (allowed_values?.length && !allowed_values_creatable) {
      return null;
    }

    switch (renderType) {
      case 'string':
        return (
          <StringFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'string'>['fieldProps'])}
            onChange={(value: string) => handleChange(value as TFormFieldValueType<T>)}
            value={value as TFormFieldValueType<T>}
            id={id}
          />
        );

      case 'bool':
      case 'boolean':
        return (
          <BooleanFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'bool'>['fieldProps'])}
            checked={value as boolean}
            onChange={(checked) => {
              handleChange(checked as TFormFieldValueType<T>);
            }}
            id={id}
          />
        );

      case 'timeout':
        return (
          <TimeoutFormField
            {...(fieldProps as any)}
            value={value as number}
            onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
            disabled={(rest as { disabled?: boolean }).disabled}
            readOnly={readonly}
            size={fieldSize}
          />
        );

      case 'int':
      case 'integer':
      case 'float':
      case 'number':
        return (
          <NumberFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'int'>['fieldProps'])}
            value={value as number}
            onChange={(value) => {
              handleChange(value as TFormFieldValueType<T>);
            }}
            id={id}
          />
        );

      case 'rgbcolor':
        return (
          <ColorFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'rgbcolor'>['fieldProps'])}
            value={value as IColorFormFieldProps['value']}
            onChange={(color) => {
              handleChange(color as TFormFieldValueType<T>);
            }}
          />
        );

      case 'long-string':
      case 'binary':
        return (
          <LongStringFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'long-string'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
            id={id}
          />
        );

      case 'markdown':
        return (
          <MarkdownFormField
            {...rest}
            {...(fieldProps as any)}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
            id={id}
          />
        );

      case 'cron':
        return (
          <CronFormField
            {...rest}
            {...(fieldProps as any)}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
            // give id to first element to make htmlFor works.
            inputProps={[{ id }]}
          />
        );

      case 'richtext':
        return (
          <RichTextFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'richtext'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(val) => {
              handleChange(val as TFormFieldValueType<T>);
            }}
          />
        );

      case 'date':
        return (
          <DateFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'date'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(val) => {
              handleChange(val as TFormFieldValueType<T>);
            }}
          />
        );

      case 'file':
        return (
          <ReqraftFileFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'file'>['fieldProps'])}
            value={value as IFileFormFieldValue}
            argSchema={finalArgSchema}
            argSchemaLoading={argSchemaLoading}
            onChange={(val) => {
              handleChange(val as TFormFieldValueType<T>);
            }}
          />
        );

      case 'select':
      case 'select-string':
      case 'enum':
        return (
          <SelectFormField
            {...rest}
            {...(fieldProps as any)}
            value={value}
            onChange={(val) => {
              handleChange(val as TFormFieldValueType<T>);
            }}
            fluid
          />
        );

      case 'byte-size':
        return (
          <ByteSizeFormField
            {...(fieldProps as any)}
            value={value as string}
            onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
            disabled={(rest as { disabled?: boolean }).disabled}
            readOnly={readonly}
            size={fieldSize}
          />
        );

      case 'url':
        return (
          <UrlFormField
            {...rest}
            {...(fieldProps as any)}
            value={value as string}
            onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
            size={fieldSize as any}
          />
        );

      case 'hash': {
        if (argSchemaLoading) {
          return <ReqoreSkeleton height='80px' />;
        }
        if (finalArgSchema) {
          return (
            <FormEngine
              name={name || id}
              options={finalArgSchema}
              value={value as any}
              onChange={(_name, val) => handleChange(val as TFormFieldValueType<T>)}
              flat={false}
              wrapperPadding='bottom'
              columns={1}
              minColumnWidth='150px'
              size={fieldSize}
              disabled={rest.disabled}
            />
          );
        }
        // No schema — YAML object editor
        const hashYaml = value ? typedToYaml({ type: 'hash', value }) : undefined;
        return (
          <ReqraftObjectFormField
            value={hashYaml}
            onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
            type='object'
            dataType='yaml'
            resultDataType='yaml'
            disabled={rest.disabled}
            size={fieldSize}
          />
        );
      }

      case 'list': {
        const effectiveElementType = ui_element_type || element_type;

        // Fixed allowed values with no creatability → checkbox/multiselect
        if (size(element_allowed_values) && !element_allowed_values_creatable) {
          const formatToServer = (vals: unknown[]) =>
            (vals || []).map((v) => {
              const match = element_allowed_values.find((ev) => isEqual(ev.value?.value, v));
              return { value: v, type: match?.value?.type ?? effectiveElementType };
            });
          const formatFromServer = (vals: unknown[]) =>
            (vals as Array<{ value?: unknown }>).map((item) => item?.value);
          const serverValue = formatFromServer((value as unknown[]) || []);

          if (element_allowed_values.length <= 3) {
            return (
              <ReqoreControlGroup vertical size='tiny'>
                {element_allowed_values.map((item, index) => {
                  const itemValue = item.value?.value;
                  const checked = serverValue.some((v) => isEqual(v, itemValue));
                  return (
                    <ReqoreCheckbox
                      margin='right'
                      key={index}
                      label={item.display_name ?? String(itemValue)}
                      tooltip={item.short_desc || item.desc}
                      checked={checked}
                      intent={checked ? 'info' : undefined}
                      onClick={() => {
                        const next =
                          checked ?
                            serverValue.filter((v) => !isEqual(v, itemValue))
                          : [...serverValue, itemValue];
                        handleChange(formatToServer(next) as TFormFieldValueType<T>);
                      }}
                    />
                  );
                })}
              </ReqoreControlGroup>
            );
          }

          return (
            <MultiSelectFormField
              items={element_allowed_values}
              value={serverValue}
              onChange={(selected) =>
                handleChange(formatToServer(selected) as TFormFieldValueType<T>)
              }
              disabled={rest.disabled}
              size={fieldSize}
            />
          );
        }

        // Has element_type → ArrayAutoField for typed items
        if (effectiveElementType) {
          const rawValues = ((value as unknown[]) || []).map((item: any) => item?.value ?? item);
          return (
            <ArrayAutoField
              name={name || id}
              display_name={display_name}
              value={rawValues}
              type={effectiveElementType}
              arg_schema={finalArgSchema}
              allowed_values={element_allowed_values}
              allowed_values_creatable={element_allowed_values_creatable}
              disabled={rest.disabled}
              readOnly={readonly}
              size={fieldSize}
              onChange={(_name, vals) => {
                if (!size(vals)) {
                  handleChange(undefined as TFormFieldValueType<T>);
                  return;
                }
                handleChange(
                  (vals || []).map((v) => ({
                    value: v,
                    type: effectiveElementType,
                  })) as TFormFieldValueType<T>
                );
              }}
              renderItem={({ value: itemVal, onChange: onItemChange, type: itemType, ...itemRest }) => (
                <FormField
                  {...(itemRest as any)}
                  type={mapQorusTypeToFormFieldType(itemType || 'string') as T}
                  value={itemVal as TFormFieldValueType<T>}
                  onChange={(v) => onItemChange(v)}
                />
              )}
            />
          );
        }

        // No element constraints — YAML array editor
        const listYaml = value ? typedToYaml({ type: 'list', value }) : undefined;
        return (
          <ReqraftObjectFormField
            value={listYaml}
            onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
            type='array'
            dataType='yaml'
            resultDataType='yaml'
            disabled={rest.disabled}
            size={fieldSize}
          />
        );
      }

      case 'auto':
      case 'any':
        return (
          <AutoFormField
            {...rest}
            {...(fieldProps as any)}
            type={type as string}
            defaultType={type as string}
            value={value}
            onChange={(_name, val) => handleChange(val as TFormFieldValueType<T>)}
            arg_schema={finalArgSchema}
            element_type={element_type}
            ui_element_type={ui_element_type}
            display_name={display_name}
            name={name}
            readonly={readonly}
            size={fieldSize}
          />
        );

      case 'schema-definition':
        return (
          <SchemaDefinitionEditor
            {...(fieldProps as any)}
            value={value as IDataSchemaDefinition | undefined}
            onChange={(definition) => handleChange(definition as TFormFieldValueType<T>)}
            readOnly={readonly || (rest as { disabled?: boolean }).disabled}
          />
        );

      default:
        return null;
    }
  };

  /**
   * Maps an IQorusAllowedValue to the shape SelectFormField / checkboxes expect.
   * The actual selectable value lives at item.value.value (the wrapper has type metadata).
   */
  const mapAllowedValue = (item: IQorusAllowedValue) => ({
    display_name: item.display_name,
    short_desc: item.short_desc,
    desc: item.desc,
    icon: item.icon,
    image: item.image,
    badge: item.badge as TReqoreBadge,
    intent: item.intent,
    disabled: item.disabled,
    messages: item.messages,
    actions: item.actions,
    value: item.value?.value,
  });

  /**
   * Renders the allowed-values picker.
   *
   * - Not creatable: ≤3 → checkboxes with selection, >3 → dropdown with selection
   * - Creatable: minimal suggestion picker with no value (resets after selection)
   */
  const renderAllowedValues = () => {
    if (!allowed_values?.length) return null;

    // Multi-select renders its own picker from allowed_values in renderField;
    // don't also render the single-value allowed-values control.
    if ((type as string) === 'multi-select' || (type as string) === 'select-array') return null;

    // Creatable: "Saved & Suggested Values" style — no value, fills field and resets
    if (allowed_values_creatable) {
      return (
        <SelectFormField
          items={allowed_values.map(mapAllowedValue)}
          onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
          placeholder='Saved & Suggested Values'
          minimal
          icon='SaveFill'
          fluid
          hideItemCount
          forceDropdown={
            (fieldProps as { forceDropdown?: boolean } | undefined)?.forceDropdown ??
            (rest as { forceDropdown?: boolean }).forceDropdown
          }
        />
      );
    }

    // Non-creatable ≤3: checkboxes that track the current value
    if (allowed_values.length <= 3) {
      return (
        <ReqoreControlGroup vertical size='tiny'>
          <ReqoreSpan effect={{ opacity: 0.6, uppercase: true, weight: 'bold' }} size='tiny'>
            Select one:
          </ReqoreSpan>
          {allowed_values.map((item, index) => {
            const itemValue = item.value?.value;
            const checked = isEqual(value, itemValue);
            return (
              <ReqoreCheckbox
                margin='right'
                key={index}
                label={item.display_name ?? JSON.stringify(itemValue)}
                tooltip={getSelectItemShortDescription(mapAllowedValue(item))}
                disabled={item.disabled}
                checked={checked}
                intent={checked ? 'info' : undefined}
                onClick={() =>
                  handleChange((checked ? undefined : itemValue) as TFormFieldValueType<T>)
                }
              />
            );
          })}
        </ReqoreControlGroup>
      );
    }

    // Non-creatable >3: dropdown that tracks the current value
    return (
      <SelectFormField
        items={allowed_values.map(mapAllowedValue)}
        value={value}
        onChange={(val) => handleChange(val as TFormFieldValueType<T>)}
        fluid
        forceDropdown={
          (fieldProps as { forceDropdown?: boolean } | undefined)?.forceDropdown ??
          (rest as { forceDropdown?: boolean }).forceDropdown
        }
      />
    );
  };

  return (
    <ReqoreControlGroup vertical fluid>
      {renderField(type)}
      {renderAllowedValues()}
    </ReqoreControlGroup>
  );
};
