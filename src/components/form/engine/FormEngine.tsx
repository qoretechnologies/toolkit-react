import {
  ReqoreButton,
  ReqoreCollection,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreErrorBoundary,
  ReqoreIcon,
  ReqoreInput,
  ReqoreMessage,
  ReqorePanel,
  ReqoreSkeleton,
  ReqoreTag,
  ReqoreTagGroup,
  ReqoreVerticalSpacer,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { IReqoreCollectionProps } from '@qoretechnologies/reqore/dist/components/Collection';
import { IReqoreCollectionItemProps } from '@qoretechnologies/reqore/dist/components/Collection/item';
import { IReqorePanelProps } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import {
  IQorusFormField,
  IQorusFormFieldMessage,
  IQorusFormFieldOnChangeMeta,
  IQorusFormOperator,
  IQorusFormOperatorsSchema,
  IQorusFormSchema,
  TQorusFlatForm,
  TQorusForm,
  TQorusFormFieldSchema,
  TQorusFormOperatorValue,
  TQorusType,
} from '@qoretechnologies/ts-toolkit';
import { cloneDeep, findKey, flatten, forEach, isEqual, isPlainObject, last } from 'lodash';
import isArray from 'lodash/isArray';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import size from 'lodash/size';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce, useUpdateEffect } from 'react-use';
import { createContext } from 'use-context-selector';
import styled from 'styled-components';
import { getDefaultValue, insertAtIndex, richtextToString } from '../../../helpers/common';
import { getRequiredOptionMessage } from '../../../helpers/options';
import {
  IValidationResult,
  hasAllDependenciesFullfilled,
  validateField,
  validateFieldWithResult,
} from '../../../helpers/validations';
import { useQorusTypes } from '../../../hooks/useQorusTypes';
import { useTemplates } from '../../../hooks/useTemplates';
import { Description } from '../../Description';
import { FocusedEditing } from '../../FocusedEditing';
import { SelectFormField } from '../fields/select/Select';
import {
  ITemplateFieldProps,
  TCustomTemplateItems,
  TemplateField,
  isValueTemplate,
} from '../fields/template/TemplateField';
import { OptionFieldMessages } from './OptionFieldMessages';
import { OptionsHelpDialog } from './OptionsHelpDialog';
import {
  formatOptionValue,
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstCompletion,
} from './readFirst';

// Re-export types for consumers
export type IOptions = TQorusForm;
export type TFlatOptions = TQorusFlatForm;
export type TOption = IQorusFormField;
export type TOperatorValue = TQorusFormOperatorValue;
export interface IOptionFieldMessage extends IQorusFormFieldMessage {}
export type IOptionsSchemaArg = TQorusFormFieldSchema;
export interface IOptionsSchema extends IQorusFormSchema {}
export interface IOperator extends IQorusFormOperator {}
export interface IOperatorsSchema extends IQorusFormOperatorsSchema {}
export interface IOptionsOnChangeMeta extends IQorusFormFieldOnChangeMeta {}

export interface IFormFieldValidityData {
  fieldName: string;
  type: TQorusType;
  value: any;
  validation: IValidationResult;
}

export interface IFormValidityData {
  isValid: boolean;
  fields: IFormFieldValidityData[];
  invalidFields: IFormFieldValidityData[];
}

const NegativeColorEffect: any = {
  gradient: {
    colors: { 0: 'danger', 100: 'danger:darken:2' },
  },
  color: '#ffffff',
  glow: 'danger',
};

const PositiveColorEffect: any = {
  gradient: {
    colors: { 0: 'success', 100: 'success:darken:2' },
  },
  color: '#ffffff',
  glow: 'success',
};

// ─── compact (read-first) layout ────────────────────────────────────────────────
// Flat two-column rows (label | value | action) inside collapsible group panels,
// rather than the classic card-per-field. Colours are theme-derived and passed in
// as props so the layout adapts to light/dark/custom Reqore themes.

