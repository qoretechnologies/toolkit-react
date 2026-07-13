import {
  ReqoreButton,
  ReqoreCollection,
  ReqoreControlGroup,
  ReqoreErrorBoundary,
  ReqoreIcon,
  ReqoreMessage,
  ReqoreP,
  ReqoreSkeleton,
  ReqoreTag,
  ReqoreTagGroup,
  ReqoreVerticalSpacer,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { IReqoreCollectionProps } from '@qoretechnologies/reqore/dist/components/Collection';
import { IReqoreCollectionItemProps } from '@qoretechnologies/reqore/dist/components/Collection/item';
import {
  IReqorePanelAction,
  IReqorePanelProps,
} from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import {
  changeDarkness,
  getMainBackgroundColor,
  getReadableColor,
  percentToHexAlpha,
} from '@qoretechnologies/reqore/dist/helpers/colors';
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
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { CompactToolbar } from './CompactToolbar';
import {
  CompactToolbarContext,
  ICompactToolbarContext,
  TCompactSort,
} from './compactToolbarContext';
import {
  GROUP_INDENT,
  LABEL_COL_MAX,
  LABEL_COL_MIN,
  LABEL_COL_VAR,
  StyledCompactPanel,
  StyledGroupBody,
  StyledGroupHeader,
  StyledRequiredClusterBox,
  StyledRequiredClusterHeader,
  StyledStatusBox,
  StyledStatusBoxGroupLabel,
} from './compactRowStyles';
import { OptionFieldMessages } from './OptionFieldMessages';
import { OptionsHelpDialog } from './OptionsHelpDialog';
import {
  getFirstAttentionOptionName,
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstBucket,
  getReadFirstCompletion,
  getReadFirstStatus,
  isOptionValueEmpty,
  TReadFirstStatus,
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

/**
 * Resolve a field's `inherit_props` map against the current available
 * options (plus any values inherited from an outer FormEngine scope),
 * producing a `{ propName: siblingValue }` hash suitable for spreading
 * onto the field's renderer.
 *
 * For each entry `<prop-name-on-renderer> -> <sibling-field-name>`, the
 * sibling's current value is forwarded under the receiving prop name.
 * Lookup order:
 *   1. `availableOptions[siblingName]?.value` — the field's local scope.
 *   2. `inheritedFromParent[siblingName]` — the bag threaded in by an
 *      outer FormEngine (see the `inheritedFromParent` prop). Used when
 *      a composite field's `arg_schema` sub-form needs to reach a value
 *      on an ancestor scope — e.g. a service-method row's `body` picking
 *      up `language` from the parent service form.
 * Missing siblings emit `undefined`, which the renderer's prop type can
 * treat as "no hint".
 *
 * Designed to be JSON-pure: no closures, no transformations. Renderers
 * decide how to use the forwarded value (e.g. the consumer-injected
 * `code-editor` renderer maps a `language: "qore"` prop to its
 * highlighter mode).
 *
 * Mirrored in qorus-ide `src/components/Field/systemOptions.tsx`; keep
 * the two in sync (see qorus-ide's `.claude/CLAUDE.md`).
 */
const resolveInheritProps = (
  inheritProps: Record<string, string> | undefined,
  availableOptions: TQorusForm | undefined,
  inheritedFromParent?: Record<string, unknown>
): Record<string, unknown> => {
  if (!inheritProps) return {};
  const out: Record<string, unknown> = {};
  for (const propName in inheritProps) {
    const siblingName = inheritProps[propName];
    const localValue = (availableOptions?.[siblingName] as IQorusFormField | undefined)?.value;
    out[propName] = localValue !== undefined ? localValue : inheritedFromParent?.[siblingName];
  }
  return out;
};

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

const StyledCompactWrap = styled.div<{ $flush?: boolean }>`
  display: flex;
  flex-flow: column;
  gap: 10px;
  width: 100%;
  /* Allow the wrap to shrink inside flex/grid parents so its rows' ellipsis can
     engage instead of overflowing the container horizontally. */
  min-width: 0;
  max-width: 100%;
  /* A bit of horizontal breathing room for the whole form (header + content
     alike). Horizontal only — top padding would break the sticky toolbar's
     flush pin (see the scroll-context note below). Dropped to flush via the
     compactFlush prop, for embeds that own their own gutters (e.g. the
     SchemaDefinition tab body). */
  padding: ${({ $flush }) => ($flush ? '0' : '0 12px')};

  /* Own our scroll context instead of borrowing the host's. The sticky toolbar
     pins to whatever scrolls; if that scroller carries top padding (e.g. a
     ReqorePanel/ReqoreContent body), sticky \`top: 0\` resolves against its
     padding box and leaves an unblurred strip above the toolbar. By scrolling
     here — an UNPADDED box — the toolbar always pins flush and content ghosts
     cleanly beneath it, regardless of host padding (mirrors how the IDE
     dashboard keeps its StyledScrollBody scroller unpadded).
     We cap at the host's available height and scroll past it, but do NOT grow
     to fill it — short forms still hug their content. When the host height is
     indefinite, \`max-height: 100%\` resolves to none and the box grows so the
     host scrolls as before (graceful fallback). */
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;

  /* Option logos (e.g. language images) render as <img> inside ReqoreIcon's
     square box; constrain them so portrait PNGs don't overflow the row. */
  .reqore-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
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
  box-shadow: 0 4px 16px ${({ $bg }) => `${changeDarkness($bg, 0.4)}${percentToHexAlpha(55)}`};
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

// A required field with no value can arrive as `{ value: '' }` OR with no `value`
// key at all — fixOptions emits either depending on the field's default. They mean
// the same "empty", so drop the key before comparing: a value that differs ONLY by
// that representation must read as unchanged, otherwise the controlled value-sync
// effect re-fixes → re-emits → re-fixes forever (the echo loop).
const normalizeEmptyFieldValues = (fields: TQorusForm | TQorusFlatForm | undefined): TQorusForm =>
  reduce(
    (fields as TQorusForm) || {},
    (acc, field, name) => {
      const fieldValue = (field as IQorusFormField)?.value;
      if (field && typeof field === 'object' && (fieldValue === '' || fieldValue === undefined)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { value: _dropped, ...rest } = field as IQorusFormField;
        acc[name] = rest as IQorusFormField;
      } else {
        acc[name] = field as IQorusFormField;
      }
      return acc;
    },
    {} as TQorusForm
  );

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
  /**
   * Compact mode only: drop the read-first wrap's horizontal gutter (the 12px
   * breathing room) so the form sits flush to its container's edges. For embeds
   * that own their own gutters — e.g. the SchemaDefinition tab body, where the
   * form should line up with the section description above it. Default `false`.
   */
  compactFlush?: boolean;
  /**
   * Compact mode only: this form is an EMBEDDED sub-form (e.g. an arg_schema
   * field's nested form) rather than the top-level scroller. It doesn't own a
   * scroll context, so the toolbar isn't sticky and its header drops the dark
   * blurred backdrop (and the stacking context that goes with it) — it sits
   * transparently inside the parent's edit card. Default `false`.
   */
  compactNested?: boolean;
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

  /**
   * Bag of values forwarded from an outer FormEngine scope, used as a
   * fallback when a field's `inherit_props` names a sibling that isn't in
   * this form's own `availableOptions`. Populated automatically when
   * FormEngine renders a nested `arg_schema` sub-form (through
   * AutoFormField's hash / list mount sites) so that each level accumulates
   * its ancestors' inherited props. Consumers rarely set this by hand — it's
   * plumbing for the inherit_props scope-forwarding contract.
   */
  inheritedFromParent?: Record<string, unknown>;

  /**
   * Opt-in: on mount, drop the user straight into the first field they must
   * fill — the first empty, focusable field (in schema/sort order) that is
   * `required` or a member of a still-unsatisfied one-of `required_groups`
   * group. Disabled, readonly, read-only-form, and dependency-locked fields are
   * skipped. In compact (read-first) mode the target row is expanded through
   * the engine's own `expandedOptions` state, so its editor gains focus with no
   * DOM scraping or synthetic clicks. Strictly one-shot: it fires the first
   * time the form has focusable content (so an async-loaded schema is covered)
   * and then never again — a later value edit, server-driven field update, or
   * in-place schema reload will not re-focus; only a remount re-arms it. It also
   * never steals focus from a control the user has already moved into. No-op in
   * classic (non-compact) mode. Default: off.
   */
  autoFocusFirstRequired?: boolean;
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
  compactFlush = false,
  compactNested = false,
  commitMode = 'immediate',
  expandMode = 'single',
  onCommit,
  operators: operatorsProp,
  groups,
  optionsLoader,
  onValidityChange,
  optionActions,
  componentOverrides,
  inheritedFromParent,
  autoFocusFirstRequired,
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
  // Global toggle (toolbar ⓘ): reveal the short-description info panel on every
  // field that has a short_desc. Per-row ⓘ overrides still win over it.
  // Global field-info visibility, tri-state: `undefined` = default (critical
  // messages auto-open, the rest closed); `true` = show all; `false` = hide all
  // (even message fields). The toolbar ⓘ drives it.
  const [showAllDescriptions, setShowAllDescriptions] = useState<boolean | undefined>(undefined);
  const [showHelpForOption, setShowHelpForOption] = useState<string | undefined>();
  const [showInvalidOptionsOnly, setShowInvalidOptionsOnly] = useState<boolean>(false);
  // Which options are expanded into their editor (several can be open at once).
  const [expandedOptions, setExpandedOptions] = useState<string[]>([]);
  // Remembers each row's last settled status box, so an actively-edited field
  // stays put when its status flips (e.g. becomes valid) instead of jumping to
  // another box mid-edit and stealing focus. Keyed by option name.
  const settledBucket = useRef<Record<string, 'attention' | 'set' | 'optional'>>({});
  // Measured form width (not viewport — the form lives in drawers/panels of
  // arbitrary width) drives the stacked narrow layout.
  const [compactWrapRef, { width: compactWrapWidth }] = useMeasure<HTMLDivElement>();
  // Own handle on the scroll wrap (useMeasure's ref is a callback, no `.current`)
  // so the label-column measurement can publish its CSS var on the element. It's
  // STATE, not a ref: the wrap mounts only after the loading-skeleton gate
  // resolves, so the measurement effect must re-run when the node appears — a
  // ref wouldn't retrigger it.
  const [compactWrapNode, setCompactWrapNode] = useState<HTMLDivElement | null>(null);
  const setCompactWrap = useCallback(
    (node: HTMLDivElement | null) => {
      compactWrapRef(node);
      setCompactWrapNode((prev) => (prev === node ? prev : node));
    },
    [compactWrapRef]
  );

  // Global label-column sizing: size the label column to the WIDEST field label
  // across the whole form, clamped to [MIN, MAX], and publish it as a CSS var on
  // the scroll wrap. Both the grid column and the value-surface offsets read the
  // var, so the surface stays glued to the (now variable) column edge. Measured
  // off-DOM from the option labels — stable regardless of filtering/scroll, so it
  // never reflows as rows come and go.
  useLayoutEffect(() => {
    const wrap = compactWrapNode;
    if (!compact || !wrap) {
      return;
    }
    const family = getComputedStyle(wrap).fontFamily || 'sans-serif';
    const measurer = document.createElement('span');
    // Match StyledRowLabel's typography (font-weight 600, 13px) so the measured
    // width matches what the row actually renders.
    measurer.style.cssText = `position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap;font:600 13px ${family};`;
    document.body.appendChild(measurer);
    let widest = 0;
    forEach(options || {}, (schema, name) => {
      measurer.textContent = (schema?.display_name as string) || name;
      widest = Math.max(widest, measurer.offsetWidth);
    });
    document.body.removeChild(measurer);
    // Allowance for the required asterisk + help icon + the label's inner gaps.
    const col = Math.max(LABEL_COL_MIN, Math.min(LABEL_COL_MAX, Math.round(widest) + 28));
    wrap.style.setProperty(LABEL_COL_VAR, `${col}px`);
  }, [compact, options, theme, compactWrapNode]);
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
      // Defer to the next frame: when this fires for a field that just changed
      // panels, its row has only just re-mounted in the new box — scrolling in the
      // same tick targets the stale (pre-move) layout, so the page doesn't budge.
      // A rAF lets the new position settle first.
      requestAnimationFrame(() => {
        document
          .querySelector(`.readfirst-row[data-field="${optionNames[0]}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
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

  // Follow a field across panels: when its status bucket changes — e.g. you fill
  // an optional field and it jumps to Set / Needs attention — scroll to its new
  // row and flash it so it's easy to keep track of. `settledBucket` holds each
  // field's current panel (frozen while the field is being edited, it re-buckets
  // on collapse), so diffing it after every render catches the move the instant it
  // lands in the new panel. Runs every render; the diff is cheap and only fires a
  // scroll on an ACTUAL move of a non-expanded field.
  const prevSettledBucket = useRef<Record<string, 'attention' | 'set' | 'optional'>>({});
  useEffect(() => {
    if (!compact) return;
    const cur = settledBucket.current;
    const prev = prevSettledBucket.current;
    const moved = Object.keys(cur).find(
      (name) => prev[name] && prev[name] !== cur[name] && !expandedOptions.includes(name)
    );
    prevSettledBucket.current = { ...cur };
    if (moved) {
      flashOptions([moved], true);
    }
  });

  const compactNarrow = !!compactWrapWidth && compactWrapWidth < 480;
  // Info panels auto-open on Tier-1 content; the per-row user override sticks.
  const [infoPanelOverrides, setInfoPanelOverrides] = useState<Record<string, boolean>>({});
  // Toolbar filters affect the listed rows only — the meter reflects the full set.
  const [requiredOnly, setRequiredOnly] = useState<boolean>(false);
  const [compactQuery, setCompactQuery] = useState<string>('');
  // Compact field sort (Fields menu → "Sort by"); 'schema' = declared order.
  const [compactSort, setCompactSort] = useState<TCompactSort>('schema');
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
    // meaningfully add or change, skip the update. This breaks the controlled-component loop for
    // arg_schema fields while still allowing required/preselected options to be restored (in that
    // case fixedValue will differ from value, so we don't skip).
    // The compare is empty-normalized: fixOptions can round-trip a required-empty field between
    // `{ value: '' }` and no `value` key — without normalizing, that cosmetic difference reads as a
    // change and re-fixes forever (e.g. byte-size / expression / ruled string fields).
    // Note: compare fixedValue against value, not localValue.fields — localValue may have been
    // updated by nested FormEngine emissions, so comparing against it would never skip.
    const normalizedValue = normalizeEmptyFieldValues(value);
    if (
      isEqual(normalizedValue, normalizeEmptyFieldValues(lastEmittedValue.current)) &&
      isEqual(normalizeEmptyFieldValues(fixedValue), normalizedValue)
    ) {
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
    // Collapse it too: a removed field drops back to the (collapsed) Optional box
    // as a quiet addable row — if it was being edited, that editor must close
    // rather than linger as an open editor for a field that's no longer added.
    setExpandedOptions((prev) => prev.filter((name) => name !== optionName));
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

  // Read-first STATUS / BOX for one option — lifted to component scope so the
  // status boxes (renderCompact) and the header's "needs attention" count share
  // exactly one definition. One-of group members travel together (bucket by the
  // group's satisfaction); everything else by its own status.
  const schemaMsgIntent = useCallback(
    (name: string): 'danger' | 'warning' | undefined => {
      const msgs = ((options?.[name] as { messages?: Array<{ intent?: string }> } | undefined)
        ?.messages || []) as Array<{ intent?: string }>;
      if (msgs.some((m) => m.intent === 'danger')) return 'danger';
      if (msgs.some((m) => m.intent === 'warning')) return 'warning';
      return undefined;
    },
    [JSON.stringify(options)]
  );
  const getOptionStatus = useCallback(
    (name: string, hidden = false): TReadFirstStatus => {
      if (hidden) return 'optional';
      const schema = options?.[name];
      const type = (schema?.ui_type || schema?.type) as TQorusType;
      const value = (availableOptions as TQorusForm)?.[name]?.value;
      const empty = isOptionValueEmpty(value);
      const reqGroups = (schema?.required_groups as string[] | undefined) || [];
      const required = !!(schema?.required || reqGroups.length);
      const covered =
        empty &&
        reqGroups.some((g) => {
          const by = requiredGroupsInfo.satisfiedBy[g];
          return !!by && by !== name;
        });
      const msgIntent = schemaMsgIntent(name);
      const invalid = (!empty && !isOptionValid(name, type, value)) || msgIntent === 'danger';
      return getReadFirstStatus({
        empty,
        required,
        covered,
        invalid,
        warned: msgIntent === 'warning',
      });
    },
    [
      JSON.stringify(options),
      JSON.stringify(availableOptions),
      isOptionValid,
      requiredGroupsInfo,
      schemaMsgIntent,
    ]
  );
  const getOptionBucket = useCallback(
    (name: string, hidden = false): 'attention' | 'set' | 'optional' => {
      if (!hidden) {
        const reqGroups = (options?.[name]?.required_groups as string[] | undefined) || [];
        if (reqGroups.length) {
          return reqGroups.some((g) => !requiredGroupsInfo.satisfiedBy[g]) ? 'attention' : 'set';
        }
      }
      return getReadFirstBucket(getOptionStatus(name, hidden));
    },
    [JSON.stringify(options), requiredGroupsInfo, getOptionStatus]
  );
  // How many fields are in the "Needs attention" box — drives the header link.
  const readFirstAttentionCount = useMemo(
    () =>
      Object.keys(availableOptions || {}).filter((name) => getOptionBucket(name) === 'attention')
        .length,
    [JSON.stringify(availableOptions), getOptionBucket]
  );

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
  const handleToggleAllDescriptions = useCallback(() => {
    setInfoPanelOverrides({});
    setShowAllDescriptions((prev) => prev !== true);
  }, []);
  const handleToggleInvalidOnly = useCallback(() => setShowInvalidOptionsOnly((prev) => !prev), []);
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

  // --- First-attention-field autofocus (opt-in) -----------------------------
  // With `autoFocusFirstRequired`, drop the user straight into the first field
  // they must fix. We reuse the engine's own ordering (`availableOptions`), the
  // very same `getOptionBucket` the status boxes use to decide "needs attention"
  // (so we cover empty-required, unsatisfied one-of, AND filled-but-invalid rows
  // without ever drifting from what the user sees), and dependency gating
  // (`dependencyLockedNames`), then expand the target row through
  // `expandedOptions` — the row's editor-focus effect does the rest. No DOM
  // scraping, no synthetic clicks, no polling.
  //
  // Strictly one-shot: it fires the first time the form has focusable content
  // (so an async-loaded schema is still covered — the empty first pass doesn't
  // count), then never again for the life of this instance. A server-driven
  // field update or an in-place schema reload will NOT re-grab focus; only a
  // genuine remount (a fresh instance) auto-focuses again, which is the intended
  // on-mount behaviour.
  const hasAutoFocusedRef = useRef(false);
  // The field expanded programmatically for autofocus. A ref (not state) so
  // CompactRow's 60ms focus timer reads the current value regardless of render
  // batching; CompactRow focuses this one with `preventScroll` so an off-screen
  // (or below-the-fold) form is never scrolled into view on mount.
  const autoFocusNameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!autoFocusFirstRequired || !compact || !options) {
      return;
    }
    if (hasAutoFocusedRef.current) {
      return;
    }

    const orderedNames = Object.keys(availableOptions);
    if (!orderedNames.length) {
      return;
    }

    // Never grab focus from a control the user is already in — including a field
    // *inside* this form. If a slow/async schema lets the user start typing
    // before this first-required scan runs, we must not steal their caret. On a
    // clean mount focus rests on the body, so the intended "drop into the first
    // field" still fires. Bailing here leaves `hasAutoFocusedRef` false, so it
    // retries once focus is free.
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) {
      return;
    }

    const target = getFirstAttentionOptionName(orderedNames, (fieldName) => {
      const schema = options[fieldName];
      if (!schema) {
        return undefined;
      }
      return {
        focusable:
          !readOnly &&
          !schema.disabled &&
          !(schema as { readonly?: boolean }).readonly &&
          !dependencyLockedNames.includes(fieldName),
        // Single source of truth: the same bucket the read-first status boxes
        // show, so a filled-but-invalid required row is a target too.
        needsAttention: getOptionBucket(fieldName) === 'attention',
      };
    });

    // Mark done even when nothing needs attention, so later value edits or an
    // in-place schema reload never re-scan or re-focus. Only a remount arms it
    // again.
    hasAutoFocusedRef.current = true;

    if (target) {
      // Set the ref before the state update so CompactRow's focus timer sees it.
      autoFocusNameRef.current = target;
      setExpandedOptions((prev) =>
        prev.includes(target) ? prev
        : expandMode === 'multi' ? [...prev, target]
        : [target]
      );
    }
  }, [
    autoFocusFirstRequired,
    compact,
    options,
    availableOptions,
    readOnly,
    dependencyLockedNames,
    getOptionBucket,
    expandMode,
  ]);

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
          {(() => {
            const schemaMsgs = (
              suppressSchemaMessages ? [] : (options?.[optionName] as any)?.messages || []
            ) as { intent?: string; title?: string; content?: string }[];
            if (!schemaMsgs.length) return null;
            const items = schemaMsgs.map(({ intent, title, content }, index) => (
              <ReqoreMessage
                intent={intent as never}
                title={title}
                key={title || index}
                opaque={false}
                size='small'
                // Compact: flat (no border) to match the read-row info panels;
                // classic forms keep the bordered, bottom-margined message.
                flat={compact || undefined}
                margin={compact ? undefined : 'bottom'}
              >
                {content}
              </ReqoreMessage>
            ));
            // Compact: stack them in a 4px-gap panel so a field's messages look
            // identical whether the row is collapsed (read panel) or expanded.
            return compact ?
                <div
                  className='options-readfirst-info-panel'
                  style={{ display: 'flex', flexFlow: 'column', gap: 4, marginBottom: 8 }}
                >
                  {items}
                </div>
              : <>{items}</>;
          })()}
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
            // qorus#347-followup: resolve the field's `inherit_props` against
            // the CURRENT sibling values (with a fallback to
            // `inheritedFromParent` — the bag threaded in from an outer
            // FormEngine when this scope is an `arg_schema` sub-form),
            // threading each entry as a top-level prop. Each
            // `<prop-name>: <sibling-field-name>` mapping copies the
            // sibling's value onto the rendered field's renderer — e.g. a
            // `code-editor` with `inherit_props: { language: 'language' }`
            // picks up the live `language` value as a `language` prop without
            // a schema refetch. Spread AFTER `{...options?.[optionName]}` so
            // the runtime value wins over any schema-defined default of the
            // same key. Mirrored in qorus-ide's `systemOptions.tsx`; see the
            // CLAUDE.md rule there.
            {...resolveInheritProps(
              options?.[optionName]?.inherit_props,
              availableOptions,
              inheritedFromParent
            )}
            // qorus#347-followup (scope forwarding): merge accumulated
            // inheritance (`inheritedFromParent`) with THIS field's freshly
            // resolved inherit_props, and pass down as a single bag so any
            // nested `arg_schema` sub-form (mounted by AutoFormField for
            // `hash` / `free-hash` / list-of-hash fields) sees every value
            // the ancestor chain forwarded. This is the plumbing that lets a
            // service-method row's `body` sub-field pick up the parent
            // service form's `language` — the parent field declares
            // `inherit_props: { language: 'language' }`, the list renderer
            // forwards it into each row, and the row's body resolves against
            // the accumulated bag.
            inheritedFromParent={{
              ...inheritedFromParent,
              ...resolveInheritProps(
                options?.[optionName]?.inherit_props,
                availableOptions,
                inheritedFromParent
              ),
            }}
            // Propagate compact so an arg_schema field renders a COMPACT sub-form
            // (consistent with the parent) rather than the classic FormEngine.
            compact={compact}
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
                  <ReqoreTag size='small' labelKey='IS' label={operatorParts.join(' ')} />
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
  const cText = theme?.text?.color || '#f1f0ee';
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
  const cRowBg = changeDarkness(getMainBackgroundColor(theme), 0.01);
  const cGroupLine = `${cText}1f`;

  // The closure surface the extracted CompactRow reads through context. Refs and
  // setters are stable; the state/memo/handler fields change identity as they do
  // today, so a row re-renders exactly when its inputs do.
  const compactRowContextValue = useMemo<ICompactRowContext>(
    () => ({
      templates: templates.value,
      readOnly,
      commitMode,
      expandMode,
      options,
      operators,
      focusedEditing,
      showFieldTypes,
      showAllDescriptions,
      expandedOptions,
      autoFocusNameRef,
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
      templates.value,
      readOnly,
      commitMode,
      expandMode,
      options,
      operators,
      focusedEditing,
      showFieldTypes,
      showAllDescriptions,
      expandedOptions,
      autoFocusNameRef,
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

  const compactToolbarContextValue = useMemo<ICompactToolbarContext>(
    () => ({
      readOnly,
      invalidCount: size(validityData.invalidFields),
      attentionCount: readFirstAttentionCount,
      completion: readFirstCompletion,
      showInvalidOnly: showInvalidOptionsOnly,
      onToggleInvalidOnly: handleToggleInvalidOnly,
      hasMultipleOptions: size(availableOptions) > 1,
      compactQuery,
      setCompactQuery,
      requiredOnly,
      setRequiredOnly,
      compactSort,
      setCompactSort,
      showFieldTypes,
      showAllDescriptions,
      onToggleFieldTypes: handleShowFieldTypesClick,
      onToggleAllDescriptions: handleToggleAllDescriptions,
      filteredCount: size(filteredOptions),
      optionalFields,
      canRevert: !!(originalValue.current && !isEqual(localValue.fields, originalValue.current)),
      onAddOptionalField: (value) => handleAddOptionalFieldChange('options', value),
      onAddAll: handleAddAllOptional,
      onResetDefaults: handleResetToDefaultFields,
      onRevertAll: handleRevertChangesClick,
    }),
    [
      readOnly,
      validityData,
      readFirstAttentionCount,
      readFirstCompletion,
      showInvalidOptionsOnly,
      handleToggleInvalidOnly,
      availableOptions,
      compactQuery,
      setCompactQuery,
      requiredOnly,
      setRequiredOnly,
      compactSort,
      setCompactSort,
      showFieldTypes,
      showAllDescriptions,
      handleShowFieldTypesClick,
      handleToggleAllDescriptions,
      filteredOptions,
      optionalFields,
      originalValue,
      localValue,
      handleAddOptionalFieldChange,
      handleAddAllOptional,
      handleResetToDefaultFields,
      handleRevertChangesClick,
    ]
  );

  const compactHeaderActions = useMemo(() => [{ as: CompactToolbar, responsive: false }], []);
  const renderCompact = () => {
    const headerBg = `${changeDarkness(getMainBackgroundColor(theme), 0.02)}${percentToHexAlpha(88)}`;
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
    // Surface EVERY not-yet-added optional field as an addable (hidden) row, so
    // the whole schema is browsable inline — they all land in the Optional box
    // (hidden ⇒ 'optional' bucket) instead of being buried in the Fields menu.
    // Narrowed by the same filters as the listed rows (search query + required-
    // only). availableOptions (listed) and filteredOptions (these) are disjoint —
    // the former is built from fixedValue keys, the latter excludes them — so a
    // field is never both a listed and a hidden row.
    forEach(filteredOptions, (_schema, optionName) => {
      if (matchesFilters(optionName)) {
        pushRow(optionName, true);
      }
    });

    // User sort (Fields menu → "Sort by"), applied WITHIN each group so the
    // group sections and the required-group rails are preserved. Schema order is
    // the default and the stable tiebreaker (Array.sort is stable, and each
    // group's array is already in schema order). Clustering (renderGroupRows)
    // still pulls required-group members together at the first member's — now
    // sorted — slot.
    if (compactSort !== 'schema') {
      const labelOf = (name: string) => (options?.[name]?.display_name || name).toLowerCase();
      const isUnset = (name: string) =>
        isOptionValueEmpty((shownOptions as TQorusForm)[name]?.value);
      const isFieldInvalid = (name: string) =>
        !isOptionValid(
          name,
          (options?.[name]?.ui_type || options?.[name]?.type) as TQorusType,
          (shownOptions as TQorusForm)[name]?.value
        );
      const comparator = (a: { name: string }, b: { name: string }): number => {
        switch (compactSort) {
          case 'alpha':
            return labelOf(a.name).localeCompare(labelOf(b.name));
          case 'alpha-desc':
            return labelOf(b.name).localeCompare(labelOf(a.name));
          // unset/invalid first — falsy(0) sorts after truthy(1), so b - a.
          case 'unset':
            return Number(isUnset(b.name)) - Number(isUnset(a.name));
          case 'invalid':
            return Number(isFieldInvalid(b.name)) - Number(isFieldInvalid(a.name));
          default:
            return 0;
        }
      };
      forEach(grouped, (entries) => entries.sort(comparator));
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

    // Read-first STATUS per row → one of three boxes (Needs attention / Set /
    // Optional), via the component-scope getOptionBucket (shared with the header
    // count and the row dot, so box ↔ dot ↔ header always agree). Buckets keep
    // schema-group order (thin sub-labels) and the required-group clustering: an
    // unmet one-of group's members all land in attention and still rail up.
    type TRowEntry = { name: string; hidden: boolean };
    type TBucketKey = 'attention' | 'set' | 'optional';
    const buckets: Record<TBucketKey, Record<string, TRowEntry[]>> = {
      attention: {},
      set: {},
      optional: {},
    };
    const bucketGroups: Record<TBucketKey, string[]> = { attention: [], set: [], optional: [] };
    // Freeze the box of any field currently being edited (or whose one-of group
    // has an edited member) to its last settled box — so finishing an edit that
    // flips its status doesn't remount it in another box and steal focus.
    const stableBucketOf = (entry: TRowEntry): TBucketKey => {
      const fresh = getOptionBucket(entry.name, entry.hidden);
      const groupBeingEdited =
        !entry.hidden &&
        ((options?.[entry.name]?.required_groups as string[] | undefined) || []).some((g) =>
          (requiredGroupsInfo.members[g] || []).some((m) => expandedOptions.includes(m))
        );
      if (!entry.hidden && (expandedOptions.includes(entry.name) || groupBeingEdited)) {
        const memo = settledBucket.current[entry.name];
        if (memo) return memo;
      }
      settledBucket.current[entry.name] = fresh;
      return fresh;
    };
    groupKeys.forEach((groupName) => {
      grouped[groupName].forEach((entry) => {
        const b = stableBucketOf(entry);
        if (!buckets[b][groupName]) {
          buckets[b][groupName] = [];
          bucketGroups[b].push(groupName);
        }
        buckets[b][groupName].push(entry);
      });
    });
    const bucketCount = (b: TBucketKey) =>
      bucketGroups[b].reduce((n, g) => n + buckets[b][g].length, 0);
    // 'general' / 'optional' are the SYNTHETIC fallback group keys getOptionGroup
    // assigns to fields with no explicit `group` — printing a "General"/"Optional"
    // sub-label for those is just noise, so suppress it. BUT a consumer may also
    // use 'general' as a REAL group (defining it in the `groups` prop and tagging
    // fields with `group: 'general'`); in that case it's a named group like any
    // other and DOES get its sub-label.
    const showGroupSubLabel = (groupName: string) =>
      (groupName !== 'general' && groupName !== 'optional') || !!groups?.[groupName];
    const STATUS_BOXES: Array<{
      key: TBucketKey;
      label: string;
      intent?: 'warning' | 'success';
      icon: IReqoreIconName;
    }> = [
      { key: 'attention', label: 'Needs attention', intent: 'warning', icon: 'ErrorWarningLine' },
      { key: 'set', label: 'Set', intent: 'success', icon: 'CheckLine' },
      { key: 'optional', label: 'Optional', icon: 'CheckboxBlankCircleLine' },
    ];

    // Build the rows for one group: contiguous required-group members are pulled
    // together at the first member's slot and rendered as a connected rail (flat
    // rows — no wrapper — so the value surface applies normally; the rail + nodes
    // are drawn per member). Narrow stacks fall back to flat rows.
    const renderGroupRows = (names: Array<{ name: string; hidden: boolean }>) => {
      const renderRow = (
        entry: { name: string; hidden?: boolean },
        clustered: boolean,
        clusterFirst?: boolean,
        clusterLast?: boolean
      ) => (
        <CompactRow
          key={entry.name}
          optionName={entry.name}
          optionField={
            entry.hidden ?
              ({
                type: (options?.[entry.name]?.ui_type || options?.[entry.name]?.type) as TQorusType,
                value: undefined,
              } as IQorusFormField)
            : ((shownOptions as TQorusForm)[entry.name] as IQorusFormField)
          }
          hidden={entry.hidden}
          clustered={clustered}
          clusterFirst={clusterFirst}
          clusterLast={clusterLast}
        />
      );
      // (Clustering runs in narrow mode too now — the "One of the below is
      // required" box wraps the members regardless of width; it no longer relies
      // on a contiguous rail.)
      const emitted = new Set<string>();
      const groupOf = (name: string) =>
        (options?.[name]?.required_groups as string[] | undefined)?.[0];
      return names.map((entry) => {
        const grp = groupOf(entry.name);
        if (!grp) return renderRow(entry, false);
        if (emitted.has(grp)) return null;
        const memberEntries = names.filter((e) => !e.hidden && groupOf(e.name) === grp);
        if (memberEntries.length < 2) return renderRow(entry, false);
        emitted.add(grp);
        const railed = memberEntries.map((e, idx) =>
          renderRow(e, true, idx === 0, idx === memberEntries.length - 1)
        );
        // An UNMET one-of group gets the explicit "One of the below is required"
        // box (the Focus cluster). A met group needs no banner — the rail + the
        // "Covers"/"Covered by" chips already say which member satisfies it.
        if (requiredGroupsInfo.satisfiedBy[grp]) return railed;
        return (
          <StyledRequiredClusterBox
            key={grp}
            className='options-readfirst-required-cluster'
            $border={`${cWarning}33`}
            $tint={`${cWarning}0d`}
          >
            <StyledRequiredClusterHeader $color={cWarning}>
              <ReqoreIcon icon='LinkM' size='11px' style={{ color: cWarning }} />
              One of the below is required
            </StyledRequiredClusterHeader>
            {railed}
          </StyledRequiredClusterBox>
        );
      });
    };

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
            <CompactToolbarContext.Provider value={compactToolbarContextValue}>
              <StyledCompactWrap
                ref={setCompactWrap}
                className='options-readfirst-scroll'
                // A nested sub-form sits flush inside the parent's card — no outer
                // gutter (the card already provides the breathing room).
                $flush={compactFlush || compactNested}
              >
                <StyledCompactPanel
                  // The top-level form scrolls, so its toolbar STICKS and carries a
                  // dark blurred backdrop so content ghosts cleanly beneath it. A
                  // nested (arg_schema) sub-form owns no scroll context — drop the
                  // sticky, the backdrop, and the stacking context so its header is
                  // transparent inside the parent's card.
                  $headerBg={compactNested ? 'transparent' : headerBg}
                  $nested={compactNested}
                  flat
                  // No panel background: the form sits transparently on whatever
                  // hosts it (page, drawer, or — for an arg_schema field — the
                  // parent's edit card) instead of stacking its own dark surface.
                  // The status boxes keep their own tints; the sticky toolbar keeps
                  // its blurred header via the $headerBg override.
                  transparent
                  stickyHeader={!compactNested}
                  padded={false}
                  actions={compactHeaderActions}
                  contentStyle={{
                    display: 'flex',
                    flexFlow: 'column',
                    gap: '10px',
                    // Nested sub-form: no surrounding panel padding (it's flush in
                    // the parent card); top-level keeps a small bottom gutter.
                    padding: compactNested ? '0' : '0 0 12px',
                  }}
                >
                  {size(groupKeys) === 0 ?
                    <ReqoreMessage flat opaque={false} size='small'>
                      No fields match the current filters.
                    </ReqoreMessage>
                  : null}

                  {STATUS_BOXES.map((box) => {
                    const groupsInBox = bucketGroups[box.key];
                    const count = bucketCount(box.key);
                    if (!count) return null;
                    const accent =
                      box.key === 'attention' ? cWarning
                      : box.key === 'set' ? cSuccess
                      : cMuted;
                    // The muted "Optional" box reads as a quieter, recessed
                    // surface — a touch darker than the page rather than the
                    // faint grey tint the accent would give.
                    const boxBg =
                      box.key === 'optional' ?
                        changeDarkness(getMainBackgroundColor(theme), 0.06)
                      : undefined;
                    return (
                      <StyledStatusBox
                        $accent={accent}
                        $bg={boxBg}
                        key={box.key}
                        flat
                        minimal
                        collapseButtonProps={{ flat: true, minimal: true, size: 'small' }}
                        collapsible
                        // The Optional box now holds every not-yet-added field, so
                        // it starts COLLAPSED to keep the form focused on what's in
                        // use. But a SEARCH must surface matching addable fields —
                        // and ReqorePanel unmounts collapsed content — so force it
                        // open whenever a query is active. (isCollapsed is the
                        // panel's controllable state; manual toggling still works
                        // when no query is set.)
                        isCollapsed={box.key === 'optional' && !query}
                        label={
                          <StyledGroupHeader>
                            <ReqoreP effect={{ weight: 'bold' }} size='normal'>
                              {box.label}
                            </ReqoreP>
                            <ReqoreTag
                              size='small'
                              minimal
                              compact
                              intent={box.intent}
                              label={String(count)}
                            />
                          </StyledGroupHeader>
                        }
                        icon={box.icon}
                        className='options-readfirst-group'
                        padded={false}
                        contentStyle={{ padding: '4px 4px 6px' }}
                      >
                        {/* ONE group body per box: every field block (and the
                            thin schema sub-labels) is a direct flex child, so the
                            inter-field gap is identical everywhere — including
                            across schema-group boundaries. */}
                        <StyledGroupBody
                          $divider={cDivider}
                          $hover={cHover}
                          $focus={cWarning}
                          $success={cSuccess}
                          $rowBg={cRowBg}
                          $lineColor={cGroupLine}
                          className={compactNarrow ? 'readfirst-narrow' : undefined}
                        >
                          {groupsInBox.map((groupName) => {
                            const groupConfig = groups?.[groupName];
                            return (
                              <React.Fragment key={groupName}>
                                {showGroupSubLabel(groupName) ?
                                  <StyledStatusBoxGroupLabel>
                                    {getOptionGroupLabel(groupName, groups)}
                                  </StyledStatusBoxGroupLabel>
                                : null}
                                {showGroupSubLabel(groupName) && groupConfig?.subtitle ?
                                  <ReqoreP
                                    size='small'
                                    effect={{ opacity: 0.6 }}
                                    style={{
                                      marginTop: 2,
                                      marginBottom: 8,
                                      marginLeft: GROUP_INDENT,
                                      paddingRight: 10,
                                    }}
                                  >
                                    {groupConfig.subtitle}
                                  </ReqoreP>
                                : null}
                                {renderGroupRows(buckets[box.key][groupName])}
                              </React.Fragment>
                            );
                          })}
                        </StyledGroupBody>
                      </StyledStatusBox>
                    );
                  })}
                </StyledCompactPanel>

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
                        size='tiny'
                        minimal
                        flat
                        compact
                        effect={{ uppercase: true, spaced: 1 }}
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
            </CompactToolbarContext.Provider>
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
      <ReqoreControlGroup
        className='options-loading-skeleton'
        vertical
        fill
        fluid
        style={{ flexGrow: 1 }}
        gapSize='big'
      >
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
                ...(typeof optionActions === 'function' ?
                  optionActions({
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
