// Verbatim port of qorus-ide `src/components/Field/auto.tsx` — keep edits to
// the documented seams (leaf-API `onChange` adaptation, `query()`/`FormEngine`
// swaps) so it stays in sync with the IDE. Intentionally-unported IDE types
// and the full seam list live in `.tasks/FIELD_STACK_REPORT.md`.
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreErrorBoundary,
  ReqoreMessage,
  ReqoreSpinner,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IWithReqoreSize } from '@qoretechnologies/reqore/dist/types/global';
import { TQorusFormFieldSchema, TQorusType } from '@qoretechnologies/ts-toolkit';
import { isEqual, size } from 'lodash';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import useMount from 'react-use/lib/useMount';
import { typedToYaml, yamlToTyped } from '../../../../helpers/common';
import {
  getTypeFromValue,
  getValueOrDefaultValue,
  maybeParseYaml,
} from '../../../../helpers/validations';
import { useWhyDidYouUpdate } from '../../../../hooks/useWhyDidYouUpdate';
import { query } from '../../../../utils/fetch';
import { DpqlEditor } from '../../../dpqlEditor';
import { FormEngine, IOptionsSchema } from '../../engine/FormEngine';
import { FieldAllowedValues, FieldAllowedValuesCheckGroup } from '../allowed-values/AllowedValues';
import { ArrayAuto } from '../array/ArrayAuto';
import BooleanFormField from '../boolean/Boolean';
import { ByteSizeFormField } from '../byte-size/ByteSize';
import { TimeoutFormField } from '../timeout/Timeout';
import ColorFormField from '../color/Color';
import CronFormField from '../cron/Cron';
import { DateFormField } from '../date/Date';
import { IFileFormFieldValue, ReqraftFileFormField } from '../file/File';
import LongStringFormField from '../long-string/LongString';
import MarkdownFormField from '../markdown/Markdown';
import { MultiSelectFormField } from '../multi-select/MultiSelectFormField';
import NumberFormField from '../number/Number';
import { ReqraftObjectFormField } from '../object/Object';
import RadioGroupFormField from '../radio-group/RadioGroup';
import { RichTextFormField } from '../rich-text/RichText';
import { SchemaDefinitionEditor } from '../schema-definition';
import { IDataSchemaDefinition } from '../schema-definition/types';
import { ISelectFormFieldItem, SelectFormField } from '../select/Select';
import { StringFormField } from '../string/String';
import { UrlFormField } from '../url/Url';

/** UI superset of `TQorusType` — the IDE's `Field/systemOptions` `IQorusType`. */
export type IQorusType = TQorusType | string;

export interface IAutoFieldProps
  extends
    IWithReqoreSize,
    Omit<
      TQorusFormFieldSchema,
      'get_message' | 'return_message' | 'on_change' | 'type' | 'arg_schema'
    > {
  name?: string;
  value?: any;
  default_value?: any;
  type?: IQorusType;
  onChange?: (name: string, value: any, type?: IQorusType, canBeNull?: boolean) => void;
  /** From IDE FieldWrapper `IField` — lets `type-depends-on` query sibling fields. */
  requestFieldData?: (name: string, key: string) => any;
  canBeNull?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  uniqueName?: string;

  arg_schema?: string | IOptionsSchema;
  /** Render the arg_schema sub-form in compact (read-first) mode, matching the
   *  parent engine. */
  compact?: boolean;
  path?: string;
  column?: boolean;
  level?: number;
  defaultType?: IQorusType;
  defaultInternalType?: IQorusType;
  noSoft?: boolean;

  /** SEAM: inert in reqraft — saved-values storage is IDE-only. */
  allowSaving?: boolean;
  /** SEAM: inert in reqraft — saved-values storage is IDE-only. */
  showSavedValues?: boolean;

  app?: string;
  action?: string;

  isConfigItem?: boolean;
  isVariable?: boolean;
  disableSearchOptions?: boolean;
  disableManagement?: boolean;

  allowedTypes?: { name: IQorusType; display_name?: string }[];
  allowTemplates?: boolean;

  fluid?: boolean;

  showDescription?: boolean;

  templates?: IReqoreFormTemplates;
  metadata?: ISelectFormFieldItem['metadata'];

  /**
   * SEAM (reqraft): per-type editor injection — checked by `type` /
   * `ui_type` before the built-in switch. The IDE re-injects its own
   * editors (InterfaceSelector, ConnectorField, CodeEditor, …) here at the
   * dedupe phase; without an override those types render the verbatim
   * "Unknown type!" tag.
   */
  componentOverrides?: Record<string, React.FC<any>>;

  [key: string]: any;
}

