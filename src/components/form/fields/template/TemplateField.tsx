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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import {
  filterTemplatesByType as templatesFilterFunc,
  getTemplateKey,
  getTemplateValue,
  isBracedTemplateToken,
  isCompleteTemplateToken,
  describeTemplateReference,
  isValueTemplate,
} from '../../../../helpers/templates';
import {
  classifyTypedText,
  mightBeDpqlExpression,
} from '../../../../helpers/dpqlDetection';
import { getTypeFromValue } from '../../../../helpers/validations';
import { useDpqlProbe } from '../../../dpqlEditor/useDpqlProbe';
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

export const isTemplateAwareUiType = (
  uiType?: string,
  extra?: string[]
): boolean => !!uiType && [...BuiltInTemplateAwareUiTypes, ...(extra ?? [])].includes(uiType);

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
    // ...and only when there is actually something to pick. A field with no
    // templates on offer would otherwise open on an EMPTY picker, which is a
    // worse place to start than the type picker it replaced.
    const typeIsAnyLike = type === 'any' || type === 'auto';
    const isEmptyValue = value === undefined || value === null || value === '';
    const hasTemplatesOnOffer = !!size(filteredTemplates?.items);
    /* The field's own editor already renders templates inline, so the selector
       is not merely unnecessary here — it is a downgrade, swapping a typable
       control for a pick-only one. Derived rather than folded into the state
       below so every `setIsTemplate` path keeps working untouched; they simply
       stop having anything to say for these fields. */
    const editorHandlesTemplates =
      !!allowTemplates &&
      isTemplateAwareUiType(type as string, (rest as any).templateAwareUiTypes);

    const [isTemplateState, setIsTemplate] = useState<boolean>(
      (isDefaultTemplate ||
        isValueTemplate(value) ||
        !allowCustomValues ||
        (typeIsAnyLike && isEmptyValue && hasTemplatesOnOffer)) &&
        allowTemplates
    );

    const isTemplate = editorHandlesTemplates ? false : isTemplateState;
    const [internalIsFunction, setInternalIsFunction] = useState<boolean>(
      !!isDefaultFunction && !!allowFunctions
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
        isEmptyValue &&
        typeIsAnyLike &&
        hasTemplatesOnOffer &&
        allowTemplates &&
        !effectiveIsFunction
      ) {
        restoreSelectorWhenSettled.current = false;
        setTemplateValue(null);
        setIsTemplate(true);
      }
    }, [isEmptyValue, typeIsAnyLike, hasTemplatesOnOffer, allowTemplates, effectiveIsFunction]);

    useEffect(() => {
      if (allowCustomValues && isTemplate && value && !isValueTemplate(value)) {
        setIsTemplate(false);
      }
    }, [allowCustomValues]);

    useEffect(() => {
      if (!isTemplate && isValueTemplate(value) && allowTemplates) {
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
        onChange?.(name, templateValue, type as TQorusType, effectiveIsFunction);
      }
    }, [JSON.stringify(templateValue)]);

    const hasOnlyAllowedValues = useMemo(
      () => !!size(rest.allowed_values) && !rest.allowed_values_creatable,
      [rest.allowed_values, rest.allowed_values_creatable]
    );

    const showTemplateToggle = allowCustomValues && allowTemplates && !rest.arg_schema;

    // Only a BRACED context ref (`$data:{…}` — machine-written, nobody types
    // one) renders as the picker chip (named via `resolveTemplateLabel`)
    // rather than as its raw text in a string editor. Plain word-path tokens
    // (`$local:id`) are typeable, so per the build #123 review they keep the
    // input that offers templates while typing. Mixed text-and-token strings
    // keep the string editor too; the chip-in-editor treatment arrives with
    // the rich-text string mode.
    const templateValueIsBracedToken = isBracedTemplateToken(templateValue);

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
    // Only a ComponentMap component gets `type`: it is ours and CONSUMES the
    // prop (the long-string field needs it to know whether it holds one line)
    // rather than spreading it onto the DOM. A caller-supplied `Comp` is someone
    // else's, which is why `type` was kept off this call in the first place.
    const componentTypeProp = componentFromType ? { type } : {};
    const fieldAriaLabel = rest['aria-label'] ?? label ?? rest.display_name ?? name;


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
          // The expression is gone, so there is no longer a switch to undo.
          setExpressionFromText(null);
        }
        onChange(name, expressionValue?.value, type as TQorusType, !remove);
      },
      [name, onChange, type, value]
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
        // `dpql/parse` answers with the field-ready envelope
        // (`{is_expression, value}`); this field stores the inner AST and
        // signals the flag through `onChange`'s fourth argument, exactly as
        // `handleExpressionChange` does.
        onChange?.(name, expression?.value ?? expression, type as TQorusType, true);
      },
      [name, onChange, type]
    );

    const undoExpressionFromText = useCallback(() => {
      if (expressionFromText === null) {
        return;
      }

      declinedTexts.current.add(expressionFromText);
      setInternalIsFunction(false);
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
      !isTemplate &&
      !hasOnlyAllowedValues &&
      !rest.readonly &&
      !rest.readOnly &&
      !rest.disabled;

    useEffect(() => {
      if (detectTimer.current) {
        clearTimeout(detectTimer.current);
        detectTimer.current = null;
      }

      const text = typeof value === 'string' ? value : undefined;

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

        void probeDpql(text).then((parsed) => {
          if (cancelled) {
            return;
          }

          const outcome = classifyTypedText({ text, type, field: validationField, parsed });

          if (outcome === 'switch') {
            enterExpressionRef.current(text, parsed.expression);
          } else if (outcome === 'offer') {
            setDpqlOffer({ text, expression: parsed.expression });
          } else {
            setDpqlOffer(null);
          }
        }).catch(() => {
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
                // The host's per-ui_type editors reach this field through the
                // rest-spread; the expression shell needs them explicitly or the
                // builder's operands render "Unknown type!" for any consumer
                // ui_type (an assertion's `test-reference` Value, for one).
                componentOverrides={(rest as any).componentOverrides}
                localTemplates={templates}
                type={type as string}
                returnType={(returnType || type) as any}
                onChange={handleExpressionChange}
                readOnly={rest.readOnly || rest.disabled}
                expressions={rest.expressions}
                expressionsUrl={rest.expressions_url}
                serverHandled={rest.server_expression_handling}
                size={rest.size}
                // An author who typed the expression as text is already
                // writing in that language — dropping them into the visual
                // builder would make them find their own sentence again.
                defaultMode={expressionFromText !== null ? 'text' : 'visual'}
              />
            </ReqoreErrorBoundary>
            {expressionFromText !== null ? (
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
            ) : null}
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
              componentOverrides={(rest as any).componentOverrides}
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
      <ReqoreControlGroup
        fluid={rest.fluid}
        fixed={rest.fixed}
        size={rest.size}
        {...rest}
        stack={false}
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
            {...componentTypeProp}
            aria-label={fieldAriaLabel}
            className={`${className} template-selector`}
            templates={componentTemplates}
          />
        ) : null}

        {isTemplate && templateSupportsCustomValues && !templateValueIsBracedToken ? (
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

        {dpqlOffer ? (
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
        ) : null}

        {showTemplatesDropdown ||
        (isTemplate && templateSupportsCustomValues && templateValueIsBracedToken) ? (
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
