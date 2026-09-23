import { ReqoreControlGroup, ReqoreTag, ReqoreVerticalSpacer } from '@qoretechnologies/reqore';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IQorusFormField, IQorusFormSchema, TQorusForm } from '@qoretechnologies/ts-toolkit';
import { isArray, size } from 'lodash';
import { useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import {
  UNAVAILABLE_VALUE_FALLBACK_REASON,
  getRefusalMessage,
  getRequiredOptionMessage,
} from '../../../helpers/options';
import { isUntypedOptionType } from '../../../helpers/optionUiTypes';
import {
  hasAllDependenciesFullfilled,
  parseDependency,
  validateFieldWithResult,
  validateOptionWithRequiredGroups,
} from '../../../helpers/validations';
import { OptionsContext } from './optionsContext';

/** A `messages` entry that appears only for certain values of its siblings. */
export interface IConditionalFieldMessage {
  intent?: string;
  title?: string;
  content?: string;
  /**
   * Show the message only while EVERY entry holds. Same grammar as `depends_on`:
   * a bare name means "that field has a value", `name=value` means it holds that
   * exact value, and a nested array is an OR of its entries.
   */
  when?: (string | string[])[];
  /** Hide the message while every entry holds — the negative form of `when`. */
  unless?: (string | string[])[];
}

/**
 * Whether a schema message applies to the form as it currently stands.
 *
 * A message declared on a field descriptor is static: it is served with the
 * schema and says the same thing whatever the user has typed. That is right for
 * a note, and wrong for a warning about a COMBINATION — an always-on warning
 * sitting over a valid configuration is one people learn to scroll past, so it
 * is not there when it finally means something.
 *
 * `when` / `unless` reuse the `depends_on` grammar and evaluator rather than
 * inventing a second predicate language, so a descriptor author writes one kind
 * of condition and the two can never disagree about what "fulfilled" means.
 *
 * Both are evaluated against the values of the SAME form. A predicate cannot
 * reach into a nested `arg_schema` sub-form or out to its parent — those are
 * separate value scopes, and a condition that silently never fires would be
 * worse than no condition at all.
 */
export const isConditionalMessageShown = (
  message: IConditionalFieldMessage,
  allOptions?: TQorusForm,
  optionsSchema?: IQorusFormSchema
): boolean => {
  const values = allOptions || {};
  if (message.when && !hasAllDependenciesFullfilled(message.when, values, optionsSchema)) {
    return false;
  }
  if (
    message.unless &&
    hasAllDependenciesFullfilled(message.unless, values, optionsSchema)
  ) {
    return false;
  }
  return true;
};

/** The subset of a field's `messages` that applies right now. */
export const getShownSchemaMessages = <T extends IConditionalFieldMessage>(
  messages: T[] | undefined,
  allOptions?: TQorusForm,
  optionsSchema?: IQorusFormSchema
): T[] => (messages || []).filter((m) => isConditionalMessageShown(m, allOptions, optionsSchema));

/**
 * Name one `depends_on` entry so the reader can act on it.
 *
 * The list used to be built by looking each entry up as a whole field name,
 * which is only ever true of the bare-name form. A COMPARISON entry
 * (`kind=type`, `kind!=type`) matched no field, was dropped, and a field whose
 * dependencies are all comparisons — the shape every subject field of a test
 * uses — rendered "…are not fulfilled:" with nothing after the colon. The
 * reader was told a dependency was unmet and not which one, by a sentence that
 * stopped mid-way.
 *
 * One parser for both halves, the same one the evaluator uses, so the sentence
 * and the lock cannot disagree about what an entry means.
 */
const describeDependency = (dependency: string, schema: IQorusFormSchema): string | undefined => {
  const { name, op, value } = parseDependency(dependency);
  const dependencySchema = schema[name];

  if (!dependencySchema) {
    return undefined;
  }

  const label = `"${dependencySchema.display_name || name}"`;

  // `!name` names no value to compare against — it is satisfied by the sibling
  // being unanswered — so it gets a sentence of its own rather than the
  // comparison template, which would read `must not be "undefined"`.
  if (op === '!') {
    return `${label} must have no value`;
  }

  return op ? `${label} must ${op === '!=' ? 'not ' : ''}be "${value}"` : label;
};

/**
 * The whole `depends_on` list as one phrase.
 *
 * A nested entry is an OR — only one of its members has to hold. It used to be
 * flattened into the same comma-separated list as the top-level entries, which
 * are an AND, so an either/or was shown to the reader as a set of things all
 * required. The alternatives now stay grouped and joined by "or".
 */
export const describeDependencies = (
  dependencies: (string | string[])[] | string[][],
  schema: IQorusFormSchema
): string =>
  (dependencies as (string | string[])[])
    .map((entry) => {
      if (!isArray(entry)) {
        return describeDependency(entry as string, schema);
      }
      const alternatives = (entry as string[])
        .map((dep) => describeDependency(dep, schema))
        .filter((dep): dep is string => !!dep);
      if (!alternatives.length) {
        return undefined;
      }
      return alternatives.length > 1 ? `(${alternatives.join(' or ')})` : alternatives[0];
    })
    .filter((entry): entry is string => !!entry)
    .join(', ');

/**
 * An allowed VALUE, as far as being offered is concerned.
 *
 * ts-toolkit 0.5.82 carries both `IQorusAllowedValue.depends_on` and
 * `IQorusFormFieldMessage.when` / `unless`, so this no longer waits on a publish.
 * It remains its own shape because it states only what DECIDING AVAILABILITY needs —
 * three keys out of the twenty an allowed value can carry — so a caller that has
 * only those three can be answered, and the predicate cannot quietly start reading
 * a fourth.
 */
export interface IAllowedValueAvailabilityInput {
  /**
   * The value is offered only while every entry holds — the SAME grammar, the
   * same parser and the same evaluator a field's `depends_on` uses, one level
   * down. For what this form can decide on its own.
   */
  depends_on?: (string | string[])[];
  /**
   * Someone who already knows has refused it — the server, for a sandbox or
   * permission context, a capability of the selected kind, or a requirement in
   * a scope `depends_on` deliberately cannot reach.
   */
  disabled?: boolean;
  /** Where a refusal says why. */
  messages?: IConditionalFieldMessage[];
}

/** Whether a value can be picked, and the sentence that stands in for it. */
export interface IAllowedValueAvailability {
  available: boolean;
  /** Why not. Read by the row itself, by its tooltip and by the list's search. */
  reason?: string;
  /** A heading the refusal came with, when it came with one. */
  title?: string;
  intent?: TReqoreIntent;
}

/** One object for every available value, so identity says "nothing to show". */
export const ALLOWED_VALUE_AVAILABLE: IAllowedValueAvailability = Object.freeze({
  available: true,
});

/**
 * Whether an offered value can be picked, and why not.
 *
 * Two things can refuse a value and they render identically, because a reader
 * has no way to tell them apart and no reason to care:
 *
 * - **the predicate** — the value's own `depends_on`, judged against the form
 *   it is standing in. Whatever the form itself can decide.
 * - **the pre-resolved refusal** — `disabled: true` with a message, from
 *   whoever already knows. A sandbox that denies a domain, a capability of the
 *   selected kind, a requirement in another value scope: none of them are
 *   reachable from a sibling's answer, and a predicate that pretended otherwise
 *   would be a predicate that never fires.
 *
 * The predicate is checked first when both could speak. It names a field in
 * this very form, so the reader can act on it without leaving the row; a served
 * reason is a statement about somewhere else.
 *
 * A value is never HIDDEN for either reason. A choice that vanishes takes its
 * own explanation with it, and leaves the reader looking for something they
 * were told exists.
 */
export const getAllowedValueAvailability = (
  value: IAllowedValueAvailabilityInput | undefined,
  allOptions?: TQorusForm,
  schema?: IQorusFormSchema
): IAllowedValueAvailability => {
  if (!value) {
    return ALLOWED_VALUE_AVAILABLE;
  }

  /* `allOptions` is undefined only when there is no form around the picker at
     all (see `OptionsContext`). A predicate about siblings has nothing to judge
     there, and locking every gated value in a standalone picker would be a
     rendering fault rather than a fact about the form. */
  if (
    size(value.depends_on) &&
    allOptions &&
    !hasAllDependenciesFullfilled(value.depends_on!, allOptions, schema)
  ) {
    const dependsOn = schema ? describeDependencies(value.depends_on!, schema) : '';

    return {
      available: false,
      intent: 'warning',
      reason:
        dependsOn ?
          `Unavailable because some dependencies are not fulfilled: ${dependsOn}`
          // Nothing nameable: every entry pointed at a field this schema does
          // not contain. A sentence that ends in a colon and then stops reads
          // as a rendering fault rather than as a fact about the form.
        : 'Unavailable because some dependencies are not fulfilled',
    };
  }

  if (value.disabled) {
    /* The refusal picks its own words out of `messages`, through the same
       `when`/`unless` filter a field's messages go through — a served reason
       can itself be conditional. The most serious one speaks: a `danger`
       message is the one that explains a refusal, and an `info` note beside it
       is not. */
    const explanation = getRefusalMessage(getShownSchemaMessages(value.messages, allOptions, schema));

    return {
      available: false,
      intent: (explanation?.intent as TReqoreIntent) || 'warning',
      title: explanation?.title,
      // A refusal with no message at all still has to say something: silence
      // over a value that will not respond is the defect this whole mechanism
      // exists to remove.
      reason: explanation?.content || UNAVAILABLE_VALUE_FALLBACK_REASON,
    };
  }

  return ALLOWED_VALUE_AVAILABLE;
};

/**
 * The availability of each offered value, against the form the picker stands in.
 *
 * Aligned with `items`: the result at index `i` describes `items[i]`.
 *
 * The answer is computed INSIDE the context selector, not from a copy of the
 * form values pulled out of it. `OptionsContext` hands down a fresh object on
 * every render of the engine, so a picker that selected the values themselves
 * would re-render on every keystroke anywhere in the form; selecting the
 * computed answer re-renders it only when an availability actually changes.
 *
 * Values that gate on nothing skip the computation entirely, and that is a
 * claim about each VALUE rather than about the field it belongs to. The gate
 * used to be one flag for the whole list, so a single gated value in a
 * thousand-item picker resolved all thousand and serialised all thousand on
 * every keystroke anywhere in the form. Only the gated indices are resolved
 * and serialised; every other position is the same frozen
 * {@link ALLOWED_VALUE_AVAILABLE}, which costs nothing to fill in and lets
 * identity say "nothing to show".
 */
export const useAllowedValueAvailability = (
  items: readonly IAllowedValueAvailabilityInput[] | undefined
): IAllowedValueAvailability[] => {
  const gatedIndices = useMemo(
    () =>
      (items || []).reduce<number[]>((indices, item, index) => {
        if (size(item?.depends_on) || item?.disabled === true) {
          indices.push(index);
        }
        return indices;
      }, []),
    [items]
  );

  const serialized = useContextSelector(OptionsContext, (context) =>
    gatedIndices.length ?
      JSON.stringify(
        gatedIndices.map((index) =>
          getAllowedValueAvailability(items![index], context.value, context.schema)
        )
      )
    : ''
  );

  return useMemo(() => {
    const result = (items || []).map(() => ALLOWED_VALUE_AVAILABLE);

    if (!serialized) {
      return result;
    }

    // Aligned back onto the caller's own indices: the picker asks for
    // `availability[i]` and must get the answer for `items[i]`.
    const resolved = JSON.parse(serialized) as IAllowedValueAvailability[];
    gatedIndices.forEach((index, position) => {
      result[index] = resolved[position];
    });

    return result;
  }, [serialized, items, gatedIndices]);
};

export interface IOptionFieldMessagesProps {
  schema: IQorusFormSchema;
  option: IQorusFormField;
  allOptions?: TQorusForm;
  name: string;
  getType: (type: string) => string;
  /**
   * The reader has not edited this field in this session.
   *
   * An error is a report that something went WRONG. "This field is required"
   * under a field nobody has been in yet reports nothing: the form is empty
   * because it is new. The requirement is already carried three other ways —
   * the asterisk on the label, the Needs-attention box the row sits in, and the
   * completion meter — so the message waits until the reader has been in the
   * field and left it empty, which IS a thing that went wrong.
   *
   * Only the plain required message is held back. A value that fails
   * validation, an unmet required GROUP and a locked dependency are all facts
   * about what the form currently holds, and they show immediately.
   */
  untouched?: boolean;
}

/**
 * Compute the validation / required-group / dependency messages for an option —
 * pure, so the compact read-first rows can surface the same messages the
 * expanded editor shows (single source of truth).
 */
export const getOptionFieldMessages = ({
  schema,
  option,
  name,
  allOptions,
  getType,
  untouched,
}: IOptionFieldMessagesProps): IReqoreTagProps[] => {
  const optionSchema = schema[name];
  const result: IReqoreTagProps[] = [];

  if (option.value || option.value === false || option.value === 0 || option.value === null) {
    /* A concrete type the VALUE carries beats an untyped schema.
       `auto`/`any` declare no type — the author picks one (Binary, Date, …)
       and it is recorded beside the value. Reading the schema first validated
       a binary value as `auto`, which auto-detects from the value and accepts
       anything, so the form said the field needed attention while the field
       itself gave no reason. The form's own check already prefers the stored
       type (`getOptionFieldStorageType`); this is the same precedence. */
    const schemaType = optionSchema?.ui_type as string;
    const storedType = option.type as string;
    const typeToValidate =
      isUntypedOptionType(schemaType) && storedType ? storedType : schemaType || storedType;

    const validationData = validateFieldWithResult(
      getType(typeToValidate),
      option.value,
      {
        has_to_have_value: true,
        isFunction: option.is_expression,
        // Spread the FIELD's schema (rules, validation_regex, arg_schema, …) —
        // this used to spread the whole schema MAP, so per-field validation
        // config never reached the validator.
        ...(optionSchema as object),
        optionSchema: schema,
      }
    );
    if (!validationData.isValid) {
      result.push({
        label: validationData.reason || 'Field value is not valid',
        intent: 'danger',
      });
    }
  } else {
    if (optionSchema?.required && !untouched) {
      result.push({ label: 'This field is required', intent: 'danger' });
    }

    if (
      optionSchema?.required_groups &&
      !validateOptionWithRequiredGroups(allOptions, schema, optionSchema.required_groups)
    ) {
      const requiredOptionsMessage = getRequiredOptionMessage(
        schema,
        optionSchema.required_groups,
        name
      );

      result.push({
        label: requiredOptionsMessage,
        intent: 'warning',
      });
    }
  }

  if (
    optionSchema?.depends_on &&
    !hasAllDependenciesFullfilled(optionSchema.depends_on, allOptions, schema)
  ) {
    const dependsOn = describeDependencies(optionSchema.depends_on, schema);

    result.push({
      label:
        dependsOn ?
          `This field is disabled because some dependencies are not fulfilled: ${dependsOn}`
          // Nothing nameable: every entry pointed at a field this schema does
          // not contain. A sentence that ends in a colon and then stops reads
          // as a rendering fault rather than as a fact about the form.
        : 'This field is disabled because some dependencies are not fulfilled',
      intent: 'warning',
    });
  }

  return result;
};

export const OptionFieldMessages = ({
  schema,
  option,
  name,
  allOptions,
  getType,
  untouched,
}: IOptionFieldMessagesProps) => {
  const messages: IReqoreTagProps[] = useMemo(
    () => getOptionFieldMessages({ schema, option, name, allOptions, getType, untouched }),
    [JSON.stringify(schema), JSON.stringify(option), JSON.stringify(allOptions), name, untouched]
  );

  if (!size(messages)) {
    return null;
  }

  return (
    <>
      <ReqoreVerticalSpacer height={5} />
      <ReqoreControlGroup size='tiny' wrap>
        {messages.map((message, index) => (
          <ReqoreTag wrap minimal icon='ErrorWarningLine' key={index} {...message} />
        ))}
      </ReqoreControlGroup>
    </>
  );
};
