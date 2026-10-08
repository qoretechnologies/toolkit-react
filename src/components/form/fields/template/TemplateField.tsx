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
  ReqoreMenuItem,
  ReqoreMenuSection,
  ReqoreMessage,
  ReqorePopover,
  ReqoreSkeleton,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { IReqoreMenuItemProps } from '@qoretechnologies/reqore/dist/components/Menu/item';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
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
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import {
  filterTemplatesByType as templatesFilterFunc,
  getTemplateKey,
  getTemplateValue,
  findTemplate,
  isCompleteTemplateToken,
  describeTemplateReference,
  isValueTemplate,
} from '../../../../helpers/templates';
import { classifyTypedText, mightBeDpqlExpression } from '../../../../helpers/dpqlDetection';
import {
  renderTemplateItemDescriptions,
  templateItemsToShow,
} from '../../../../helpers/templateItems';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';
import { getTypeFromValue } from '../../../../helpers/validations';
import { useDpqlProbe } from '../../../dpqlEditor/useDpqlProbe';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';
import { useWhyDidYouUpdate } from '../../../../hooks/useWhyDidYouUpdate';
import { ExpressionBuilder, IExpressionBuilderProps } from '../../expressions/builder';
// Direct import — the cycle (TemplateField → ExpressionField → builder →
// TemplateField) is render-time only, safe like the other Field cycles.
import { ExpressionField } from '../../expressions/ExpressionField';
import { IExpression, TExpressionReorder } from '../../expressions/types';
import { useExpressions } from '../../expressions/useExpressions';
import { AutoFormField as Auto, IQorusType as IQorusFormType } from '../auto/AutoFormField';
import BooleanFormField from '../boolean/Boolean';
import { DateFormField } from '../date/Date';
import { ReqraftFileFormField } from '../file/File';
import LongStringFormField from '../long-string/LongString';
import NumberFormField from '../number/Number';
import { ReadOnlyTemplateTag } from './ReadOnlyTemplateTag';
import { RichTextFormField } from '../rich-text/RichText';
import { richtextToString } from '../../../../helpers/common';
import { isSingleLineStringType } from '../../../../helpers/singleLineString';
import { isUntypedOptionType } from '../../../../helpers/optionUiTypes';
import {
  expressionSeedOf,
  isWrittenAsText,
  isWrittenAsTextOnTheValueTab,
  loneTemplateOf,
  loneValueOf,
  expressionTextOfValue,
  sameValueType,
  templateTypeName,
  valueTextOf,
  TValueTab,
  templateTextValue,
  untypedTextOf,
} from './writtenAsText';
import {
  IRowMenuRegistration,
  RowMenuContext,
  useRowMenu,
  useRowMenuPublisher,
} from '../../engine/rowMenuContext';

// Re-export template utilities for consumers
export { getTemplateKey, getTemplateValue, isValueTemplate };
export type { IQorusFormType as IQorusType };

/**
 * How long the author must pause before typed text is sent to the DPQL
 * probe. Long enough that a probe is not sent for every prefix of what is
 * being typed, short enough that the offer appears while they are still
 * looking at the field.
 */
const DPQL_DETECT_DEBOUNCE_MS = 400;

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
// `type` is FORWARDED here, unlike the other wrappers below: the long-string
// field consumes it to decide whether it holds one line (a `string` does, a
// `long-string`, `hash` or `list` does not) and never spreads it to the DOM.
// Dropping it made every string field in every FormEngine form a growing
// textarea, so an alert rule's Internal Name took Enter.
const LongStringField = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <LongStringFormField
    {...rest}
    type={type}
    onChange={(value: string) => onChange?.(name, value)}
  />
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
   * SEAM (reqraft, additive): a collapsed section in the field's `⋮` menu,
   * rendered before "Set Custom Value"; a row click closes the menu. The
   * expression builder puts its operand reorder actions here.
   */
  menuActions?: ITemplateMenuActions;
  /**
   * SEAM (reqraft, additive): rows appended at the end of the `⋮` menu, after
   * a divider — where an operand's destructive action goes on a phone, whose
   * row has no room for it inline. Clicking a row closes the menu.
   */
  menuTrailingItems?: IReqoreMenuItemProps[];
  /** SEAM (reqraft, additive): forwarded to a nested expression builder. */
  reorder?: TExpressionReorder;
  /**
   * SEAM (reqraft, additive): render expression mode through the
   * `ExpressionField` shell — Visual (the ported builder) + Text (the
   * net-new DPQL editor) — instead of the IDE's bare builder. FormEngine
   * turns this on for its (top-level) fields; nested operands (builder
   * arguments, array items) never receive it and stay IDE-verbatim.
   */
  allowTextExpressions?: boolean;
  /**
   * The value is entered on tabs (qorus#646, David): Value · Expression · Visual where the field takes
   * templates and expressions written as text, Value · Template where it takes templates only. A form's
   * options set it (FormEngine); an expression's operands and other hosts keep the field as it was.
   */
  valueTabs?: boolean;
  /** The words of the value tabs, for a host that translates them; English where not given. */
  valueTabsLabels?: Partial<IValueTabsLabels>;
  /**
   * SEAM (reqraft): host-injected per-card actions for the expression editor
   * this field renders in expression mode (the IDE's AI-assist button).
   * Declared here — not left to the index signature — so it is destructured
   * out of `rest` and never spread onto a leaf input.
   */
  extraActions?: IExpressionBuilderProps['extraActions'];
  /**
   * SEAM (reqraft): the host's per-`ui_type` editors, forwarded to the field
   * component and to the expression editor's operand rows. Declared here — not
   * left to the index signature — for the same reason as `extraActions` above:
   * so it is destructured out of `rest` and never spread onto a leaf input or a
   * Reqore layout component, both of which pass unknown props to the DOM.
   */
  componentOverrides?: Record<string, React.FC<any>>;
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

/**
 * The words of the value tabs (qorus#646). A host that translates its interface passes its own; a label that
 * holds a value is a function of it, so the host keeps its language's word order.
 */
export interface IValueTabsLabels {
  value: string;
  expression: string;
  visual: string;
  template: string;
  expressionTooltip: string;
  visualTooltip: string;
  templateTooltip: string;
  /** Said on the Value tab for an expression that is not a lone value or template. */
  cannotShowExpression: string;
  /** Said on the Value tab for a template it cannot show; `tab` is the tab's own label. */
  templateShownOn: (tab: string) => string;
  replaceWithAValue: string;
  /** A template of another type than the field's; `from` and `to` are the types' names. */
  conversion: (from: string, to: string) => string;
  /** The name of a type in `conversion`. */
  typeName: (type: string) => string;
  undo: string;
  /** The undo's tooltip; `text` is what was typed. */
  undoTooltip: (text: string) => string;
}

