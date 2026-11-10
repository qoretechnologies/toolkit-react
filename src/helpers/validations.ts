import { IQorusFormSchema, TQorusForm, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { isValidCron } from 'cron-validator';
import jsyaml from 'js-yaml';
import { isBoolean, isNull, isString, isUndefined, memoize, omit } from 'lodash';
import type { MemoizedFunction } from 'lodash';
import every from 'lodash/every';
import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isNaN from 'lodash/isNaN';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isPlainObject';
import size from 'lodash/size';
import { defaultQorusTypes, qorusTypeSentenceForm } from './qorusTypeCatalogue';
import uniqWith from 'lodash/uniqWith';
import { fixOperatorValue, getAddress, getProtocol, splitByteSize } from './common';
import { isOptionInterfaceUiType } from './optionUiTypes';
import { getListElementValue, getOptionsFromRequiredGroups } from './options';
import { IProviderType, TVariableActionValue, maybeBuildOptionProvider } from './providerValue';
import { getTemplateKey, getTemplateValue, isValueTemplate, textAroundATemplate } from './templates';
import { allowedValueOf, getUnlistedChoiceReason } from './allowedValues';
import { storedColorProblem } from '../components/colorValue/colorValue';
import { asLoneValue } from '../components/form/expressions/loneValue';
import { onReqraftLabelsChange, reqraftLabels } from './reqraftLabels';
import type { IValidationLabels } from './validationLabels';

/** The five cron fields, in order, as a schedule hash may name them. */
const CRON_FIELDS: [string, string][] = [
  ['minutes', 'minute'],
  ['hours', 'hour'],
  ['days', 'day'],
  ['months', 'month'],
  ['dow', 'weekday'],
];

/**
 * A five-field cron expression, from either representation a caller may hold.
 *
 * A schedule reaches the form in one of two shapes, and both are legitimate: a
 * joined string (`"0 0 1 1 *"`), or the hash a Qorus job carries
 * (`{minutes, hours, days, months, dow}` — also accepted under the singular
 * `minute`/`hour`/`day`/`month`/`weekday` spellings). The renderer already
 * accepted both; validation did not, and fed the hash straight to
 * `isValidCron`, which calls `.trim()` on it.
 *
 * Returns `undefined` for anything that is neither, so the caller reports an
 * invalid value rather than throwing.
 */
export const cronExpressionFromValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const hash = value as Record<string, unknown>;
  const parts = CRON_FIELDS.map(([plural, singular]) => {
    const field = hash[plural] ?? hash[singular];
    return field === undefined || field === null || field === '' ? '*' : String(field);
  });

  // An object with none of the five keys is not a schedule — every part
  // defaulting to `*` would otherwise turn any object at all into "* * * * *"
  return parts.every((part) => part === '*') &&
    !CRON_FIELDS.some(([plural, singular]) => plural in hash || singular in hash)
    ? undefined
    : parts.join(' ');
};

export interface IValidationResult {
  isValid: boolean;
  reason?: string;
  reasons: string[];
  /**
   * The value is refused because it is not one of the field's fixed choices (`getUnlistedChoiceReason`): said so by
   * this flag, not by the words of `reason`, which are the host's and may be in any language.
   */
  unlistedChoice?: boolean;
}

interface IFieldValidationProps {
  has_to_have_value?: boolean;
  has_to_be_valid_identifier?: boolean;
  /** Server options-schema validation rules (e.g. `['valid_identifier']`) —
   *  mapped onto the corresponding `has_to_be_*` flags. */
  rules?: string[];
  validation_regex?: string;
  /**
   * What `validation_regex` accepts, in words ("a host name and a port, like api.example.com:443"): said when a
   * value does not match, in place of the pattern. Optional on the server's option info.
   */
  validation_regex_desc?: string;
  /** A value the field takes, as the server gives it: said as the form a value must have, when it has no words. */
  example_value?: unknown;
  /**
   * The inclusive bounds a numeric field accepts — read only by the `int`, `float`
   * and `number` validators.
   *
   * Declared here rather than imported because ts-toolkit still does not carry them:
   * 0.5.82 added the allowed-value and message members reqraft was waiting on, but
   * `IQorusFormFieldSchemaBase` has no numeric bound. These two collapse into the
   * imported type once it does — unlike the allowed-value shapes, which stay local
   * for a reason of their own.
   *
   * The server declares a bound only where that same bound is already enforced on the
   * write (`MetaFieldInfo::min_value`), so refusing a value here turns an error the
   * author would otherwise meet on save into one they meet while the field is still on
   * screen. It never enforces the bound, and it never refuses a value the server would
   * have accepted.
   */
  min_value?: number;
  max_value?: number;
  required_groups?: string[];
  optionSchema?: IQorusFormSchema;
  /** The sibling option VALUES, for required-group and dependency checks.
   *  Widened because a schema entry is also passed straight in as `field`, and
   *  a schema entry carries an `options` of its own — the field's UI options
   *  bag (`{ file?: DropzoneOptions }`) — under the same name. */
  options?: TQorusForm | Record<string, any>;
  isFunction?: boolean;
  arg_schema?: IQorusFormSchema;
  ui_element_type?: string;
  element_type?: string;
  allowed_values?: any[];
  element_allowed_values?: any[];
  disabled?: boolean;
  metadata?: Record<string, any>;
  /** The expression catalogue, when a caller holds one already — see
   *  {@link setExpressionCatalogueReader} for where it comes from otherwise. */
  expressions?: any[];
  /** The two key names an `array-of-pairs` row is made of. */
  fields?: string[];
  /** Set for a provider chosen as an FSM variable, which must support an action. */
  isVariable?: boolean;
  /** The declaration a `var-action` is resolved against. Partial because it
   *  carries only the provider half — the action supplies the variable half,
   *  and the two are merged before the provider validator sees them. */
  variableData?: { value?: Partial<TVariableActionValue> };
  [key: string]: any;
}

/**
 * Where the expression catalogue comes from when a caller does not carry one.
 *
 * Every other rule here is a pure function of the value and its schema, but an
 * expression can only be checked against the catalogue of operations the server
 * publishes — which is application state, fetched once and held in a store. The
 * library must not reach into a consumer's store, so the consumer hands the
 * reader in instead: qorus-ide registers one that reads its expressions store.
 *
 * Unregistered, the catalogue is empty, and `case 'expression'` then validates
 * only what an expression can be judged on by itself (see the ordering there).
 */
type TExpressionCatalogueReader = () => any[] | undefined;

let expressionCatalogueReader: TExpressionCatalogueReader | undefined;

export const setExpressionCatalogueReader = (reader?: TExpressionCatalogueReader): void => {
  expressionCatalogueReader = reader;
};

const readExpressionCatalogue = (field?: IFieldValidationProps): any[] =>
  field?.expressions ?? expressionCatalogueReader?.() ?? [];

