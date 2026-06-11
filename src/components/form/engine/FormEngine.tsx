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
import { useDebounce, useMeasure, useUpdateEffect } from 'react-use';
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
import { ReqraftCollapsibleContent } from '../../collapsible/CollapsibleContent';
import { StructuredDataView } from './_structuredData/StructuredDataView';
import { getOptionFieldMessages, OptionFieldMessages } from './OptionFieldMessages';
import { OptionsHelpDialog } from './OptionsHelpDialog';
import {
  colorToCss,
  formatBytes,
  formatOptionValue,
  getFileSize,
  getHashEntries,
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstCompletion,
  getValueType,
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
  /* The editor's trailing ⋮ (template menu): reqore gives group buttons
     align-self: flex-start plus a bottom margin that inflates their flex box
     (32px button + 6px margin = the 38px line) — together they rendered the ⋮
     3px above our vertically-centred ✓. Scope STRICTLY to direct buttons of
     the editor cell's TOP-LEVEL (horizontal) group: any broader and the rule
     reaches buttons inside nested vertical groups, where align-self is the
     HORIZONTAL axis (it centred the bool switch, then the allowed-values
     dropdown). */
  .readfirst-row-editing > div:nth-child(2) > .reqore-control-group > .reqore-button {
    align-self: flex-start !important;
    margin-top: 3px !important;
    margin-bottom: 0 !important;
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

const StyledEditCard = styled.div<{ $bg: string; $border: string }>`
  padding: 12px;
  display: flex;
  flex-flow: column;
  gap: 8px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;
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

// Recurring micro-layouts of the read-first rows and their popovers.
const StyledPopColumn = styled.div`
  display: flex;
  flex-flow: column;
  gap: 6px;
  max-width: 300px;
`;

const StyledPopGroup = styled.div`
  display: flex;
  flex-flow: column;
  gap: 4px;
`;

const StyledPopHint = styled.span<{ $small?: boolean }>`
  font-size: ${({ $small }) => ($small ? 11 : 12)}px;
  opacity: ${({ $small }) => ($small ? 0.6 : 0.7)};
`;

const StyledLabelBlock = styled.div`
  display: flex;
  flex-flow: column;
  gap: 2px;
  min-width: 0;
`;

const StyledRowLabel = styled.div<{ $color: string; $pointer?: boolean }>`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${({ $color }) => $color};
  font-weight: 600;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: ${({ $pointer }) => ($pointer ? 'pointer' : 'inherit')};
`;

const StyledCardHeading = styled.div`
  display: flex;
  flex-flow: column;
  min-width: 0;
`;

const StyledCardLabel = styled.div<{ $color: string }>`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* min-width: 0 lets the grid cell shrink below its content's intrinsic width
   so the ellipsis engages instead of overflowing. */
const StyledRowValue = styled.div<{ $color: string; $empty?: boolean }>`
  min-width: 0;
  color: ${({ $color }) => $color};
  font-style: ${({ $empty }) => ($empty ? 'italic' : 'normal')};
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StyledActionSlot = styled.span<{ $width: number }>`
  display: inline-flex;
  justify-content: center;
  width: ${({ $width }) => $width}px;
  flex: 0 0 auto;
`;

const StyledStar = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
`;

const StyledTypeTag = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-weight: 400;
  font-size: 11px;
  margin-left: 6px;
`;

const StyledHelpIcon = styled.span`
  cursor: help;
  display: inline-flex;
  opacity: 0.55;
  margin-left: 5px;
`;

const StyledMutedNote = styled.div<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-size: 12px;
`;

const StyledColumn = styled.div`
  display: flex;
  flex-flow: column;
`;

const StyledInfoPanel = styled.div`
  display: flex;
  flex-flow: column;
  gap: 4px;
  padding: 0 10px 8px 24px;
`;

const StyledRowInset = styled.div`
  padding: 0 10px 6px 24px;
`;

// Types whose editors are too tall/nested to edit in-row — these keep the edit
// card; `arg_schema` and operator fields are excluded separately.
const COMPACT_COMPLEX_TYPES = new Set([
  'hash',
  'free-hash',
  'list',
  'free-list',
  'array',
  'array-auto',
  'file',
  'file-string',
  'richtext',
  'long-string',
  'any',
  'auto',
  'schema',
  'schema-definition',
  'data-provider',
  'processor-mappings',
  'options',
  'system-options',
  'byte-size',
  'markdown',
  'method-name',
  'class-connectors',
  'class-array',
  'yaml',
]);

// A small inline colour swatch shown before an rgbcolor value's hex string.
const StyledColorSwatch = styled.span<{ $color: string; $border: string }>`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex: 0 0 auto;
  background: ${({ $color }) => $color};
  border: 1px solid ${({ $border }) => $border};
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
  onOptionsLoaded?: (options: IQorusFormSchema) => void;
  recordRequiresSearchOptions?: boolean;
  readOnly?: boolean;
  allowTemplates?: boolean;
  stringTemplates?: IReqoreFormTemplates;
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
  commitMode = 'immediate',
  onCommit,
  operators,
  groups,
  optionsLoader,
  onValidityChange,
  ...rest
}: IFormEngineProps) => {
  const [options, setOptions] = useState<IQorusFormSchema | undefined>(rest?.options || undefined);
  // optionsLoader lifecycle: loading feeds the skeleton gate, error the banner.
  const [optionsLoading, setOptionsLoading] = useState<boolean>(!!optionsLoader && !rest?.options);
  const [optionsError, setOptionsError] = useState<string | undefined>();
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
  const templates = useTemplates(allowTemplates, rest.stringTemplates);

  useDebounce(
    () => {
      if (isEqual(localValue.fields, value)) {
        return;
      }

      const toEmit = size(localValue.fields) ? (localValue.fields as TQorusForm) : undefined;
      lastEmittedValue.current = toEmit;
      const meta = size(localValue.meta) ? localValue.meta : undefined;
      // Batched mode still emits every staged change (consumers may want to
      // live-validate), but flags it as a draft — persistence waits for Save.
      onChange?.(name, toEmit, commitMode === 'batched' ? { ...(meta || {}), draft: true } : meta);
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

  const renderOption = (
    optionName: string,
    { type, ...other }: IQorusFormField,
    // Inline (in-row) editing renders the editor a size down so it fits the
    // read row's height without shifting the rows around it.
    editorSize?: 'small',
    // The info panel below the row keeps showing schema messages while editing —
    // rendering them in the editor too would balloon a one-line edit.
    suppressSchemaMessages?: boolean
  ) => {
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

  // Compact (read-first) rendering.
  // Theme-derived colours so the flat-row layout adapts to light/dark/custom themes.
  const cText = theme?.text?.color || '#ffffff';
  const cMuted = `${cText}99`;
  const cFaint = `${cText}66`;
  const cKey = `${cText}cc`;
  const cDivider = `${cText}14`;
  const cHover = `${cText}0d`;
  const cDanger = theme?.intents?.danger || '#e35a5a';
  const cWarning = theme?.intents?.warning || '#ffdf34';
  const cInfo = theme?.intents?.info || '#3b8eea';
  const cSuccess = theme?.intents?.success || '#36b37e';
  const cBg = (theme as { main?: string } | undefined)?.main || '#181818';

  // Value-cell content: colour adds a swatch, file an icon + size; hash keeps
  // its "N fields" summary (sub-fields reveal beneath the row).
  const renderReadFirstValue = (
    optionField: IQorusFormField,
    schema: TQorusFormFieldSchema | undefined,
    formatted: string
  ): React.ReactNode => {
    const valueType = getValueType(optionField, schema);
    const wrapStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      maxWidth: '100%',
    };
    const textStyle: React.CSSProperties = {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    if (valueType === 'rgbcolor') {
      const swatch = colorToCss(optionField?.value);
      return (
        <span style={wrapStyle}>
          {swatch ? <StyledColorSwatch aria-hidden $color={swatch} $border={cDivider} /> : null}
          <span style={textStyle}>{formatted}</span>
        </span>
      );
    }

    if (valueType === 'file') {
      const fileSize = getFileSize(optionField?.value);
      return (
        <span style={wrapStyle}>
          <ReqoreIcon icon='File2Line' size='13px' style={{ opacity: 0.7, flexShrink: 0 }} />
          <span style={textStyle}>{formatted}</span>
          {fileSize !== undefined ?
            <span style={{ color: cFaint, fontSize: 11, flexShrink: 0 }}>{formatBytes(fileSize)}</span>
          : null}
        </span>
      );
    }

    return formatted;
  };

  // One read-first row: label | value | action collapsed; the real editor (the
  // classic renderOption) expanded. `hidden` = search-surfaced optional —
  // activating the row adds the field first.
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
    const changed = !hidden && !readOnly && hasOptionChanged(optionField?.value, optionName);
    // Unmet groups drive the "One of" chip; a group satisfied by a SIBLING
    // drives the "covered by" note.
    const memberGroups: string[] = (schema?.required_groups as string[]) || [];
    const unmetGroups = memberGroups.filter(
      (groupName) => !requiredGroupsInfo.satisfiedBy[groupName]
    );
    const coveredByGroup = memberGroups.find(
      (groupName) =>
        requiredGroupsInfo.satisfiedBy[groupName] &&
        requiredGroupsInfo.satisfiedBy[groupName] !== optionName
    );
    const coveredByLabel =
      coveredByGroup && !schema?.required ?
        (options?.[requiredGroupsInfo.satisfiedBy[coveredByGroup] as string]
          ?.display_name as string) || requiredGroupsInfo.satisfiedBy[coveredByGroup]
      : undefined;
    const requiredGroupChip =
      !hidden && !readOnly && unmetGroups.length && !schema?.required ?
        <span
          style={{ display: 'inline-flex' }}
          role='presentation'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setHighlightedOptions(requiredGroupsInfo.members[unmetGroups[0]] || [])}
          onMouseLeave={() => setHighlightedOptions([])}
        >
          <ReqoreTag
            className='options-readfirst-required-group'
            size='small'
            minimal
            intent='warning'
            icon='LinkM'
            label={`One of: ${unmetGroups[0]}`}
            tooltip={{
              handler: 'click',
              content: (
                <StyledPopColumn>
                  {unmetGroups.map((groupName) => (
                    <StyledPopGroup key={groupName}>
                      <StyledPopHint>
                        Set one of these fields ({groupName}):
                      </StyledPopHint>
                      {requiredGroupsInfo.members[groupName].map((member) => (
                        <ReqoreTag
                          key={member}
                          className='options-readfirst-group-member'
                          size='small'
                          minimal
                          intent={member === optionName ? undefined : 'info'}
                          icon={member === optionName ? 'MapPinLine' : 'ArrowRightLine'}
                          label={(options?.[member]?.display_name as string) || member}
                          onClick={member === optionName ? undefined : () => flashOption(member)}
                        />
                      ))}
                    </StyledPopGroup>
                  ))}
                </StyledPopColumn>
              ),
            }}
          />
        </span>
      : null;
    const editType = ((schema?.ui_type as string) || (schema?.type as string)) ?? '';
    // Scalars edit in place inside the row; complex fields (tall or nested
    // editors) still open the expanded card below.
    const inlineEditable =
      !readOnly &&
      !schema?.arg_schema &&
      !(operators && size(operators)) &&
      !COMPACT_COMPLEX_TYPES.has(editType);
    const revertButton =
      changed ?
        <ReqoreButton
          className='options-readfirst-revert'
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
      : null;
    // Batched commit: a changed row is a draft until Save — mark it with the
    // product's Draft chip (always visible, unlike the hover-revealed revert).
    const draftChip =
      commitMode === 'batched' && changed ?
        <ReqoreTag
          className='options-readfirst-draft'
          label='Draft'
          intent='warning'
          icon='EditLine'
          size='small'
          minimal
          fixed
        />
      : null;

    // Info tiers: Tier 1 (danger/warning + dependency hints) must be visible
    // without interaction; Tier 2 (info/success, default notes) sits behind ⓘ.
    const infoActive = !hidden;
    type TInfoMsg = { intent?: string; title?: string; content: string };
    const schemaMessages: TInfoMsg[] =
      infoActive ?
        ((((schema as any)?.messages || []) as any[]).map((m) => ({
          intent: m.intent,
          title: m.title,
          content: m.content,
        })) as TInfoMsg[])
      : [];
    const fieldMessages: TInfoMsg[] =
      infoActive ?
        getOptionFieldMessages({
          schema: options || {},
          option: optionField || ({} as IQorusFormField),
          name: optionName,
          allOptions: availableOptions,
          getType: getTypeForOption,
        })
          // The row already shows the Required tag — the plain required
          // message would duplicate it.
          .filter((m) => m.label !== 'This field is required')
          .map((m) => ({ intent: m.intent as string, content: String(m.label) }))
      : [];
    const isCriticalMsg = (m: TInfoMsg) => m.intent === 'danger' || m.intent === 'warning';
    const tier1 = [...schemaMessages, ...fieldMessages].filter(isCriticalMsg);
    const tier2: TInfoMsg[] = [
      ...[...schemaMessages, ...fieldMessages].filter((m) => !isCriticalMsg(m)),
      ...(infoActive && schema?.default_value_desc ?
        [
          {
            content:
              `Default: ${schema.default_value_display_name || ''} — ${schema.default_value_desc}`.trim(),
          },
        ]
      : []),
    ];
    const worstIntent =
      tier1.some((m) => m.intent === 'danger') ? 'danger'
      : tier1.length ? 'warning'
      : undefined;
    const intentColor =
      worstIntent === 'danger' ? cDanger
      : worstIntent === 'warning' ? cWarning
      : undefined;
    const showStripe = infoActive && !!intentColor;
    const hasInfoPanelContent =
      infoActive && (tier1.length > 0 || tier2.length > 0 || !!schema?.short_desc);
    const infoPanelOpen =
      hasInfoPanelContent && (infoPanelOverrides[optionName] ?? tier1.length > 0);

    const renderInfoStrip = (m: TInfoMsg, index: number) => (
      <ReqoreMessage
        key={`${m.content}-${index}`}
        size='small'
        opaque={false}
        flat
        intent={m.intent as never}
        title={m.title}
      >
        {m.content}
      </ReqoreMessage>
    );

    const infoToggle =
      hasInfoPanelContent ?
        <span
          style={{ display: 'inline-flex', cursor: 'pointer' }}
          role='button'
          tabIndex={0}
          aria-label={`${infoPanelOpen ? 'Hide' : 'Show'} field information`}
          onClick={(e) => {
            e.stopPropagation();
            setInfoPanelOverrides((prev) => ({ ...prev, [optionName]: !infoPanelOpen }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setInfoPanelOverrides((prev) => ({ ...prev, [optionName]: !infoPanelOpen }));
            }
          }}
        >
          <ReqoreIcon
            icon={infoPanelOpen ? 'InformationFill' : 'InformationLine'}
            size='14px'
            intent={worstIntent as never}
            style={{ opacity: infoPanelOpen ? 0.9 : 0.55 }}
          />
        </span>
      : null;

    const infoBlock =
      infoPanelOpen ?
        <StyledInfoPanel className='options-readfirst-info-panel'>
          {schema?.short_desc ?
            <StyledMutedNote $color={cMuted}>{schema.short_desc}</StyledMutedNote>
          : null}
          {[...tier1, ...tier2].map(renderInfoStrip)}
        </StyledInfoPanel>
      : null;


    if (expandedOptions.includes(optionName)) {
      if (inlineEditable) {
        const collapse = () => toggleExpandedOption(optionName);
        const editingRow = (
          <div
            key={optionName}
            data-field={optionName}
            className='readfirst-row readfirst-row-editing options-readfirst-inline options-readfirst-value'
            style={
              readRowHeights.current[optionName] ?
                { minHeight: readRowHeights.current[optionName] }
              : undefined
            }
          >
            <StyledRowLabel
              role='button'
              tabIndex={0}
              aria-label={`Collapse ${label}`}
              title={schema?.short_desc || undefined}
              $color={cKey}
              $pointer
              onClick={collapse}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  collapse();
                }
              }}
            >
              {label}
              {required ? <StyledStar $color={cDanger}> *</StyledStar> : null}
            </StyledRowLabel>
            <div
              style={{ minWidth: 0 }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  collapse();
                }
              }}
            >
              {renderOption(optionName, optionField, 'small', true)}
            </div>
            <StyledRowActions>
              {draftChip}
              {/* No Required tag here: while editing, the editor's own
                  OptionFieldMessages strip below already says it — showing
                  both was redundant. The tag stays on READ rows, where no
                  message strip is visible. */}
              {revertButton}
              <ReqoreButton
                className='options-readfirst-done'
                size='small'
                flat
                minimal
                intent='success'
                icon='CheckLine'
                tooltip='Done'
                onClick={collapse}
              />
            </StyledRowActions>
          </div>
        );
        // The panel stays below the editing row — messages neither vanish nor
        // balloon the editor.
        return infoBlock ?
            <StyledColumn
              key={optionName}
              data-field={optionName}
              className='options-readfirst-info-row'
            >
              {editingRow}
              {infoBlock}
            </StyledColumn>
          : editingRow;
      }
      // Card chrome: badge / actions / tags render here — the row only fits
      // icon/image + the intent stripe.
      const schemaBadge = (schema as { badge?: unknown } | undefined)?.badge;
      const cardBadges =
        schemaBadge !== undefined && schemaBadge !== null ?
          ((Array.isArray(schemaBadge) ? schemaBadge : [schemaBadge]) as unknown[])
        : [];
      const cardActions =
        (schema as { actions?: unknown[] } | undefined)?.actions?.filter(
          (action) => !!action && typeof action === 'object'
        ) || [];
      const cardTags = ((schema as { tags?: unknown[] } | undefined)?.tags || []) as object[];
      const schemaIntentColor =
        schema?.intent ?
          (theme?.intents as Record<string, string> | undefined)?.[schema.intent as string]
        : undefined;
      return (
        <StyledEditCard
          key={optionName}
          data-field={optionName}
          className='options-readfirst-card'
          $bg={cHover}
          $border={schemaIntentColor ? `${schemaIntentColor}66` : `${cInfo}66`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <StyledCardHeading>
              <StyledCardLabel $color={cMuted}>
                {(schema as { icon?: string } | undefined)?.icon || (schema as { image?: string } | undefined)?.image ?
                  <ReqoreIcon
                    icon={(schema as { icon?: string } | undefined)?.icon as never}
                    image={(schema as { image?: string } | undefined)?.image}
                    size='14px'
                  />
                : null}
                <span>
                  {label}
                  {required ? <StyledStar $color={cDanger}> *</StyledStar> : null}
                </span>
                {cardBadges.map((badge, index) =>
                  typeof badge === 'object' ?
                    <ReqoreTag
                      size='small'
                      minimal
                      key={index}
                      className='options-readfirst-card-badge'
                      {...(badge as object)}
                    />
                  : <ReqoreTag
                      size='small'
                      minimal
                      key={index}
                      className='options-readfirst-card-badge'
                      label={badge as string | number}
                    />
                )}
              </StyledCardLabel>
              {schema?.short_desc ?
                <StyledMutedNote $color={cMuted} style={{ marginTop: 2 }}>
                  {schema.short_desc}
                </StyledMutedNote>
              : null}
              {cardTags.length ?
                <ReqoreTagGroup size='small' className='options-readfirst-card-tags'>
                  {cardTags.map((tag, index) => (
                    <ReqoreTag size='small' minimal key={index} {...(tag as object)} />
                  ))}
                </ReqoreTagGroup>
              : null}
            </StyledCardHeading>
            <ReqoreControlGroup fixed verticalAlign='center'>
              {cardActions.map((action, index) => {
                const { label: actionLabel, ...actionProps } = action as {
                  label?: string;
                } & Record<string, unknown>;
                return (
                  <ReqoreButton
                    size='small'
                    minimal
                    flat
                    fixed
                    key={index}
                    className='options-readfirst-card-action'
                    {...(actionProps as object)}
                  >
                    {actionLabel}
                  </ReqoreButton>
                );
              })}
              <ReqoreButton
                size='small'
                icon='FullscreenLine'
                minimal
                flat
                fixed
                className='options-readfirst-fullscreen'
                tooltip='Edit fullscreen'
                onClick={() => setFocusedEditing(optionName)}
              />
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
            </ReqoreControlGroup>
          </div>
          {/* Same fullscreen focused-editing affordance as the classic cards —
              the modal mounts when this option is focused. */}
          <FocusedEditing
            isFullscreen={focusedEditing === optionName}
            onClose={() => setFocusedEditing(undefined)}
            description={(schema?.display_name as string) || optionName}
          >
            {focusedEditing === optionName ?
              <Description
                longDescription={schema?.desc}
                shortDescription={schema?.short_desc}
                longDescriptionShownByDefault
              />
            : null}
            {renderOption(optionName, optionField)}
          </FocusedEditing>
        </StyledEditCard>
      );
    }

    const formatted = formatOptionValue(optionField, schema);
    const empty = formatted === '';
    // A hash row reveals its sub-fields as read-only sub-rows under a "view
    // more" disclosure; the row itself still expands the real editor on click.
    const valueType = getValueType(optionField, schema);
    const hashEntries =
      !hidden && (valueType === 'hash' || valueType === 'free-hash') ?
        getHashEntries(optionField, schema)
      : [];
    const typeLabel =
      showFieldTypes ?
        `<${(schema?.ui_type as string) || (schema?.type as string) || 'auto'}${(schema as { ui_element_type?: string } | undefined)?.ui_element_type ? `[${(schema as { ui_element_type?: string }).ui_element_type}]` : ''}>`
      : null;
    // Disabled rows (schema flag or unmet deps) can't open — a lock + reason
    // renders instead. Form-level readOnly still opens in view mode (Close).
    const fieldDisabled =
      !hidden &&
      !readOnly &&
      (!!schema?.disabled ||
        !hasAllDependenciesFullfilled(schema?.depends_on, availableOptions, options || {}));
    const fieldDisabledReason =
      schema?.disabled ? 'This field is disabled' : 'Disabled — dependencies are not fulfilled';
    // Dependency contract: top-level entries must ALL hold; a nested array
    // means ANY of its entries; `name=value` requires that exact value.
    const dependencyEntries =
      fieldDisabled && !schema?.disabled ?
        ((schema?.depends_on || []) as (string | string[])[])
      : [];
    const describeDependency = (dep: string) => {
      const eqIndex = dep.indexOf('=');
      const depName = eqIndex === -1 ? dep : dep.slice(0, eqIndex);
      const expected = eqIndex === -1 ? undefined : dep.slice(eqIndex + 1);
      const depLabel = (options?.[depName]?.display_name as string) || depName;
      const depValue = (availableOptions as TQorusForm)?.[depName]?.value;
      return {
        name: depName,
        exists: !!options?.[depName],
        label: expected === undefined ? depLabel : `${depLabel} = ${expected}`,
        fulfilled:
          expected === undefined ?
            !isOptionValueEmpty(depValue)
          : depValue != null && String(depValue) === expected,
      };
    };
    const depHighlightNames = (flatten(dependencyEntries as never[]) as string[])
      .map((dep) => describeDependency(dep).name)
      .filter((depName) => !!options?.[depName]);
    const renderDependencyTag = (dep: string) => {
      const info = describeDependency(dep);
      if (!info.exists) {
        return null;
      }
      return (
        <ReqoreTag
          key={dep}
          className='options-readfirst-dep'
          size='small'
          minimal
          intent={info.fulfilled ? 'success' : 'info'}
          icon={info.fulfilled ? 'CheckLine' : 'ArrowRightLine'}
          label={info.label}
          onClick={() => flashOption(info.name)}
        />
      );
    };
    const activate = (event?: { currentTarget?: Element | null }) => {
      if (fieldDisabled) {
        return;
      }
      const target = event?.currentTarget as HTMLElement | undefined;
      if (target?.classList?.contains('readfirst-row')) {
        readRowHeights.current[optionName] = Math.round(target.getBoundingClientRect().height);
      }
      if (hidden) {
        handleAddOptionalFieldChange('options', optionName);
      }
      toggleExpandedOption(optionName);
    };

    // Row chrome: icon/image before the label; schema `intent` as the edge
    // stripe (message-severity stripes win when both apply).
    const rowChromeIcon =
      (schema as { icon?: string } | undefined)?.icon || (schema as { image?: string } | undefined)?.image ?
        <ReqoreIcon
          icon={(schema as { icon?: string } | undefined)?.icon as never}
          image={(schema as { image?: string } | undefined)?.image}
          size='14px'
          className='options-readfirst-row-icon'
        />
      : null;
    const rowSchemaIntentColor =
      schema?.intent ?
        (theme?.intents as Record<string, string> | undefined)?.[schema.intent as string]
      : undefined;
    const rowStripeColor = (showStripe ? intentColor : undefined) || rowSchemaIntentColor;

    const row = (
      <div
        key={optionName}
        data-field={optionName}
        role='button'
        tabIndex={0}
        aria-label={`${label}${hidden ? ' (add field)' : ''}`}
        className={`readfirst-row options-readfirst-value${hidden ? ' readfirst-row-hidden' : ''}${fieldDisabled ? ' readfirst-row-disabled' : ''}${highlightedOptions.includes(optionName) ? ' readfirst-row-group-highlight' : ''}${flashedOptions.includes(optionName) ? ' readfirst-row-flash' : ''}`}
        aria-disabled={fieldDisabled || undefined}
        style={rowStripeColor ? { boxShadow: `inset 3px 0 0 ${rowStripeColor}` } : undefined}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate(event);
          }
        }}
      >
        <StyledLabelBlock>
          <StyledRowLabel title={schema?.short_desc || undefined} $color={cKey}>
            {rowChromeIcon}
            {label}
            {required ? <StyledStar $color={cDanger}> *</StyledStar> : null}
            {typeLabel ? <StyledTypeTag $color={cFaint}>{typeLabel}</StyledTypeTag> : null}
            {schema?.desc ?
              <StyledHelpIcon
                role='button'
                tabIndex={-1}
                aria-label='Help'
                className='options-readfirst-help'
                onClick={(event) => {
                  event.stopPropagation();
                  handleOptionLabelClick(optionName);
                }}
              >
                <ReqoreIcon icon='QuestionLine' size='12px' />
              </StyledHelpIcon>
            : null}
          </StyledRowLabel>
        </StyledLabelBlock>
        <StyledRowValue
          title={!empty && !hidden && typeof formatted === 'string' ? formatted : undefined}
          $color={empty || hidden ? cFaint : cText}
          $empty={empty || hidden}
        >
          {hidden ?
            'Not in form — add'
          : empty ?
            coveredByLabel ?
              `Not set — covered by “${coveredByLabel}”`
            : required ?
              'Required — not set'
            : 'Not set'
          : renderReadFirstValue(optionField, schema, formatted)}
        </StyledRowValue>
        <StyledRowActions>
          {/* Column discipline (table treatment): variable-width chips lead and
              rag INWARD; the info badge and the trailing edit/lock icon live in
              fixed-width slots pinned at the right, so the same affordance sits
              at the same x on every row. Hover utilities (revert/delete) sit
              between the chips and the fixed slots. */}
          {!hidden && !fieldDisabled && !valid ?
            requiredGroupChip ||
            <ReqoreTag label='Required' intent='danger' size='small' minimal />
          : null}
          {draftChip}
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
          {infoToggle ?
            <StyledActionSlot className='options-readfirst-info-slot' $width={26}>
              {infoToggle}
            </StyledActionSlot>
          : null}
          <StyledActionSlot
            className={`options-readfirst-trailing-slot${!hidden && !fieldDisabled ? ' options-readfirst-trailing-hover-only' : ''}`}
            $width={18}
          >
            {hidden ?
              <ReqoreIcon icon='AddLine' intent='info' size='14px' />
            : fieldDisabled ?
              dependencyEntries.length ?
                <span
                  role='presentation'
                  style={{ display: 'inline-flex' }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHighlightedOptions(depHighlightNames)}
                  onMouseLeave={() => setHighlightedOptions([])}
                >
                  <ReqoreIcon
                    className='options-readfirst-locked options-readfirst-lock-deps'
                    icon='LockLine'
                    size='14px'
                    style={{ opacity: 0.45, cursor: 'pointer' }}
                    tooltip={{
                      handler: 'click',
                      content: (
                        <StyledPopColumn>
                          <StyledPopHint>Unlocked by:</StyledPopHint>
                          {dependencyEntries.map((entry, index) =>
                            Array.isArray(entry) ?
                              <StyledPopGroup key={index}>
                                <StyledPopHint $small>any of:</StyledPopHint>
                                {entry.map(renderDependencyTag)}
                              </StyledPopGroup>
                            : renderDependencyTag(entry)
                          )}
                        </StyledPopColumn>
                      ),
                    }}
                  />
                </span>
              : <span
                  title={fieldDisabledReason}
                  style={{ display: 'inline-flex', opacity: 0.45 }}
                >
                  <ReqoreIcon className='options-readfirst-locked' icon='LockLine' size='14px' />
                </span>
            : <ReqoreIcon
                className='readfirst-action'
                icon={readOnly ? 'EyeLine' : 'EditLine'}
                size='14px'
              />
            }
          </StyledActionSlot>
        </StyledRowActions>
      </div>
    );

    if (hashEntries.length) {
      return (
        <StyledColumn
          key={optionName}
          data-field={optionName}
          className='options-readfirst-hash-row'
        >
          {row}
          <StyledRowInset>
            <ReqraftCollapsibleContent
              maxCollapsedHeight={96}
              fadeColor={cBg}
              accentColor={cBg}
              buttonProps={{ className: 'options-readfirst-viewmore' }}
            >
              {/* The IDE workflow-orders renderer (ReqoreDataView): a nested,
                  type-coloured tree. Section summaries own their
                  expand/collapse clicks, but clicking a VALUE chip opens the
                  hash's editor. The Fields-menu "Show field types" toggle also
                  drives the per-scalar type chips here. Depth 2 = root + first
                  level open; deeper nests start collapsed so the preview stays
                  short before the fade's "Show more". */}
              <div className='options-readfirst-structured'>
                <StructuredDataView
                  value={optionField?.value}
                  collapsibleRoot={false}
                  showTypes={showFieldTypes}
                  defaultExpandDepth={2}
                  onItemClick={() => activate()}
                />
              </div>
            </ReqraftCollapsibleContent>
          </StyledRowInset>
          {infoBlock}
        </StyledColumn>
      );
    }

    if (infoBlock) {
      return (
        <StyledColumn
          key={optionName}
          data-field={optionName}
          className='options-readfirst-info-row'
        >
          {row}
          {infoBlock}
        </StyledColumn>
      );
    }

    return row;
  };

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
                    <StyledMutedNote $color={cMuted} style={{ padding: '0 6px 6px' }}>
                      {groupConfig.subtitle}
                    </StyledMutedNote>
                  : null}
                  <StyledGroupBody
                    $divider={cDivider}
                    $hover={cHover}
                    $focus={cInfo}
                    $zebra={`${cText}08`}
                    className={compactNarrow ? 'readfirst-narrow' : undefined}
                  >
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