export const DEFAULT_VALUE_TABS_LABELS: IValueTabsLabels = {
  value: 'Value',
  expression: 'Expression',
  visual: 'Visual',
  template: 'Template',
  expressionTooltip: 'Write an expression - it also takes templates',
  visualTooltip: 'Build the expression visually',
  templateTooltip: 'Choose a template',
  cannotShowExpression: "This expression can't be shown as a value.",
  templateShownOn: (tab) => `A template is shown on the ${tab} tab, not here.`,
  replaceWithAValue: 'Replace it with a value',
  conversion: (from, to) =>
    `${from} is converted to ${to.toLowerCase()} when the value is used; a value that does not convert fails`,
  typeName: templateTypeName,
  undo: 'Undo',
  undoTooltip: (text) => `Keep "${text}" as a value instead`,
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

/**
 * The `menuActions` seam: a collapsed section of menu items, dividers, nested
 * sections, or custom content — rendered with the popover's close callback so
 * an inline control can shut the menu after acting.
 */
export interface ITemplateMenuActions {
  label: string;
  icon?: IReqoreIconName;
  className?: string;
  items: (
    | IReqoreMenuItemProps
    | (IReqoreMenuDividerProps & { isDivider: true })
    | (ITemplateMenuActions & { isSection: true })
    | { isCustom: true; content: (closePopover?: () => void) => React.ReactNode }
  )[];
}

const renderMenuActionRows = (
  actions: ITemplateMenuActions,
  closePopover: (() => void) | undefined,
  size: IReqoreButtonProps['size']
): React.ReactNode =>
  actions.items.map((item, index) => {
    if ('isDivider' in item) {
      return <ReqoreMenuDivider key={index} {...item} />;
    }

    if ('isCustom' in item) {
      return <React.Fragment key={index}>{item.content(closePopover)}</React.Fragment>;
    }

    if ('isSection' in item) {
      return (
        <ReqoreMenuSection
          key={index}
          label={item.label}
          icon={item.icon}
          className={item.className}
          isCollapsed
          transparent
          size={size}
        >
          {renderMenuActionRows(item, closePopover, size)}
        </ReqoreMenuSection>
      );
    }

    // The menu hands its size to direct children only; rows inside a
    // section get it from here, or they render at the default size next to
    // rows that do not.
    return (
      <ReqoreMenuItem
        size={size}
        {...item}
        key={index}
        onClick={(event, itemId) => {
          item.onClick?.(event, itemId, closePopover);
          closePopover?.();
        }}
      />
    );
  });

// The `menuTrailingItems` rows: last in the menu, behind a divider. A direct
// child of `ReqoreMenu` for the same reason as `MenuActionsSection` below.
const MenuTrailingItems = memo(
  ({
    items,
    closePopover,
    size,
  }: {
    items: IReqoreMenuItemProps[];
    closePopover?: () => void;
    size?: IReqoreButtonProps['size'];
  }) => (
    <>
      <ReqoreMenuDivider size={size} />
      {items.map((item, index) => (
        <ReqoreMenuItem
          size={size}
          {...item}
          key={index}
          onClick={(event, itemId) => {
            item.onClick?.(event, itemId);
            closePopover?.();
          }}
        />
      ))}
    </>
  )
);

// A direct child of `ReqoreMenu`, like `CustomMenuItems`, so the menu hands it
// the popover's `closePopover` — a section does not pass it on to its rows.
const MenuActionsSection = memo(
  ({
    actions,
    closePopover,
    size,
    startExpanded,
    ...rest
  }: {
    actions: ITemplateMenuActions;
    closePopover?: () => void;
    size?: IReqoreButtonProps['size'];
    /** @see `loneSectionStartsExpanded` — the menu's only group opens itself. */
    startExpanded?: boolean;
  }) => (
    <ReqoreMenuSection
      label={actions.label}
      icon={actions.icon}
      isCollapsed={!startExpanded}
      transparent
      className='template-menu-actions'
      size={size}
      {...rest}
    >
      {renderMenuActionRows(actions, closePopover, size)}
    </ReqoreMenuSection>
  )
);

export const CustomMenuItems = memo(
  ({
    items,
    closePopover,
    setIsTemplate,
    setTemplateValue,
    startExpanded,
    ...rest
  }: {
    items: TCustomTemplateItems | undefined;
    closePopover?: () => void;
    setIsTemplate: React.Dispatch<React.SetStateAction<boolean>>;
    setTemplateValue: React.Dispatch<React.SetStateAction<string | null>>;
    /** @see `loneSectionStartsExpanded` — the menu's only group opens itself. */
    startExpanded?: boolean;
  }) => {
    return (
      <ReqoreMenuSection
        label='Set Custom Value'
        isCollapsed={!startExpanded}
        transparent
        icon='Text'
        {...rest}
      >
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
    size,
    ...rest
  }: ITemplateDropdownSelectorProps) => {
    /* The LAST hop before Reqore, which is the only place a drawn description
       may be made: `filteredTemplates` upstream is a `JSON.stringify` memo key,
       and an element in it throws on its own circular owner. */
    const renderMarkdown = useMarkdownRenderer();
    const shownItems = useMemo(
      () => renderTemplateItemDescriptions(templateItemsToShow(items), renderMarkdown),
      [items, renderMarkdown]
    );

    // One resolver for every surface that names a reference — the picker chip
    // here, the read-only tag, and the compact row's expression summary. The
    // row and this editor must agree: a reference that reads as its path when
    // the row is closed cannot read as `$data:{…}` the moment it is opened.
    const resolved = describeTemplateReference(templates, value);
    const template = resolved.item;
    const label = resolved.label || rest.label || 'Select Template';
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
            items={shownItems}
            label={label}
            leftIconProps={leftIconProps}
            caretPosition='right'
            filterable
            size={size}
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
              size={size}
              onClick={onRemoveClick}
            />
          : null}
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);

/**
 * `ui_type`s whose OWN editor renders templates as chips inline.
 *
 * For these the template SELECTOR must not take over: it replaces a control the
 * author can type in with one they can only pick from. A Qorus test assertion's
 * `Value` is the case this was written for — the IDE's own `auto.tsx` already
 * renders it as template rich text (type freely, references become chips), and
 * the same field reached through this form engine offered a dropdown and no way
 * to type at all.
 *
 * `richtext` is reqraft's own; a consumer adds its types through the
 * `templateAwareUiTypes` prop, exactly as it adds `rendererOnlyUiTypes`.
 */
export const BuiltInTemplateAwareUiTypes = ['richtext'];

export const isTemplateAwareUiType = (uiType?: string, extra?: string[]): boolean =>
  !!uiType && [...BuiltInTemplateAwareUiTypes, ...(extra ?? [])].includes(uiType);

/**
 * One entry of the "set a value of this type" menu an untyped field offers.
 *
 * `onClick` is typed by what the caller actually invokes it with — the chosen
 * value and a reset callback — rather than as `Function`, which accepts a class
 * declaration as readily as a handler and gives no help at the call site.
 */
interface IUntypedFieldMenuItem {
  label?: unknown;
  description?: unknown;
  isDivider?: boolean;
  onClick?: (value: unknown, reset: () => void) => void;
}

const TemplateFieldImpl = memo(
  ({
    rowMenu,
    value,
    name,
    onChange,
    component: Comp = Auto,
    templates,
    interfaceContext, // eslint-disable-line @typescript-eslint/no-unused-vars
    allowTemplates = true,
    allowFunctions,
    allowTextExpressions,
    valueTabs,
    valueTabsLabels,
    extraActions,
    componentOverrides,
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
    menuActions,
    menuTrailingItems,
    reorder,
    label,
    ...rest
  }: ITemplateFieldProps & { rowMenu?: IRowMenuRegistration }) => {
    const qorusTypes = useQorusTypes();
    const functions = useExpressions({
      allow: !!allowFunctions,
      expressionsUrl: rest.expressions_url,
      extraExpressions: rest.expressions,
    });
    const type = rest.ui_type || rest.type || rest.defaultType;

    /* The type an EXPRESSION must return, and is stored with, is a DATA type.
       `type` above deliberately prefers `ui_type`, because that is what decides
       which editor to render — but a ui_type says how a value is EDITED, not
       what it is. The IDE's reference fields carry `ui_type: 'test-reference'`
       (a rich-text editor that turns `$.` paths into chips), and feeding that
       to the expression builder asked it for an expression RETURNING
       `test-reference`: no expression returns one, so every choice was refused
       with *"the expected return type is test-reference"*, and the ui_type was
       then stored on the saved expression as its declared type.

       The declared data type is the constraint; the ui_type is only a fallback
       for a field that declares no type at all. */
    const expressionDataType = rest.type || rest.defaultType || rest.ui_type;

    const filteredTemplates = useMemo<IReqoreFormTemplates>(():
      IReqoreFormTemplates | undefined => {
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

      /* A lone category is opened, once, HERE — where this control resolves the
         templates every one of its pickers then reads: the "Select Template"
         dropdown, the in-editor `$` list, the numeric field's focus dropdown and
         the expression builder's argument picker. Applying it per picker meant
         each new one had to remember, and the ones that forgot made the author
         click through a header naming the only category on offer to reach the
         only values on offer.

         LAST, after both filters. `filterTemplatesFunc` is given the grouped
         shape on purpose — the Qog expression builder filters top-level items by
         `metadata.dataRole`, which is a property of the CATEGORY — so flattening
         before it would hand it values and quietly change what it keeps. This
         only changes what is finally shown. */
      return { ...result, items: templateItemsToShow(result?.items) };
    }, [
      JSON.stringify(templates),
      type,
      allowTemplates,
      filterTemplatesByType,
      JSON.stringify(rest.arg_schema),
      filterTemplatesFunc,
    ]);

    // An `any`-typed field has no editor of its own until a concrete type is
    // chosen, so it opened on the TYPE PICKER: before an author could say what
    // they meant, they had to answer a question about storage — "is this a Text
    // or a Number?" — that they often cannot answer, because the value they
    // want is a reference to something else whose type is not theirs to pick.
    //
    // So an untyped field that accepts templates now opens on the template
    // selector, which is the answer most of them want, and "Set Custom Value"
    // in the ⋮ menu is the way to a literal of a chosen type. That is the
    // reverse of the old default, and it is the right way round: choosing a
    // template is picking from a list, choosing a literal is a decision.
    //
    // Only while the field is EMPTY. A field already holding a literal must
    // open showing that literal — flipping to the template view would hide a
    // value the author put there and make it look lost.
    //
    // A field that may hold a custom value opens there whether or not templates
    // are on offer, and whether or not they have ARRIVED: template mode gives it
    // a typable editor, which offers the list once there is one. Waiting for the
    // list decided the landing from data that is async — on a cold load the
    // type-filtered list did not exist at mount, so the field fell to the type
    // picker and stayed there. A pick-only field (no custom values) is in
    // template mode regardless, by the `!allowCustomValues` term.
    const typeIsAnyLike = isUntypedOptionType(type);
    /* An EMPTY field, for the purpose of offering the template selector.
   
       `null` is deliberately not empty. It is the DPQL null literal — a value
       an author writes to say "this is nothing", and the only way to assert
       that a call returned no value. Counted as emptiness here, an argument
       holding it was treated as a field the author had just cleared: with a
       type of `any` and templates on offer, the selector-restore effect below
       flipped the field into template mode with a null template value, and
       that reported the field as cleared — so writing `null` in the Text tab
       and switching to Visual silently erased it, leaving `{type: "any"}` in
       the draft and the message "Value for argument 1 ("any") is invalid:
       Value is empty".
   
       `undefined` is the cleared state; `null` is a value. Same rule as
       `expressions/argumentPresence`, which states it canonically. */
    const isEmptyValue = value === undefined || value === '';
    const hasTemplatesOnOffer = !!size(filteredTemplates?.items);
    /* The field's own editor already renders templates inline, so the selector
       is not merely unnecessary here — it is a downgrade, swapping a typable
       control for a pick-only one. Derived rather than folded into the state
       below so every `setIsTemplate` path keeps working untouched; they simply
       stop having anything to say for these fields. */
    const editorHandlesTemplates =
      !!allowTemplates && isTemplateAwareUiType(type as string, (rest as any).templateAwareUiTypes);

    const hasOnlyAllowedValues = useMemo(
      () => !!size(rest.allowed_values) && !rest.allowed_values_creatable,
      [rest.allowed_values, rest.allowed_values_creatable]
    );

    /** Where this field lands when it is empty: an untyped one in template mode — see above. */
    const emptyLandsOnTemplates =
      typeIsAnyLike && (hasTemplatesOnOffer || (!!allowCustomValues && !hasOnlyAllowedValues));
    const opensOnTemplates = isEmptyValue && emptyLandsOnTemplates;
    /* An untyped field holding null is written in the same text field, as `null`: the editor an untyped
       field otherwise falls to drew null as an empty box, the same as a field holding nothing, so the
       author could not tell the two apart (qorus#646). */
    const nullWrittenAsText =
      value === null && typeIsAnyLike && !!allowCustomValues && !hasOnlyAllowedValues;

    /* The tabs a value is entered on (qorus#646, David): Value · Expression · Visual where the field takes
       templates and expressions written as text, Value · Template where it takes templates only, none where
       it takes no templates. One value, three views: see `selectTab`. */
    const valueTabIsText = isWrittenAsTextOnTheValueTab(type as string) && !hasOnlyAllowedValues;
    const tabsKind: 'full' | 'template' | undefined =
      !valueTabs || !allowTemplates || editorHandlesTemplates || rest.arg_schema ? undefined
      : allowFunctions && allowTextExpressions && !hasOnlyAllowedValues ? 'full'
      : 'template';
    /** The value is an expression (its AST), as the host says. */
    const valueIsExpression =
      !!(isFunction || isDefaultFunction) && value !== null && typeof value === 'object';
    /** Where a saved value opens: an expression on Expression; a template on Value where it is written as
     *  text, else on Expression (or Template, for a template-only field); anything else on Value. */
    const [tab, setTab] = useState<TValueTab>(() => {
      if (!tabsKind) return 'value';
      if (valueIsExpression) return tabsKind === 'full' ? 'expression' : 'value';
      if (typeof value === 'string' && isValueTemplate(value) && !valueTabIsText) {
        return tabsKind === 'full' ? 'expression' : 'template';
      }
      return 'value';
    });
    const opensInExpressionText = tabsKind === 'full' && tab === 'expression' && !valueIsExpression;
    const tabsKindRef = useRef(tabsKind);
    tabsKindRef.current = tabsKind;
    /** What the Text view is seeded with when the value is not an expression yet; null outside it. */
    const [expressionSeed, setExpressionSeed] = useState<string | null>(
      opensInExpressionText ? expressionTextOfValue(value) : null
    );

    const [isTemplateState, setIsTemplate] = useState<boolean>(
      tabsKind ?
        tab === 'template' || (tab === 'value' && valueTabIsText)
      : (isDefaultTemplate ||
          isValueTemplate(value) ||
          !allowCustomValues ||
          opensOnTemplates ||
          nullWrittenAsText) &&
          !!allowTemplates
    );

    const isTemplate = editorHandlesTemplates ? false : isTemplateState;
    const [internalIsFunction, setInternalIsFunction] = useState<boolean>(
      tabsKind ? tab === 'expression' || tab === 'visual' : !!isDefaultFunction && !!allowFunctions
    );
    const [templateValue, setTemplateValue] = useState<string | null>(value);

    // Typed text that turned out to be an expression the author may accept.
    const [dpqlOffer, setDpqlOffer] = useState<{ text: string; expression: any } | null>(null);
    // The literal this field held before typed text switched it into
    // expression mode — kept so the switch is undoable, and so the editor
    // opens on the Text view the author was already writing in.
    const [expressionFromText, setExpressionFromText] = useState<string | null>(null);
    // Texts the author has said no to. Without this, dismissing an offer (or
    // undoing a switch) would re-detect the same text on the next render and
    // ask again forever.
    const declinedTexts = useRef<Set<string>>(new Set());
    const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const probeDpql = useDpqlProbe();

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
      /* Emptied from outside the editor - the card's "Clear value", an undo, a host's reset - the text the
         value is written in is emptied too. It kept its own copy, so a cleared value went on showing what it
         had held (qorus#646: "Clear value" had no effect). The editor's own emptying sets this already. */
      if (isEmptyValue && templateValue) {
        setTemplateValue(null);
      }
    }, [JSON.stringify(value)]);

    /* Clearing an untyped field returns it to the template selector, which is
       where mounting it empty already lands.

       The rule above that opens an `any`-like field on the template selector is
       a `useState` INITIALISER, so it only ever ran on mount. Clearing a value
       in place does not remount anything, so the field fell through to the TYPE
       picker and demanded `string`/`int`/`hash` before it would let the author
       name a value they had already captured -- the very question that rule
       exists to stop asking. Reloading the page fixed it, which is the tell:
       same field, same empty value, different landing, because only one of the
       two paths ran the rule.

       Watched as a TRANSITION from a value to no value, not as "the value is
       empty": an author who picks `Set Custom Value` on an empty field is
       asking for the type picker, and re-asserting the template view on every
       render while the field sat empty would take it away again immediately. */
    const hadValue = useRef(!isEmptyValue);
    /* A clear is REMEMBERED rather than acted on in the same render.

       While the field holds a value its resolved type is that VALUE's type — a
       reference reads as `test-reference`, not `auto` — and clearing reverts it
       to the schema's `auto` one render LATER than the value empties. Acting
       only on the transition therefore ran while `typeIsAnyLike` was still
       false and did nothing, and by the time the type settled the transition
       had passed. Measured in the live IDE at the moment of the clear:
       `{ wasCleared: true, typeIsAnyLike: false, type: "test-reference",
       hasTemplatesOnOffer: true }`, then `typeIsAnyLike: true` on the very next
       render with `wasCleared` already false. */
    const restoreSelectorWhenSettled = useRef(false);
    /** Set by the template control's own `×`, which is an author saying "not a
     *  template" — that clear must not be answered with the selector again. */
    const suppressSelectorRestore = useRef(false);

    useEffect(() => {
      if (hadValue.current && isEmptyValue) {
        restoreSelectorWhenSettled.current = !suppressSelectorRestore.current;
        suppressSelectorRestore.current = false;
      }
      if (!isEmptyValue) {
        // A value arrived: whatever the author did, they are not sitting on an
        // empty field waiting to be offered the list.
        restoreSelectorWhenSettled.current = false;
      }
      hadValue.current = !isEmptyValue;

      if (
        restoreSelectorWhenSettled.current &&
        opensOnTemplates &&
        allowTemplates &&
        !effectiveIsFunction
      ) {
        restoreSelectorWhenSettled.current = false;
        setTemplateValue(null);
        setIsTemplate(true);
      }
    }, [isEmptyValue, opensOnTemplates, allowTemplates, effectiveIsFunction]);

    useEffect(() => {
      if (allowCustomValues && isTemplate && value && !isValueTemplate(value)) {
        setIsTemplate(false);
      }
    }, [allowCustomValues]);

    // null arriving later (written in the Text tab, say) is written in the text field too - see above
    useEffect(() => {
      if (!isTemplate && nullWrittenAsText && allowTemplates) {
        setTemplateValue(null);
        setIsTemplate(true);
      }
    }, [nullWrittenAsText, allowTemplates]);

    useEffect(() => {
      // a template on the Expression tab stays there: it is the expression editor's to show
      if (
        !isTemplate &&
        isValueTemplate(value) &&
        allowTemplates &&
        !(tabsKind && internalIsFunction)
      ) {
        // In auto mode, leave user-typed dollar-strings alone ('$foo: hello'
        // passes the loose check) — but a string that IS one well-formed token
        // ($data:{…}, $config:item) must still flip into template mode, or an
        // arg whose value hydrates after mount is stuck rendering raw text.
        if (
          type === 'auto' &&
          getTypeFromValue(value) === 'string' &&
          !isCompleteTemplateToken(value)
        ) {
          return;
        }

        // A template reference with an OPERATOR on it (`$local:count + 1`) is
        // an expression, not a template. The loose check above passes it —
        // it starts with `$` and has a colon — so without this every such
        // string was swallowed into template mode, where the arithmetic is
        // dead text and no affordance can reach it. A token standing alone
        // (`$local:count`, `$data:{1.field}`) has no operator and still
        // flips, which is the case template mode is for.
        if (!isCompleteTemplateToken(value) && mightBeDpqlExpression(value)) {
          return;
        }

        setIsTemplate(true);
        setTemplateValue(value);
      }
    }, [JSON.stringify(value), allowTemplates]);

    // When template key or template value change run the onChange function
    useUpdateEffect(() => {
      if (templateValue) {
        /* Read from the text where the field is written as text: a lone template takes its own
           type in an untyped field, a scalar's literal is that literal, other text is text. */
        if (templateSupportsCustomValues) {
          const read = templateTextValue(templateValue, type as string, filteredTemplates);
          onChange?.(name, read.value, read.type as TQorusType, effectiveIsFunction);
          return;
        }
        onChange?.(name, templateValue, type as TQorusType, effectiveIsFunction);
      }
    }, [JSON.stringify(templateValue)]);

    // an editor that takes templates into its own text has no template mode to switch to: "Use Template"
    // there emptied the field and showed nothing in its place
    const showTemplateToggle =
      allowCustomValues && allowTemplates && !rest.arg_schema && !editorHandlesTemplates;

    /* An UNTYPED field can be typed into as well as picked from.
    
       Template mode has a typable editor whenever the field's type can hold
       arbitrary text, and `any`/`auto` can — it is the type that has not been
       narrowed yet, not a type that excludes text. Restricting this to
       `string` meant an empty untyped field opened on template mode with no
       editor to offer, so it fell through to the pick-only "Select Template"
       dropdown: a control that can only choose from a list, on exactly the
       fields where an author most often needs to write something the list
       cannot hold — a deeper walk, a literal, or an expression.
    
       Reported against a Qorus assertion's Expected Value, and it was never
       specific to that field: every empty untyped field with templates on
       offer got the same downgrade. The editor still offers the same templates
       on focus, so nothing is lost by being able to type as well. */
    /* And so can a scalar: a whole number, a number or a yes/no is written as text too
       (qorus#646). A template chosen into it is a chip in that text, not a pick-only
       control that holds the template and nothing else, so text can be written around it;
       what the field then holds is read from the text (writtenAsText). A date keeps its
       date control. */
    const templateSupportsCustomValues =
      allowCustomValues && isWrittenAsText(type as string) && !hasOnlyAllowedValues;
    const showTemplatesDropdown =
      allowTemplates && (!allowCustomValues || (isTemplate && !templateSupportsCustomValues));
    const hasOnlyExpressions = !allowCustomValues && !allowTemplates && allowFunctions;
    /** A date field with templates on offer: they are offered beside its date control. */
    const dateTakesTemplates =
      type === 'date' && !!allowTemplates && hasTemplatesOnOffer && !hasOnlyAllowedValues;
    // True when some input control renders besides the ⋮ menu. When nothing
    // does (an empty `any` field: custom values are disallowed and the value's
    // type is picked FROM the menu), the menu trigger is the field's only
    // affordance and gets a label — a bare ⋮ alone reads as a broken editor.
    const hasInputAffordance =
      (!isTemplate && allowCustomValues) ||
      (isTemplate && templateSupportsCustomValues) ||
      showTemplatesDropdown;

    const Component = componentFromType ? ComponentMap[type] : Comp;
    // Only a ComponentMap component gets `type`: it is ours and CONSUMES the
    // prop (the long-string field needs it to know whether it holds one line)
    // rather than spreading it onto the DOM. A caller-supplied `Comp` is someone
    // else's, which is why `type` was kept off this call in the first place.
    const componentTypeProp = componentFromType ? { type } : {};
    const fieldAriaLabel = rest['aria-label'] ?? label ?? rest.display_name ?? name;

    const handleTemplateFieldChange = useCallback(
      (_name: string, val: string) => {
        if (!val) {
          /* Emptying the text leaves the field where an empty field lands. For
             an untyped field that is THIS editor: switching to custom mode here
             mounted a different editor in its place, so deleting the last
             character lost the cursor. A field written as text (a whole number, a
             number, a yes/no) is the same: deleting the template in it left a
             different, empty editor in its place, and what was typed next went
             nowhere. */
          if (!((emptyLandsOnTemplates || templateSupportsCustomValues) && allowTemplates)) {
            setIsTemplate(false);
          }
          setTemplateValue(null);
          onChange(name, undefined);
        } else {
          setTemplateValue(val);
        }
      },
      [name, onChange, emptyLandsOnTemplates, templateSupportsCustomValues, allowTemplates]
    );

    const handleTemplateTextChange = useCallback(
      (val: unknown) => handleTemplateFieldChange(name, typeof val === 'string' ? val : ''),
      [handleTemplateFieldChange, name]
    );

    const handleSelectTemplateFromList = useCallback(
      // If the field has allowed values and supports templates, we do not want to overwrite the field type with the template type
      (item) => {
        // If the template type is richtext, we need to wrap the template value in the richtext template format
        const value =
          item.badge === 'richtext' ?
            ([
              {
                type: 'paragraph',
                /* The empty text nodes on either side are load-bearing. A
                     chip is an inline VOID: it holds no text of its own, so the
                     only places a cursor can go are the text nodes AROUND it.
                     Slate treats that as an invariant and repairs it during
                     normalisation, which runs on edits but NOT on a document
                     handed in whole as a controlled value — which is what this
                     is. Without them the picked template renders as a chip that
                     cannot be typed after, so it can never be extended by hand. */
                children: [
                  { text: '' },
                  {
                    children: [{ text: '' }],
                    label: item.label,
                    type: 'tag',
                    value: item.value,
                    metadata: item.metadata,
                  },
                  { text: '' },
                ],
              },
            ] as IReqoreRichTextEditorProps['value'])
          : item.value;

        onChange(
          name,
          value,
          hasOnlyAllowedValues ? (type as TQorusType) : (item.badge as TQorusType)
        );
      },
      [name, onChange]
    );

    // SEAM (reqraft): the IDE computes `canSaveValue` here and renders a
    // `SaveValueButton` in the controls menu — the saved-values storage is
    // IDE-only, so the menu item is dropped (`allowSaving` is inert).

    /* A template chosen beside a date control is the value at once, IN the template control: handed to
       the form while the field was still drawing its date control, the reference reached the date
       picker first, which threw on it ("Invalid ISO 8601 date time string"). */
    const handleSelectDateTemplate = useCallback((item: { value?: unknown }) => {
      if (typeof item?.value !== 'string') return;
      setIsTemplate(true);
      setTemplateValue(item.value);
    }, []);

    const handleRemoveTemplateClick = useCallback(() => {
      /* This is the `×` ON the template control, and it means "I do not want a
         template here" — on a field whose menu offers no `Set Custom Value` it
         is the ONLY way to reach a literal. So it still drops to the custom
         value editor, and it tells the empty-field rule below to keep its hands
         off this particular clear: that rule watches the value going away, and
         this handler clears the value too, so without the flag it would send
         the author straight back to the selector they just dismissed. */
      if (allowCustomValues) {
        suppressSelectorRestore.current = true;
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

    /* Leaving template mode from the ⋮ — the counterpart of "Use Template".
       Template mode's editor has no `×` of its own, so without this the author
       who switched to a template had no way back and no menu to ask with. */
    const handleUseCustomValueClick = useCallback(() => {
      setIsTemplate(false);
      /* A reference cannot stay in the custom editor: the field reads it as a
         template again and switches straight back. Anything else is text the
         author wrote, and it survives the switch. */
      if (isValueTemplate(value as string) || isCompleteTemplateToken(templateValue)) {
        /* Only where the value is actually cleared. The flag is read by the
           "emptied" effect, which never runs when the text survives — setting
           it unconditionally left it armed to swallow the NEXT genuine clear's
           selector restore. */
        suppressSelectorRestore.current = true;
        setTemplateValue(null);
        onChange?.(name, undefined);
      }
    }, [name, onChange, value, templateValue]);

    /* One value, three views (qorus#646, David). Value → Expression writes the literal or template as
       expression text, emitting nothing until it is edited. Expression ↔ Visual is the editor's own toggle.
       Expression → Value converts only a literal or a lone template; any other expression stays, and the
       Value tab says it cannot show it and offers to replace it. Nothing is lost silently. */
    const selectTab = useCallback(
      (next: TValueTab) => {
        if (next === tab) return;
        if (next === 'value' || next === 'template') {
          if (valueIsExpression) {
            const envelope = { is_expression: true, value };
            const template = loneTemplateOf(envelope);
            const literal = template === undefined ? loneValueOf(envelope) : undefined;
            if (template !== undefined) {
              setTemplateValue(template);
              onChange?.(name, template, type as TQorusType, false);
            } else if (literal !== undefined) {
              setTemplateValue(valueTextOf(literal.value, type as string) || null);
              onChange?.(name, literal.value, type as TQorusType, false);
            }
          }
          setInternalIsFunction(false);
          setExpressionFromText(null);
          setIsTemplate(next === 'template' || valueTabIsText);
        } else {
          if (!valueIsExpression) setExpressionSeed(expressionTextOfValue(value));
          setInternalIsFunction(true);
        }
        setTab(next);
      },
      [tab, valueIsExpression, value, name, onChange, type, valueTabIsText]
    );

    /** Replace what a tab cannot show with an empty value of its own kind. */
    const replaceWithAValue = useCallback(() => {
      setInternalIsFunction(false);
      setTemplateValue(null);
      setExpressionSeed(null);
      onChange?.(name, undefined, type as TQorusType, false);
    }, [name, onChange, type]);

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
          setExpressionSeed(null);
          // The expression is gone, so there is no longer a switch to undo.
          setExpressionFromText(null);
        }
        /* On the Expression tab, a lone template is the template: stored bare, as every consumer
           evaluates it (see `loneTemplateOf`) - the server evaluates its expression form, template(...),
           to the template's parts, not to its value. The Text view stays, seeded with it. */
        const onTabs = !!tabsKindRef.current;
        const lone = remove || !onTabs ? undefined : loneTemplateOf(expressionValue);
        if (lone !== undefined) {
          setExpressionSeed(lone);
          onChange(name, lone, type as TQorusType, false);
          return;
        }
        // and a lone value (12, true) is that value, the field's own shape (see `loneValueOf`)
        const literal = remove || !onTabs ? undefined : loneValueOf(expressionValue);
        if (literal !== undefined) {
          setExpressionSeed(expressionSeedOf(literal.value));
          onChange(name, literal.value, type as TQorusType, false);
          return;
        }
        onChange(name, expressionValue?.value, expressionDataType as TQorusType, !remove);
      },
      [name, onChange, expressionDataType, value, type]
    );

    // ─── Text typed into a plain field that is really a DPQL expression ───
    //
    // A field that accepts expressions still gets DPQL TYPED into it, in the
    // ordinary editor, by an author who never opened the expression view.
    // What happens then depends on the field's own type, and the asymmetry is
    // deliberate: text that could stand as a literal here is only ever
    // OFFERED, because silently rewriting the string `a + b` into a
    // concatenation would destroy a value the author meant. Text that could
    // NOT be a literal here was already an error the moment it was typed, so
    // switching costs nothing and explains the error.
    //
    // The server decides whether the text is an expression at all — see
    // `helpers/dpqlDetection` for why a successful parse alone means nothing.
    const validationField = useMemo(
      () => ({
        validation_regex: rest.validation_regex,
        has_to_be_valid_identifier: rest.has_to_be_valid_identifier,
        has_to_have_value: rest.has_to_have_value,
        rules: rest.rules,
        arg_schema: rest.arg_schema,
      }),
      [
        rest.validation_regex,
        rest.has_to_be_valid_identifier,
        rest.has_to_have_value,
        JSON.stringify(rest.rules),
        JSON.stringify(rest.arg_schema),
      ]
    );

    const enterExpressionFromText = useCallback(
      (text: string, expression: any) => {
        setDpqlOffer(null);
        setExpressionFromText(text);
        setInternalIsFunction(true);
        setIsTemplate(false);
        setTemplateValue(null);
        // the Value tab never holds an expression: detected, it moves to the Expression tab, with an undo
        if (tabsKindRef.current === 'full') setTab('expression');
        // `dpql/parse` answers with the field-ready envelope
        // (`{is_expression, value}`); this field stores the inner AST and
        // signals the flag through `onChange`'s fourth argument, exactly as
        // `handleExpressionChange` does.
        onChange?.(name, expression?.value ?? expression, expressionDataType as TQorusType, true);
      },
      [name, onChange, expressionDataType]
    );

    const undoExpressionFromText = useCallback(() => {
      if (expressionFromText === null) {
        return;
      }

      declinedTexts.current.add(expressionFromText);
      setInternalIsFunction(false);
      if (tabsKind) {
        setTab('value');
        setIsTemplate(valueTabIsText);
      }
      setExpressionFromText(null);
      onChange?.(name, expressionFromText, type as TQorusType, false);
    }, [expressionFromText, name, onChange, type]);

    const declineDpqlOffer = useCallback(() => {
      if (dpqlOffer) {
        declinedTexts.current.add(dpqlOffer.text);
      }

      setDpqlOffer(null);
    }, [dpqlOffer]);

    const acceptDpqlOffer = useCallback(() => {
      if (dpqlOffer) {
        enterExpressionFromText(dpqlOffer.text, dpqlOffer.expression);
      }
    }, [dpqlOffer, enterExpressionFromText]);

    // Held in a ref so the debounce below does not depend on it. `onChange`
    // comes from the host form and can be a fresh function on any render;
    // with the callback in the effect's deps, a re-render caused by a
    // DIFFERENT field would restart this field's timer, and a form the
    // author is typing in re-renders constantly.
    const enterExpressionRef = useRef(enterExpressionFromText);
    useEffect(() => {
      enterExpressionRef.current = enterExpressionFromText;
    }, [enterExpressionFromText]);

    // Detection only runs on a field that could hold an expression and is
    // currently showing a plain editor — never on a read-only field, a
    // fixed-value list, or one already in template or expression mode.
    const canDetectDpql =
      !!allowFunctions &&
      !!allowTextExpressions &&
      !effectiveIsFunction &&
      // the template editor is text too: an expression written around a template is detected there
      (!isTemplate || templateSupportsCustomValues) &&
      !hasOnlyAllowedValues &&
      !rest.readonly &&
      !rest.readOnly &&
      !rest.disabled;

    useEffect(() => {
      if (detectTimer.current) {
        clearTimeout(detectTimer.current);
        detectTimer.current = null;
      }

      /* A richtext field is still text. It hands its value back as a Slate
         DOCUMENT rather than a flattened string — deliberately, so a chosen
         reference cannot fuse with text typed beside it — and reading only
         `typeof value === 'string'` here silently switched detection off for
         every one of them the moment the field changed shape. A test
         assertion's Value is exactly that field, and `1 + 2` typed into it
         stopped being offered as an expression.

         `richtextToString` flattens a tag to its raw value, so a document
         holding only a chosen reference reads as `$.result` — no operator, so
         `mightBeDpqlExpression` rejects it below and the server is never
         asked. */
      const text =
        typeof value === 'string' ? value
        : Array.isArray(value) ? richtextToString(value as never)
        : undefined;

      if (
        !canDetectDpql ||
        !text ||
        declinedTexts.current.has(text) ||
        !mightBeDpqlExpression(text)
      ) {
        setDpqlOffer(null);
        return undefined;
      }

      let cancelled = false;

      detectTimer.current = setTimeout(() => {
        detectTimer.current = null;

        void probeDpql(text)
          .then((parsed) => {
            if (cancelled) {
              return;
            }

            const outcome = classifyTypedText({ text, type, field: validationField, parsed });

            // on tabs, an expression detected switches (with an undo) rather than being offered
            if (outcome === 'switch' || (outcome === 'offer' && tabsKindRef.current === 'full')) {
              enterExpressionRef.current(text, parsed.expression);
            } else if (outcome === 'offer') {
              setDpqlOffer({ text, expression: parsed.expression });
            } else {
              setDpqlOffer(null);
            }
          })
          .catch(() => {
            // Detection is an offer of help, never a reason for a field to
            // break: an unreachable instance or a classifier that threw leaves
            // the author's text exactly where they put it.
            if (!cancelled) {
              setDpqlOffer(null);
            }
          });
      }, DPQL_DETECT_DEBOUNCE_MS);

      return () => {
        cancelled = true;

        if (detectTimer.current) {
          clearTimeout(detectTimer.current);
          detectTimer.current = null;
        }
      };
    }, [value, canDetectDpql, type, validationField, probeDpql]);

    const canOfferExpression =
      allowFunctions && !hasOnlyAllowedValues && !rest.readonly && !internalIsFunction;
    const canOfferTemplate = showTemplateToggle && !isTemplate;
    /* The way back out, published on the same terms the field's own ⋮ draws it.
       A field inside a form ROW draws no menu of its own — it publishes into
       the row's — so leaving this out of the published list meant template mode
       was a one-way door on the surface most options are edited from. */
    const canOfferCustomValue = showTemplateToggle && isTemplate && templateSupportsCustomValues;

    const publishedItems = useMemo(
      () => [
        // on tabs, the menu keeps value actions only: the tabs are the mode switch
        ...(tabsKind ?
          []
        : [
            ...(canOfferExpression && !functions.loading ?
              [
                {
                  label: 'Use Expression',
                  icon: 'Functions' as const,
                  tooltip: 'Run a function on this value',
                  onClick: handleSelectFunctionChange,
                },
              ]
            : []),
            ...(canOfferTemplate ?
              [
                {
                  label: 'Use Template',
                  icon: 'MoneyDollarCircleLine' as const,
                  tooltip: 'Use a template',
                  onClick: handleTemplateToggleClick,
                },
              ]
            : []),
          ]),
        ...(canOfferCustomValue && !tabsKind ?
          [
            {
              label: 'Use Custom Value',
              icon: 'EditLine' as const,
              tooltip: 'Write the value here instead of choosing a template',
              onClick: handleUseCustomValueClick,
            },
          ]
        : []),
        /* The "set a value of this type" choices an untyped field offers.
           Dividers are dropped: they grouped items in a menu this field drew
           itself, and in the row's shared menu they would divide other
           people's. */
        ...((menuItems ?? []) as IUntypedFieldMenuItem[])
          .filter((item) => !('isDivider' in item))
          .map((item) => ({
            label: item.label as string,
            description: item.description as string | undefined,
            onClick: () =>
              item.onClick?.(undefined, () => {
                setIsTemplate(false);
                setTemplateValue(null);
              }),
          })),
      ],
      [
        canOfferExpression,
        functions.loading,
        canOfferTemplate,
        canOfferCustomValue,
        menuItems,
        handleSelectFunctionChange,
        handleTemplateToggleClick,
        handleUseCustomValueClick,
      ]
    );

    /* Keyed on WHICH items are offered, never on the items: they carry
       handlers, so they are a new array every render and a row comparing them
       by value would loop. */
    const publishedKey = [
      canOfferExpression && !functions.loading ? 'expression' : '',
      canOfferTemplate ? 'template' : '',
      canOfferCustomValue ? 'custom-value' : '',
      `custom:${((menuItems ?? []) as { label?: unknown }[]).map((item) => String(item.label ?? '')).join('|')}`,
    ].join(',');

    useRowMenuPublisher(rowMenu, publishedKey, publishedItems as never);

    const renderControls = useCallback(() => {
      // on tabs, the tabs are the mode switch: the menu keeps value actions only
      const showFunctionsDropdown =
        !tabsKind &&
        allowFunctions &&
        !hasOnlyAllowedValues &&
        !rest.readonly &&
        !internalIsFunction;
      const showTemplatesButton = !tabsKind && showTemplateToggle && !isTemplate;
      // The way back out of template mode, where the editor draws no `×`.
      const showCustomValueButton =
        !tabsKind && showTemplateToggle && isTemplate && templateSupportsCustomValues;
      // The "Set value" label promises a way to set one — reorder rows alone don't.
      const hasValueRows =
        showFunctionsDropdown ||
        showTemplatesButton ||
        showCustomValueButton ||
        size(menuItems) > 0;

      /* A lone group opens itself. Two of the menu's groups are collapsed
         sections, so a menu holding nothing but one of them asked for a click
         to reach the only thing on offer — on an untyped field, "Set Custom
         Value" hiding the type rows behind it. Expanded, it still names what
         its rows are and can still be collapsed. The same rule the template
         list follows for a lone category, and the row menu already publishes
         these rows flat. */
      const loneSectionStartsExpanded =
        [
          showFunctionsDropdown,
          showTemplatesButton,
          showCustomValueButton,
          size(menuActions?.items) > 0,
          size(menuItems) > 0,
        ].filter(Boolean).length === 1;

      /* ONE menu per control. Where this field sits in a form ROW, the row
         already renders a ⋮ of its own, and drawing a second one beside it
         put two menus of slightly different widths on the same control —
         with the type choices an `any` field offers hidden in the narrower
         one. The items are published to the row instead (see
         `rowMenuContext`); outside a row there is nothing to publish into,
         so the field goes on drawing its own. */
      if (rowMenu) {
        return null;
      }

      if (hasOnlyExpressions) {
        return (
          showFunctionsDropdown ?
            functions.loading ?
              <ReqoreSkeleton size={rest.size} />
            : <ReqoreButton
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
          : null
        );
      }

      if (hasValueRows || size(menuActions?.items) > 0 || size(menuTrailingItems) > 0) {
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
                /* Centre the trailing menu in its flex line so it lines up
                   with sibling action buttons (reqore alignSelf; replaces a
                   reqraft `align-self !important` override of this button).
                
                   Centring is only right beside a ONE-LINE editor. The
                   expression shell is a toolbar with an editor, a type message
                   and a preview stacked under it, so centring put this menu
                   somewhere down the side of that block — level with nothing,
                   over the editor, and a long way from the Undo it belongs
                   beside. There it goes to the top, which is where the shell's
                   own toolbar is. */
                alignSelf: effectiveIsFunction ? 'flex-start' : 'center',
                label: hasInputAffordance || !hasValueRows ? undefined : 'Set value',
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
                {showFunctionsDropdown ?
                  functions.loading ?
                    <ReqoreSkeleton size={rest.size} />
                  : <ReqoreButton
                      compact
                      transparent
                      label='Use Expression'
                      className='function-selector'
                      icon='Functions'
                      tooltip='Run a function on this value'
                      onClick={handleSelectFunctionChange}
                    />

                : null}

                {showTemplatesButton && !(showFunctionsDropdown && allowTextExpressions) ?
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
                : null}

                {showCustomValueButton ?
                  <ReqoreButton
                    transparent
                    icon='EditLine'
                    className='template-custom-value'
                    tooltip='Write the value here instead of choosing a template'
                    compact
                    size={rest.size}
                    onClick={handleUseCustomValueClick}
                  >
                    {' '}
                    Use Custom Value{' '}
                  </ReqoreButton>
                : null}

                {size(menuActions?.items) > 0 ?
                  <MenuActionsSection
                    actions={menuActions}
                    size={rest.size}
                    startExpanded={loneSectionStartsExpanded}
                  />
                : null}

                {size(menuItems) > 0 ?
                  <CustomMenuItems
                    items={menuItems}
                    setIsTemplate={setIsTemplate}
                    setTemplateValue={setTemplateValue}
                    startExpanded={loneSectionStartsExpanded}
                  />
                : null}

                {size(menuTrailingItems) > 0 ?
                  <MenuTrailingItems items={menuTrailingItems} size={rest.size} />
                : null}
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
      handleUseCustomValueClick,
      allowTextExpressions,
      hasOnlyAllowedValues,
      isTemplate,
      rest.readonly,
      rest.size,
      showTemplateToggle,
      // reaches the menu through `templateSupportsCustomValues`
      allowCustomValues,
      hasOnlyExpressions,
      type,
      value,
      menuItems,
      menuActions,
      menuTrailingItems,
      internalIsFunction,
      effectiveIsFunction,
      hasInputAffordance,
      // the row decides whether this field draws a menu at all
      rowMenu,
      tabsKind,
    ]);

    // When the type is a list, and it has an element type - that element type is different
    // from the field type, so we need to send down the full templates object
    // and the actual rendered field will filter it's own templates
    // This is a special case only for lists with element types
    /* `undefined` when nothing is on offer, rather than a list with no items:
       an editor given a list draws the control that opens it, so a field whose
       templates were all filtered out by type opened an EMPTY menu. */
    const componentTemplates = useMemo(() => {
      if (type === 'list' && (rest.ui_element_type || rest.element_type)) {
        return templates;
      }
      return size(filteredTemplates?.items) ?
          {
            ...filteredTemplates,
            ...TemplatesListProps,
          }
        : undefined;
    }, [
      JSON.stringify(filteredTemplates),
      // the list-with-element-type branch hands this back untouched
      templates,
      rest.ui_element_type,
      rest.element_type,
      type,
    ]);

    // ─── Value · Expression · Visual (or Value · Template) ───────────────────────────────────────────
    if (tabsKind && !rest.disabled) {
      const words: IValueTabsLabels = { ...DEFAULT_VALUE_TABS_LABELS, ...valueTabsLabels };
      const tabButton = (
        key: TValueTab,
        label: string,
        icon: IReqoreIconName,
        tooltip?: string
      ) => (
        <ReqoreButton
          key={key}
          compact
          size={rest.size}
          icon={icon}
          active={tab === key}
          aria-pressed={tab === key}
          data-tab={key}
          className={`value-tab value-tab-${key}`}
          tooltip={tooltip}
          disabled={rest.readOnly || rest.readonly}
          onClick={() => selectTab(key)}
        >
          {label}
        </ReqoreButton>
      );
      /* A lone template of another type than the field's is converted when the value is used: said as a
         warning, not a block - whether it converts depends on the data (qorus#646, David). */
      const loneTemplate =
        typeof value === 'string' && isCompleteTemplateToken(value) ? value : undefined;
      const templateBadge =
        loneTemplate && !typeIsAnyLike ?
          findTemplate(templates ?? {}, loneTemplate)?.badge
        : undefined;
      const conversionNote =
        (
          typeof templateBadge === 'string' &&
          templateBadge &&
          !sameValueType(templateBadge, type as string)
        ) ?
          words.conversion(words.typeName(templateBadge), words.typeName(type as string))
        : undefined;
      const cannotShow = (message: string) => (
        <ReqoreMessage
          size='small'
          flat
          opaque={false}
          intent='muted'
          className='value-tab-cannot-show'
        >
          {message}{' '}
          <ReqoreButton
            compact
            size={rest.size}
            className='value-tab-replace'
            onClick={replaceWithAValue}
            disabled={rest.readOnly || rest.readonly}
          >
            {words.replaceWithAValue}
          </ReqoreButton>
        </ReqoreMessage>
      );
      const valueBody = () => {
        if (valueIsExpression) {
          return cannotShow(words.cannotShowExpression);
        }
        if (valueTabIsText) {
          return (
            <ReqoreControlGroup vertical fluid gapSize='small'>
              <RichTextFormField
                className='template-selector value-tab-text'
                valueFormat='text'
                singleLine={isSingleLineStringType('string')}
                value={
                  typeof templateValue === 'string' ? templateValue : (
                    valueTextOf(value, type as string)
                  )
                }
                templates={filteredTemplates}
                // a chip of a field not of this type is named as the catalogue names it
                namingTemplates={templates}
                allowTemplates
                onChange={handleTemplateTextChange}
                {...rest}
                fixed={false}
                fluid
                panelProps={{
                  ...(rest as { panelProps?: object }).panelProps,
                  style: {
                    ...(rest as { panelProps?: { style?: object } }).panelProps?.style,
                    width: '150px',
                    maxWidth: '100%',
                    minWidth: 'fit-content',
                  },
                }}
                aria-label={fieldAriaLabel}
              />
              {conversionNote ?
                <ReqoreMessage
                  size='small'
                  flat
                  opaque={false}
                  intent='warning'
                  className='value-tab-conversion'
                >
                  {conversionNote}
                </ReqoreMessage>
              : null}
            </ReqoreControlGroup>
          );
        }
        if (loneTemplate !== undefined || (typeof value === 'string' && isValueTemplate(value))) {
          return cannotShow(
            words.templateShownOn(tabsKind === 'full' ? words.expression : words.template)
          );
        }
        return (
          <Component
            value={value}
            allowTemplates={false}
            onChange={onChange}
            name={name}
            level={level}
            {...rest}
            componentOverrides={componentOverrides}
            {...componentTypeProp}
            aria-label={fieldAriaLabel}
            className={`${className} template-selector`}
          />
        );
      };
      const expressionBody = () => (
        <ReqoreControlGroup vertical fluid gapSize='small'>
          <ReqoreErrorBoundary>
            <ExpressionField
              /* A value that is not an expression yet is shown as the server reads it written alone:
                 value(12) - so the Visual tab starts from the value, not from an operand with no operation. */
              value={{
                is_expression: true,
                value:
                  value !== null && typeof value === 'object' ? value
                  : !isEmptyValue && value !== null ?
                    { exp: 'value', args: [{ type: type as TQorusType, value }] }
                  : undefined,
              }}
              initialText={expressionSeed ?? undefined}
              heldAsValue={!isEmptyValue && value !== null && typeof value !== 'object'}
              componentOverrides={componentOverrides}
              localTemplates={templates}
              type={type as string}
              returnType={(returnType || expressionDataType) as any}
              onChange={handleExpressionChange}
              readOnly={rest.readOnly || rest.disabled}
              expressions={rest.expressions}
              expressionsUrl={rest.expressions_url}
              fields={rest.dpql_fields}
              serverHandled={rest.server_expression_handling}
              extraActions={extraActions}
              size={rest.size}
              defaultMode={tab === 'visual' ? 'visual' : 'text'}
              requestedMode={tab === 'visual' ? 'visual' : 'text'}
              hideModeToggle
              // no language server: the Visual tab is where the expression is built
              onTextUnavailable={() => setTab('visual')}
              reorder={reorder}
            />
          </ReqoreErrorBoundary>
          {expressionFromText !== null ?
            <ReqoreButton
              fixed
              compact
              minimal
              icon='ArrowGoBackLine'
              size={rest.size}
              className='dpql-detected-undo'
              tooltip={words.undoTooltip(expressionFromText)}
              onClick={undoExpressionFromText}
            >
              {words.undo}
            </ReqoreButton>
          : null}
        </ReqoreControlGroup>
      );
      const templateBody = () => (
        <TemplateDropdownSelector
          allowCustomValues={false}
          templates={templates}
          value={typeof value === 'string' && isValueTemplate(value) ? value : null}
          items={filteredTemplates?.items}
          onItemSelect={handleSelectTemplateFromList}
          onRemoveClick={replaceWithAValue}
          size={rest.size}
          label={label}
          hasOnlyAllowedValues={hasOnlyAllowedValues}
        />
      );
      return (
        <ReqoreControlGroup vertical fluid gapSize='small' className='value-tabs-field'>
          <ReqoreControlGroup fluid size={rest.size} verticalAlign='center'>
            <ReqoreControlGroup stack size={rest.size} className='value-tabs' fixed>
              {tabButton('value', words.value, 'EditLine')}
              {tabsKind === 'full' ?
                [
                  tabButton('expression', words.expression, 'CodeLine', words.expressionTooltip),
                  tabButton('visual', words.visual, 'NodeTree', words.visualTooltip),
                ]
              : tabButton(
                  'template',
                  words.template,
                  'MoneyDollarCircleLine',
                  words.templateTooltip
                )
              }
            </ReqoreControlGroup>
            {renderControls()}
          </ReqoreControlGroup>
          {tab === 'value' ?
            valueBody()
          : tab === 'template' ?
            templateBody()
          : expressionBody()}
        </ReqoreControlGroup>
      );
    }

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
                // The host's per-ui_type editors reach this field through the
                // rest-spread; the expression shell needs them explicitly or the
                // builder's operands render "Unknown type!" for any consumer
                // ui_type (an assertion's `test-reference` Value, for one).
                componentOverrides={componentOverrides}
                localTemplates={templates}
                type={type as string}
                returnType={(returnType || expressionDataType) as any}
                onChange={handleExpressionChange}
                readOnly={rest.readOnly || rest.disabled}
                expressions={rest.expressions}
                expressionsUrl={rest.expressions_url}
                // the record's fields for the Text view, from the field's schema (`dpql_fields`)
                fields={rest.dpql_fields}
                serverHandled={rest.server_expression_handling}
                extraActions={extraActions}
                size={rest.size}
                // An author who typed the expression as text is already
                // writing in that language — dropping them into the visual
                // builder would make them find their own sentence again.
                defaultMode={expressionFromText !== null ? 'text' : 'visual'}
                reorder={reorder}
              />
            </ReqoreErrorBoundary>
            {expressionFromText !== null ?
              <ReqoreButton
                fixed
                compact
                minimal
                icon='ArrowGoBackLine'
                // No `intent` with `minimal`: a Reqore intent is a FILL, and
                // `muted` as TEXT is 1.3:1 on the app surface.
                size={rest.size}
                className='dpql-detected-undo'
                tooltip={`Keep "${expressionFromText}" as plain text instead`}
                onClick={undoExpressionFromText}
              >
                Undo
              </ReqoreButton>
            : null}
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
              componentOverrides={componentOverrides}
              localTemplates={templates}
              level={level}
              type={type as string}
              returnType={(returnType || expressionDataType) as any}
              onChange={handleExpressionChange}
              readOnly={rest.readOnly || rest.disabled}
              expressions={rest.expressions}
              expressionsUrl={rest.expressions_url}
              serverHandled={rest.server_expression_handling}
              extraActions={extraActions}
              reorder={reorder}
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

      return (
        <Comp
          value={value}
          onChange={onChange}
          name={name}
          {...rest}
          componentOverrides={componentOverrides}
        />
      );
    }

    return (
      <ReqoreControlGroup
        fluid={rest.fluid}
        fixed={rest.fixed}
        size={rest.size}
        {...rest}
        stack={false}
        verticalAlign='flex-start'
      >
        {!isTemplate && allowCustomValues ?
          <Component
            value={value}
            allowTemplates={allowTemplates}
            onChange={onChange}
            name={name}
            level={level}
            {...rest}
            componentOverrides={componentOverrides}
            {...componentTypeProp}
            aria-label={fieldAriaLabel}
            className={`${className} template-selector`}
            templates={componentTemplates}
          />
        : null}

        {/* A date keeps its date control - it is not written as text - and takes a template beside it:
            chosen, the template is the value (the template control, whose × returns to the date). */}
        {/* A date keeps its date control - it is not written as text - and takes a template beside it:
            chosen, the template is the value (the template control, whose × returns to the date). */}
        {!isTemplate && allowCustomValues && dateTakesTemplates ?
          <ReqoreDropdown
            className='date-template-picker'
            icon='MoneyDollarCircleLine'
            fixed
            compact
            size={rest.size}
            tooltip='Use a template'
            aria-label='Use a template'
            filterable
            items={filteredTemplates?.items}
            onItemSelect={handleSelectDateTemplate}
          />
        : null}

        {/* Template mode's editor for a value that can also be typed: each
            reference in it is a chip named as the catalogue names it, while the
            field still stores the plain string. A textarea spelled a chosen
            template `$local:name` wherever it was edited — in the Visual
            builder's operands, in every string field that takes templates. */}
        {isTemplate && templateSupportsCustomValues ?
          <RichTextFormField
            className='template-selector'
            valueFormat='text'
            singleLine={isSingleLineStringType('string')}
            /* null shows as null, not as an empty field: the two are different values, and an
               untyped field holding null looked exactly like one holding nothing (qorus#646) */
            value={
              typeof templateValue === 'string' ? templateValue : (
                (untypedTextOf(value, type as string) ?? '')
              )
            }
            templates={filteredTemplates}
            // a chip of a field not of this type (text around it, say) is named as the catalogue names it
            namingTemplates={templates}
            allowTemplates
            onChange={handleTemplateTextChange}
            {...rest}
            /* The text the value is written in takes the room its row gives it and gives it back: a
               caller's \`fixed\` sized a picker chip, and on a text field it kept the field at its full
               width, pushing the ⋮ past an operand's row in a narrow column. */
            fixed={false}
            fluid
            /* 150px wide, as a free text field is, wider for what it holds, and narrower only where its
               row has less room - an operand in a narrow column - as a number's input is: a fixed
               150px minimum held it at full width there. */
            panelProps={{
              ...(rest as { panelProps?: object }).panelProps,
              style: {
                ...(rest as { panelProps?: { style?: object } }).panelProps?.style,
                width: '150px',
                maxWidth: '100%',
                minWidth: 'fit-content',
              },
            }}
            aria-label={fieldAriaLabel}
          />
        : null}

        {dpqlOffer ?
          <ReqoreControlGroup fixed stack size={rest.size}>
            <ReqoreButton
              compact
              icon='Functions'
              intent='info'
              className='dpql-detected-offer'
              tooltip={`"${dpqlOffer.text}" reads as an expression. It is also valid text here, so nothing has been changed — use it as an expression?`}
              onClick={acceptDpqlOffer}
            >
              Use as expression
            </ReqoreButton>
            <ReqoreButton
              compact
              icon='CloseLine'
              intent='info'
              className='dpql-detected-dismiss'
              tooltip='Keep it as plain text'
              onClick={declineDpqlOffer}
            />
          </ReqoreControlGroup>
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

/**
 * The row channel belongs to the row's OWN editor: this field. It is read here
 * and hidden from everything this field renders, so a field nested inside it —
 * an expression operand, a list item — keeps drawing its own menu instead of
 * publishing actions into a row menu that cannot say which value they act on.
 * `undefined` outside a row, where this field draws its own menu too.
 */
export const TemplateField = memo((props: ITemplateFieldProps) => {
  const rowMenu = useRowMenu();

  return (
    <RowMenuContext.Provider value={undefined}>
      <TemplateFieldImpl {...props} rowMenu={rowMenu} />
    </RowMenuContext.Provider>
  );
});