export const DefaultNoSoftTypes = [
  { name: 'bool', display_name: 'True/False' },
  { name: 'date', display_name: 'Date' },
  { name: 'string', display_name: 'Text' },
  { name: 'binary', display_name: 'Binary' },
  { name: 'float', display_name: 'Decimal' },
  { name: 'list', display_name: 'List' },
  { name: 'hash', display_name: 'Key/Value {}' },
  { name: 'int', display_name: 'Integer' },
  { name: 'rgbcolor', display_name: 'RGB Color' },
];

function AutoField<T = any>({
  name,
  onChange,
  value,
  default_value,
  defaultType,
  defaultInternalType,
  requestFieldData,
  type,
  noSoft,
  path,
  arg_schema,
  compact,
  column,
  level = 0,
  canBeNull,
  isConfigItem,
  isVariable,
  allowedTypes,
  element_type,
  ui_element_type,
  disableManagement,
  allowSaving,
  showSavedValues,
  uniqueName,
  componentOverrides,
  // qorus#347-followup (scope forwarding): destructure so it does NOT
  // land in `...rest` — otherwise the primitive field renderers spread
  // rest onto DOM nodes and React warns about the unknown attribute.
  // Only the nested arg_schema mount sites re-forward this into their
  // sub-forms explicitly.
  inheritedFromParent,
  ...rest
}: IAutoFieldProps & T) {
  const [currentType, setType] = useState<IQorusType>(defaultInternalType || null);
  const [currentInternalType, setInternalType] = useState<IQorusType>(
    defaultInternalType || 'any'
  );
  const [isSetToNull, setIsSetToNull] = useState<boolean>(false);
  const [finalArgSchema, setFinalArgSchema] = useState<IOptionsSchema>(
    typeof arg_schema === 'string' ? undefined : arg_schema
  );
  const [error, setError] = useState<string>();

  useWhyDidYouUpdate(`Auto field ${name} ${currentType}`, {
    name,
    onChange,
    value,
    default_value,
    defaultType,
    defaultInternalType,
    requestFieldData,
    type,
    noSoft,
    path,
    arg_schema,
    column,
    level,
    canBeNull,
    isConfigItem,
    isVariable,
    allowedTypes,
    element_type,
    disableManagement,
    allowSaving,
    showSavedValues,
    uniqueName,
    ...rest,
  });

  // Some arg schemas are not provided as objects, but as strings
  // so we need to fetch them
  useEffect(() => {
    if (typeof arg_schema === 'string') {
      (async () => {
        const schema = await query<IOptionsSchema>({
          url: `dataprovider/arg_schemas/${arg_schema}`,
          method: 'GET',
        });

        if (schema.ok) {
          setError(undefined);
          setFinalArgSchema(schema.data);
        } else {
          setError(schema.error);
        }
      })();
    } else {
      setError(undefined);
      setFinalArgSchema(arg_schema);
    }
  }, [JSON.stringify(arg_schema)]);

  useMount(() => {
    let defType: IQorusType = defaultType && (defaultType.replace(/"/g, '').trim() as any);

    // If default type was not provided, get the type from the value
    if (!defType) {
      defType = getTypeFromValue(maybeParseYaml(value)) as IQorusType;
    }

    let internalType: IQorusType;
    // If value already exists, but the type is auto or any
    // set the type based on the value
    if (value && (defType === 'auto' || defType === 'any') && !defaultInternalType) {
      internalType = getTypeFromValue(maybeParseYaml(value)) as IQorusType;
    } else {
      internalType = defaultInternalType || defType;
    }

    setInternalType(internalType);
    setType(defType);
    // If the value is null and can be null, set the null flag
    if (
      (getValueOrDefaultValue(value, default_value, _canBeNull(defType)) === 'null' ||
        getValueOrDefaultValue(value, default_value, _canBeNull(defType)) === null) &&
      _canBeNull(defType)
    ) {
      setIsSetToNull(true);
    }
  });

  useUpdateEffect(() => {
    if (defaultType && currentInternalType !== defaultType) {
      setType(defaultType);
      setInternalType(defaultType);
    }
  }, [defaultType]);

  useEffect(() => {
    // Auto field type depends on other fields' value
    // which will be used as a type
    if (rest['type-depends-on']) {
      // Get the requested type
      const typeValue: IQorusType = requestFieldData(rest['type-depends-on'], 'value');
      // Check if the field has the value set yet
      if (typeValue && typeValue !== currentType) {
        // If this is auto / any field
        // set the internal type
        if (typeValue === 'auto' || typeValue === 'any') {
          setInternalType(value ? (getTypeFromValue(maybeParseYaml(value)) as IQorusType) : 'any');
        } else {
          setInternalType(typeValue);
        }
        // Set the new type
        setType(typeValue);
        if (!currentType) {
          handleChange(name, value === undefined ? undefined : value, typeValue);
        } else if (typeValue !== 'any') {
          const typeFromValue =
            value || value === null ? getTypeFromValue(maybeParseYaml(value)) : 'any';

          handleChange(
            name,
            value === null ? null : typeValue === typeFromValue ? value : undefined,
            typeValue
          );
        }
      }
    }
    // If can be undefined was toggled off, but the value right now is null
    // we need to set the ability to be null to false and remove
    if (!_canBeNull() && isSetToNull) {
      setIsSetToNull(false);
      handleChange(name, null);
    }
  });

  const _canBeNull = (type = currentType) => {
    if (type === 'any' || canBeNull) {
      return true;
    }

    if (requestFieldData) {
      return requestFieldData('can_be_undefined', 'value');
    }

    return false;
  };

  const handleChange: (name: string, val: any, type?: IQorusType) => void = useCallback(
    (name, val, type) => {
      const returnType: IQorusType = type || currentType;
      // Run the onchange
      if (onChange && returnType) {
        onChange(name, val, returnType, _canBeNull(returnType));
      }
    },
    [currentInternalType, currentType, onChange]
  );

  const handleListObjectChange = useCallback(
    (name, val, type) => {
      const typedValue = yamlToTyped(val);
      handleChange(name, typedValue?.value, type);
    },
    [handleChange]
  );

  const handleTypeChange: (name: string, type?: IQorusType) => void = (name, type) => {
    // Run the onchange
    onChange?.(name, null, 'auto');
    setInternalType(type);
  };

  const handleNullToggle = () => {
    setType(defaultType || 'any');
    setInternalType(defaultType || 'any');
    setIsSetToNull((current) => {
      return !current;
    });

    // Handle change
    handleChange(name, isSetToNull ? undefined : null);
  };

  // SEAM (reqraft): consumer-injected editors for types reqraft doesn't
  // ship (the IDE's processor-mappings, tool-catalog, test-cases,
  // active-windows, collection-documents, data-provider, interface
  // selectors, code-editor, …).
  const Override =
    componentOverrides?.[type as string] || componentOverrides?.[(rest as any).ui_type];
  if (Override) {
    return (
      <Override
        {...rest}
        name={name}
        value={value}
        onChange={(val: any, emittedType?: IQorusType, emittedIsFunction?: boolean) => {
          const returnType = emittedType || currentType;
          if (onChange && returnType) {
            onChange(name, val, returnType, emittedIsFunction);
          }
        }}
      />
    );
  }

  // Render the structured DataSchema editor for the schema object's
  // `definition` hash — server-driven via `?action=options` (qorus#225).
  if (
    (type as string) === 'schema-definition' ||
    (rest as any).ui_type === 'schema-definition'
  ) {
    return (
      <SchemaDefinitionEditor
        {...((rest as any).fieldProps || {})}
        value={
          value === null || value === undefined
            ? undefined
            : (value as IDataSchemaDefinition)
        }
        onChange={(definition) => handleChange(name, definition, 'hash')}
        readOnly={rest.readonly || rest.disabled}
      />
    );
  }

  // Render the Monaco DPQL editor for a DPQL match-expression field
  // (alert rules / silences opt their `match` field in via `ui_type`).
  if ((type as string) === 'dpql' || (rest as any).ui_type === 'dpql') {
    return (
      <DpqlEditor
        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
        onChange={(next) => handleChange(name, next, 'string')}
        readOnly={rest.readonly || rest.disabled}
      />
    );
  }

  if (arg_schema && !finalArgSchema) {
    return <ReqoreSpinner size='small'>Loading field data...</ReqoreSpinner>;
  }

  const renderAllowedValues = (currentType: IQorusType) => {
    if (rest.allowed_values_creatable && (!currentInternalType || currentInternalType === 'auto')) {
      return null;
    }

    return (
      <FieldAllowedValues
        items={rest.allowed_values}
        type={currentType as TQorusType}
        elementType={ui_element_type || element_type}
        value={value}
        name={name}
        onChange={handleChange}
        size={rest.size}
        disabled={rest.disabled}
        app={rest.app}
        action={rest.action}
        showDescription={rest.showDescription}
        forceDropdown={rest.forceDropdown}
        allowCreation={rest.allowed_values_creatable}
        showSavedValues={showSavedValues}
        readOnly={rest.readonly}
        canAutoSelect={!size(rest.required_groups)}
      />
    );
  };

  const renderField = (currentType: IQorusType) => {
    // If this field is set to null
    if (isSetToNull) {
      // Render a readonly field with null
      return <StringFormField value='null' readOnly />;
    }

    if (!currentType) {
      return null;
    }
    // Check if there is a `<` in the type
    const pos: number = (currentType as string).indexOf('<');

    if (pos > 0) {
      // Get the type from start to the position of the `<`
      currentType = (currentType as string).slice(0, pos) as IQorusType;
    }

    // Readonly fields whose value is a primitive (string / number / boolean)
    // get the compact button shortcut below. Complex values — Slate
    // documents for richtext, lists, hashes — MUST fall through to the
    // switch-case so their kind-specific renderer (RichTextField,
    // LongStringField, …) handles the read-only display. Rendering a Slate
    // doc as a ReqoreButton label otherwise lands an object in JSX
    // children and React crashes with "Objects are not valid as a React
    // child (found: object with keys {type, children})".
    const isPrimitiveValue =
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';

    if (rest.readonly && isPrimitiveValue) {
      return (
        <ReqoreButton
          readOnly
          fluid
          label={value === default_value ? rest.default_value_display_name || value : value}
          customTheme={{
            main: 'main:darken:2',
          }}
          description={value === default_value ? rest.default_value_desc : undefined}
        />
      );
    }

    // Non-creatable allowed_values render through FieldAllowedValues
    // (`renderAllowedValues` below) — a radio CheckGroup for ≤3 simple values, a
    // Select otherwise — matching the IDE (which returns null here). `enum` is the
    // exception: FieldAllowedValues skips it (it has its own `case 'enum'` radio
    // renderer), so let enum fall through. f5f2e11 had returned a second RadioGroup
    // here, which duplicated FieldAllowedValues for string allowed-value fields.
    if (rest.allowed_values && !rest.allowed_values_creatable && currentType !== 'enum') {
      return null;
    }

    const renderFieldComponent = () => {
      // Render the field based on the type. SEAM (reqraft): `long-string` is
      // reqraft FormField vocabulary — the IDE calls it `string` (both render
      // the textarea field).
      switch (currentType) {
        case 'string':
        case 'data':
        case 'binary':
        case 'long-string':
          return (
            <LongStringFormField
              {...rest}
              onChange={(value) => handleChange(name, value)}
              value={value}
            />
          );
        // reqraft ships these editors (see Field.tsx), but the compact /
        // TemplateField path dispatches through AutoFormField — bridge them so
        // they render here instead of falling through to "Unknown type!".
        case 'markdown':
          return (
            <MarkdownFormField
              {...rest}
              onChange={(value) => handleChange(name, value)}
              value={value}
            />
          );
        case 'cron':
          return (
            <CronFormField
              {...rest}
              onChange={(value) => handleChange(name, value)}
              value={value}
            />
          );
        case 'processor':
        case 'richtext': {
          return (
            <RichTextFormField
              {...rest}
              onChange={(value) => {
                handleChange(name, value);
              }}
              value={value}
            />
          );
        }
        case 'bool':
        case 'boolean':
          return (
            <BooleanFormField
              {...rest}
              checked={!!value}
              onChange={(checked) => handleChange(name, checked)}
            />
          );
        case 'date':
          return (
            <DateFormField
              {...rest}
              onChange={(val) => handleChange(name, val)}
              value={value}
            />
          );
        case 'hash':
        case 'free-hash': {
          if (finalArgSchema) {
            return (
              <FormEngine
                wrapperPadding='top'
                flat
                compact={compact}
                // Embedded sub-form: no scroll context of its own, so its toolbar
                // isn't sticky and its header stays transparent (no dark backdrop).
                compactNested
                name={name}
                uniqueName={uniqueName}
                options={finalArgSchema}
                value={value === null ? undefined : value}
                templateFieldProps={{
                  level: level + 1,
                }}
                allowTemplates
                onChange={(name, value) => {
                  handleChange(name, value, 'hash');
                }}
                columns={1}
                minColumnWidth='150px'
                stringTemplates={rest.templates}
                size={rest.size}
                disabled={rest.disabled}
                // Forward consumer-injected editors into the nested sub-form
                // so its own fields can render host-injected types (e.g. a
                // `code-editor` override for a `body` sub-field inside a
                // list-of-hash row). Was missing pre-qorus#347-followup —
                // catches an existing gap surfaced by the nested inherit_props
                // story.
                componentOverrides={componentOverrides}
                // qorus#347-followup (scope forwarding): thread the accumulated
                // inheritance bag into the nested sub-form so its own fields'
                // `inherit_props` can reach ancestor-scope values (e.g. a
                // service-method row's `body` picking up `language` from the
                // parent service form). The parent FormEngine populates this
                // via TemplateField -> AutoFormField's `rest`.
                inheritedFromParent={inheritedFromParent}
              />
            );
          }

          const yamlValue = value ? typedToYaml({ type: 'hash', value }) : value;

          return (
            <ReqraftObjectFormField
              value={yamlValue}
              onChange={(value) => handleListObjectChange(name, value, 'hash')}
              type='object'
              dataType='yaml'
              resultDataType='yaml'
              {...rest}
            />
          );
        }
        case 'list':
        case 'free-list': {
          if (
            ui_element_type ||
            element_type ||
            (rest.element_allowed_values && !rest.element_allowed_values_creatable)
          ) {
            const formatToServerValue = (value) => {
              return (value || []).map((item) => {
                // If this value is actually in allowed values, just return it
                if (rest.element_allowed_values?.find((ev) => isEqual(ev.value, item))) {
                  return item;
                }

                return {
                  value: item,
                  type:
                    ui_element_type ||
                    element_type ||
                    rest.element_allowed_values?.find((ev) => isEqual(ev.value, item))?.ui_type,
                };
              });
            };

            const formatFromServerValue = (value) => {
              return (value || []).map((item) => item?.value);
            };

            const mappedAllowedValues = rest.element_allowed_values?.map((ev) => ({
              ...ev,
              value: ev.value?.value,
            }));

            if (
              rest.element_allowed_values &&
              !rest.element_allowed_values_creatable &&
              !rest.allowed_values_creatable
            ) {
              if (size(rest.element_allowed_values) <= 3) {
                return (
                  <FieldAllowedValuesCheckGroup
                    items={mappedAllowedValues}
                    value={formatFromServerValue(value)}
                    multiSelect
                    onChange={(_name, value) => {
                      handleChange(name, formatToServerValue(value));
                    }}
                  />
                );
              }

              return (
                <MultiSelectFormField
                  items={mappedAllowedValues}
                  value={formatFromServerValue(value)}
                  onChange={(selected) => {
                    handleChange(name, formatToServerValue(selected));
                  }}
                  disabled={rest.disabled}
                  size={rest.size}
                />
              );
            }

            const effectiveElementType = ui_element_type || element_type;

            return (
              <ArrayAuto
                {...rest}
                level={level + 1}
                arg_schema={finalArgSchema}
                name={name}
                value={formatFromServerValue(value)}
                allowed_values={rest.element_allowed_values}
                allowed_values_creatable={rest.element_allowed_values_creatable}
                type={effectiveElementType}
                componentOverrides={componentOverrides}
                // qorus#347-followup (scope forwarding): thread the accumulated
                // inheritance bag through the list wrapper so each row's
                // arg_schema sub-form sees it. ArrayAuto forwards this via
                // TemplateField's `rest` into each row's AutoFormField, which
                // hands it to the row's nested FormEngine (case 'hash' above).
                inheritedFromParent={inheritedFromParent}
                onChange={(name, value) => {
                  if (!size(value)) {
                    return handleChange(name, undefined);
                  }

                  handleChange(name, formatToServerValue(value));
                }}
              />
            );
          }

          const yamlValue = value ? typedToYaml({ type: 'list', value }) : value;

          return (
            <ReqraftObjectFormField
              value={yamlValue}
              onChange={(value) => handleListObjectChange(name, value, 'list')}
              type='array'
              dataType='yaml'
              resultDataType='yaml'
              {...rest}
            />
          );
        }
        case 'int':
        case 'integer':
        case 'float':
        case 'number':
          return (
            <NumberFormField
              {...rest}
              onChange={(value) => handleChange(name, value)}
              value={value}
            />
          );
        // A connection's `connect_timeout` / `timeout` arrive from
        // `getCreateConnectionOptions` as `type: 'timeout'` with a bare-integer
        // default (45000) and an "in milliseconds" description. The value stays
        // that integer millisecond count — TimeoutFormField only adds the
        // unit-aware display. Extras are trimmed the same way as `byte-size`
        // below: `rest` carries `templates`, which would flip the inner
        // NumberFormField into its templates-dropdown variant.
        case 'timeout':
          return (
            <TimeoutFormField
              value={value}
              onChange={(val) => handleChange(name, val)}
              disabled={rest.disabled}
              readOnly={rest.readonly}
              size={rest.size}
              aria-label={rest['aria-label']}
            />
          );
        case 'byte-size':
          // The IDE spreads `{...rest}` here but its ByteSizeField ignores
          // extras — reqraft's forwards them into the amount input, and `rest`
          // carries `templates` (which would flip NumberFormField into its
          // templates-dropdown variant), so only `aria-label` is forwarded.
          return (
            <ByteSizeFormField
              value={value}
              onChange={(val) => handleChange(name, val)}
              disabled={rest.disabled}
              readOnly={rest.readonly}
              size={rest.size}
              aria-label={rest['aria-label']}
            />
          );
        case 'enum': {
          // Two option shapes describe the same enum: reqraft `allowed_values`
          // ({ value: { type, value }, display_name, image }) and the IDE
          // `items` ({ value, title, display_name?, image? }). Accept both so a
          // server-driven enum field (e.g. language) renders its choices —
          // previously only `allowed_values` was read, leaving `items` empty.
          const enumItems = (rest.allowed_values as any[] | undefined)?.length
            ? (rest.allowed_values as any[]).map((av) => ({
                label: av.display_name ?? String(av.value?.value ?? av.value),
                value: av.value?.value ?? av.value,
                image: av.image,
                icon: av.icon,
              }))
            : ((rest as any).items as any[] | undefined ?? []).map((it) => ({
                label: it.display_name ?? it.title ?? String(it.value),
                value: it.value,
                image: it.image,
                icon: it.icon,
              }));
          return (
            <RadioGroupFormField
              items={enumItems}
              value={value}
              onChange={(val) => handleChange(name, val)}
              disabled={rest.disabled}
            />
          );
        }
        case 'url': {
          return (
            <UrlFormField
              {...rest}
              value={value}
              onChange={(val) => handleChange(name, val)}
            />
          );
        }
        case 'select-string': {
          return (
            <SelectFormField
              items={(rest.allowed_values || []).map((av) => ({
                ...av,
                value: av.value?.value,
              }))}
              value={value}
              onChange={(val) => handleChange(name, val)}
            />
          );
        }
        case 'select-array':
        case 'multi-select': {
          return (
            <MultiSelectFormField
              items={rest.allowed_values ?? []}
              value={(value as unknown[]) ?? []}
              onChange={(selected) => handleChange(name, selected)}
              canCreateItems={rest.allowed_values_creatable || !size(rest.allowed_values)}
              disabled={rest.disabled}
              size={rest.size}
            />
          );
        }
        case 'file':
        case 'file-as-string': {
          return (
            <ReqraftFileFormField
              onChange={(val) => handleChange(name, val)}
              options={rest.type_options}
              value={value as IFileFormFieldValue}
              argSchema={finalArgSchema as any}
              {...rest}
            />
          );
        }
        case 'rgbcolor': {
          return (
            <ColorFormField
              {...rest}
              value={!value ? undefined : value}
              onChange={(color) => handleChange(name, color)}
            />
          );
        }
        case 'any':
          return null;
        case 'auto':
          return (
            <ReqoreTag
              intent='warning'
              minimal
              icon='ErrorWarningLine'
              label='Please select data type'
            />
          );
        default:
          return <ReqoreTag intent='danger' icon='SpamLine' label='Unknown type!' />;
      }
    };

    return (
      <ReqoreControlGroup vertical={false} fluid={true} verticalAlign='flex-start'>
        {renderFieldComponent()}
      </ReqoreControlGroup>
    );
  };

  const showPicker =
    size(allowedTypes) > 1 ||
    ((!size(rest.allowed_values) ||
      (size(rest?.allowed_values) > 0 && !rest.allowed_values_creatable) ||
      !size(rest.element_allowed_values) ||
      (size(rest?.element_allowed_values) > 0 && !rest.element_allowed_values_creatable)) &&
      !isSetToNull &&
      (defaultType === 'auto' ||
        defaultType === 'any' ||
        currentType === 'auto' ||
        currentType === 'any'));

  const types =
    allowedTypes ||
    (!noSoft
      ? [
          { value: 'bool' },
          { value: 'softbool' },
          { value: 'date' },
          { value: 'string' },
          { value: 'softstring' },
          { value: 'binary' },
          { value: 'float' },
          { value: 'softfloat' },
          { value: 'list' },
          { value: 'softlist' },
          { value: 'hash' },
          { value: 'int' },
          { value: 'softint' },
          { value: 'rgbcolor' },
        ]
      : DefaultNoSoftTypes);

  if (error) {
    return <ReqoreMessage intent='danger'>{error}</ReqoreMessage>;
  }

  if (arg_schema) {
    return (
      <ReqoreControlGroup vertical className='auto-field-schema-wrapper' fluid>
        {renderField(currentInternalType)}
        {currentInternalType && currentInternalType !== 'auto'
          ? renderAllowedValues(currentInternalType)
          : null}
      </ReqoreControlGroup>
    );
  }

  // Render type picker if the type is auto or any
  return (
    <ReqoreErrorBoundary>
      <ReqoreControlGroup {...rest} className={`auto-field-group`} vertical fluid>
        {showPicker && (
          <SelectFormField
            fixed
            flat
            minimal={rest.minimal}
            size={rest.size}
            items={types as ISelectFormFieldItem[]}
            value={currentInternalType}
            onChange={(value) => {
              handleTypeChange(name, value as IQorusType);
            }}
          />
        )}
        {renderField(currentInternalType)}
        {renderAllowedValues(currentInternalType)}
        {canBeNull && (
          <ReqoreButton
            intent={isSetToNull ? 'warning' : undefined}
            icon={isSetToNull ? 'CloseLine' : undefined}
            onClick={handleNullToggle}
            fixed
          >
            {isSetToNull ? 'Unset null' : 'Set as null'}
          </ReqoreButton>
        )}
      </ReqoreControlGroup>
    </ReqoreErrorBoundary>
  );
}

export const AutoFormField = memo(AutoField) as React.FC<IAutoFieldProps>;