// permissive patterns for the semantic string formats — mirror the qore DataProvider
// QoreStringFormatDataType server backstop (email/uuid/hostname/ipv4/ipv6/phone)
const SEMANTIC_FORMAT_PATTERNS: Record<string, RegExp> = {
  email: /^[^@\s]+@[^@\s]+$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  hostname: /^[A-Za-z0-9.-]+$/,
  ipv4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ipv6: /^([0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}$/,
  phone: /^\+?[0-9 ().-]{3,}$/,
};

/** The words a reason is said in, read when it is said: a host that gives others is answered in them. */
const words = (): IValidationLabels => reqraftLabels().validation;

const validResult = (): IValidationResult => ({ isValid: true, reasons: [] });

/**
 * Why a value its field's pattern refuses is refused, in words the author can act on: what the pattern accepts,
 * as the server says it ("Must be a host name and a port."); else the form a value must have, by the field's
 * example; the pattern itself last, as a detail (qorus#646, David: "we need to tell the user why there's an error -
 * i.e. what doesn't match the pattern - what is the pattern"). It said "Value does not match validation pattern".
 */
export const patternMismatchReason = (field?: {
  validation_regex?: string;
  validation_regex_desc?: string;
  example_value?: unknown;
}): string => {
  const desc =
    typeof field?.validation_regex_desc === 'string' ? field.validation_regex_desc.trim() : '';
  if (desc) {
    return words().mustBe(desc);
  }
  const example = field?.example_value;
  const exampleText =
    typeof example === 'string' ? example.trim()
    : typeof example === 'number' || typeof example === 'boolean' ? String(example)
    : '';
  return words().mustMatchExpectedForm(
    exampleText || undefined,
    field?.validation_regex || undefined
  );
};

const invalidResult = (
  reason?: string | string[],
  childReasons: string[] = []
): IValidationResult => {
  const reasons = [
    ...(Array.isArray(reason) ? reason.filter(Boolean) : reason ? [reason] : []),
    ...childReasons,
  ];

  return {
    isValid: false,
    reason: reasons[0],
    reasons,
  };
};

const withContext = (result: IValidationResult, context?: string): IValidationResult => {
  if (result.isValid || !context) {
    return result;
  }

  const checked: string = context;
  const reasons =
    result.reasons.length > 0 ?
      result.reasons.map((reason) => words().inContext(checked, reason))
    : [checked];

  return {
    isValid: false,
    reason: reasons[0],
    reasons,
  };
};

const resultFromBoolean = (isValid: boolean, reason: string): IValidationResult =>
  isValid ? validResult() : invalidResult(reason);

/**
 * Whether the value is a number at all — the check the `number` and `float` cases both
 * make before any bound is read. Shared because the two differ only in the wording of
 * the refusal, and a predicate that drifted between them would leave one of the pair
 * accepting what the other refuses.
 */
const isNumericValue = (value: any): boolean =>
  !isNaN(value) && (getTypeFromValue(value) === 'float' || getTypeFromValue(value) === 'int');

/**
 * The schema-declared range for a value that is already the right kind of number.
 *
 * Both bounds are inclusive and either may stand alone — the server declares only the
 * side it can point at an enforcing line for, so a count with a floor and no ceiling
 * arrives with `min_value` alone. A bound that is not a finite number is ignored rather
 * than treated as zero: a schema that says nothing must not refuse everything.
 *
 * Kept out of the type checks above it so the reason a value is refused says which
 * thing is wrong — "must be a whole number" and "must be at least 1" are different
 * corrections, and collapsing them into one message makes the author guess.
 */
const checkNumericBounds = (value: any, field?: IFieldValidationProps): IValidationResult => {
  const num = Number(value);
  const min = field?.min_value;
  const max = field?.max_value;

  if (typeof min === 'number' && Number.isFinite(min) && num < min) {
    return invalidResult(words().atLeast(min));
  }
  if (typeof max === 'number' && Number.isFinite(max) && num > max) {
    return invalidResult(words().atMost(max));
  }
  return validResult();
};

const isRichTextWithoutValue = (value: any): boolean => {
  return (
    value === undefined ||
    value === '' ||
    JSON.stringify(value) === '[{"type":"paragraph","children":[{"text":""}]}]'
  );
};

/**
 * A value that sets nothing: none, `null`, empty text or an empty list.
 *
 * The one rule for "is this field set" - the form's read-first status reads it (an empty list files the field
 * under Optional, not Set), and so does validation. The two used to disagree on an empty list: the status said an
 * optional Authors field holding `[]` was not set, while validation checked it as a value and found it wanting
 * ("At least one value is required"), so the form was invalid with nothing on screen saying why.
 */
export const isOptionValueEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const isValueDefined = (type: string, value: any): boolean => {
  if (type === 'richtext') {
    return !isRichTextWithoutValue(value);
  }

  return !isOptionValueEmpty(value);
};

/**
 * A type named inside a sentence: its sentence form in the server's type catalogue ("a whole number"), as reqraft
 * keeps it - the form's own words, said before and without any server (qorus#646).
 */
const typeInSentence = (type: string): string | undefined =>
  qorusTypeSentenceForm(defaultQorusTypes, type);

/** What is said of a value that is not of its field's type, the type named where there is one (qorus#646). */
const valueMustBe = (type: string): string => words().valueMustBe(typeInSentence(type));

/** The types a value is written as text in, where text around a template makes it text and not one of them. */
const NOT_TEXT_WITH_A_TEMPLATE = new Set([
  'int',
  'integer',
  'softint',
  'number',
  'float',
  'softfloat',
  'softnumber',
  'bool',
  'boolean',
  'softbool',
  'date',
  'softdate',
]);

/**
 * What is said of a value of a type that is not text, written with text around a template: what makes it
 * text, and what to do about it (qlip build 20261008-083118: "How does the user fix this? Why has this
 * happened?"). `undefined` where the type is text, or the value is not text around a template.
 */
const textAroundATemplateReason = (type: string, value: unknown): string | undefined => {
  const around = NOT_TEXT_WITH_A_TEMPLATE.has(type) ? textAroundATemplate(value) : undefined;
  if (!around) {
    return undefined;
  }
  // the type as the catalogue names it inside a sentence; the words say it of the field's type where it has no name
  const named = typeInSentence(type);
  if (around.templates > 1) {
    return around.text.length
      ? words().textAndTemplatesMakeText(named)
      : words().templatesSideBySide(named);
  }
  return words().textAroundTemplate(around.text, named);
};

export const _validateField = (
  type: string,
  value?: any,
  field?: IFieldValidationProps,
  canBeNull?: boolean
): IValidationResult => {
  if (!type) {
    if (value === undefined || value === null) {
      return invalidResult(words().missingValue);
    }

    return invalidResult(words().missingType);
  }

  // Check if the type starts with a * to indicate it can be null
  if (type.startsWith('*')) {
    type = type.substring(1);
    canBeNull = true;
  }
  // If the value can be null and is null, immediately return valid
  if (canBeNull && (value === null || value === undefined)) {
    return validResult();
  }
  // Strip type parameters e.g. hash<string, int> → hash
  const pos: number = type.indexOf('<');
  if (pos > 0) {
    type = type.slice(0, pos);
  }
  /* A value whose type is not text, written with text around a template, is not of that type: a whole
     number written as "$record:{pos} Stk." passed as a template - anything starting with `$` and holding
     a `:` did - and the form could be saved with a value its type cannot hold (qorus#646). A template
     alone, a literal and an expression are judged as before. */
  const textAroundReason = textAroundATemplateReason(type, value);
  if (textAroundReason) {
    return invalidResult(textAroundReason);
  }
  // Check if the value is a template string
  if (isValueTemplate(value)) {
    const hasKey = !!getTemplateKey(value);
    const hasValue = !!getTemplateValue(value);

    return resultFromBoolean(hasKey && hasValue, words().templateNeedsKeyAndValue);
  }
  // Expression values (`is_expression`) carry the AST `{ exp, args }` instead of
  // a typed literal, so the declared type says nothing about them — validate
  // them as the expression they are, arguments and all. (`isFunction` is set by
  // FormEngine, and by the option recursion below, for expression options.)
  if (field?.isFunction) {
    // The AST is normally the value itself; a caller that still holds the
    // option envelope hands over `{ value: ast }`, so accept both.
    const ast = (value as { value?: any })?.value ?? value;

    return validateFieldWithResult(
      'expression',
      { value: ast },
      omit(field, ['isFunction']),
      canBeNull
    );
  }

  // Check if the field has required groups
  if (field?.required_groups) {
    if (
      !isValueDefined(type, value) &&
      validateOptionWithRequiredGroups(
        field.options as TQorusForm,
        field.optionSchema,
        field.required_groups
      )
    ) {
      return validResult();
    }
  }

  // A value that is not one of the field's fixed choices is INVALID — never
  // erased. The form used to drop such a value when the choices arrived, and
  // three times the dropped value was a real one (a document naming a choice,
  // a bare-declared choice, a value whose choices had not loaded yet) that the
  // emptied form then saved. Keeping it and saying why it cannot be submitted
  // leaves the author to decide. Templates and expression values returned
  // above; `allowed_values: []` and creatable choices are not judged. An
  // `expression` is never judged either: the expression branch above recurses
  // here with the field's schema (choices included) and the AST as the value.
  const unlistedChoiceReason =
    type === 'expression' ? undefined : getUnlistedChoiceReason(value, field);
  if (unlistedChoiceReason) {
    return { ...invalidResult(unlistedChoiceReason), unlistedChoice: true };
  }

  // An interface type names another Qorus object by its name, so a non-empty
  // string is the whole contract. `connection` is the exception: it carries
  // enablement and authentication state of its own, checked below.
  if (isOptionInterfaceUiType(type) && type !== 'connection') {
    return validateFieldWithResult('string', value, field);
  }

  switch (type) {
    case 'richtext': {
      if (!value || !size(value)) {
        return invalidResult(words().textEmpty);
      }

      if (typeof value === 'string') {
        return validResult();
      }

      if (isRichTextWithoutValue(value)) {
        return invalidResult(words().textEmpty);
      }

      return validResult();
    }
    case 'bool':
    case 'boolean':
      return resultFromBoolean(
        value === true ||
          value === false ||
          (value === undefined && field?.has_to_have_value === false),
        valueMustBe('bool')
      );
    case 'connection': {
      if (!value) {
        return invalidResult(words().connectionMissing);
      }

      if (field?.allowed_values) {
        const allowedValue = field.allowed_values.find(
          (val: any) => allowedValueOf(val) === value || val.name === value
        );

        if (!allowedValue) {
          return invalidResult(words().connectionNotAllowed);
        }

        if (allowedValue.disabled || allowedValue.metadata?.needs_auth) {
          return invalidResult(words().connectionDisabled);
        }
      }

      if (field?.disabled || field?.metadata?.needs_auth) {
        return invalidResult(words().connectionDisabled);
      }

      return withContext(
        validateFieldWithResult('string', value, field),
        words().connectionTextInvalid
      );
    }
    // semantic string formats — permissive patterns mirror the qore DataProvider
    // QoreStringFormatDataType backstop; a server-supplied validation_regex, if
    // present, is also enforced
    case 'email':
    case 'uuid':
    case 'hostname':
    case 'ipv4':
    case 'ipv6':
    case 'phone': {
      if (value === undefined || value === null || value === '' || typeof value !== 'string') {
        return invalidResult(words().nonEmptyText);
      }
      if (field?.validation_regex && !value.match(field.validation_regex)) {
        return invalidResult(patternMismatchReason(field));
      }
      return resultFromBoolean(
        SEMANTIC_FORMAT_PATTERNS[type].test(value),
        words().notValidFormat(type)
      );
    }
    case 'binary': {
      if (typeof value !== 'string') {
        return invalidResult(words().binaryNotText);
      }

      const trimmed = value.trim();

      if (trimmed.length === 0) {
        return invalidResult(words().binaryEmpty);
      }

      // the canonical wire form is base64 (matching the server decode); a "data:<mime>;base64,..." URL
      // and legacy "0x"-prefixed hex are also accepted
      if (/^data:[^;]+;base64,/.test(trimmed)) {
        return validResult();
      }

      if (/^0x/i.test(trimmed)) {
        const hex = trimmed.replace(/^0x/i, '');
        return resultFromBoolean(
          hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex),
          words().binaryHexInvalid
        );
      }

      return resultFromBoolean(
        /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed),
        words().binaryForm
      );
    }
    case 'string':
    case 'mapper':
    case 'workflow':
    case 'service':
    case 'job':
    case 'softstring':
    case 'select-string':
    case 'file-string':
    case 'file-as-string':
    case 'long-string':
    case 'method-name':
    case 'code-editor':
    case 'data': {
      if (value === undefined || value === null || value === '' || typeof value !== 'string') {
        return invalidResult(words().nonEmptyText);
      }

      const reasons: string[] = [];

      if (field?.validation_regex && !value.match(field.validation_regex)) {
        reasons.push(patternMismatchReason(field));
      }

      // Server `rules[]` contract: 'valid_identifier' is the only rule the
      // server sends today; unknown rule strings are deliberately ignored
      // (validation passes) — extend this mapping when the server grows rules.
      if (
        field?.has_to_be_valid_identifier ||
        (Array.isArray(field?.rules) && field.rules.includes('valid_identifier'))
      ) {
        if (value.match(/^[0-9]|\W/)) {
          reasons.push(words().notIdentifier);
        }
      }

      if (field?.has_to_have_value) {
        if (value === '' || value.length === 0) {
          reasons.push(words().required);
        }
      }

      return reasons.length ? invalidResult(undefined, reasons) : validResult();
    }
    case 'file': {
      // Support both the Build-tab typed format ({ name: { type, value } })
      // and the Upload-tab flat format ({ name: 'file.txt' })
      //
      // A Build-tab sub-value is a full option envelope: it carries its own
      // `type` and may hold an expression (`is_expression`) or a rich-text
      // paragraph array rather than a bare string. This used to unwrap `.value`
      // and validate it as a hard-coded `string` with no field, discarding both
      // the declared type and the expression flag — so a `concat(...)` filename
      // arrived at the string validator as `{ exp, args }`, rich text arrived as
      // an array, and both were rejected with "Value must be a non-empty text".
      //
      // Validate each part against its OWN type and route `is_expression`
      // through `isFunction`, exactly as the `system-options` recursion below
      // does, so the `field?.isFunction` branch above gets a chance to run.
      const validateFilePart = (part: any, fallbackType: string): IValidationResult => {
        const isEnvelope = !!part && isObject(part) && ('value' in part || 'is_expression' in part);

        return isEnvelope
          ? validateFieldWithResult(part.type || fallbackType, part.value, {
              isFunction: part.is_expression,
            } as IFieldValidationProps)
          : validateFieldWithResult(fallbackType, part);
      };

      // Fall back to the arg_schema's declared types for the flat Upload-tab
      // shape: `name` is `richtext` (which also accepts a plain string) and
      // `content` is `data`.
      const nameResult = validateFilePart(value?.name, 'richtext');
      const contentResult = validateFilePart(value?.content, 'data');

      // Report both parts. Returning on the first failure meant a bad file name
      // masked the content result entirely, so the form could only ever surface
      // one problem at a time.
      const reasons = [
        ...(nameResult.isValid ? [] : withContext(nameResult, words().fileNameInvalid).reasons),
        ...(contentResult.isValid
          ? []
          : withContext(contentResult, words().fileContentInvalid).reasons),
      ];

      return reasons.length ? invalidResult(reasons) : validResult();
    }
    case 'collection-documents': {
      // The value is an array of rows in mixed lifecycle states.
      // A row is valid when it's either:
      //   1. Server-managed: has `ai_documentid` (number) + `name`.
      //   2. Client-managed: has `name` + `content` (base64) — i.e.
      //      a fresh upload that hasn't landed yet.
      // Failed rows count as valid for form-level purposes (the
      // user can Retry; the form shouldn't block save just because
      // an upload errored). Empty list is valid here — the
      // top-level required check (`field.required`) handles "must
      // pick at least one" gating.
      if (value === undefined || value === null) {
        return validResult();
      }
      if (!Array.isArray(value)) {
        return invalidResult(words().documentsNotList);
      }
      const reasons: string[] = [];
      value.forEach((row: any, idx: number) => {
        if (!row || typeof row !== 'object') {
          reasons.push(words().documentRowNotObject(idx + 1));
          return;
        }
        if (typeof row.name !== 'string' || !row.name) {
          reasons.push(words().documentRowNoName(idx + 1));
          return;
        }
        const hasServerId = typeof row.ai_documentid === 'number';
        const hasContent = typeof row.content === 'string' && !!row.content;
        if (!hasServerId && !hasContent) {
          reasons.push(words().documentRowNoContent(idx + 1, row.name));
        }
      });
      return reasons.length ? invalidResult(undefined, reasons) : validResult();
    }
    case 'array-of-pairs': {
      let valid = true;
      const reasons: string[] = [];
      // Check if every pair has key & value
      // assigned properly
      if (!Array.isArray(value)) {
        return invalidResult(words().notList);
      }
      if (
        !value?.every(
          (pair: { [key: string]: string }): boolean =>
            pair[field.fields[0]] !== '' && pair[field.fields[1]] !== ''
        )
      ) {
        valid = false;
        reasons.push(words().pairsNeedBothFields);
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(
        value,
        (cur, prev) => cur[field.fields[0]] === prev[field.fields[0]]
      );
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push(words().pairsUniqueKeys);
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    case 'class-connectors': {
      if (!Array.isArray(value) || value.length === 0) {
        return invalidResult(words().connectorRequired);
      }
      let valid = true;
      const reasons: string[] = [];
      // Check if every pair has name, input method and output method
      // assigned properly
      if (
        !value?.every(
          (pair: { [key: string]: string }): boolean =>
            !!pair.name && pair.name !== '' && !!pair.method && pair.method !== ''
        )
      ) {
        valid = false;
        reasons.push(words().connectorNameAndMethod);
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(value, (cur, prev) => cur.name === prev.name);
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push(words().connectorNamesUnique);
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    // Classes check
    case 'class-array': {
      if (!(Array.isArray(value) && value.length > 0)) {
        return invalidResult(words().classRequired);
      }
      let valid = true;
      const reasons: string[] = [];
      // Check if the fields are not empty
      if (
        !value?.every((pair: { [key: string]: string }): boolean => !!pair.name && pair.name !== '')
      ) {
        valid = false;
        reasons.push(words().classNeedsName);
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(
        value,
        (cur, prev) => `${cur.prefix}${cur.name}` === `${prev.prefix}${prev.name}`
      );
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push(words().classNamesUnique);
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    case 'number': {
      if (!isNumericValue(value)) {
        return invalidResult(valueMustBe('number'));
      }
      return checkNumericBounds(value, field);
    }
    case 'int':
      if (!(!Number.isNaN(value) && getTypeFromValue(value) === 'int')) {
        return invalidResult(valueMustBe('int'));
      }
      return checkNumericBounds(value, field);
    case 'float':
      if (!isNumericValue(value)) {
        return invalidResult(valueMustBe('float'));
      }
      return checkNumericBounds(value, field);
    case 'select-array':
    case 'multi-select':
    case 'array':
    case 'file-tree':
      return resultFromBoolean(value && value.length > 0, words().atLeastOneValue);
    case 'cron': {
      if (!value) {
        return invalidResult(words().cronRequired);
      }
      const expression = cronExpressionFromValue(value);
      // A value that is neither a cron string nor a schedule hash is INVALID,
      // not a crash: `isValidCron` calls `.trim()` on whatever it is given, so
      // passing it a hash threw a TypeError out of validation and took the
      // whole form down through the host's error boundary.
      if (expression === undefined) {
        return invalidResult(words().cronInvalid);
      }
      return resultFromBoolean(
        isValidCron(expression, { alias: true }),
        words().cronInvalid
      );
    }
    case 'date':
      return resultFromBoolean(
        value !== undefined &&
          value !== null &&
          value !== '' &&
          new Date(value).toString() !== 'Invalid Date',
        words().dateInvalid
      );
    case 'hash':
    case 'free-hash': {
      const parsedValue: any = typeof value === 'object' ? value : maybeParseYaml(value);

      if (field?.arg_schema) {
        const result = every(
          field.arg_schema,
          (fieldData: TQorusFormFieldSchema, argName: string) => {
            const argValue = readArgValue(parsedValue?.[argName]);

            // Absent and present-but-empty are the same answer to the only
            // question the schema asks here: was the arg supplied?
            if (argValue === undefined) {
              return !fieldData.required;
            }

            return validateFieldWithResult(
              (fieldData.ui_type as string) || (fieldData.type as string),
              argValue,
              fieldData as unknown as IFieldValidationProps
            ).isValid;
          }
        );

        return resultFromBoolean(result, words().hashArgumentsInvalid);
      }

      if (!parsedValue || !isObject(parsedValue)) {
        return invalidResult(valueMustBe('hash'));
      }

      return validResult();
    }
    case 'rgbcolor': {
      // the hash { r, g, b, a? } (qorus#646, David): a hex code, bare or as { hex }, is shown but not stored
      const problem = storedColorProblem(value);

      return problem ? invalidResult(problem) : validResult();
    }
    case 'list':
    case 'free-list': {
      const parsedValue: any = maybeParseYaml(value);

      if (
        !field?.has_to_have_value &&
        (parsedValue === undefined || (!size(parsedValue) && isArray(parsedValue)))
      ) {
        return validResult();
      }

      if (!isArray(parsedValue)) {
        return invalidResult(words().notList);
      }

      if (field?.ui_element_type || field?.element_type) {
        for (let i = 0; i < parsedValue.length; i++) {
          const itemResult = validateFieldWithResult(
            (field.ui_element_type as string) || (field.element_type as string),
            // An element arrives bare OR in a `{value, type}` envelope: the
            // envelope is what the editor writes, the bare form is what storage
            // holds. Reaching straight for `.value` failed every stored element
            // as empty, so a reloaded alert rule reported its delivery action
            // invalid while showing all six options set -- and threw outright on
            // a null element.
            getListElementValue(parsedValue[i]),
            field
          );

          if (!itemResult.isValid) {
            return withContext(itemResult, words().listItemInvalid(i));
          }
        }
      }

      return validResult();
    }
    case 'list-of-hashes': {
      const parsedValue: any = maybeParseYaml(value);

      if (!parsedValue || !isArray(parsedValue)) {
        return invalidResult(words().notListOfHashes);
      }

      for (let i = 0; i < parsedValue.length; i++) {
        const item = parsedValue[i];

        if (!size(item)) {
          return invalidResult(words().hashEmptyAt(i));
        }

        const itemResult = validateFieldWithResult('hash', item);

        if (!itemResult.isValid) {
          return withContext(itemResult, words().hashInvalidAt(i));
        }
      }

      return validResult();
    }
    case 'mapper-code': {
      if (!value) {
        return invalidResult(words().mapperCodeRequired);
      }
      // Split the value
      const [code, method] = value.split('::');
      // Both fields need to be strings & filled
      const codeResult = validateFieldWithResult('string', code);

      if (!codeResult.isValid) {
        return withContext(codeResult, words().mapperCodeInvalid);
      }

      const methodResult = validateFieldWithResult('string', method);

      if (!methodResult.isValid) {
        return withContext(methodResult, words().mapperMethodInvalid);
      }

      return validResult();
    }
    case 'var-action': {
      const varAction: TVariableActionValue = value;

      if (
        varAction?.var_type !== 'localvar' &&
        varAction?.var_type !== 'globalvar' &&
        varAction?.var_type !== 'autovar'
      ) {
        return invalidResult(words().variableTypeInvalid);
      }

      const nameResult = validateFieldWithResult('string', varAction.var_name, {
        has_to_have_value: true,
      });

      if (!nameResult.isValid) {
        return withContext(nameResult, words().variableNameInvalid);
      }

      const actionResult = validateFieldWithResult('string', varAction.action_type, {
        has_to_have_value: true,
      });

      if (!actionResult.isValid) {
        return withContext(actionResult, words().variableActionTypeInvalid);
      }

      // If the action type is transaction, the transaction_action needs to be set
      if (varAction.action_type === 'transaction') {
        const transactionResult = validateFieldWithResult('string', varAction.transaction_action, {
          has_to_have_value: true,
        });

        if (!transactionResult.isValid) {
          return withContext(transactionResult, words().transactionActionInvalid);
        }

        return validResult();
      }

      // If the variable data is missing
      if (!field?.variableData?.value) {
        return invalidResult(words().variableDataMissing);
      }

      // Get the variable data
      const variableData: TVariableActionValue = {
        ...value,
        ...field.variableData.value,
      };

      return withContext(
        validateFieldWithResult(varAction.action_type, variableData, field),
        words().variableActionInvalid
      );
    }
    case 'type-selector':
    case 'data-provider':
    case 'api-call':
    case 'search-single':
    case 'send-message':
    case 'search':
    case 'update':
    case 'delete':
    case 'create': {
      const newValue: IProviderType | null = maybeBuildOptionProvider(value);

      if (!newValue) {
        return invalidResult(words().providerInvalid);
      }

      // Api call only supports  requests / response
      if (type === 'api-call' && !value.supports_request) {
        return invalidResult(words().apiCallNeedsRequests);
      }

      // If the provider is from FSM variables, it needs pass this
      if (
        field?.isVariable &&
        !(
          newValue.supports_read ||
          newValue.supports_create ||
          newValue.supports_update ||
          newValue.supports_delete ||
          newValue.supports_request ||
          newValue.supports_messages ||
          newValue.transaction_management
        )
      ) {
        return invalidResult(words().variableProviderNeedsAction);
      }

      // Send message only supports messages
      if (
        type === 'send-message' &&
        (!newValue.supports_messages || !newValue.message_id || !newValue.message)
      ) {
        return invalidResult(words().sendMessageProviderIncomplete);
      }

      if (newValue.message_id) {
        const messageIdResult = validateFieldWithResult('string', newValue.message_id);

        if (!messageIdResult.isValid) {
          return withContext(messageIdResult, words().messageIdInvalid);
        }

        if (!newValue.message) {
          return invalidResult(words().messageContentMissing);
        }

        const messageResult = validateFieldWithResult(
          newValue.message.type,
          newValue.message.value
        );

        if (!messageResult.isValid) {
          return withContext(messageResult, words().messageContentInvalid);
        }
      }

      if (newValue.use_args) {
        if (newValue.args?.type !== 'nothing') {
          if (!newValue.args) {
            return invalidResult(words().argumentsMissing);
          }

          const argsResult = validateFieldWithResult(
            newValue.args.type === 'hash' ? 'system-options' : newValue.args.type,
            newValue.args.value
          );

          if (!argsResult.isValid) {
            return withContext(argsResult, words().argumentsInvalid);
          }
        }
      }

      if (
        (type === 'search-single' || type === 'search') &&
        size(newValue.search_args) !== 0 &&
        !validateFieldWithResult('system-options-with-operators', newValue.search_args).isValid
      ) {
        return invalidResult(words().searchArgumentsInvalid);
      }

      const isUpdateOrCreate = type === 'update' || type === 'create';

      if (isUpdateOrCreate) {
        const areNormalArgsInvalid =
          `${type}_args` in newValue &&
          (size(newValue[`${type}_args`]) === 0 ||
            !validateFieldWithResult('system-options', newValue[`${type}_args`]).isValid);

        const areFreeFormArgsInvalid =
          `${type}_args_freeform` in newValue &&
          (size(newValue[`${type}_args_freeform`]) === 0 ||
            !validateFieldWithResult('list-of-hashes', newValue[`${type}_args_freeform`]).isValid);

        if (`${type}_args` in newValue && areNormalArgsInvalid && areFreeFormArgsInvalid) {
          return invalidResult(words().updateCreateArgumentsInvalid);
        }

        if (`${type}_args_freeform` in newValue && areFreeFormArgsInvalid && areNormalArgsInvalid) {
          return invalidResult(words().updateCreateArgumentsInvalid);
        }
      }

      if (newValue?.type === 'factory') {
        if (newValue.optionsChanged) {
          return invalidResult(words().factoryOptionsNotSaved);
        }

        let options = true;

        if (newValue.options) {
          options = validateFieldWithResult('system-options', newValue.options).isValid;
        }

        // Type path and name are required
        return resultFromBoolean(
          !!(newValue.type && newValue.name && options),
          words().factoryIncomplete
        );
      }

      if (newValue.record_requires_search_options && newValue.searchOptionsChanged) {
        return invalidResult(words().searchOptionsNotSaved);
      }

      if (
        newValue.search_options &&
        !validateFieldWithResult('system-options', newValue.search_options).isValid
      ) {
        return invalidResult(words().searchOptionsInvalid);
      }

      return resultFromBoolean(
        !!(newValue.type && newValue.name),
        words().providerTypeAndName
      );
    }
    case 'context-selector': {
      if (isString(value)) {
        const cont: string[] = value.split(':');
        const contextResult = validateFieldWithResult('string', cont[0]);

        if (!contextResult.isValid) {
          return withContext(contextResult, words().contextPrefixInvalid);
        }

        const nameResult = validateFieldWithResult('string', cont[1]);

        if (!nameResult.isValid) {
          return withContext(nameResult, words().contextNameInvalid);
        }

        return validResult();
      }
      return resultFromBoolean(
        !!value?.iface_kind && !!value?.name,
        words().contextSelectorIncomplete
      );
    }
    case 'service-event': {
      const typeResult = validateFieldWithResult('type-selector', value);

      if (!typeResult.isValid) {
        return withContext(typeResult, words().serviceEventTypeInvalid);
      }

      if (
        !size(value.handlers) ||
        !every(
          value.handlers,
          (handler: any) => (handler.type === 'fsm' || handler.type === 'method') && handler.value
        )
      ) {
        return invalidResult(words().serviceEventHandlersInvalid);
      }

      return validResult();
    }
    case 'service-events': {
      if (!isArray(value) || !size(value)) {
        return invalidResult(words().serviceEventRequired);
      }

      for (let i = 0; i < value.length; i++) {
        const serviceEventResult = validateFieldWithResult('service-event', value[i]);

        if (!serviceEventResult.isValid) {
          return withContext(serviceEventResult, words().serviceEventInvalid(i));
        }
      }

      return validResult();
    }
    case 'service-webhook': {
      if (
        !validateFieldWithResult('string', value?.name).isValid ||
        !validateFieldWithResult('string', value?.['rest-method']).isValid ||
        !validateFieldWithResult('string', value?.auth).isValid
      ) {
        return invalidResult(words().webhookIncomplete);
      }

      if (value.handler) {
        if (value.handler.type !== 'fsm' && value.handler.type !== 'method') {
          return invalidResult(words().webhookHandlerTypeInvalid);
        }

        const handlerResult = validateFieldWithResult('string', value.handler.value);

        if (!handlerResult.isValid) {
          return withContext(handlerResult, words().webhookHandlerValueInvalid);
        }
      }

      return validResult();
    }
    case 'service-webhooks': {
      if (!isArray(value) || !size(value)) {
        return invalidResult(words().webhookRequired);
      }

      for (let i = 0; i < value.length; i++) {
        const webhookResult = validateFieldWithResult('service-webhook', value[i]);

        if (!webhookResult.isValid) {
          return withContext(webhookResult, words().serviceWebhookInvalid(i));
        }
      }

      return validResult();
    }
    case 'auto':
    case 'any': {
      // Only a STRING has YAML in it. An `auto` field's value is usually
      // already the structure it describes -- a hash the form's hash editor
      // wrote, a list from a list editor -- and `jsyaml.load()` stringifies
      // whatever it is handed first: an object becomes `"[object Object]"`,
      // which YAML then reads as the flow sequence `["object Object"]`. So the
      // auto-detected type came back `list`, the value was validated as a list,
      // and every hash stored in an `auto` field was reported *"Value must be a
      // list"* -- an invalid marker on a value that is fine. A list fared no
      // better: `[1, 2]` stringified to `"1,2"` and detected as a string.
      //
      // Every other branch that accepts either shape already parses through
      // `maybeParseYaml`, which passes a non-string straight through; this one
      // reached for `jsyaml` directly. It cannot use `maybeParseYaml` as-is
      // because that reports a YAML error as an absent value, and "not valid
      // YAML" and "empty" are different answers here.
      let parsedData: any = value;
      if (isString(value)) {
        try {
          parsedData = jsyaml.load(value);
        } catch (e) {
          return invalidResult(words().notYaml);
        }
      }

      /* A FALSY value is not an ABSENT one. `null`, `0`, `false` and `""` are
         all values an author may hold in an `auto`/`any` field — a test
         assertion expecting a count of zero, a flag that is off, or a blank
         string — and the truthiness gate that used to stand here refused every
         one of them as *"Value is empty"*. It surfaced on an assertion's
         Expected Value holding `null`: opening it reported *"Value for argument
         1 ("any") is invalid: Value is empty"* on the value the author had
         deliberately chosen. Only `undefined` is actually empty.

         `null` and `""` are answered here rather than delegated, for two
         different reasons: `getTypeFromValue(null)` answers `auto`, which would
         re-enter this very branch, and the `string` validator rejects `""`
         because that is the rule for a REQUIRED text field — a different
         question from whether an untyped field may hold a blank string. */
      if (parsedData === undefined) {
        return invalidResult(words().valueEmpty);
      }

      if (parsedData === null || parsedData === '') {
        return validResult();
      }

      /* Validate what was PARSED, against the type detected from the same
         parse. Validating the raw `value` instead made the two disagree
         whenever parsing changed the shape: typing `1` into an `auto` field
         parsed to the number 1, detected `int`, and then validated the STRING
         "1" against it — "Value must be an integer", on a value that is one.
         The author saw their field go invalid on the first character they
         typed. */
      return withContext(
        validateFieldWithResult(getTypeFromValue(parsedData), parsedData),
        words().autoTypeInvalid
      );
    }
    case 'processor': {
      if (!value || !value['processor-input-type'] || !value['processor-output-type']) {
        return invalidResult(words().processorTypesRequired);
      }
      // Validate the input and output types
      if (value?.['processor-input-type']) {
        const inputResult = validateFieldWithResult(
          'type-selector',
          value?.['processor-input-type']
        );

        if (!inputResult.isValid) {
          return withContext(inputResult, words().processorInputInvalid);
        }
      }

      if (value?.['processor-output-type']) {
        const outputResult = validateFieldWithResult(
          'type-selector',
          value?.['processor-output-type']
        );

        if (!outputResult.isValid) {
          return withContext(outputResult, words().processorOutputInvalid);
        }
      }

      return validResult();
    }
    case 'processor-mappings': {
      // processor-mappings is an array of field mappings
      // Each mapping must have an outputPath (the target field being mapped)
      // and either an inputPath (source field) or options configured
      if (!isArray(value)) {
        return canBeNull ? validResult() : invalidResult(words().processorMappingsNotList);
      }

      for (let i = 0; i < value.length; i++) {
        const mapping = value[i];

        if (!mapping || !isObject(mapping)) {
          return invalidResult(words().mappingInvalidAt(i));
        }

        // outputPath is always required - it identifies which output field is being mapped
        const outputPathResult = validateFieldWithResult('string', mapping.outputPath);

        if (!outputPathResult.isValid) {
          return withContext(outputPathResult, words().mappingOutputPathInvalid(i));
        }

        // A mapping must have either an inputPath or options (or both)
        const hasInputPath = mapping.inputPath && mapping.inputPath !== '';
        const hasOptions = mapping.options && size(mapping.options) > 0;

        if (!hasInputPath && !hasOptions) {
          return invalidResult(words().mappingNeedsInput(String(mapping.outputPath)));
        }
      }

      return validResult();
    }
    case 'tool-catalog': {
      // tool-catalog is a flat string[] of selectors; each selector is one of:
      //   "*"                         — all tools from every source
      //   "system:*"                  — all Qorus system tools
      //   "system:<tool>"             — a specific system tool
      //   "<connection>"              — all tools from a connection
      //   "<connection>/<tool>"       — a specific tool from a connection
      if (!isArray(value)) {
        return canBeNull ? validResult() : invalidResult(words().toolCatalogNotList);
      }

      for (let i = 0; i < value.length; i++) {
        const selector = value[i];
        if (typeof selector !== 'string' || selector.length === 0) {
          return invalidResult(words().toolSelectorAt(i));
        }
      }

      return validResult();
    }
    case 'fsm-list': {
      // users call FSMs Qogs: this is said to them
      if (!isArray(value)) {
        return invalidResult(words().qogListNotArray);
      }

      for (let i = 0; i < value.length; i++) {
        const itemResult = validateFieldWithResult('string', value[i]?.name);

        if (!itemResult.isValid) {
          return withContext(itemResult, words().qogEntryNameInvalid(i));
        }
      }

      return validResult();
    }
    case 'api-manager': {
      if (!value) {
        return invalidResult(words().apiManagerMissing);
      }

      const factoryResult = validateFieldWithResult('string', value.factory);

      if (!factoryResult.isValid) {
        return withContext(factoryResult, words().apiManagerFactoryInvalid);
      }

      const endpointsResult = validateFieldWithResult('api-endpoints', value.endpoints);

      if (!endpointsResult.isValid) {
        return withContext(endpointsResult, words().apiManagerEndpointsInvalid);
      }

      return validResult();
    }
    case 'api-endpoints': {
      if (!isArray(value) || !size(value)) {
        return invalidResult(words().apiEndpointRequired);
      }

      for (let i = 0; i < value.length; i++) {
        const endpointResult = validateFieldWithResult('string', value[i]?.value);

        if (!endpointResult.isValid) {
          return withContext(endpointResult, words().endpointValueInvalid(i));
        }

        const authorizationResult = validateFieldWithResult(
          'api-endpoint-authorization',
          value[i]?.authorization,
          undefined,
          true
        );

        if (!authorizationResult.isValid) {
          return withContext(authorizationResult, words().endpointAuthorizationInvalid(i));
        }
      }

      return validResult();
    }
    case 'api-endpoint-authorization': {
      if (!value) {
        return canBeNull ? validResult() : invalidResult(words().authorizationMissing);
      }

      if (typeof value !== 'object' || isArray(value)) {
        return invalidResult(words().authorizationNotObject);
      }

      if (value.mode !== undefined && !['merge', 'replace'].includes(value.mode)) {
        return invalidResult(words().authorizationMode);
      }

      if (value.allow_anonymous !== undefined && typeof value.allow_anonymous !== 'boolean') {
        return invalidResult(words().authorizationAllowAnonymous);
      }

      if (value.roles !== undefined) {
        if (!isArray(value.roles)) {
          return invalidResult(words().authorizationRolesNotList);
        }

        for (let i = 0; i < value.roles.length; i++) {
          const roleResult = validateFieldWithResult('string', value.roles[i]);

          if (!roleResult.isValid) {
            return withContext(roleResult, words().authorizationRoleInvalid(i));
          }
        }
      }

      return validResult();
    }
    case 'options':
    case 'pipeline-options':
    case 'mapper-options':
    case 'system-options': {
      const getIsValid = (
        options?: TQorusForm,
        optionSchema: IQorusFormSchema = {}
      ): IValidationResult => {
        if (!options || size(options) === 0) {
          if (!canBeNull) {
            return invalidResult(words().optionsRequired);
          }

          return validResult();
        }

        // Check if all required options are resolved by the current values
        const [unresolvedRequiredOption] = getUnresolvedRequiredOptions(optionSchema, options);

        if (unresolvedRequiredOption) {
          return unresolvedRequiredOption.validation
            ? withContext(
                unresolvedRequiredOption.validation,
                words().optionInvalid(unresolvedRequiredOption.name)
              )
            : invalidResult(
                getUnresolvedRequiredOptionReason(unresolvedRequiredOption, optionSchema)
              );
        }

        for (const option of Object.keys(options)) {
          const optionData = options[option];
          const optionType = ((typeof optionData === 'object' ? optionData?.type : undefined) ||
            (optionSchema?.[option] as TQorusFormFieldSchema)?.ui_type ||
            (optionSchema?.[option] as TQorusFormFieldSchema)?.type) as string;
          const optionValue =
            optionData && typeof optionData === 'object' ? optionData.value : optionData;

          if (
            !(optionSchema?.[option] as TQorusFormFieldSchema)?.required &&
            !isValueDefined(optionType, optionValue)
          ) {
            continue;
          }

          /* An option whose dependencies are not fulfilled is not part of this
             object, so it cannot make the object invalid.

             The form already takes that view — it HIDES such an option — and
             the two disagreeing is a trap with no way out of it: a test whose
             subject moved from a versioned kind to a service keeps the
             `subject_iface_version` it no longer has a field for, and Submit
             goes dead naming an option that is nowhere on screen. Nulling the
             value does not help either, because a null is still a value the
             loop reaches.

             A REQUIRED option with unfulfilled dependencies is unaffected:
             `getUnresolvedRequiredOptions` above reports it as `dependency`
             before this loop runs, and it is the only owner of that question.
             This branch was therefore only ever able to fail an option the
             author could not see and did not need. */
          if (
            (optionSchema?.[option] as TQorusFormFieldSchema)?.depends_on &&
            !hasAllDependenciesFullfilled(
              (optionSchema[option] as TQorusFormFieldSchema).depends_on,
              options,
              optionSchema
            )
          ) {
            continue;
          }

          const optionResult =
            typeof optionData !== 'object'
              ? validateFieldWithResult(getTypeFromValue(optionData), optionData)
              : validateFieldWithResult(optionData.type, optionData.value, {
                  ...(optionSchema?.[option] as any),
                  optionSchema,
                  options,
                  isFunction: optionData.is_expression,
                });

          if (!optionResult.isValid) {
            return withContext(optionResult, words().optionInvalid(option));
          }
        }

        return validResult();
      };

      if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const optionResult = getIsValid(value[i], field?.optionSchema);

          if (!optionResult.isValid) {
            return withContext(optionResult, words().optionSetInvalid(i));
          }
        }

        return validResult();
      }

      return getIsValid(value, field?.optionSchema);
    }
    case 'system-options-with-operators': {
      const isValid = (val: TQorusForm): IValidationResult => {
        if (!val || size(val) === 0) {
          if (canBeNull) {
            return validResult();
          }

          return invalidResult(words().optionsWithOperatorsRequired);
        }

        for (const option of Object.keys(val)) {
          const optionData = val[option];
          const optionResult =
            typeof optionData !== 'object'
              ? validateFieldWithResult(getTypeFromValue(optionData), optionData)
              : validateFieldWithResult(optionData.type, optionData.value);

          if (!optionResult.isValid) {
            return withContext(optionResult, words().optionInvalid(option));
          }

          if (
            !optionData.op ||
            !fixOperatorValue(optionData.op).every(
              (operator) => validateFieldWithResult('string', operator).isValid
            )
          ) {
            return invalidResult(words().operatorsInvalid(option));
          }
        }

        return validResult();
      };

      if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const optionResult = isValid(value[i]);

          if (!optionResult.isValid) {
            return withContext(optionResult, words().optionSetInvalid(i));
          }
        }

        return validResult();
      }

      return isValid(value);
    }
    case 'byte-size': {
      if (typeof value !== 'string') return invalidResult(words().byteSizeNotText);

      const [bytes, sizeUnit] = splitByteSize(value);

      const bytesResult = validateFieldWithResult('number', bytes);

      if (!bytesResult.isValid) {
        return withContext(bytesResult, words().byteSizeNumberInvalid);
      }

      const sizeResult = validateFieldWithResult('string', sizeUnit);

      if (!sizeResult.isValid) {
        return withContext(sizeResult, words().byteSizeUnitInvalid);
      }

      return validResult();
    }
    case 'timeout': {
      // An integer count of milliseconds — the unit selector is display-only,
      // so the stored value validates as an int.
      const msResult = validateFieldWithResult('int', value);

      if (!msResult.isValid) {
        return withContext(msResult, words().timeoutMilliseconds);
      }

      return validResult();
    }
    case 'url':
    case 'uri': {
      const protocolResult = validateFieldWithResult('string', getProtocol(value));

      if (!protocolResult.isValid) {
        return withContext(protocolResult, words().urlProtocolInvalid);
      }

      const addressResult = validateFieldWithResult('string', getAddress(value));

      if (!addressResult.isValid) {
        return withContext(addressResult, words().urlAddressInvalid);
      }

      return validResult();
    }
    case 'schema-definition': {
      // The minimal NEW_FIELD.md shape check, so malformed definitions can't
      // silently save through FormEngine.
      if (!isObject(value)) {
        return invalidResult(words().schemaDefinitionNotObject);
      }
      if (!isObject((value as { schema?: unknown }).schema)) {
        return invalidResult(words().schemaDefinitionNoSchema);
      }
      return validResult();
    }
    case 'expression': {
      const castedValue = value as {
        value?: { exp?: string; args?: any[] };
        is_expression?: boolean;
        type?: string;
      };
      const expressions = readExpressionCatalogue(field);

      // Expressions validation is complicated and needs to follow the following rules
      // 1. If the expression is empty, it is invalid
      // 2. If the expression has a type, it means its a normal argument (sub expressions don't have type)
      // 3. If the expression has no type and `exp` is present, it is a sub expression and must be validated as such
      // 4. If there are no `args` we need to check if the expression actually has any required arguments or what is the `min_args` property

      // 1. If the expression is empty
      //
      // Checked BEFORE the catalogue guard below, and deliberately: an
      // expression with no value, or with no operation chosen, is incomplete on
      // its own terms. Nothing in the catalogue can make it valid, so making
      // these two answers wait for a network fetch meant the same option
      // reported valid or invalid depending on whether that fetch had landed —
      // the field's own "show invalid only" filter listed a different set of
      // rows on a fast machine than on a slow one.
      if (!castedValue) {
        return invalidResult(words().expressionEmpty);
      }

      if (!castedValue.value?.exp) {
        return invalidResult(reqraftLabels().expressions.noOperationYet(false));
      }

      // Everything past this point needs the expression's definition, which
      // only the catalogue can supply. Until it loads there is nothing to check
      // against, so an expression that names an operation is left alone rather
      // than reported against a catalogue we do not have.
      if (!size(expressions)) {
        return validResult();
      }

      // Get the expression definition from the catalogue - a lone template's as the lone value it is (`asLoneValue`)
      const expressionDefinition = expressions.find(
        (expr: any) => expr.name === asLoneValue(castedValue.value)?.exp
      );

      if (!expressionDefinition) {
        return invalidResult(words().noSuchOperation(String(castedValue.value?.exp)));
      }

      // If the expression has no required args, we can consider it valid
      const hasRequiredArgs = expressionDefinition.args?.some((arg: any) => arg.required);

      if (!hasRequiredArgs && size(castedValue.value?.args || []) === 0) {
        return validResult();
      }

      // If there are no args provided but the expression requires some (normal expressions require at least 1 arg
      // because we checked for required args earlier), or min_args is set
      if (size(castedValue.value?.args || []) < (expressionDefinition.min_args || 1)) {
        return invalidResult(words().notEnoughArguments);
      }

      // Now we need to validate each argument, either as a normal value or as a sub-expression
      const args = castedValue.value?.args ?? [];

      // each operand's name, as the editor shows it
      const argLabels: string[] = args.map((_arg: unknown, index: number) => {
        const definition = expressionDefinition.varargs
          ? expressionDefinition.args[0]
          : expressionDefinition.args[index];
        return definition?.display_name ?? definition?.name ?? words().unnamedOperand(index + 1);
      });

      for (let index = 0; index < args.length; index++) {
        const argValue: any = args[index];
        const argDefinition = expressionDefinition.varargs
          ? expressionDefinition.args[0]
          : expressionDefinition.args[index];
        /* The argument's name for the message.
        
           `display_name` is what a catalogue MAY carry; the served one carries
           `name`, so every message about an argument read "argument 1
           ("undefined") is invalid" and named a field that does not exist. */
        const argLabel = argLabels[index];
        /* Which operand, where its name alone does not say: every operand of a call taking any number of
           them is "Value" (qlip build 20261008-083118: "which "value" is the message mentioning"). Said by
           its position too, as the editor shows them, left to right - and so is a lone operand of a call that
           can take more (David, qorus#646), as the operands that join it will be. The words say the position
           their own way ("the 2nd"); it is given only where it is said. */
        const position =
          expressionDefinition.varargs ||
          argLabels.some((label, other) => other !== index && label === argLabel)
            ? index + 1
            : undefined;

        /* An explicit null is a VALUE, and DPQL says so: `null` is a literal
           that parses, serializes and round-trips like any other.
        
           Treated as a missing one, it made "this returns no value"
           unsayable. Typing `null` into the text editor produces the literal
           expression `{exp: "value", args: [null]}`; the visual view then
           called it invalid and refused to render a summary, and a raw null
           argument crashed the validator outright on `argValue.type`. Reported
           from the live IDE by an author with no other way to assert that a
           service method returns nothing.
        
           Only an EXPLICIT null counts. An argument that is simply absent, or
           an envelope holding `undefined`, is still missing — which is the
           distinction the author is making when they write it. */
        if (argValue === null || (isObject(argValue) && (argValue as any).value === null)) {
          continue;
        }

        if (!argValue?.value && !argDefinition?.required) {
          continue;
        }

        if (argValue?.is_expression) {
          const result = validateFieldWithResult('expression', argValue, {
            expressions,
            has_to_have_value: argDefinition?.required,
          });

          if (!result.isValid) {
            // said by the operand's name, as the editor shows it - not by its position in the call
            return withContext(result, words().operandExpressionHasError(argLabel, position));
          }

          continue;
        }

        /* A slot with no operand at all is judged as what it is — a missing
           value — rather than read for a `type` it does not have.

           An operand that HOLDS something is judged by the envelope's own type,
           or — when the envelope carries none (a raw parse operand widened
           without a `ui_type`, a slot reset by a type change) — by the type the
           catalogue declares. Without that fallback `_validateField` refuses it
           for "Missing type" however right the value is. */
        const operandType =
          argValue?.type ?? (argValue?.value === undefined ? undefined : argDefinition?.ui_type);
        const result = validateFieldWithResult(operandType, argValue?.value, {
          expressions,
          allowed_values: argDefinition?.allowed_values,
          element_allowed_values: argDefinition?.element_allowed_values,
          has_to_have_value: argDefinition?.required,
        });

        if (!result.isValid) {
          // an operand not filled in yet says what to do; one that is wrong says which and why (David's
          // review of qorus#646: "Value for argument 1 ("Value") is invalid: Missing value" while building)
          if (argValue?.value === undefined || argValue?.value === null || argValue?.value === '') {
            return invalidResult(words().enterOperand(argLabel, position));
          }
          return withContext(result, words().operandInvalid(argLabel, position));
        }
      }

      return validResult();
    }
    case 'nothing':
      return invalidResult(words().nothingNotValid);
    default:
      return validResult();
  }
};

/**
 * Read one arg out of a hash, whichever of the two legitimate shapes it is in.
 *
 * A hash reaches validation both as plain values (`{name: 'init'}` — what the
 * server sends, and what a list-of-hash row holds until it is edited) and as
 * typed envelopes (`{name: {type: 'string', value: 'init'}}` — what FormEngine
 * emits once the row has been through the form). `fixOptions` already
 * reconciles the two for RENDERING; validation never learned the same rule, so
 * a freshly-loaded row read as invalid while an edited one read as valid. That
 * is what made every complete service-method row report "Hash arguments are
 * invalid" while showing correct values.
 *
 * The `'value' in arg` test is the one `fixOptions` uses, including its known
 * edge — an arg whose own value is a hash carrying a `value` key. Agreeing with
 * the renderer beats being differently wrong from it.
 */
export const readArgValue = (arg: any): any =>
  isObject(arg) && 'value' in (arg as object) ? (arg as { value: unknown }).value : arg;

type TValidateFieldWithResult = (
  type: string,
  value?: any,
  field?: IFieldValidationProps,
  canBeNull?: boolean
) => IValidationResult;

// Memoized version
export const validateFieldWithResult: TValidateFieldWithResult & MemoizedFunction = memoize(
  _validateField,
  (type, value, field, canBeNull) =>
    `${type}-${JSON.stringify(value)}-${JSON.stringify(field)}-${canBeNull}`
);

/* A reason kept is worded as it was when it was first asked for: when the host gives other words, the kept reasons
   are dropped, and the next asking words them again. */
onReqraftLabelsChange(() => validateFieldWithResult.cache.clear?.());

export const validateField: (
  type: string,
  value?: any,
  field?: IFieldValidationProps,
  canBeNull?: boolean
) => boolean = (type, value, field, canBeNull) =>
  validateFieldWithResult(type, value, field, canBeNull).isValid;

export const maybeParseYaml = (yaml: any): any => {
  if (yaml === true || yaml === false) {
    return yaml;
  }
  if (isNumber(yaml)) {
    return yaml;
  }
  if (isDate(yaml)) {
    return yaml;
  }
  if (yaml === undefined || yaml === null || yaml === '') {
    return undefined;
  }
  if (!isString(yaml)) {
    return yaml;
  }

  let yamlCorrect = true;
  let parsedData: any;
  try {
    parsedData = jsyaml.load(String(yaml));
  } catch (e) {
    yamlCorrect = false;
  }

  if (!yamlCorrect) {
    return undefined;
  }

  if (!isNull(parsedData) && !isUndefined(parsedData)) {
    return parsedData;
  }

  return undefined;
};

export const isValueSet = (value: any, canBeNull?: boolean): boolean => {
  if (canBeNull) {
    return !isUndefined(value);
  }

  return !isNull(value) && !isUndefined(value);
};

export const getValueOrDefaultValue = (value: any, defaultValue: any, canBeNull?: boolean) => {
  if (isValueSet(value, canBeNull)) {
    return value;
  }

  if (isValueSet(defaultValue, canBeNull)) {
    return defaultValue;
  }

  return undefined;
};

/** Deliberately un-annotated: the inferred literal union is what callers assign
 *  into their own narrower type aliases, and widening it to `string` breaks
 *  them. */
export const getTypeFromValue = (value: any) => {
  switch (true) {
    case isNull(value):
    case isUndefined(value):
      return 'auto';
    case isBoolean(value):
      return 'bool';
    case Number(value) === value && value % 1 === 0:
      return 'int';
    case Number(value) === value && value % 1 !== 0:
      return 'float';
    case isObject(value):
      return 'hash';
    case isArray(value):
      return 'list';
    case new Date(value).toString() !== 'Invalid Date':
      return 'date';
    case isString(value):
      return 'string';
    default:
      return 'any';
  }
};

/**
 * The groups of `groups` none of whose options has a value. A required group asks for one of its
 * options; an option in several groups is settled only when each of them is.
 */
export const unsatisfiedRequiredGroups = (
  options: TQorusForm,
  schema: IQorusFormSchema,
  groups: string[]
): string[] =>
  (groups ?? []).filter(
    (group) =>
      !getOptionsFromRequiredGroups(schema, [group]).some((option) =>
        isValueDefined(
          ((schema[option] as TQorusFormFieldSchema)?.ui_type as string) ||
            ((schema[option] as TQorusFormFieldSchema)?.type as string),
          options?.[option]?.value
        )
      )
  );

/**
 * Whether an option's required groups are settled: each has an option with a value. Any value in any of
 * the groups used to do, so an option in two groups passed while one of them was still empty - it was
 * neither flagged nor counted, and the form said fewer fields needed attention than did.
 */
export const validateOptionWithRequiredGroups = (
  options: TQorusForm,
  schema: IQorusFormSchema,
  groups: string[]
): boolean => !unsatisfiedRequiredGroups(options, schema, groups).length;

/** Why a required option is not satisfied by the current values. */
export type TUnresolvedRequiredOptionReason =
  /** No value at all — neither typed, nor defaulted, nor preselected. */
  | 'missing'
  /** The option's dependencies are not fulfilled, so its value cannot be final yet. */
  | 'dependency'
  /** A value is present but does not validate against the option's type / schema. */
  | 'invalid';

export interface IUnresolvedRequiredOption {
  /** The option's key in the schema. */
  name: string;
  reason: TUnresolvedRequiredOptionReason;
  /** The failing validation, present only for the `invalid` reason. */
  validation?: IValidationResult;
}

export const getUnresolvedRequiredOptionReason = (
  { name, reason }: IUnresolvedRequiredOption,
  optionSchema?: IQorusFormSchema
): string => {
  switch (reason) {
    case 'dependency':
      return words().optionDependenciesNotFulfilled(name);
    case 'invalid':
      return words().optionInvalid(name);
    default:
      return (optionSchema?.[name] as TQorusFormFieldSchema)?.required
        ? words().optionRequired(name)
        : words().optionRequiresValue(name);
  }
};

/**
 * List every required option that the given values do not resolve.
 *
 * `required` on an option schema means "the effective configuration must carry
 * this option" — NOT "the user has to type it in". An option whose schema
 * default or preselected value already resolves it needs no user input at all,
 * which is why callers pass values that have been through `fixOptions()`
 * (defaults, preselected values and rich-text default envelopes applied)
 * rather than the raw values the server returned.
 *
 * This is the single owner of the "which required options still need input"
 * question: `validateField('options', …)` uses it for form validity, and
 * qorus-ide's `ConnectionManagementModal` uses it to decide whether a
 * connection can be created — and its OAuth2 flow started — without showing a
 * form at all.
 */
export const getUnresolvedRequiredOptions = (
  optionSchema: IQorusFormSchema = {},
  options: TQorusForm = {}
): IUnresolvedRequiredOption[] => {
  const unresolved: IUnresolvedRequiredOption[] = [];

  for (const [name, schemaEntry] of Object.entries(optionSchema ?? {})) {
    const optionData = schemaEntry as TQorusFormFieldSchema;

    if (!optionData?.required && !size(optionData?.required_groups)) {
      continue;
    }

    const optionField = options?.[name];
    const optionValue =
      optionField && typeof optionField === 'object' ? optionField.value : optionField;
    const optionType = ((typeof optionField === 'object' ? optionField?.type : undefined) ||
      optionData.ui_type ||
      optionData.type) as string;

    // A dependent option cannot be considered resolved while its dependencies
    // are not: the schema it will be validated against — and with it any
    // default the server would send — is not final yet.
    if (
      optionData.depends_on &&
      !hasAllDependenciesFullfilled(optionData.depends_on, options, optionSchema)
    ) {
      unresolved.push({ name, reason: 'dependency' });
      continue;
    }

    if (!isValueDefined(optionType, optionValue)) {
      // An option required only through a group is resolved by any sibling in
      // that group carrying a value.
      if (
        optionData.required ||
        !validateOptionWithRequiredGroups(options, optionSchema, optionData.required_groups)
      ) {
        unresolved.push({ name, reason: 'missing' });
      }

      continue;
    }

    const validation =
      typeof optionField !== 'object'
        ? validateFieldWithResult(getTypeFromValue(optionField), optionField)
        : validateFieldWithResult(optionField.type, optionField.value, {
            ...(optionData as any),
            optionSchema,
            options,
            isFunction: optionField.is_expression,
          });

    if (!validation.isValid) {
      unresolved.push({ name, reason: 'invalid', validation });
    }
  }

  return unresolved;
};

/**
 * Split a dependency entry into the sibling it names and how its value is compared.
 *
 * Four forms: `name` (the sibling must simply have a value), `!name` (it must have
 * none), `name=value` (it must have exactly that value) and `name!=value` (it must
 * have a value, and not that one). The negative comparison is what lets a field say
 * it applies to every variant of a record but one — spelling that as an `any-of`
 * list of every other variant is both unreadable in the "Depends on" lock and
 * silently wrong the moment a variant is added.
 *
 * `!=` deliberately requires the sibling to be answered: "not X" is a statement about
 * an answer, so an unanswered sibling does not satisfy it and the field stays locked.
 *
 * `!name` is the form that statement cannot make. Two options that exclude one
 * another (a converter that reads NodeSet2 and one that writes OpenAPI 3) each
 * apply only while the OTHER has not been answered at all, and `name!=value` cannot
 * say that: it requires an answer. Being a predicate like any other, it composes
 * with the AND of the top-level entries and the OR of a nested list for free.
 *
 * `!` binds to the whole entry, so `!name` never carries a value; `!=` is checked
 * first, which is what keeps `name!=value` from being read as a leading `!`.
 */
export const parseDependency = (
  dependency: string
): { name: string; op?: '=' | '!=' | '!'; value?: string } => {
  const neqIdx = dependency.indexOf('!=');
  if (neqIdx !== -1) {
    return {
      name: dependency.substring(0, neqIdx),
      op: '!=',
      value: dependency.substring(neqIdx + 2),
    };
  }

  const eqIdx = dependency.indexOf('=');
  if (eqIdx !== -1) {
    return {
      name: dependency.substring(0, eqIdx),
      op: '=',
      value: dependency.substring(eqIdx + 1),
    };
  }

  if (dependency.startsWith('!')) {
    return { name: dependency.substring(1), op: '!' };
  }

  return { name: dependency };
};

/** Whether the named sibling currently holds a value this form accepts. */
const siblingHasValue = (
  name: string,
  options: TQorusForm,
  optionsSchema?: IQorusFormSchema
): boolean =>
  validateField(options?.[name]?.type, options?.[name]?.value, {
    ...(optionsSchema?.[name] as unknown as IFieldValidationProps),
    options,
    optionSchema: optionsSchema,
  });

/** Whether one dependency entry holds against the current form values. */
const isDependencyFulfilled = (
  dependency: string,
  options: TQorusForm,
  optionsSchema?: IQorusFormSchema
): boolean => {
  const { name, op, value } = parseDependency(dependency);

  if (op === '!') {
    // "Has no value" is true of a field the form has not materialized at all —
    // there is nothing there to be the value. So an absent sibling satisfies
    // this, exactly as it satisfies the bare form below: neither has an answer
    // to judge, and a mutual exclusion that locked both halves until one of
    // them was added would offer the author no way in.
    return !options?.[name] || !siblingHasValue(name, options, optionsSchema);
  }

  if (op) {
    const optValue = options?.[name]?.value;
    if (optValue == null) {
      return false;
    }
    return op === '=' ? String(optValue) === value : String(optValue) !== value;
  }

  return options?.[name] ? siblingHasValue(name, options, optionsSchema) : true;
};

export const hasAllDependenciesFullfilled = (
  /** Every entry must hold; a nested list is an ANY of its entries. Mixed freely. */
  dependencies: ReadonlyArray<string | readonly string[]>,
  options: TQorusForm,
  optionsSchema?: IQorusFormSchema
): boolean => {
  if (size(dependencies) === 0) {
    return true;
  }

  return dependencies.every((dependency) => {
    // A nested list is an ANY. It used to look each entry up as a whole form-field
    // name, so a `name=value` entry inside one found no field and returned `true`
    // unconditionally — the any-of group was satisfied by anything at all, while
    // CompactRow's lock rendered those same entries as real comparisons. Both halves
    // now go through one parser, so the grammar cannot mean two things.
    if (isArray(dependency)) {
      return (dependency as readonly string[]).some((dep) =>
        isDependencyFulfilled(dep, options, optionsSchema)
      );
    }

    return isString(dependency)
      ? isDependencyFulfilled(dependency, options, optionsSchema)
      : true;
  });
};
