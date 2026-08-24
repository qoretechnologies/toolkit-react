import { ReqoreControlGroup, ReqoreTag, ReqoreVerticalSpacer } from '@qoretechnologies/reqore';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { IQorusFormField, IQorusFormSchema, TQorusForm } from '@qoretechnologies/ts-toolkit';
import { flatten, size } from 'lodash';
import { useMemo } from 'react';
import { getRequiredOptionMessage } from '../../../helpers/options';
import {
  hasAllDependenciesFullfilled,
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
  if (message.unless && hasAllDependenciesFullfilled(message.unless as never, values, optionsSchema)) {
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

export interface IOptionFieldMessagesProps {
  schema: IQorusFormSchema;
  option: IQorusFormField;
  allOptions?: TQorusForm;
  name: string;
  getType: (type: string) => string;
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
    if (optionSchema?.required) {
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
    const dependsOn = flatten(optionSchema.depends_on)
      .filter((dep: string) => !!schema[dep])
      .map((dep: string) => schema[dep].display_name || dep)
      .map((dep: string) => `"${dep}"`)
      .join(', ');

    result.push({
      label: `This field is disabled because some dependencies are not fulfilled: ${dependsOn}`,
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
}: IOptionFieldMessagesProps) => {
  const messages: IReqoreTagProps[] = useMemo(
    () => getOptionFieldMessages({ schema, option, name, allOptions, getType }),
    [JSON.stringify(schema), JSON.stringify(option), JSON.stringify(allOptions), name]
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