const StyledCompactWrap = styled.div`
  display: flex;
  flex-flow: column;
  gap: 10px;
  width: 100%;
  /* Allow the wrap to shrink inside flex/grid parents so its rows' ellipsis can
     engage instead of overflowing the container horizontally. */
  min-width: 0;
  max-width: 100%;

  /* Option logos (e.g. language images) render as <img> inside ReqoreIcon's
     square box; constrain them so portrait PNGs don't overflow the row. */
  .reqore-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const StyledGroupBody = styled.div<{ $divider: string; $hover: string; $focus: string }>`
  display: flex;
  flex-flow: column;

  .readfirst-row {
    display: grid;
    /* The value column is minmax(0, 1fr) — a bare 1fr keeps its min-content
       width, so a long unbroken value (e.g. a URL) would force the grid wider
       than its container and produce a horizontal scrollbar. The 0 minimum lets
       it shrink and the value cell's ellipsis take over instead. */
    grid-template-columns: minmax(120px, 220px) minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    min-height: 38px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .readfirst-row + .readfirst-row {
    border-top: 1px solid ${({ $divider }) => $divider};
  }
  .readfirst-row:hover {
    background: ${({ $hover }) => $hover};
  }
  .readfirst-row:focus-visible {
    outline: 2px solid ${({ $focus }) => $focus};
    outline-offset: -2px;
    background: ${({ $hover }) => $hover};
  }
  /* A hidden (not-yet-added) field surfaced by the search is dimmed. */
  .readfirst-row-hidden {
    opacity: 0.65;
  }
  .readfirst-action {
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .readfirst-row:hover .readfirst-action,
  .readfirst-row:focus-visible .readfirst-action {
    opacity: 0.85;
  }
`;

// The completion meter + toolbar (search / Fields menu) stay pinned to the top of
// the scroll area while the field groups scroll beneath, so filtering and adding
// optional fields are always reachable. The opaque background masks rows passing
// underneath. (Sticky needs a scrolling ancestor with no clipping `overflow`
// between it and this element — the standard form container provides one.)
const StyledCompactHeader = styled.div<{ $bg: string }>`
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-flow: column;
  gap: 10px;
  padding-bottom: 10px;
  background: ${({ $bg }) => $bg};
`;

const StyledEditCard = styled.div<{ $bg: string; $border: string }>`
  padding: 12px;
  display: flex;
  flex-flow: column;
  gap: 8px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;
`;

// Completion meter: a single inline row — label | track (fills remaining) | percent.
const StyledCompletion = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 2px;
`;
const StyledCompletionTrack = styled.div<{ $bg: string; $fill: string }>`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: ${({ $bg }) => $bg};
  overflow: hidden;
  & > div {
    height: 100%;
    border-radius: 3px;
    background: ${({ $fill }) => $fill};
    transition: width 0.25s ease;
  }
`;
const StyledCompletionLabel = styled.span<{ $color: string }>`
  font-size: 12px;
  color: ${({ $color }) => $color};
  white-space: nowrap;
`;

export const getType = (
  type: TQorusType | TQorusType[],
  operators?: IOperatorsSchema,
  operator?: TOperatorValue
): TQorusType => {
  const finalType = getTypeFromOperator(operators, fixOperatorValue(operator)) || type;
  return (isArray(finalType) ? finalType[0] : finalType) as TQorusType;
};

const getTypeFromOperator = (
  operators?: IOperatorsSchema,
  operatorData?: (string | null | undefined)[]
): TQorusType | null => {
  if (!operators || !operatorData || !size(operatorData) || !last(operatorData)) {
    return null;
  }
  return (operators[last(operatorData) as string]?.type as TQorusType) || null;
};

export const fixOperatorValue = (operator: TOperatorValue): (string | null | undefined)[] => {
  return isArray(operator) ? operator : [operator];
};

export const hasRequiredOptions = (options: IQorusFormSchema = {}) => {
  return !!findKey(options, (option) => option.required);
};

export const OptionsContext = createContext<{
  schema?: IQorusFormSchema;
  value?: TQorusForm;
}>({});

export const fixOptions = (
  value: TQorusForm | TQorusFlatForm = {},
  options: IQorusFormSchema,
  operators?: IOperatorsSchema
): TQorusForm => {
  const fixedValue = cloneDeep(value);

  forEach(options, (option, name) => {
    if (
      option.value ||
      option.required_groups ||
      ((option.required || option.preselected) && !fixedValue[name]) ||
      ((option.required || option.preselected) && option.default_value && !option.value)
    ) {
      let obj: IQorusFormField;
      const type = getType(
        (option.ui_type || option.type) as TQorusType,
        operators,
        (fixedValue[name] as IQorusFormField)?.op
      );

      if (
        (option.default_value as IQorusFormField)?.is_expression &&
        (fixedValue[name] as IQorusFormField)?.value === undefined
      ) {
        obj = option.default_value as IQorusFormField;
      } else {
        obj = {
          type,
          value:
            (typeof fixedValue[name] === 'object' ?
              (fixedValue[name] as IQorusFormField)?.value
            : fixedValue[name]) ??
            option.value ??
            getDefaultValue(option),
        };

        if ((fixedValue[name] as IQorusFormField)?.is_expression) {
          obj.is_expression = true;
        }
      }

      fixedValue[name] = obj;
    }
  });

  const res = reduce(
    fixedValue,
    (newValue, option, optionName) => {
      let newOption = option as IQorusFormField;

      if (!isPlainObject(newOption) || !(newOption as IQorusFormField)?.type) {
        const fixedOption: IQorusFormField = {
          type: getType(
            (options?.[optionName]?.ui_type || options?.[optionName]?.type) as TQorusType,
            operators,
            (newOption as IQorusFormField)?.op
          ),
          value: newOption,
        };

        if ((newOption as IQorusFormField)?.is_expression) {
          fixedOption.is_expression = true;
        }

        newOption = fixedOption;
      }

      if (
        newOption.value !== undefined &&
        options?.[optionName]?.allowed_values &&
        !options?.[optionName]?.allowed_values?.find(
          (allowedValue: any) =>
            allowedValue.value?.value === newOption.value || allowedValue.name === newOption.value
        ) &&
        !isValueTemplate(newOption.value) &&
        !options?.[optionName]?.multiselect &&
        !options?.[optionName]?.allowed_values_creatable
      ) {
        newOption.value = undefined;
      }

      if (
        newOption.value &&
        options?.[optionName]?.readonly &&
        options?.[optionName]?.default_value &&
        getDefaultValue(options?.[optionName]) !== newOption.value
      ) {
        newOption.value = getDefaultValue(options[optionName]);
      }

      return { ...newValue, [optionName]: newOption };
    },
    {} as TQorusForm
  );

  return res;
};

export const flattenOptions = (options: TQorusForm): TQorusFlatForm => {
  return reduce(
    options,
    (newOptions, option, optionName) => {
      return {
        ...newOptions,
        [optionName]: typeof option === 'object' ? (option as IQorusFormField)?.value : option,
      };
    },
    {} as TQorusFlatForm
  );
};

export const getTypeAndCanBeNull = (
  type: TQorusType | TQorusType[],
  allowed_values?: any[],
  operatorData?: TOperatorValue,
  operators?: IOperatorsSchema
) => {
  let canBeNull = false;
  let realType = getType(type, operators, operatorData);

  realType = realType.replace('soft', '') as TQorusType;
  realType = realType.replace(/<[^>]*>/g, '') as TQorusType;

  if (realType?.startsWith('*')) {
    realType = realType.replace('*', '') as TQorusType;
    canBeNull = true;
  }

  realType = (realType === 'string' && allowed_values ? 'string' : realType) as TQorusType;

  return {
    type: realType,
    defaultType: realType,
    defaultInternalType: realType === 'auto' || realType === 'any' ? undefined : realType,
    canBeNull,
  };
};

/**
 * Display metadata for a read-first group, keyed by the option's raw `group`
 * string (e.g. `info`, `scaling`). The server only sends the bare group key, so
 * the consumer supplies the label / icon / order here; anything omitted falls
 * back to a title-cased key, no icon, and schema order.
 */
export interface IFormEngineGroup {
  label?: string;
  icon?: IReqoreIconName;
  subtitle?: string;
  sort?: number;
}

export interface IFormEngineProps extends Omit<IReqoreCollectionProps, 'onChange'> {
  name: string;
  uniqueName?: string;
  value?: TQorusForm | TQorusFlatForm;
  options?: IQorusFormSchema;
  onChange?: (name: string, value?: TQorusForm, meta?: IOptionsOnChangeMeta) => void;
  onSingleOptionsChange?: (name: string, value: TOption) => void;
  onDependableOptionChange?: (
    name: string,
    value: TOption,
    options: TQorusForm,
    schema: IQorusFormSchema
  ) => void;
  placeholder?: string;
  noValueString?: string;
  isValid?: boolean;
  onOptionsLoaded?: (options: IQorusFormSchema) => void;
  recordRequiresSearchOptions?: boolean;
  readOnly?: boolean;
  allowTemplates?: boolean;
  stringTemplates?: IReqoreFormTemplates;
  templateFieldProps?: Partial<ITemplateFieldProps>;
  showTypeToggle?: boolean;
  /**
   * Render the form in **compact (read-first)** mode: each option is shown as a
   * row with its current value, grouped by the option's `group`, with a
   * completion meter at the top; clicking a row expands the real editor inline
   * and a "Done" action collapses it again. The search box, sort, and outer
   * label are hidden. Defaults to the classic always-expanded layout.
   */
  compact?: boolean;
  /**
   * Compact mode only: per-group display metadata (label / icon / subtitle /
   * order), keyed by the option's raw `group` string. The server doesn't define
   * group display info, so the consumer supplies it here.
   */
  groups?: Record<string, IFormEngineGroup>;
  /**
   * Async schema source. When provided (and `options` is not), the engine calls
   * this on mount and whenever the callback's identity changes, owns the
   * loading / error / refetch lifecycle itself, and renders the loaded schema.
   *
   * The callback is **transport-agnostic**: the consumer fetches the schema
   * however it likes (e.g. from a backend endpoint) and resolves it — the engine
   * never learns about any specific data source. Memoize it (e.g. `useCallback`)
   * keyed on its inputs, since a new identity triggers a refetch. On success
   * `onOptionsLoaded` fires with the loaded schema; a rejection renders an error.
   */
  optionsLoader?: () => Promise<IQorusFormSchema>;
  onValidityChange?: (isValid: boolean, data: IFormValidityData) => void;
}

export const FormEngine = ({
  name,
  uniqueName,
  value,
  onChange,
  onSingleOptionsChange,
  onDependableOptionChange,
  placeholder,
  noValueString, // eslint-disable-line @typescript-eslint/no-unused-vars
  isValid, // eslint-disable-line @typescript-eslint/no-unused-vars
  onOptionsLoaded,
  recordRequiresSearchOptions,
  readOnly,
  allowTemplates = true,
  templateFieldProps,
  showTypeToggle = true,
  compact,
  groups,
  optionsLoader,
  onValidityChange,
  ...rest
}: IFormEngineProps) => {
  const [options, setOptions] = useState<IQorusFormSchema | undefined>(rest?.options || undefined);
  // When `optionsLoader` is supplied, the engine fetches the schema itself and
  // tracks the async lifecycle here: `optionsLoading` feeds the skeleton gate,
  // `optionsError` surfaces a failed load.
  const [optionsLoading, setOptionsLoading] = useState<boolean>(!!optionsLoader && !rest?.options);
  const [optionsError, setOptionsError] = useState<string | undefined>();
  const [operators] = useState<IOperatorsSchema | undefined>(undefined);
  const confirmAction = useReqoreProperty('confirmAction');
  const theme = useReqoreTheme();
  const [focusedEditing, setFocusedEditing] = useState<string>();
  const [showFieldTypes, setShowFieldTypes] = useState<boolean>(false);
  const [showHelpForOption, setShowHelpForOption] = useState<string | undefined>();
  const [showInvalidOptionsOnly, setShowInvalidOptionsOnly] = useState<boolean>(false);
  // Read-first (compact) mode: which options are currently expanded into their
  // editor. Collapsed options show their formatted value only; clicking a row
  // reveals the real field. Multiple rows can be open at once.
  const [expandedOptions, setExpandedOptions] = useState<string[]>([]);
  // Compact-mode toolbar state: narrow the rows to required fields, and/or
  // free-text filter by label. Both only affect which rows are listed — the
  // completion meter still reflects the full set.
  const [requiredOnly, setRequiredOnly] = useState<boolean>(false);
  const [compactQuery, setCompactQuery] = useState<string>('');
  const [localValue, setLocalValue] = useState<{
    fields: TQorusForm | TQorusFlatForm;
    meta?: IOptionsOnChangeMeta;
  }>(() => ({
    fields: fixOptions(value, options || {}),
    meta: undefined,
  }));
  const originalValue = useRef<any>();
  // Track the last value we emitted via onChange so we can skip re-applying fixOptions
  // when the parent echoes it back as the new value prop (controlled component loop prevention)
  const lastEmittedValue = useRef<TQorusForm | TQorusFlatForm | undefined>(value);

  if (originalValue.current === undefined && size(value)) {
    originalValue.current = localValue.fields;
  }

  const unavailableOptionsCount = useRef(0);
  const { compactValue, loading: typesLoading } = useQorusTypes();
  const templates = useTemplates(allowTemplates, rest.stringTemplates);

  useDebounce(
    () => {
      if (isEqual(localValue.fields, value)) {
        return;
      }

      const toEmit = size(localValue.fields) ? (localValue.fields as TQorusForm) : undefined;
      lastEmittedValue.current = toEmit;
      onChange?.(name, toEmit, size(localValue.meta) ? localValue.meta : undefined);
    },
    0,
    [JSON.stringify(localValue)]
  );

  useUpdateEffect(() => {
    // When a loader owns the schema, ignore controlled `options` syncs so a
    // late/undefined `options` prop can't clobber the loaded schema.
    if (optionsLoader) {
      return;
    }
    setOptions(rest.options);
  }, [JSON.stringify(rest.options)]);

  // `optionsLoader`: fetch the schema on mount and whenever the loader identity
  // changes. The engine owns the loading/error lifecycle; the loader itself is
  // transport-agnostic (the consumer decides how the schema is fetched).
  useEffect(() => {
    if (!optionsLoader) {
      return undefined;
    }

    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError(undefined);

    // `Promise.resolve().then(...)` so a synchronous throw in the loader is
    // funnelled into the same rejection path as an async failure.
    Promise.resolve()
      .then(() => optionsLoader())
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setOptions(loaded || {});
        onOptionsLoaded?.(loaded || {});
        setOptionsLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setOptionsError(
          error instanceof Error ? error.message : String(error ?? 'Failed to load options')
        );
        setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsLoader]);

  useUpdateEffect(() => {
    const fixedValue = fixOptions(value, options || {});

    // When the value we're receiving is the one we just emitted AND fixOptions has nothing to
    // add or change (fixedValue equals value), skip the update. This breaks the controlled-component
    // loop for arg_schema fields while still allowing required/preselected options to be restored
    // (in that case fixedValue will differ from value, so we don't skip).
    // Note: compare fixedValue against value, not localValue.fields — localValue may have been
    // updated by nested FormEngine emissions, so comparing against it would never skip.
    if (isEqual(value, lastEmittedValue.current) && isEqual(fixedValue, value)) {
      return;
    }

    if (!originalValue.current && size(fixedValue)) {
      originalValue.current = fixedValue;
    }

    setLocalValue?.({ fields: fixedValue, meta: undefined });
  }, [JSON.stringify(options), JSON.stringify(value)]);

  const handleValueChange = useCallback(
    (optionName: string, val?: any, _type?: string) => {
      setLocalValue(({ fields = {} }) => {
        const schemaType = (options?.[optionName]?.ui_type ||
          options?.[optionName]?.type) as TQorusType;
        const isAnyLike = schemaType === 'any' || schemaType === 'auto';
        // For any/auto schema types, preserve the user's chosen type stored in the field
        const resolvedSchemaType =
          isAnyLike && (fields[optionName] as IQorusFormField)?.type ?
            ((fields[optionName] as IQorusFormField).type as TQorusType)
          : schemaType || ((fields[optionName] as IQorusFormField)?.type as TQorusType);
        const type =
          _type ||
          getTypeAndCanBeNull(resolvedSchemaType, options?.[optionName]?.allowed_values).type;

        if (!(fields as TQorusForm)[optionName]) {
          const defaultOperators: TOperatorValue = reduce(
            operators || {},
            (filteredOperators: TOperatorValue, operator, operatorKey) => {
              if (operator.selected) {
                return [...(filteredOperators as string[]), operatorKey];
              }
              return filteredOperators;
            },
            []
          );
          if ((defaultOperators as string[])?.length) {
            return {
              fields: {
                ...fields,
                [optionName]: {
                  type,
                  value: val,
                  op: defaultOperators,
                },
              },
            };
          }
        }

        const updatedValue: TQorusForm = {
          ...(fields as TQorusForm),
          [optionName]: {
            ...(fields as TQorusForm)[optionName],
            type: type as TQorusType,
            value: val,
          },
        };

        delete updatedValue[optionName].is_expression;

        const meta: IOptionsOnChangeMeta = {};

        if (
          options?.[optionName]?.has_dependents &&
          val !== undefined &&
          val !== (fields as TQorusForm)[optionName]?.value
        ) {
          forEach(options, (option, depName) => {
            if (
              option.depends_on &&
              flatten(option.depends_on).includes(optionName) &&
              updatedValue[depName]
            ) {
              updatedValue[depName].value = undefined;
            }
          });

          onDependableOptionChange?.(optionName, val, updatedValue, options);
        }

        if (size(options?.[optionName]?.on_change)) {
          meta.events = options?.[optionName]?.on_change;
        }

        onSingleOptionsChange?.(optionName, updatedValue[optionName]);

        return {
          fields: updatedValue,
          meta,
        };
      });
    },
    [
      onSingleOptionsChange,
      onDependableOptionChange,
      JSON.stringify(options),
      JSON.stringify(operators),
    ]
  );

  const handleOperatorChange = useCallback(
    (optionName: string, currentValue: TQorusForm, operator: string, index: number) => {
      setLocalValue?.({
        fields: {
          ...currentValue,
          [optionName]: {
            ...currentValue[optionName],
            op: fixOperatorValue(currentValue[optionName].op).map((op, idx) => {
              if (idx === index) {
                return operator;
              }
              return op as string;
            }),
          },
        },
        meta: undefined,
      });
    },
    []
  );

  const handleAddOperator = useCallback(
    (optionName: string, currentValue: TQorusForm, index: number) => {
      setLocalValue?.({
        fields: {
          ...currentValue,
          [optionName]: {
            ...currentValue[optionName],
            op: insertAtIndex(fixOperatorValue(currentValue[optionName].op), index, null),
          },
        },
        meta: undefined,
      });
    },
    []
  );

  const handleRemoveOperator = useCallback(
    (optionName: string, currentValue: TQorusForm, index: number) => {
      setLocalValue?.({
        fields: {
          ...currentValue,
          [optionName]: {
            ...currentValue[optionName],
            op: fixOperatorValue(currentValue[optionName].op).filter((_op, idx) => idx !== index),
          },
        },
        meta: undefined,
      });
    },
    []
  );

  const buildBadges = useCallback(
    (option: TQorusFormFieldSchema, optionName: string): IReqorePanelProps['badge'] => {
      const badges: IReqorePanelProps['badge'] = [];

      if (option.required || option.required_groups) {
        badges.push({
          icon: 'Asterisk',
          size: 'tiny',
          leftIconProps: {
            size: 'tiny',
          },
          color: 'transparent',
          minimal: true,
          iconColor: option.required_groups ? 'warning:lighten:7' : 'danger:lighten:7',
          tooltip: {
            delay: 300,
            content: getRequiredOptionMessage(options || {}, option.required_groups, optionName),
          },
        });
      }

      if (option.has_dependents) {
        badges.push({
          icon: 'LinkUnlink',
          intent: 'info',
          size: 'tiny',
          tooltip: {
            content:
              'Other options depend on this option, changing it may result in configuration changes.',
            delay: 300,
          },
        });
      }

      return badges;
    },
    [options]
  );

  const fixedValue: TQorusForm = (localValue.fields || {}) as TQorusForm;

  const removeSelectedOption = useCallback((optionName: string) => {
    setLocalValue?.(({ fields }) => {
      const newFields = cloneDeep(fields as TQorusForm);
      delete newFields[optionName];
      return {
        fields: newFields,
        meta: undefined,
      };
    });
  }, []);

  const handleAddOptionalFieldChange = useCallback(
    (_name: string, optionName: unknown) => {
      handleValueChange(
        optionName as string,
        getDefaultValue(options?.[optionName as string]),
        getTypeAndCanBeNull(
          (options?.[optionName as string]?.ui_type ||
            options?.[optionName as string]?.type) as TQorusType,
          options?.[optionName as string]?.allowed_values
        ).type
      );
    },
    [JSON.stringify(options), handleValueChange]
  );

  const availableOptions: TQorusForm = useMemo(() => {
    if (!options) {
      return {};
    }
    unavailableOptionsCount.current = 0;

    return Object.keys(fixedValue)
      .sort((a, b) => {
        const aSort = (options[a] as any)?.sort || 0;
        const bSort = (options[b] as any)?.sort || 0;
        return aSort - bSort;
      })
      .reduce((newValue: TQorusForm, optionName) => {
        const option = fixedValue[optionName];
        if (!options?.[optionName]) {
          unavailableOptionsCount.current += 1;
          removeSelectedOption(optionName);
          return newValue;
        }

        const schemaType = getType(
          (options[optionName].ui_type || options[optionName].type) as TQorusType,
          operators,
          (option as IQorusFormField)?.op
        );

        if (!isPlainObject(option)) {
          return {
            ...newValue,
            [optionName]: {
              type: schemaType,
              value: option,
            },
          };
        }

        // For any/auto schema types the user can pick a specific type — preserve it.
        // For all other schema types, normalize to the schema's type so rendering and
        // validation always use the correct field type (e.g. ui_type:'richtext' wins over type:'string').
        const isAnyLike = schemaType === 'any' || schemaType === 'auto';
        const effectiveType =
          isAnyLike && (option as IQorusFormField)?.type ?
            (option as IQorusFormField).type
          : schemaType;

        return {
          ...newValue,
          [optionName]: { ...(option as IQorusFormField), type: effectiveType },
        };
      }, {});
  }, [
    JSON.stringify(fixedValue),
    JSON.stringify(options),
    unavailableOptionsCount.current,
    JSON.stringify(operators),
    showInvalidOptionsOnly,
  ]);

  const filteredOptions: IQorusFormSchema = useMemo(
    () =>
      reduce(
        options,
        (newOptions, option, optName) => {
          if (optName in fixedValue) {
            return newOptions;
          }
          return { ...newOptions, [optName]: option };
        },
        {} as IQorusFormSchema
      ),
    [JSON.stringify(options), JSON.stringify(fixedValue)]
  );

  const isOptionValid = useCallback(
    (optionName: string, type: TQorusType, optionValue: any) => {
      if (
        !options?.[optionName]?.required &&
        !options?.[optionName]?.required_groups &&
        (optionValue === undefined || optionValue === '')
      ) {
        return true;
      }

      return validateField(getType(type), optionValue, {
        has_to_have_value: true,
        optionSchema: options,
        options: availableOptions,
        ...options?.[optionName],
      } as any);
    },
    [JSON.stringify(options), JSON.stringify(availableOptions), JSON.stringify(localValue.fields)]
  );

  const getValidityData = useCallback((): IFormValidityData => {
    const fields: IFormFieldValidityData[] = reduce(
      availableOptions,
      (result, option, optionName) => {
        const type =
          (option as IQorusFormField).type ||
          (options?.[optionName]?.ui_type as TQorusType) ||
          (options?.[optionName]?.type as TQorusType);
        const optionValue = (option as IQorusFormField).value;

        const isRequired = options?.[optionName]?.required;
        const hasRequiredGroups = !!options?.[optionName]?.required_groups;
        const isEmpty = optionValue === undefined || optionValue === '';

        let validation: IValidationResult;

        if (!isRequired && !hasRequiredGroups && isEmpty) {
          validation = { isValid: true, reasons: [] };
        } else {
          validation = validateFieldWithResult(getType(type), optionValue, {
            has_to_have_value: true,
            optionSchema: options,
            options: availableOptions,
            ...options?.[optionName],
          } as any);
        }

        result.push({
          fieldName: optionName,
          type: getType(type),
          value: optionValue,
          validation,
        });

        return result;
      },
      [] as IFormFieldValidityData[]
    );

    const invalidFields = fields.filter((f) => !f.validation.isValid);

    return {
      isValid: invalidFields.length === 0,
      fields,
      invalidFields,
    };
  }, [
    JSON.stringify(availableOptions),
    JSON.stringify(options),
    JSON.stringify(localValue.fields),
  ]);

  const validityData = useMemo(() => getValidityData(), [getValidityData]);
  const optionsAreValid = validityData.isValid;

  useEffect(() => {
    onValidityChange?.(optionsAreValid, validityData);
  }, [JSON.stringify(validityData)]);

  const shownOptions = useMemo((): TQorusForm => {
    return reduce(
      availableOptions,
      (newValue, option, optionName) => {
        if (
          showInvalidOptionsOnly &&
          isOptionValid(
            optionName,
            (options?.[optionName]?.ui_type as TQorusType) ||
              (options?.[optionName]?.type as TQorusType),
            (option as IQorusFormField).value
          )
        ) {
          return newValue;
        }
        return { ...newValue, [optionName]: option };
      },
      {}
    );
  }, [showInvalidOptionsOnly, JSON.stringify(availableOptions)]);

  const getIntent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (optName: string, type: TQorusType, optValue: any, _op: any): TReqoreIntent => {
      const intent =
        isOptionValid(optName, type, optValue) ? undefined
        : recordRequiresSearchOptions ? 'info'
        : 'danger';

      return intent || (options?.[optName] as any)?.intent;
    },
    [isOptionValid, recordRequiresSearchOptions, JSON.stringify(options)]
  );

  const handleShowFieldTypesClick = useCallback(() => setShowFieldTypes((prev) => !prev), []);
  const handleRevertChangesClick = useCallback(() => {
    setLocalValue({
      fields: originalValue.current,
      meta: undefined,
    });
  }, [JSON.stringify(options), JSON.stringify(originalValue.current)]);

  const hasOptionChanged = useCallback(
    (optionValue: unknown, optionName: string): boolean => {
      return !isEqual(optionValue, originalValue.current?.[optionName]?.value);
    },
    [JSON.stringify(originalValue.current)]
  );

  const handleOptionLabelClick = useCallback((optionName: string) => {
    setShowHelpForOption(optionName);
  }, []);

  const toggleExpandedOption = useCallback((optionName: string) => {
    setExpandedOptions((prev) =>
      prev.includes(optionName) ?
        prev.filter((name) => name !== optionName)
      : [...prev, optionName]
    );
  }, []);

  // Read-first completion summary (how many shown options have a value set),
  // surfaced as a progress meter at the top of the compact form.
  const readFirstCompletion = useMemo(
    () => getReadFirstCompletion(availableOptions as Record<string, IQorusFormField | undefined>),
    [JSON.stringify(availableOptions)]
  );

  const optionalFields = useMemo(
    () =>
      Object.keys(filteredOptions).map((option) => ({
        value: option,
        desc: options?.[option]?.desc,
        short_desc: options?.[option]?.short_desc,
        disabled: options?.[option]?.disabled,
        display_name: options?.[option]?.display_name,
        intent: (options?.[option] as any)?.intent,
        messages: (options?.[option] as any)?.messages,
      })),
    [JSON.stringify(filteredOptions), JSON.stringify(options)]
  );

  // Compact "Fields" menu — Select all: add every not-yet-selected, enabled
  // optional field (mirrors the IDE's handleAddAll).
  const handleAddAllOptional = useCallback(() => {
    forEach(filteredOptions, (schema, optionName) => {
      if (!schema?.disabled) {
        handleAddOptionalFieldChange('options', optionName);
      }
    });
  }, [JSON.stringify(filteredOptions), handleAddOptionalFieldChange]);

  // Compact "Fields" menu — Default fields: drop the optional fields the user
  // added (keep required / preselected / data-carried fields and their values),
  // and clear the required-only filter (mirrors the IDE's handleResetToDefault).
  const handleResetToDefaultFields = useCallback(() => {
    setLocalValue(({ fields }) => {
      const current = (fields || {}) as TQorusForm;
      const next: TQorusForm = {};
      forEach(current, (value, optionName) => {
        const schema = options?.[optionName];
        const isDefault = !!(
          schema?.required ||
          schema?.required_groups ||
          schema?.preselected ||
          originalValue.current?.[optionName]
        );
        if (isDefault) {
          next[optionName] = value as IQorusFormField;
        }
      });
      return { fields: fixOptions(next, options || {}, operators), meta: undefined };
    });
    setRequiredOnly(false);
  }, [JSON.stringify(options), JSON.stringify(operators)]);

  const getCustomMenuTemplateItems = useCallback<(optionName: string) => TCustomTemplateItems>(
    (optionName) => {
      return compactValue?.map((type) => ({
        label: type.display_name,
        description: type.short_desc,
        onClick: (_e: any, removeTemplate: any) => {
          removeTemplate?.();
          handleValueChange(optionName, undefined, type.name);
        },
      }));
    },
    [compactValue, handleValueChange]
  );

  const getTypeForOption = useCallback((type: string) => type, []);

  const renderOption = (optionName: string, { type, ...other }: IQorusFormField) => {
    return (
      <>
        {((options?.[optionName] as any)?.messages || []).map(
          ({ intent, title, content }: any, index: number) => (
            <ReqoreMessage
              intent={intent}
              title={title}
              key={title || index}
              opaque={false}
              size='small'
              margin='bottom'
            >
              {content}
            </ReqoreMessage>
          )
        )}
        {operators && size(operators) ?
          <>
            <ReqoreControlGroup fill wrap className='operators'>
              {fixOperatorValue(other.op).map((operator, index) => (
                <React.Fragment key={index}>
                  <SelectFormField
                    items={map(operators, (op) => ({
                      ...op,
                      value: op.name,
                    }))}
                    disabled={readOnly}
                    value={operator && `${(operators as any)?.[operator as string]?.name}`}
                    onChange={(val) => {
                      if (val !== undefined) {
                        handleOperatorChange(
                          optionName,
                          fixedValue,
                          findKey(operators, (op) => op.name === val) as string,
                          index
                        );
                      }
                    }}
                  />
                  {(
                    index === fixOperatorValue(other.op).length - 1 &&
                    operator &&
                    (operators as any)[operator as string]?.supports_nesting
                  ) ?
                    <ReqoreButton
                      icon='AddLine'
                      disabled={readOnly}
                      fixed
                      effect={PositiveColorEffect}
                      onClick={() => handleAddOperator(optionName, fixedValue, index + 1)}
                    />
                  : null}
                  {size(fixOperatorValue(other.op)) > 1 ?
                    <ReqoreButton
                      disabled={readOnly}
                      icon='DeleteBinLine'
                      effect={NegativeColorEffect}
                      fixed
                      onClick={() => handleRemoveOperator(optionName, fixedValue, index)}
                    />
                  : null}
                </React.Fragment>
              ))}
            </ReqoreControlGroup>
            <ReqoreVerticalSpacer height={5} />
          </>
        : null}
        <TemplateField
          fluid
          {...(options?.[optionName] as any)}
          allowTemplates={!!(allowTemplates && options?.[optionName]?.supports_templates)}
          allowCustomValues={
            options?.[optionName]?.supports_custom_values !== false && type !== 'any'
          }
          templates={templates.value}
          {...getTypeAndCanBeNull(
            type as TQorusType,
            options?.[optionName]?.allowed_values,
            other.op
          )}
          ui_type={type}
          name={optionName}
          uniqueName={`${uniqueName ? `${uniqueName}.` : `${name ? `${name}.` : ''}`}${optionName}`}
          onChange={(name, value, type) => {
            handleValueChange(name, value, type);
          }}
          key={optionName}
          arg_schema={options?.[optionName]?.arg_schema}
          noSoft={!!rest?.options}
          value={other.value}
          sensitive={options?.[optionName]?.sensitive}
          default_value={getDefaultValue(options?.[optionName])}
          isDefaultTemplate={options?.[optionName]?.default_view === 'template'}
          allowed_values={options?.[optionName]?.allowed_values}
          disabled={
            options?.[optionName]?.disabled ||
            readOnly ||
            !hasAllDependenciesFullfilled(
              options?.[optionName]?.depends_on,
              availableOptions,
              options || {}
            )
          }
          readOnly={readOnly}
          size={rest.size}
          menuItems={
            (options?.[optionName] as any)?.ui_type === 'any' ?
              getCustomMenuTemplateItems(optionName)
            : undefined
          }
          {...templateFieldProps}
        />
        <OptionFieldMessages
          schema={options || {}}
          allOptions={availableOptions}
          name={optionName}
          option={{ type, ...other }}
          getType={getTypeForOption}
        />
        {operators && size(operators) && size(other.op) ?
          <>
            <ReqoreVerticalSpacer height={5} />
            <ReqoreMessage size='small'>
              <ReqoreTagGroup>
                <ReqoreTag size='small' labelKey='WHERE' label={optionName} />
                <ReqoreTag
                  size='small'
                  labelKey='IS'
                  label={fixOperatorValue(other.op).join(' ')}
                />
                <ReqoreTag
                  size='small'
                  intent='info'
                  label={
                    other.value ?
                      type === 'richtext' ?
                        richtextToString(other.value)
                      : JSON.stringify(other.value)
                    : ''
                  }
                />
              </ReqoreTagGroup>
            </ReqoreMessage>
          </>
        : null}
      </>
    );
  };

  // ─── compact (read-first) rendering ───────────────────────────────────────────
  // Theme-derived colours so the flat-row layout adapts to light/dark/custom themes.
  const cText = theme?.text?.color || '#ffffff';
  const cMuted = `${cText}99`;
  const cFaint = `${cText}66`;
  const cKey = `${cText}cc`;
  const cDivider = `${cText}14`;
  const cHover = `${cText}0d`;
  const cDanger = theme?.intents?.danger || '#e35a5a';
  const cInfo = theme?.intents?.info || '#3b8eea';
  const cSuccess = theme?.intents?.success || '#36b37e';
  const cBg = (theme as { main?: string } | undefined)?.main || '#181818';

  // A single read-first row. Collapsed: label | formatted value | edit affordance.
  // Expanded: the real editor (same `renderOption` as the classic layout, so all
  // field wiring is preserved) with a "Done" action to collapse it again.
  // `hidden` marks an optional field surfaced by the search that isn't part of
  // the form yet — activating its row adds it, then opens the editor.
  const renderCompactRow = (
    optionName: string,
    optionField: IQorusFormField,
    hidden = false
  ) => {
    const schema = options?.[optionName];
    const label = schema?.display_name || optionName;
    const required = !!(schema?.required || schema?.required_groups);
    const valid = isOptionValid(
      optionName,
      (schema?.ui_type as TQorusType) || (schema?.type as TQorusType),
      optionField?.value
    );
    const removable =
      !readOnly && !schema?.preselected && !schema?.required && !schema?.required_groups;

    if (expandedOptions.includes(optionName)) {
      return (
        <StyledEditCard
          key={optionName}
          data-field={optionName}
          className='options-readfirst-card'
          $bg={cHover}
          $border={`${cInfo}66`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexFlow: 'column', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: cMuted,
                }}
              >
                {label}
                {required ? <span style={{ color: cDanger }}> *</span> : null}
              </div>
              {schema?.short_desc ?
                <div style={{ color: cMuted, fontSize: 12, marginTop: 2 }}>{schema.short_desc}</div>
              : null}
            </div>
            <ReqoreButton
              size='small'
              icon='CheckLine'
              intent='success'
              fixed
              className='options-readfirst-done'
              onClick={() => toggleExpandedOption(optionName)}
            >
              {readOnly ? 'Close' : 'Done'}
            </ReqoreButton>
          </div>
          {renderOption(optionName, optionField)}
        </StyledEditCard>
      );
    }

    const formatted = formatOptionValue(optionField, schema);
    const empty = formatted === '';
    const changed = !hidden && !readOnly && hasOptionChanged(optionField?.value, optionName);
    const typeLabel =
      showFieldTypes ?
        `<${(schema?.ui_type as string) || (schema?.type as string) || 'auto'}${(schema as { ui_element_type?: string } | undefined)?.ui_element_type ? `[${(schema as { ui_element_type?: string }).ui_element_type}]` : ''}>`
      : null;
    const activate = () => {
      if (hidden) {
        handleAddOptionalFieldChange('options', optionName);
      }
      toggleExpandedOption(optionName);
    };

    return (
      <div
        key={optionName}
        data-field={optionName}
        role='button'
        tabIndex={0}
        aria-label={`${label}${hidden ? ' (add field)' : ''}`}
        className={`readfirst-row options-readfirst-value${hidden ? ' readfirst-row-hidden' : ''}`}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        }}
      >
        <div
          title={schema?.short_desc || undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            color: cKey,
            fontWeight: 600,
            fontSize: 13,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
          {required ? <span style={{ color: cDanger }}> *</span> : null}
          {typeLabel ?
            <span style={{ color: cFaint, fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
              {typeLabel}
            </span>
          : null}
          {schema?.desc ?
            <span
              role='button'
              tabIndex={-1}
              aria-label='Help'
              className='options-readfirst-help'
              style={{ cursor: 'help', display: 'inline-flex', opacity: 0.55, marginLeft: 5 }}
              onClick={(event) => {
                event.stopPropagation();
                handleOptionLabelClick(optionName);
              }}
            >
              <ReqoreIcon icon='QuestionLine' size='12px' />
            </span>
          : null}
        </div>
        <div
          title={!empty && !hidden && typeof formatted === 'string' ? formatted : undefined}
          style={{
            // min-width: 0 lets this grid cell shrink below its content's
            // intrinsic width so the ellipsis engages instead of overflowing.
            minWidth: 0,
            color: empty || hidden ? cFaint : cText,
            fontStyle: empty || hidden ? 'italic' : 'normal',
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hidden ?
            'Not in form — add'
          : empty ?
            required ?
              'Required — not set'
            : 'Not set'
          : formatted}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hidden ?
            <ReqoreIcon icon='AddLine' intent='info' size='14px' />
          : !valid ?
            <ReqoreTag label='Required' intent='danger' size='small' minimal />
          : <ReqoreIcon
              className='readfirst-action'
              icon={readOnly ? 'EyeLine' : 'EditLine'}
              size='14px'
            />
          }
          {changed ?
            <ReqoreButton
              className='readfirst-action options-readfirst-revert'
              size='small'
              flat
              minimal
              icon='HistoryLine'
              tooltip='Revert changes'
              onClick={(e: any) => {
                e.stopPropagation();
                handleValueChange(
                  optionName,
                  originalValue.current?.[optionName]?.value,
                  originalValue.current?.[optionName]?.type
                );
              }}
            />
          : null}
          {removable && !hidden ?
            <ReqoreButton
              className='readfirst-action'
              size='small'
              flat
              minimal
              intent='danger'
              icon='DeleteBinLine'
              tooltip='Remove field'
              onClick={(e: any) => {
                e.stopPropagation();
                confirmAction({
                  title: 'Remove field',
                  onConfirm: () => removeSelectedOption(optionName),
                });
              }}
            />
          : null}
        </div>
      </div>
    );
  };

  // The full compact (read-first) form: a completion meter, an optional
  // invalid-fields message, the options as flat rows grouped into collapsible
  // panels by their `group`, and the "more options" adder. Bypasses the classic
  // ReqoreCollection card layout entirely; the classic path is untouched.
  const renderCompact = () => {
    // Filter rows by the toolbar: required-only and/or a free-text label query.
    // Filters only affect which rows are listed — the completion meter reflects
    // the full set.
    const query = compactQuery.trim().toLowerCase();
    const matchesQuery = (optionName: string): boolean =>
      !query || (options?.[optionName]?.display_name || optionName).toLowerCase().includes(query);
    const matchesFilters = (optionName: string): boolean => {
      const schema = options?.[optionName];
      if (requiredOnly && !(schema?.required || schema?.required_groups)) {
        return false;
      }
      return matchesQuery(optionName);
    };

    // Group the options by their raw `group` key, remembering the order groups
    // first appear in the schema. Each row carries a `hidden` flag.
    const groupOrder: string[] = [];
    const grouped: Record<string, Array<{ name: string; hidden: boolean }>> = {};
    const pushRow = (optionName: string, hidden: boolean) => {
      const group = getOptionGroup(options?.[optionName]);
      if (!grouped[group]) {
        grouped[group] = [];
        groupOrder.push(group);
      }
      grouped[group].push({ name: optionName, hidden });
    };
    // Listed (added / preselected / required) options that pass the filters.
    forEach(shownOptions, (_option, optionName) => {
      if (matchesFilters(optionName)) {
        pushRow(optionName, false);
      }
    });
    // When searching, also surface matching hidden optional fields (not yet
    // added) so the search spans the whole schema, not just the visible rows.
    if (query) {
      forEach(filteredOptions, (_schema, optionName) => {
        if (matchesQuery(optionName)) {
          pushRow(optionName, true);
        }
      });
    }

    // Order groups by the consumer-supplied `sort` (when given), else first-seen.
    const groupKeys = groupOrder.slice().sort((a, b) => {
      const sa = groups?.[a]?.sort;
      const sb = groups?.[b]?.sort;
      if (sa != null && sb != null && sa !== sb) return sa - sb;
      if (sa != null && sb == null) return -1;
      if (sb != null && sa == null) return 1;
      return groupOrder.indexOf(a) - groupOrder.indexOf(b);
    });

    return (
      <OptionsContext.Provider value={{ schema: options, value: availableOptions }}>
        <ReqoreErrorBoundary>
          {showHelpForOption && (
            <OptionsHelpDialog
              onClose={() => setShowHelpForOption(undefined)}
              option={options[showHelpForOption]}
            />
          )}
          <StyledCompactWrap>
            <StyledCompactHeader $bg={cBg}>
            {readFirstCompletion.total ?
              <StyledCompletion className='options-readfirst-completion'>
                <StyledCompletionLabel $color={cMuted}>
                  {readFirstCompletion.set} / {readFirstCompletion.total} fields set
                </StyledCompletionLabel>
                <StyledCompletionTrack
                  $bg={cDivider}
                  $fill={readFirstCompletion.set === readFirstCompletion.total ? cSuccess : cInfo}
                >
                  <div style={{ width: `${readFirstCompletion.pct}%` }} />
                </StyledCompletionTrack>
                <StyledCompletionLabel $color={cMuted}>
                  {readFirstCompletion.pct}%
                </StyledCompletionLabel>
              </StyledCompletion>
            : null}

            {size(availableOptions) > 1 ?
              <ReqoreControlGroup fluid verticalAlign='center'>
                <ReqoreInput
                  fluid
                  pill
                  icon='Search2Line'
                  iconColor='muted'
                  placeholder='Filter fields...'
                  value={compactQuery}
                  intent={compactQuery ? 'info' : undefined}
                  className='options-readfirst-search'
                  onChange={(event: React.FormEvent<HTMLInputElement>) =>
                    setCompactQuery(event.currentTarget.value)
                  }
                  onClearClick={() => setCompactQuery('')}
                />
                {!readOnly ?
                  <ReqoreDropdown
                    fixed
                    minimal
                    filterable
                    icon='Filter3Line'
                    label='Fields'
                    className='options-readfirst-fields'
                    intent={requiredOnly ? 'info' : undefined}
                    badge={requiredOnly ? 'Required only' : undefined}
                    onItemSelect={({ value }: any) =>
                      value && handleAddOptionalFieldChange('options', value)
                    }
                    items={
                      [
                        {
                          label: 'Required only',
                          selected: requiredOnly,
                          icon: requiredOnly ? 'CheckboxCircleLine' : 'CheckboxBlankCircleLine',
                          tooltip: 'Show only required fields',
                          onClick: () => setRequiredOnly((value) => !value),
                        },
                        {
                          label: 'Show field types',
                          selected: showFieldTypes,
                          icon:
                            showFieldTypes ? 'CheckboxCircleLine' : 'CheckboxBlankCircleLine',
                          tooltip: 'Annotate each field with its type',
                          onClick: handleShowFieldTypesClick,
                        },
                        {
                          label: 'Select all',
                          icon: 'MenuAddLine',
                          tooltip: 'Add every optional field',
                          disabled: size(filteredOptions) === 0,
                          onClick: handleAddAllOptional,
                        },
                        {
                          label: 'Default fields',
                          icon: 'RestartLine',
                          tooltip: 'Reset to the default set of fields',
                          onClick: handleResetToDefaultFields,
                        },
                        {
                          label: 'Revert all changes',
                          icon: 'HistoryLine',
                          tooltip: 'Undo all edits back to the loaded values',
                          disabled: !(
                            originalValue.current &&
                            !isEqual(localValue.fields, originalValue.current)
                          ),
                          onClick: handleRevertChangesClick,
                        },
                        ...(size(filteredOptions) ?
                          [
                            {
                              label: 'Add optional fields',
                              readOnly: true,
                              disabled: true,
                              icon: 'AddLine',
                            },
                          ]
                        : []),
                        ...optionalFields.map((field) => ({
                          label: field.display_name || field.value,
                          value: field.value,
                          description: field.short_desc,
                          disabled: field.disabled,
                        })),
                      ] as any
                    }
                  />
                : null}
              </ReqoreControlGroup>
            : null}
            </StyledCompactHeader>

            {size(validityData.invalidFields) && !readOnly ?
              <ReqoreMessage
                intent={showInvalidOptionsOnly ? 'info' : 'danger'}
                opaque={false}
                size='small'
                onClick={() => setShowInvalidOptionsOnly(!showInvalidOptionsOnly)}
              >
                {showInvalidOptionsOnly ?
                  'Showing invalid fields only. Click here again to show all fields.'
                : `${size(validityData.invalidFields) < 2 ? 'A field is not valid and requires' : `${size(validityData.invalidFields)} fields are not valid and require`} attention. Click here to only show invalid fields.`
                }
              </ReqoreMessage>
            : null}

            {size(groupKeys) === 0 ?
              <ReqoreMessage flat opaque={false} size='small'>
                No fields match the current filters.
              </ReqoreMessage>
            : null}

            {groupKeys.map((groupName) => {
              const names = grouped[groupName];
              const groupConfig = groups?.[groupName];
              const invalidCount = names.filter(
                (entry) =>
                  !entry.hidden &&
                  !isOptionValid(
                    entry.name,
                    (options?.[entry.name]?.ui_type as TQorusType) ||
                      (options?.[entry.name]?.type as TQorusType),
                    (shownOptions as TQorusForm)[entry.name]?.value
                  )
              ).length;

              return (
                <ReqorePanel
                  key={groupName}
                  flat
                  minimal
                  collapsible
                  label={getOptionGroupLabel(groupName, groups)}
                  icon={groupConfig?.icon}
                  className='options-readfirst-group'
                  padded={false}
                  contentStyle={{ padding: '4px 4px 6px' }}
                  badge={
                    groupName === 'optional' ?
                      { label: `${names.length} optional` }
                    : invalidCount ?
                      {
                        label: `${invalidCount} to resolve`,
                        intent: 'warning',
                        icon: 'ErrorWarningLine',
                      }
                    : { label: 'all set', intent: 'success', icon: 'CheckLine' }
                  }
                >
                  {groupConfig?.subtitle ?
                    <div style={{ color: cMuted, fontSize: 12, padding: '0 6px 6px' }}>
                      {groupConfig.subtitle}
                    </div>
                  : null}
                  <StyledGroupBody $divider={cDivider} $hover={cHover} $focus={cInfo}>
                    {names.map((entry) =>
                      renderCompactRow(
                        entry.name,
                        entry.hidden ?
                          ({
                            type: (options?.[entry.name]?.ui_type ||
                              options?.[entry.name]?.type) as TQorusType,
                            value: undefined,
                          } as IQorusFormField)
                        : ((shownOptions as TQorusForm)[entry.name] as IQorusFormField),
                        entry.hidden
                      )
                    )}
                  </StyledGroupBody>
                </ReqorePanel>
              );
            })}

          </StyledCompactWrap>
        </ReqoreErrorBoundary>
      </OptionsContext.Provider>
    );
  };

  if (rest.skeleton || templates.loading || typesLoading || optionsLoading) {
    return (
      <ReqoreControlGroup vertical fill fluid style={{ flexGrow: 1 }} gapSize='big'>
        <ReqoreControlGroup fixed fill={false}>
          <ReqoreSkeleton />
          <ReqoreSkeleton />
          <ReqoreSkeleton width='100%' />
        </ReqoreControlGroup>
        <ReqoreControlGroup vertical fill={false}>
          <ReqoreSkeleton width='100%' height='150px' />
          <ReqoreSkeleton width='100%' height='150px' />
          <ReqoreSkeleton width='100%' height='150px' />
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }

  // A loader that rejected (and produced no usable schema) surfaces its error
  // instead of the generic "No options available" empty state.
  if (optionsError && (!options || !size(options))) {
    return (
      <ReqoreMessage intent='danger' opaque={false}>
        {optionsError}
      </ReqoreMessage>
    );
  }

  if (!options || !size(options)) {
    return (
      <ReqoreMessage intent='warning' opaque={false}>
        No options available
      </ReqoreMessage>
    );
  }

  if (compact) {
    return renderCompact();
  }

  return (
    <OptionsContext.Provider value={{ schema: options, value: availableOptions }}>
      <ReqoreErrorBoundary>
        {showHelpForOption && (
          <OptionsHelpDialog
            onClose={() => setShowHelpForOption(undefined)}
            option={options[showHelpForOption]}
          />
        )}
        {recordRequiresSearchOptions && !readOnly ?
          <>
            <ReqoreMessage intent='info'>
              This provider record requires some search options to be set. You can set them below.
            </ReqoreMessage>
            <ReqoreVerticalSpacer height={10} />
          </>
        : null}
        <ReqoreCollection
          minColumnWidth='350px'
          flat
          padded={false}
          minimal
          {...rest}
          label={compact ? undefined : rest.label}
          responsiveTitle={false}
          inputProps={{
            disabled: size(availableOptions) < 2,
          }}
          labelSize={4}
          filterable={'filterable' in rest ? rest.filterable : !compact}
          sortable={'sortable' in rest ? rest.sortable : !compact && size(availableOptions) > 1}
          defaultSortBy={null}
          contentRenderer={(children) => (
            <>
              {size(validityData.invalidFields) && !readOnly ?
                <ReqoreMessage
                  intent={showInvalidOptionsOnly ? 'info' : 'danger'}
                  opaque={false}
                  size='small'
                  margin='bottom'
                  onClick={() => setShowInvalidOptionsOnly(!showInvalidOptionsOnly)}
                >
                  {showInvalidOptionsOnly ?
                    'Showing invalid fields only. Click here again to show all fields.'
                  : `${size(validityData.invalidFields) < 2 ? 'A field is not valid and requires' : `${size(validityData.invalidFields)} fields are not valid and require`} attention. Click here to only show invalid fields.`
                  }
                </ReqoreMessage>
              : null}
              {unavailableOptionsCount.current ?
                <>
                  <ReqoreMessage intent='warning' opaque={false} size='small' margin='bottom'>
                    {`${unavailableOptionsCount.current} fields(s) hidden because they are not supported on the current instance`}
                  </ReqoreMessage>
                  <ReqoreVerticalSpacer height={10} />
                </>
              : null}
              {children}
              {size(filteredOptions) >= 1 && !readOnly ?
                <>
                  <ReqoreVerticalSpacer height={10} />
                  <SelectFormField
                    items={optionalFields}
                    onChange={(val) => handleAddOptionalFieldChange('options', val)}
                    placeholder={placeholder || 'More Options Available'}
                    minimal
                    icon='ListView'
                    showDescription={false}
                    fluid
                    size={rest.size}
                  />
                </>
              : null}
            </>
          )}
          sortButtonProps={{ minimal: true }}
          showLayoutSwitch={false}
          style={{ width: '100%' }}
          items={map(
            shownOptions,
            ({ type, ...other }, optionName): IReqoreCollectionItemProps => ({
              label: options[optionName]?.display_name || optionName,
              tags: (options[optionName] as any)?.tags,
              labelEffect: {
                textSize: '11px',
                uppercase: true,
                opacity: 0.9,
              },
              labelProps: {
                style:
                  options[optionName]?.short_desc ?
                    {
                      cursor: 'help',
                    }
                  : undefined,
                onClick:
                  options[optionName]?.desc ? () => handleOptionLabelClick(optionName) : undefined,
              },
              showLabelTooltip: !!options[optionName]?.short_desc,
              customLabelTooltip: {
                delay: 300,
                content: (
                  <Description
                    longDescription={`${options[optionName]?.short_desc}${options[optionName]?.desc ? '. Click to learn more.' : ''}`}
                    margin='none'
                  />
                ),
              },
              description:
                showFieldTypes ?
                  `<${options[optionName].ui_type || options[optionName].type}${options[optionName]?.ui_element_type ? `[${options[optionName].ui_element_type}]` : ''}> ${options[optionName].short_desc || ''}`
                : options[optionName].short_desc || '',
              descriptionEffect: {
                textSize: '11px',
                opacity: 0.3,
                underline: options[optionName]?.desc ? 'underline dotted #878787' : undefined,
              },
              customTheme: {
                main: 'main:darken:1',
              },
              flat: false,
              icon:
                !isOptionValid(optionName, type as TQorusType, (other as any).value) ? 'SpamFill'
                : undefined,
              iconColor:
                !isOptionValid(optionName, type as TQorusType, (other as any).value) ?
                  'danger:lighten:5'
                : undefined,
              transparent: false,
              intent: getIntent(
                optionName,
                type as TQorusType,
                (other as any).value,
                (other as any).op
              ),
              badge: buildBadges(options[optionName], optionName),
              className: 'system-option',
              size: 'small',
              floatingActions: true,
              actions: [
                {
                  size: 'tiny',
                  icon: 'FullscreenLine',
                  className: 'options-item-fullscreen',
                  tooltip: 'Focused Editing',
                  show:
                    (
                      !readOnly &&
                      type !== 'code-editor' &&
                      ((options[optionName] as any)?.ui_type || options[optionName]?.type) !==
                        'code-editor'
                    ) ?
                      'hover'
                    : false,
                  onClick: () => setFocusedEditing(optionName),
                },
                {
                  size: 'tiny',
                  icon: 'CloseLine',
                  className: 'options-item-remove',
                  tooltip: 'Remove Value',
                  show:
                    (
                      !readOnly &&
                      (other as any).value &&
                      !isEqual((other as any).value, getDefaultValue(options[optionName])) &&
                      !(options[optionName]?.disabled || (options[optionName] as any)?.readonly)
                    ) ?
                      'hover'
                    : false,
                  onClick: () => handleValueChange(optionName, undefined),
                },
                {
                  size: 'tiny',
                  icon: 'HistoryLine',
                  className: 'options-item-revert',
                  tooltip: 'Revert Changes',
                  show:
                    !readOnly && hasOptionChanged((other as any).value, optionName) ?
                      'hover'
                    : false,
                  onClick: () => {
                    handleValueChange(
                      optionName,
                      originalValue.current?.[optionName]?.value,
                      originalValue.current?.[optionName]?.type
                    );
                  },
                },
                {
                  size: 'tiny',
                  icon: 'DeleteBinLine',
                  intent: 'danger',
                  minimal: true,
                  className: 'options-optional-remove',
                  show:
                    (
                      !readOnly &&
                      !options[optionName]?.preselected &&
                      !options[optionName]?.required
                    ) ?
                      'hover'
                    : false,
                  onClick: () => {
                    confirmAction({
                      title: 'Remove Selected Option',
                      onConfirm: () => {
                        removeSelectedOption(optionName);
                      },
                    });
                  },
                },
              ],
              content: (
                <FocusedEditing
                  isFullscreen={focusedEditing === optionName}
                  onClose={() => setFocusedEditing(undefined)}
                  description={options[optionName]?.display_name}
                  intent={getIntent(
                    optionName,
                    type as TQorusType,
                    (other as any).value,
                    (other as any).op
                  )}
                >
                  {focusedEditing === optionName ?
                    <Description
                      longDescription={options[optionName]?.desc}
                      shortDescription={options[optionName]?.short_desc}
                      longDescriptionShownByDefault
                    />
                  : null}
                  {renderOption(optionName, { type, ...other } as IQorusFormField)}
                </FocusedEditing>
              ),
            })
          )}
          defaultZoom={1}
          zoomable={false}
          actions={[
            ...(rest.actions || []).map((action) => ({
              ...action,
              minimal: true,
            })),
            {
              icon: 'HistoryLine',
              className: 'fields-revert',
              tooltip: 'Revert Changes',
              minimal: true,
              position: 'right',
              show:
                showTypeToggle &&
                !readOnly &&
                !!originalValue.current &&
                !isEqual(localValue.fields, originalValue.current),
              onClick: handleRevertChangesClick,
            },
            {
              icon: 'CodeLine',
              minimal: true,
              className: 'fields-show-types',
              tooltip: showFieldTypes ? 'Hide field types' : 'Show field types',
              intent: showFieldTypes ? 'info' : undefined,
              show: showTypeToggle,
              position: 'right',
              onClick: handleShowFieldTypesClick,
            },
          ]}
        />
      </ReqoreErrorBoundary>
    </OptionsContext.Provider>
  );
};

export default FormEngine;
