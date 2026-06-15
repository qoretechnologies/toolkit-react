import {
  ReqoreButton,
  ReqoreCollection,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreErrorBoundary,
  ReqoreInput,
  ReqoreMessage,
  ReqoreP,
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
import { IReqorePanelAction, IReqorePanelProps } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
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
import { useMeasure, useMount, useUpdateEffect } from 'react-use';
import { createContext } from 'use-context-selector';
import styled from 'styled-components';
import { getDefaultValue, insertAtIndex, richtextToString } from '../../../helpers/common';
import { getRequiredOptionMessage } from '../../../helpers/options';
import { query } from '../../../utils/fetch';
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
import { CompactRow } from './CompactRow';
import { CompactRowContext, ICompactRowContext } from './compactRowContext';
import { OptionFieldMessages } from './OptionFieldMessages';
import { OptionsHelpDialog } from './OptionsHelpDialog';
import {
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstCompletion,
  isOptionValueEmpty,
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
export interface IOptionsOnChangeMeta extends IQorusFormFieldOnChangeMeta {
  /** `commitMode='batched'`: the emitted value is staged (a draft), not committed. */
  draft?: boolean;
}

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

// Compact (read-first) layout: flat label | value | action rows in collapsible
// group panels; colours come in as props so the layout follows the Reqore theme.

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

const StyledGroupBody = styled.div<{ $divider: string; $hover: string; $focus: string; $zebra: string }>`
  display: flex;
  flex-flow: column;
  /* Field blocks separate with real space + the zebra tint — the old hairline
     dividers between rows became noise once both arrived and were retired. */
  gap: 8px;

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
    /* 3px vertical: the hover-revealed action buttons (revert/delete) are
       ~32px tall and occupy layout even at opacity 0 — with 8px padding they
       inflated removable rows to ~48px while plain rows sat at the 38px
       min-height. 32 + 6 = 38 keeps every one-line row the same height; the
       min-height keeps the click target for rows with shorter content. */
    padding: 3px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s ease;
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
  /* A disabled field (schema disabled flag or unmet dependencies) is not a
     click target — no hover invite, not-allowed cursor; a lock replaces the
     pencil. */
  .readfirst-row-disabled {
    cursor: not-allowed;
  }
  .readfirst-row-disabled:hover {
    background: transparent;
  }
  /* Required-group linkage: hovering a "One of" chip highlights every member
     row; locating a sibling from the chip's popover flashes it briefly. */
  .readfirst-row-group-highlight {
    background: ${({ $focus }) => `${$focus}1f`};
    box-shadow: inset 3px 0 0 ${({ $focus }) => $focus};
  }
  .readfirst-row-flash {
    animation: readfirstRowFlash 1.4s ease;
  }
  @keyframes readfirstRowFlash {
    0% {
      background: ${({ $focus }) => `${$focus}59`};
    }
    100% {
      background: transparent;
    }
  }
  .readfirst-action {
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .readfirst-row:hover .readfirst-action,
  .readfirst-row:focus-visible .readfirst-action {
    opacity: 0.85;
  }

  /* A scalar row being edited in place: the real editor replaces the value
     cell. The row stops being a click target (the editor owns the clicks) and
     keeps a constant active background. Vertical padding is tightened so the
     editor fits inside the same ~38px the read row occupies — switching into
     (and out of) inline editing must not shift the rows around it. */
  .readfirst-row-editing {
    cursor: default;
    /* Top-anchor the cells: with multi-line editors (e.g. allowed-values =
       input + picker), per-cell centring gives every control a different
       anchor. Instead everything aligns to the FIRST editor line — label and
       the ✓/↺ cluster get small offsets to sit optically centred on it. */
    align-items: start;
    background: ${({ $hover }) => $hover};
    /* Zero vertical padding: the pinned min-height (captured from the read
       row at activation) owns the height; the editor centres within it. */
    padding-top: 0;
    padding-bottom: 0;
    /* Tighter column gap: the editor's trailing template ⋮ and our ✓ should
       read as one control cluster, not two separated groups. */
    column-gap: 6px;
  }
  .readfirst-row-editing > div:nth-child(1) {
    padding-top: 10px;
  }
  .readfirst-row-editing > div:nth-child(3) {
    padding-top: 3px;
  }
  .readfirst-row-editing:hover {
    background: ${({ $hover }) => $hover};
  }

  /* Narrow FORMS (phone / slim drawer): stack each row — label + actions share
     the first line, the value cell (or the inline editor) takes the full width
     beneath. The class is set from a measured wrap width (react-use useMeasure)
     rather than a viewport media query, so a slim desktop drawer stacks too.
     The 3 row children are placed explicitly:
     label (1,1) · actions (1,2) · value (2, span both). */
  &.readfirst-narrow .readfirst-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 14px;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(3) {
    grid-column: 2;
    grid-row: 1;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  /* Zebra-tint each field BLOCK (a bare row, or a wrapper carrying the row
     plus its strips/preview, tints as one unit) so every field owns a visible
     territory — message strips stop floating ownerless. The edit card keeps
     its own surface. (Trialled mobile-first, promoted to all widths for
     review.) */
  > :nth-child(odd):not(.options-readfirst-card) {
    background: ${({ $zebra }) => $zebra};
    border-radius: 6px;
  }
  /* Narrow forms get the stronger tint — on a phone the zebra is the main
     structure; on desktop the grid columns carry most of it, so 3% suffices
     (and stays clearly below the 5% hover). */
  &.readfirst-narrow > :nth-child(odd):not(.options-readfirst-card) {
    background: ${({ $hover }) => $hover};
  }
  /* Narrow only: content under the label indents 12px (left rail) so each
     stacked block shares the same internal shape — label at the edge, content
     inset. The desktop grid's columns provide this structure already. */
  &.readfirst-narrow .readfirst-row > :nth-child(2) {
    padding-left: 12px;
  }
  /* Touch layouts have no hover: a slot reserved for the hover-revealed edit
     pencil is permanent dead space that insets every chip from the edge —
     drop it (rows are tap-to-edit; the lock/add slots stay, they're static). */
  &.readfirst-narrow .options-readfirst-trailing-hover-only {
    /* !important: the slot carries an inline display for the desktop layout. */
    display: none !important;
  }
  /* Phone air: stacked blocks get slightly taller inner padding. The in-place
     editor keeps zero padding so its pinned height still matches. */
  &.readfirst-narrow .readfirst-row {
    padding-top: 6px;
    padding-bottom: 6px;
  }
  &.readfirst-narrow .readfirst-row-editing {
    padding-top: 0;
    padding-bottom: 0;
  }

  /* A hash block = its parent row + the revealed sub-rows. Highlight the whole
     block as one unit on hover (rather than only the parent row), and neutralise
     the parent row's own hover so the two don't stack into a darker band. The
     parent row's hover actions still surface whenever the block is hovered. */
  .options-readfirst-hash-row {
    border-radius: 6px;
    transition: background 0.12s ease;
  }
  .options-readfirst-hash-row:hover {
    background: ${({ $hover }) => $hover};
  }
  .options-readfirst-hash-row:hover .readfirst-row {
    background: transparent;
  }
  .options-readfirst-hash-row:hover .readfirst-action {
    opacity: 0.85;
  }
`;

// Pinned toolbar (meter + search + Fields menu); the opaque background masks
// rows scrolling beneath. Sticky needs an unclipped scrolling ancestor.
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

// Batched-commit dock: a floating Save/Discard card pinned bottom-right. Sticky
// (not fixed) so it stays within the form's own scroll bounds when the engine
// renders inside a drawer/panel; align-self pushes it to the right edge, and it
// elevates above the rows with an opaque surface + border + shadow.
const StyledCommitDock = styled.div<{ $bg: string; $border: string }>`
  position: sticky;
  bottom: 8px;
  z-index: 6;
  align-self: flex-end;
  width: fit-content;
  max-width: 100%;
  padding: 8px 10px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
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

/** Display metadata for a read-first group, keyed by the raw `group` string;
 * omissions fall back to a title-cased key, no icon, and schema order. */
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
  /**
   * `'immediate'` (default): edits flow out via the debounced `onChange`.
   * `'batched'`: edits stage locally (Draft chips + Save/Discard bar); Save
   * fires `onCommit`, gated on validity; staged `onChange` carries `meta.draft`.
   */
  commitMode?: 'immediate' | 'batched';
  /**
   * How many read-first rows can be expanded (editing) at once. `'single'`
   * (default) collapses the previously-open row when another is opened — the
   * accordion model that keeps the read-first list scannable. `'multi'` lets
   * several stay open (e.g. filling an empty form top-to-bottom).
   */
  expandMode?: 'single' | 'multi';
  /** `commitMode='batched'` only: the user applied the staged changes. */
  onCommit?: (name: string, value?: TQorusForm, meta?: IOptionsOnChangeMeta) => void;
  /**
   * Operator schema (`WHERE <field> IS <op>`): adds the operator selector rows;
   * operator-bearing fields always card-edit in compact mode.
   */
  operators?: IOperatorsSchema;
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
  /** Fetch the options schema from `options/{url}` (IDE Options parity). */
  url?: string;
  /** Fetch the options schema from a custom endpoint; wins over `url`. */
  customUrl?: string;
  /** Fetch the search-operators schema (enables the per-option operator UI). */
  operatorsUrl?: string;
  /** Fired with the fetched schema after a successful `url`/`customUrl` load. */
  onOptionsLoaded?: (options: IQorusFormSchema) => void;
  recordRequiresSearchOptions?: boolean;
  readOnly?: boolean;
  allowTemplates?: boolean;
  stringTemplates?: IReqoreFormTemplates;
  /** Opt-in: fetch global templates from `system/getContextData` for this context. */
  interfaceContext?: string;
  templateFieldProps?: Partial<ITemplateFieldProps>;
  showTypeToggle?: boolean;
  /**
   * Compact (read-first) mode: each option renders as a row with its formatted
   * value; clicking expands the real editor inline, Done collapses it.
   */
  compact?: boolean;
  /** Compact mode only: per-group display metadata (label / icon / subtitle /
   * order) — the server only sends the bare group key. */
  groups?: Record<string, IFormEngineGroup>;
  /**
   * Async schema source (used when `options` is absent): transport-agnostic,
   * called on mount and on identity change (memoize it); the engine owns the
   * loading/error lifecycle and fires `onOptionsLoaded` on success.
   */
  optionsLoader?: () => Promise<IQorusFormSchema>;
  onValidityChange?: (isValid: boolean, data: IFormValidityData) => void;
  /**
   * SEAM (reqraft): extra hover actions prepended to each option row — where
   * the IDE renders its `allowAi` AI-assist button. A factory receives the
   * option's name/schema/value (the context the IDE's `AiAssistanceAction`
   * captures); the consumer injects the button, reqraft stays AI-free.
   */
  optionActions?:
    | IReqorePanelAction[]
    | ((context: {
        name: string;
        schema: IQorusFormSchema[string];
        value?: TOption;
      }) => IReqorePanelAction[]);
  /**
   * SEAM (reqraft): consumer-injected field editors for types reqraft doesn't
   * ship (IDE domain fields). Keyed by field `type`/`ui_type`; forwarded through
   * `TemplateField` to the `AutoFormField` override seam.
   */
  componentOverrides?: Record<string, React.FC<any>>;
}

// Option types rendered full-width (IDE Options parity, commit 8e6b7781).
const STRECHABLE_TYPES = new Set<TQorusType>(['tool-catalog' as TQorusType]);

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
  url,
  customUrl,
  operatorsUrl,
  onOptionsLoaded,
  recordRequiresSearchOptions,
  readOnly,
  allowTemplates = true,
  interfaceContext,
  templateFieldProps,
  showTypeToggle = true,
  compact,
  commitMode = 'immediate',
  expandMode = 'single',
  onCommit,
  operators: operatorsProp,
  groups,
  optionsLoader,
  onValidityChange,
  optionActions,
  componentOverrides,
  ...rest
}: IFormEngineProps) => {
  const [options, setOptions] = useState<IQorusFormSchema | undefined>(rest?.options || undefined);
  // optionsLoader lifecycle: loading feeds the skeleton gate, error the banner.
  const [optionsLoading, setOptionsLoading] = useState<boolean>(!!optionsLoader && !rest?.options);
  const [optionsError, setOptionsError] = useState<string | undefined>();
  // Operators: prop-provided (compact) or fetched via operatorsUrl (dpql,
  // ported from IDE Options) — the fetch overrides the seeded prop value.
  const [operators, setOperators] = useState<IOperatorsSchema | undefined>(operatorsProp);
  // Remote-fetch loading (ported from IDE Options); only relevant when one of
  // the fetch urls is set — schema-as-props consumers never see the skeleton.
  const [loading, setLoading] = useState<boolean>(!!(url || customUrl || operatorsUrl));
  const confirmAction = useReqoreProperty('confirmAction');
  const theme = useReqoreTheme();
  const [focusedEditing, setFocusedEditing] = useState<string>();
  const [showFieldTypes, setShowFieldTypes] = useState<boolean>(false);
  const [showHelpForOption, setShowHelpForOption] = useState<string | undefined>();
  const [showInvalidOptionsOnly, setShowInvalidOptionsOnly] = useState<boolean>(false);
  // Which options are expanded into their editor (several can be open at once).
  const [expandedOptions, setExpandedOptions] = useState<string[]>([]);
  // Measured form width (not viewport — the form lives in drawers/panels of
  // arbitrary width) drives the stacked narrow layout.
  const [compactWrapRef, { width: compactWrapWidth }] = useMeasure<HTMLDivElement>();
  // Editing rows pin min-height to the measured read row they replace, so the
  // toggle never shifts neighbours (height varies with chrome — measure it).
  const readRowHeights = useRef<Record<string, number>>({});
  // Required-groups linkage: hovering a group chip highlights every member row;
  // clicking a sibling in the chip's popover scrolls to it and flashes it.
  const [highlightedOptions, setHighlightedOptions] = useState<string[]>([]);
  const [flashedOptions, setFlashedOptions] = useState<string[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>();
  const flashOptions = useCallback((optionNames: string[], scrollToFirst = false) => {
    if (scrollToFirst && optionNames[0]) {
      document
        .querySelector(`.readfirst-row[data-field="${optionNames[0]}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setFlashedOptions(optionNames);
    clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlashedOptions([]), 1400);
  }, []);
  const flashOption = useCallback(
    (optionName: string) => flashOptions([optionName], true),
    [flashOptions]
  );
  useEffect(() => () => clearTimeout(flashTimeout.current), []);
  const compactNarrow = !!compactWrapWidth && compactWrapWidth < 480;
  // Info panels auto-open on Tier-1 content; the per-row user override sticks.
  const [infoPanelOverrides, setInfoPanelOverrides] = useState<Record<string, boolean>>({});
  // Toolbar filters affect the listed rows only — the meter reflects the full set.
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
  const templates = useTemplates(allowTemplates, rest.stringTemplates, interfaceContext);

  useEffect(() => {
    if (isEqual(localValue.fields, value)) {
      return;
    }

    const toEmit = size(localValue.fields) ? (localValue.fields as TQorusForm) : undefined;
    lastEmittedValue.current = toEmit;
    const meta = size(localValue.meta) ? localValue.meta : undefined;
    // Batched mode still emits every staged change (consumers may want to
    // live-validate), but flags it as a draft — persistence waits for Save.
    onChange?.(name, toEmit, commitMode === 'batched' ? { ...(meta || {}), draft: true } : meta);
  }, [JSON.stringify(localValue)]);

  useUpdateEffect(() => {
    // When a loader owns the schema, ignore controlled `options` syncs so a
    // late/undefined `options` prop can't clobber the loaded schema.
    if (optionsLoader) {
      return;
    }
    setOptions(rest.options);
  }, [JSON.stringify(rest.options)]);

  // Fetch the schema on mount and on loader identity change.
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
  }, [optionsLoader]);

  // --- Remote schema fetching, ported from IDE Options (systemOptions.tsx
  // lines 394-462 + 504-522). reqraft's `query()` replaces the IDE's
  // `fetchData` — same `{ data, ok, error }` shape and `api/latest/` prefix;
  // the IDE's leading-slash URLs are normalised away.
  const getFetchUrl = useCallback(() => customUrl || `options/${url}`, [customUrl, url]);

  useMount(() => {
    if (url || customUrl) {
      (async () => {
        setOptions(undefined);
        setLoading(true);
        const data = await query<IQorusFormSchema>({ url: getFetchUrl() });

        if (!data.ok || data.data === null) {
          setLoading(false);
          setOptions({});
          return;
        }
        setLocalValue({ fields: fixOptions(value, data.data), meta: undefined });
        if (!operatorsUrl) {
          setLoading(false);
        }
        setOptions(data.data);
        onOptionsLoaded?.(data.data);
      })();
    }

    if (operatorsUrl) {
      (async () => {
        setOperators(undefined);
        setLoading(true);
        const data = await query<IOperatorsSchema>({ url: operatorsUrl.replace(/^\//, '') });

        if (!data.ok) {
          setLoading(false);
          setOperators({});
          return;
        }
        setOperators(data.data);
        setLoading(false);
      })();
    }
  });

  // Changing the source clears the current value and re-seeds the form from
  // the freshly fetched schema (IDE semantics).
  useUpdateEffect(() => {
    if (url || customUrl) {
      (async () => {
        setOptions(undefined);
        setLoading(true);
        const data = await query<IQorusFormSchema>({ url: getFetchUrl() });

        if (!data.ok) {
          setLoading(false);
          setOptions({});
          return;
        }
        if (!operatorsUrl) {
          setLoading(false);
        }
        setOptions(data.data);
        onOptionsLoaded?.(data.data);
        setLocalValue({ fields: fixOptions({}, data.data), meta: undefined });
      })();
    }
  }, [url, customUrl]);

  useUpdateEffect(() => {
    if (operatorsUrl) {
      (async () => {
        setOperators(undefined);
        setLoading(true);
        const data = await query<IOperatorsSchema>({ url: operatorsUrl.replace(/^\//, '') });

        if (!data.ok) {
          setLoading(false);
          setOperators({});
          return;
        }
        setLoading(false);
        setOperators(data.data);
      })();
    }
  }, [operatorsUrl]);

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
    (optionName: string, val?: any, _type?: string, isFunction?: boolean) => {
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

        // IDE Options model: the 4th `onChange` argument (`isFunction`, sent
        // by TemplateField/auto) drives the option's `is_expression` flag;
        // the value itself is the raw AST `{ exp, args }`.
        const updatedValue: TQorusForm = {
          ...(fields as TQorusForm),
          [optionName]: {
            ...(fields as TQorusForm)[optionName],
            type: type as TQorusType,
            value: val,
          },
        };

        if (isFunction) {
          (updatedValue[optionName] as { is_expression?: boolean }).is_expression = true;
        } else {
          delete updatedValue[optionName].is_expression;
        }

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

        // any/auto: preserve the user-picked type; otherwise normalize to the
        // schema type (ui_type wins) so rendering and validation agree.
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

  // Per required-group: its member options, and which member (if any) already
  // satisfies it — drives the "One of" chips and the "covered by" notes.
  const requiredGroupsInfo = useMemo(() => {
    const members: Record<string, string[]> = {};
    forEach(options || {}, (optionSchema, name) => {
      (optionSchema?.required_groups || []).forEach((groupName: string) => {
        (members[groupName] = members[groupName] || []).push(name);
      });
    });
    const satisfiedBy: Record<string, string | undefined> = {};
    Object.keys(members).forEach((groupName) => {
      satisfiedBy[groupName] = members[groupName].find(
        (name) => !isOptionValueEmpty((availableOptions as TQorusForm)?.[name]?.value)
      );
    });
    return { members, satisfiedBy };
  }, [JSON.stringify(options), JSON.stringify(availableOptions)]);

  // Dependency linkage (3a): when filling a dependency unlocks rows, flash
  // them once — the form visibly "opens up" instead of silently changing.
  const dependencyLockedNames = useMemo(() => {
    const names: string[] = [];
    forEach(options || {}, (optionSchema, name) => {
      if (
        optionSchema?.depends_on &&
        !hasAllDependenciesFullfilled(optionSchema.depends_on, availableOptions, options || {})
      ) {
        names.push(name);
      }
    });
    return names;
  }, [JSON.stringify(options), JSON.stringify(availableOptions)]);
  const previousDependencyLocked = useRef<string[] | null>(null);
  useEffect(() => {
    const previous = previousDependencyLocked.current;
    previousDependencyLocked.current = dependencyLockedNames;
    if (!previous) {
      return;
    }
    const unlocked = previous.filter(
      (name) => !dependencyLockedNames.includes(name) && !options?.[name]?.disabled
    );
    if (unlocked.length) {
      flashOptions(unlocked);
    }
  }, [dependencyLockedNames.join('|')]);

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
        // The expression flag lives on the field value, not the schema — so an
        // expression value is validated as an expression, not the base type.
        isFunction: (availableOptions?.[optionName] as { is_expression?: boolean })?.is_expression,
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
            // The expression flag lives on the field value, not the schema.
            isFunction: (option as { is_expression?: boolean }).is_expression,
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

  // `commitMode='batched'`: which options differ from the committed baseline —
  // drives the per-row Draft chips and the Save/Discard bar.
  const dirtyOptionNames = useMemo(() => {
    if (commitMode !== 'batched') {
      return [];
    }
    const keys = new Set([
      ...Object.keys((localValue.fields as TQorusForm) || {}),
      ...Object.keys((originalValue.current as TQorusForm) || {}),
    ]);
    return Array.from(keys).filter(
      (key) =>
        !isEqual(
          (localValue.fields as TQorusForm)?.[key]?.value,
          originalValue.current?.[key]?.value
        )
    );
  }, [commitMode, JSON.stringify(localValue.fields), JSON.stringify(originalValue.current)]);

  // Save: emit the staged form via onCommit and make it the new baseline, so
  // the Draft chips and the bar clear. Validation gates the button itself.
  const handleCommitClick = useCallback(() => {
    const toEmit = size(localValue.fields) ? (localValue.fields as TQorusForm) : undefined;
    onCommit?.(name, toEmit, size(localValue.meta) ? localValue.meta : undefined);
    originalValue.current = localValue.fields;
    setLocalValue((current) => ({ ...current }));
  }, [JSON.stringify(localValue), name, onCommit]);

  const hasOptionChanged = useCallback(
    (optionValue: unknown, optionName: string): boolean => {
      return !isEqual(optionValue, originalValue.current?.[optionName]?.value);
    },
    [JSON.stringify(originalValue.current)]
  );

  const handleOptionLabelClick = useCallback((optionName: string) => {
    setShowHelpForOption(optionName);
  }, []);

  const toggleExpandedOption = useCallback(
    (optionName: string) => {
      setExpandedOptions((prev) =>
        prev.includes(optionName) ? prev.filter((name) => name !== optionName)
          // single (default): opening a row collapses any other open one.
        : expandMode === 'single' ? [optionName]
        : [...prev, optionName]
      );
    },
    [expandMode]
  );

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

  // Default fields: drop user-added optionals, keep required/preselected/valued,
  // clear the required-only filter (mirrors the IDE's handleResetToDefault).
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

  const renderOption = useCallback(
    (
      optionName: string,
      { type, ...other }: IQorusFormField,
      // Inline (in-row) editing renders the editor a size down so it fits the
      // read row's height without shifting the rows around it.
      editorSize?: 'small',
      // The info panel below the row keeps showing schema messages while editing —
      // rendering them in the editor too would balloon a one-line edit.
      suppressSchemaMessages?: boolean
    ) => {
    const operatorParts = fixOperatorValue(other.op);
    return (
      <>
        {(suppressSchemaMessages ? [] : (options?.[optionName] as any)?.messages || []).map(
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
              {operatorParts.map((operator, index) => (
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
                    index === operatorParts.length - 1 &&
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
                  {size(operatorParts) > 1 ?
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
          // SEAM: forwarded through TemplateField's rest-spread to AutoFormField,
          // which renders consumer-injected editors by field type/ui_type.
          componentOverrides={componentOverrides}
          allowTemplates={!!(allowTemplates && options?.[optionName]?.supports_templates)}
          allowFunctions={!!options?.[optionName]?.supports_expressions}
          // reqraft: form-level expression fields get the Visual/Text shell
          // (DPQL text mode); opt out per-form via `templateFieldProps`.
          allowTextExpressions
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
          onChange={
            // Identity-stable on purpose: the typed fields debounce on
            // `[localValue, onChange]` — an inline lambda resets the pending emit
            // every render and the typed value can starve.
            handleValueChange
          }
          key={optionName}
          arg_schema={options?.[optionName]?.arg_schema}
          noSoft={!!rest?.options}
          value={other.value}
          isFunction={(other as { is_expression?: boolean }).is_expression}
          isDefaultFunction={options?.[optionName]?.default_view === 'expression'}
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
          size={editorSize || rest.size}
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
                  label={operatorParts.join(' ')}
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
    },
    [
      options,
      operators,
      readOnly,
      allowTemplates,
      templates,
      name,
      uniqueName,
      componentOverrides,
      templateFieldProps,
      availableOptions,
      fixedValue,
      // Depend on the specific `rest` values used, not the whole `rest` object
      // (which is a fresh `{...rest}` every render and would defeat the memo).
      rest?.options,
      rest?.size,
      handleValueChange,
      handleOperatorChange,
      handleAddOperator,
      handleRemoveOperator,
      getCustomMenuTemplateItems,
      getTypeForOption,
    ]
  );

  // Compact (read-first) rendering.
  // Theme-derived colours so the flat-row layout adapts to light/dark/custom themes.
  const cText = theme?.text?.color || '#ffffff';
  // Text emphasis tiers via reqore's readable-colour helper (key = full readable
  // text, muted = its dimmed variant, faint = the dimmed variant softened
  // further) instead of hand-rolled hex-alpha suffixes on the raw text colour.
  const cKey = getReadableColor(theme);
  const cMuted = getReadableColor(theme, undefined, undefined, true);
  const cFaint = `${cMuted}99`;
  const cDivider = `${cText}14`;
  const cHover = `${cText}0d`;
  const cDanger = theme?.intents?.danger || '#e35a5a';
  const cWarning = theme?.intents?.warning || '#ffdf34';
  const cInfo = theme?.intents?.info || '#3b8eea';
  const cSuccess = theme?.intents?.success || '#36b37e';
  const cBg = (theme as { main?: string } | undefined)?.main || '#181818';

  // The closure surface the extracted CompactRow reads through context. Refs and
  // setters are stable; the state/memo/handler fields change identity as they do
  // today, so a row re-renders exactly when its inputs do.
  const compactRowContextValue = useMemo<ICompactRowContext>(
    () => ({
      readOnly,
      commitMode,
      expandMode,
      options,
      operators,
      focusedEditing,
      showFieldTypes,
      expandedOptions,
      highlightedOptions,
      flashedOptions,
      infoPanelOverrides,
      setHighlightedOptions,
      setInfoPanelOverrides,
      setFocusedEditing,
      readRowHeights,
      originalValue,
      availableOptions,
      requiredGroupsInfo,
      handleValueChange,
      handleAddOptionalFieldChange,
      toggleExpandedOption,
      flashOption,
      hasOptionChanged,
      handleOptionLabelClick,
      removeSelectedOption,
      getTypeForOption,
      isOptionValid,
      confirmAction,
      renderOption,
      theme,
      cText,
      cMuted,
      cFaint,
      cKey,
      cDivider,
      cHover,
      cDanger,
      cWarning,
      cInfo,
      cBg,
    }),
    [
      readOnly,
      commitMode,
      expandMode,
      options,
      operators,
      focusedEditing,
      showFieldTypes,
      expandedOptions,
      highlightedOptions,
      flashedOptions,
      infoPanelOverrides,
      setHighlightedOptions,
      setInfoPanelOverrides,
      setFocusedEditing,
      readRowHeights,
      originalValue,
      availableOptions,
      requiredGroupsInfo,
      handleValueChange,
      handleAddOptionalFieldChange,
      toggleExpandedOption,
      flashOption,
      hasOptionChanged,
      handleOptionLabelClick,
      removeSelectedOption,
      getTypeForOption,
      isOptionValid,
      confirmAction,
      renderOption,
      theme,
      cText,
      cMuted,
      cFaint,
      cKey,
      cDivider,
      cHover,
      cDanger,
      cWarning,
      cInfo,
      cBg,
    ]
  );

  // The compact form: meter + invalid banner + grouped rows + the field adder.
  // Bypasses the classic ReqoreCollection layout; the classic path is untouched.
  const renderCompact = () => {
    // Toolbar filters narrow the listed rows; the meter reflects the full set.
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
        <CompactRowContext.Provider value={compactRowContextValue}>
        <ReqoreErrorBoundary>
          {showHelpForOption && (
            <OptionsHelpDialog
              onClose={() => setShowHelpForOption(undefined)}
              option={options[showHelpForOption]}
            />
          )}
          <StyledCompactWrap ref={compactWrapRef}>
            <StyledCompactHeader $bg={cBg}>
            {readFirstCompletion.total ?
              <StyledCompletion className='options-readfirst-completion'>
                {/* Draft/Ready readiness badge — the IDE restyled-creator hero
                    convention (RestyledFields): warning EditLine "Draft" while
                    fields still need attention, success CheckLine "Ready" once
                    everything validates. Driven by the same validity data as
                    the invalid-fields banner. Hidden in readOnly (nothing is
                    being drafted). */}
                {!readOnly ?
                  size(validityData.invalidFields) ?
                    <ReqoreTag
                      className='options-readfirst-status'
                      label='Draft'
                      intent='warning'
                      icon='EditLine'
                      minimal
                      size='small'
                      fixed
                    />
                  : <ReqoreTag
                      className='options-readfirst-status'
                      label='Ready'
                      intent='success'
                      icon='CheckLine'
                      minimal
                      size='small'
                      fixed
                    />
                : null}
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
                    <ReqoreP size='small' effect={{ opacity: 0.6 }} style={{ padding: '0 6px 6px' }}>
                      {groupConfig.subtitle}
                    </ReqoreP>
                  : null}
                  <StyledGroupBody
                    $divider={cDivider}
                    $hover={cHover}
                    $focus={cInfo}
                    $zebra={`${cText}08`}
                    className={compactNarrow ? 'readfirst-narrow' : undefined}
                  >
                    {names.map((entry) => (
                      <CompactRow
                        key={entry.name}
                        optionName={entry.name}
                        optionField={
                          entry.hidden ?
                            ({
                              type: (options?.[entry.name]?.ui_type ||
                                options?.[entry.name]?.type) as TQorusType,
                              value: undefined,
                            } as IQorusFormField)
                          : ((shownOptions as TQorusForm)[entry.name] as IQorusFormField)
                        }
                        hidden={entry.hidden}
                      />
                    ))}
                  </StyledGroupBody>
                </ReqorePanel>
              );
            })}

            {/* Batched commit: the Save/Discard bar docks bottom-right, floating
                over the rows while anything is staged — the product's draft
                convention (edits are a draft until explicitly applied). Save is
                gated on overall validity; Discard is the existing revert-all. */}
            {commitMode === 'batched' && !readOnly && dirtyOptionNames.length ?
              <StyledCommitDock $bg={cBg} $border={cDivider}>
                <ReqoreControlGroup
                  className='options-readfirst-commitbar'
                  verticalAlign='center'
                  wrap
                >
                  <ReqoreTag
                    size='small'
                    minimal
                    intent='warning'
                    icon='EditLine'
                    label={`${dirtyOptionNames.length} unsaved change${dirtyOptionNames.length === 1 ? '' : 's'}`}
                  />
                  <ReqoreButton
                    size='small'
                    intent='success'
                    icon='CheckLine'
                    fixed
                    className='options-readfirst-save'
                    disabled={!validityData.isValid}
                    tooltip={
                      validityData.isValid ?
                        'Apply the staged changes'
                      : 'Resolve the invalid fields before saving'
                    }
                    onClick={handleCommitClick}
                  >
                    Save
                  </ReqoreButton>
                  <ReqoreButton
                    size='small'
                    minimal
                    flat
                    fixed
                    icon='HistoryLine'
                    className='options-readfirst-discard'
                    onClick={handleRevertChangesClick}
                  >
                    Discard
                  </ReqoreButton>
                </ReqoreControlGroup>
              </StyledCommitDock>
            : null}

          </StyledCompactWrap>
        </ReqoreErrorBoundary>
        </CompactRowContext.Provider>
      </OptionsContext.Provider>
    );
  };

  if (
    rest.skeleton ||
    templates.loading ||
    typesLoading ||
    optionsLoading ||
    // Remote-fetch gates, mirroring IDE Options (systemOptions.tsx:1097-1102).
    loading ||
    (operatorsUrl && !operators) ||
    ((url || customUrl) && !options)
  ) {
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
              // Ported from IDE Options (commit 8e6b7781): full-width layout
              // for stretchable option types.
              stretch:
                STRECHABLE_TYPES.has(options[optionName].type as TQorusType) ||
                (options[optionName] as { stretch?: boolean }).stretch,
              size: 'small',
              floatingActions: true,
              actions: [
                // SEAM (reqraft): per-option injected hover actions — where
                // the IDE renders its `allowAi` AiAssistanceAction (with the
                // option's schema as context). The consumer (the IDE) injects
                // it; same factory pattern as the ExpressionBuilder's
                // `extraActions`.
                ...(typeof optionActions === 'function'
                  ? optionActions({
                      name: optionName,
                      schema: options[optionName],
                      value: availableOptions?.[optionName] as TOption,
                    })
                  : (optionActions ?? [])),
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
