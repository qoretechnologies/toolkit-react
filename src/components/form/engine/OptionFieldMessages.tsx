import { ReqoreControlGroup, ReqoreTag, ReqoreVerticalSpacer } from '@qoretechnologies/reqore';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { IQorusFormField, IQorusFormSchema, TQorusForm } from '@qoretechnologies/ts-toolkit';
import { isArray, size } from 'lodash';
import { useMemo } from 'react';
import { getRequiredOptionMessage } from '../../../helpers/options';
import {
  hasAllDependenciesFullfilled,
  parseDependency,
  validateFieldWithResult,
  validateOptionWithRequiredGroups,
} from '../../../helpers/validations';

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
  if (message.when && !hasAllDependenciesFullfilled(message.when as never, values, optionsSchema)) {
    return false;
  }
  if (
    message.unless &&
    hasAllDependenciesFullfilled(message.unless as never, values, optionsSchema)
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
const describeDependencies = (
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
    const validationData = validateFieldWithResult(
      getType((optionSchema?.ui_type as string) || (option.type as string)),
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
