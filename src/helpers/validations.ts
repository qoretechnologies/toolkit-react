import { isValidSixCharHex } from '@qoretechnologies/reqore/dist/helpers/colors';
import { IQorusFormSchema, TQorusForm, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { isValidCron } from 'cron-validator';
import jsyaml from 'js-yaml';
import { isBoolean, isNull, isString, isUndefined, memoize, omit } from 'lodash';
import every from 'lodash/every';
import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isNaN from 'lodash/isNaN';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isPlainObject';
import size from 'lodash/size';
import uniqWith from 'lodash/uniqWith';
import { fixOperatorValue, getAddress, getProtocol, splitByteSize } from './common';
import { isOptionInterfaceUiType } from './optionUiTypes';
import { getListElementValue, getOptionsFromRequiredGroups } from './options';
import { IProviderType, TVariableActionValue, maybeBuildOptionProvider } from './providerValue';
import { getTemplateKey, getTemplateValue, isValueTemplate } from './templates';

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
}

interface IFieldValidationProps {
  has_to_have_value?: boolean;
  has_to_be_valid_identifier?: boolean;
  /** Server options-schema validation rules (e.g. `['valid_identifier']`) —
   *  mapped onto the corresponding `has_to_be_*` flags. */
  rules?: string[];
  validation_regex?: string;
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

const validResult = (): IValidationResult => ({ isValid: true, reasons: [] });

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

  const reasons =
    result.reasons.length > 0 ? result.reasons.map((reason) => `${context}: ${reason}`) : [context];

  return {
    isValid: false,
    reason: reasons[0],
    reasons,
  };
};

const resultFromBoolean = (isValid: boolean, reason: string): IValidationResult =>
  isValid ? validResult() : invalidResult(reason);

const isRichTextWithoutValue = (value: any): boolean => {
  return (
    value === undefined ||
    value === '' ||
    JSON.stringify(value) === '[{"type":"paragraph","children":[{"text":""}]}]'
  );
};

const isValueDefined = (type: string, value: any): boolean => {
  if (type === 'richtext') {
    return !isRichTextWithoutValue(value);
  }

  return value !== undefined && value !== '';
};

export const _validateField = (
  type: string,
  value?: any,
  field?: IFieldValidationProps,
  canBeNull?: boolean
): IValidationResult => {
  if (!type) {
    if (value === undefined || value === null) {
      return invalidResult('Missing value');
    }

    return invalidResult('Missing type');
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
  // Check if the value is a template string
  if (isValueTemplate(value)) {
    const hasKey = !!getTemplateKey(value);
    const hasValue = !!getTemplateValue(value);

    return resultFromBoolean(hasKey && hasValue, 'Template must include key and value');
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

  // An interface type names another Qorus object by its name, so a non-empty
  // string is the whole contract. `connection` is the exception: it carries
  // enablement and authentication state of its own, checked below.
  if (isOptionInterfaceUiType(type) && type !== 'connection') {
    return validateFieldWithResult('string', value, field);
  }

  switch (type) {
    case 'richtext': {
      if (!value || !size(value)) {
        return invalidResult('Text value is empty');
      }

      if (typeof value === 'string') {
        return validResult();
      }

      if (isRichTextWithoutValue(value)) {
        return invalidResult('Text value is empty');
      }

      return validResult();
    }
    case 'bool':
    case 'boolean':
      return resultFromBoolean(
        value === true ||
          value === false ||
          (value === undefined && field?.has_to_have_value === false),
        'Value must be a True or False value'
      );
    case 'connection': {
      if (!value) {
        return invalidResult('Connection value is missing');
      }

      if (field?.allowed_values) {
        const allowedValue = field.allowed_values.find(
          (val: any) => val.value?.value === value || val.name === value
        );

        if (!allowedValue) {
          return invalidResult('Connection is not allowed');
        }

        if (allowedValue.disabled || allowedValue.metadata?.needs_auth) {
          return invalidResult('Connection is disabled or not authenticated');
        }
      }

      if (field?.disabled || field?.metadata?.needs_auth) {
        return invalidResult('Connection is disabled or not authenticated');
      }

      return withContext(
        validateFieldWithResult('string', value, field),
        'Connection string validation failed'
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
        return invalidResult('Value must be a non-empty text');
      }
      if (field?.validation_regex && !value.match(field.validation_regex)) {
        return invalidResult('Value does not match the required format');
      }
      return resultFromBoolean(
        SEMANTIC_FORMAT_PATTERNS[type].test(value),
        `Value is not a valid ${type}`
      );
    }
    case 'binary': {
      if (typeof value !== 'string') {
        return invalidResult('Binary value must be a string');
      }

      const trimmed = value.trim();

      if (trimmed.length === 0) {
        return invalidResult('Binary value is empty');
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
          'Binary hex value is invalid'
        );
      }

      return resultFromBoolean(
        /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed),
        'Binary value must be base64, a data: URL, or 0x-prefixed hex'
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
        return invalidResult('Value must be a non-empty text');
      }

      const reasons: string[] = [];

      if (field?.validation_regex && !value.match(field.validation_regex)) {
        reasons.push('Value does not match validation pattern');
      }

      // Server `rules[]` contract: 'valid_identifier' is the only rule the
      // server sends today; unknown rule strings are deliberately ignored
      // (validation passes) — extend this mapping when the server grows rules.
      if (
        field?.has_to_be_valid_identifier ||
        (Array.isArray(field?.rules) && field.rules.includes('valid_identifier'))
      ) {
        if (value.match(/^[0-9]|\W/)) {
          reasons.push('Value is not a valid identifier');
        }
      }

      if (field?.has_to_have_value) {
        if (value === '' || value.length === 0) {
          reasons.push('Value is required');
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
        ...(nameResult.isValid ? [] : withContext(nameResult, 'File name is invalid').reasons),
        ...(contentResult.isValid
          ? []
          : withContext(contentResult, 'File content is invalid').reasons),
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
        return invalidResult('Value must be a list of documents');
      }
      const reasons: string[] = [];
      value.forEach((row: any, idx: number) => {
        if (!row || typeof row !== 'object') {
          reasons.push(`Row ${idx + 1} is not an object`);
          return;
        }
        if (typeof row.name !== 'string' || !row.name) {
          reasons.push(`Row ${idx + 1} is missing a name`);
          return;
        }
        const hasServerId = typeof row.ai_documentid === 'number';
        const hasContent = typeof row.content === 'string' && !!row.content;
        if (!hasServerId && !hasContent) {
          reasons.push(
            `Row ${idx + 1} ("${row.name}") has neither uploaded ` +
              `content nor a server document id`
          );
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
        return invalidResult('Value must be a list');
      }
      if (
        !value?.every(
          (pair: { [key: string]: string }): boolean =>
            pair[field.fields[0]] !== '' && pair[field.fields[1]] !== ''
        )
      ) {
        valid = false;
        reasons.push('All pairs must include both fields');
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(
        value,
        (cur, prev) => cur[field.fields[0]] === prev[field.fields[0]]
      );
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push('Pairs must use unique keys');
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    case 'class-connectors': {
      if (!Array.isArray(value) || value.length === 0) {
        return invalidResult('At least one connector is required');
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
        reasons.push('Each connector must have a name and method');
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(value, (cur, prev) => cur.name === prev.name);
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push('Connector names must be unique');
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    // Classes check
    case 'class-array': {
      if (!(Array.isArray(value) && value.length > 0)) {
        return invalidResult('At least one class must be provided');
      }
      let valid = true;
      const reasons: string[] = [];
      // Check if the fields are not empty
      if (
        !value?.every((pair: { [key: string]: string }): boolean => !!pair.name && pair.name !== '')
      ) {
        valid = false;
        reasons.push('Each class must have a name');
      }
      // Get a list of unique values
      const uniqueValues: any[] = uniqWith(
        value,
        (cur, prev) => `${cur.prefix}${cur.name}` === `${prev.prefix}${prev.name}`
      );
      // Check if there are any duplicates
      if (size(uniqueValues) !== size(value)) {
        valid = false;
        reasons.push('Class names must be unique');
      }

      return valid ? validResult() : invalidResult(undefined, reasons);
    }
    case 'number': {
      return resultFromBoolean(
        !isNaN(value) && (getTypeFromValue(value) === 'float' || getTypeFromValue(value) === 'int'),
        'Value must be a number'
      );
    }
    case 'int':
      return resultFromBoolean(
        !Number.isNaN(value) && getTypeFromValue(value) === 'int',
        'Value must be an integer'
      );
    case 'float':
      return resultFromBoolean(
        !isNaN(value) && (getTypeFromValue(value) === 'float' || getTypeFromValue(value) === 'int'),
        'Value must be a float'
      );
    case 'select-array':
    case 'multi-select':
    case 'array':
    case 'file-tree':
      return resultFromBoolean(value && value.length > 0, 'At least one value is required');
    case 'cron': {
      if (!value) {
        return invalidResult('Cron value is required');
      }
      const expression = cronExpressionFromValue(value);
      // A value that is neither a cron string nor a schedule hash is INVALID,
      // not a crash: `isValidCron` calls `.trim()` on whatever it is given, so
      // passing it a hash threw a TypeError out of validation and took the
      // whole form down through the host's error boundary.
      if (expression === undefined) {
        return invalidResult('Cron expression is invalid');
      }
      return resultFromBoolean(
        isValidCron(expression, { alias: true }),
        'Cron expression is invalid'
      );
    }
    case 'date':
      return resultFromBoolean(
        value !== undefined &&
          value !== null &&
          value !== '' &&
          new Date(value).toString() !== 'Invalid Date',
        'Date is invalid'
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

        return resultFromBoolean(result, 'Hash arguments are invalid');
      }

      if (!parsedValue || !isObject(parsedValue)) {
        return invalidResult('Hash value must be an object');
      }

      return validResult();
    }
    case 'rgbcolor': {
      return resultFromBoolean(
        isValidSixCharHex(value?.hex) ||
          ((value?.r || value?.r === 0) &&
            (value?.g || value?.g === 0) &&
            (value?.b || value?.b === 0)),
        'RGB color is invalid'
      );
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
        return invalidResult('Value must be a list');
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
            return withContext(itemResult, `List item ${i} is invalid`);
          }
        }
      }

      return validResult();
    }
    case 'list-of-hashes': {
      const parsedValue: any = maybeParseYaml(value);

      if (!parsedValue || !isArray(parsedValue)) {
        return invalidResult('Value must be a list of hashes');
      }

      for (let i = 0; i < parsedValue.length; i++) {
        const item = parsedValue[i];

        if (!size(item)) {
          return invalidResult(`Hash at index ${i} must not be empty`);
        }

        const itemResult = validateFieldWithResult('hash', item);

        if (!itemResult.isValid) {
          return withContext(itemResult, `Hash at index ${i} is invalid`);
        }
      }

      return validResult();
    }
    case 'mapper-code': {
      if (!value) {
        return invalidResult('Mapper code is required');
      }
      // Split the value
      const [code, method] = value.split('::');
      // Both fields need to be strings & filled
      const codeResult = validateFieldWithResult('string', code);

      if (!codeResult.isValid) {
        return withContext(codeResult, 'Mapper code is invalid');
      }

      const methodResult = validateFieldWithResult('string', method);

      if (!methodResult.isValid) {
        return withContext(methodResult, 'Mapper method is invalid');
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
        return invalidResult('Variable type is invalid');
      }

      const nameResult = validateFieldWithResult('string', varAction.var_name, {
        has_to_have_value: true,
      });

      if (!nameResult.isValid) {
        return withContext(nameResult, 'Variable name is invalid');
      }

      const actionResult = validateFieldWithResult('string', varAction.action_type, {
        has_to_have_value: true,
      });

      if (!actionResult.isValid) {
        return withContext(actionResult, 'Variable action type is invalid');
      }

      // If the action type is transaction, the transaction_action needs to be set
      if (varAction.action_type === 'transaction') {
        const transactionResult = validateFieldWithResult('string', varAction.transaction_action, {
          has_to_have_value: true,
        });

        if (!transactionResult.isValid) {
          return withContext(transactionResult, 'Transaction action is invalid');
        }

        return validResult();
      }

      // If the variable data is missing
      if (!field?.variableData?.value) {
        return invalidResult('Variable data is missing');
      }

      // Get the variable data
      const variableData: TVariableActionValue = {
        ...value,
        ...field.variableData.value,
      };

      return withContext(
        validateFieldWithResult(varAction.action_type, variableData, field),
        'Variable action is invalid'
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
        return invalidResult('Provider value is invalid');
      }

      // Api call only supports  requests / response
      if (type === 'api-call' && !value.supports_request) {
        return invalidResult('API call must support requests');
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
        return invalidResult('Variable provider must support at least one action');
      }

      // Send message only supports messages
      if (
        type === 'send-message' &&
        (!newValue.supports_messages || !newValue.message_id || !newValue.message)
      ) {
        return invalidResult('Send message provider must include message id and content');
      }

      if (newValue.message_id) {
        const messageIdResult = validateFieldWithResult('string', newValue.message_id);

        if (!messageIdResult.isValid) {
          return withContext(messageIdResult, 'Message id is invalid');
        }

        if (!newValue.message) {
          return invalidResult('Message content is missing');
        }

        const messageResult = validateFieldWithResult(
          newValue.message.type,
          newValue.message.value
        );

        if (!messageResult.isValid) {
          return withContext(messageResult, 'Message content is invalid');
        }
      }

      if (newValue.use_args) {
        if (newValue.args?.type !== 'nothing') {
          if (!newValue.args) {
            return invalidResult('Arguments are missing');
          }

          const argsResult = validateFieldWithResult(
            newValue.args.type === 'hash' ? 'system-options' : newValue.args.type,
            newValue.args.value
          );

          if (!argsResult.isValid) {
            return withContext(argsResult, 'Arguments are invalid');
          }
        }
      }

      if (
        (type === 'search-single' || type === 'search') &&
        size(newValue.search_args) !== 0 &&
        !validateFieldWithResult('system-options-with-operators', newValue.search_args).isValid
      ) {
        return invalidResult('Search arguments are invalid');
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
          return invalidResult('Update/create arguments are invalid');
        }

        if (`${type}_args_freeform` in newValue && areFreeFormArgsInvalid && areNormalArgsInvalid) {
          return invalidResult('Update/create arguments are invalid');
        }
      }

      if (newValue?.type === 'factory') {
        if (newValue.optionsChanged) {
          return invalidResult('Factory options are not saved');
        }

        let options = true;

        if (newValue.options) {
          options = validateFieldWithResult('system-options', newValue.options).isValid;
        }

        // Type path and name are required
        return resultFromBoolean(
          !!(newValue.type && newValue.name && options),
          'Factory provider is incomplete'
        );
      }

      if (newValue.record_requires_search_options && newValue.searchOptionsChanged) {
        return invalidResult('Search options must be saved');
      }

      if (
        newValue.search_options &&
        !validateFieldWithResult('system-options', newValue.search_options).isValid
      ) {
        return invalidResult('Search options are invalid');
      }

      return resultFromBoolean(
        !!(newValue.type && newValue.name),
        'Provider type and name required'
      );
    }
    case 'context-selector': {
      if (isString(value)) {
        const cont: string[] = value.split(':');
        const contextResult = validateFieldWithResult('string', cont[0]);

        if (!contextResult.isValid) {
          return withContext(contextResult, 'Context selector prefix is invalid');
        }

        const nameResult = validateFieldWithResult('string', cont[1]);

        if (!nameResult.isValid) {
          return withContext(nameResult, 'Context selector name is invalid');
        }

        return validResult();
      }
      return resultFromBoolean(
        !!value?.iface_kind && !!value?.name,
        'Context selector requires iface_kind and name'
      );
    }
    case 'service-event': {
      const typeResult = validateFieldWithResult('type-selector', value);

      if (!typeResult.isValid) {
        return withContext(typeResult, 'Service event type is invalid');
      }

      if (
        !size(value.handlers) ||
        !every(
          value.handlers,
          (handler: any) => (handler.type === 'fsm' || handler.type === 'method') && handler.value
        )
      ) {
        return invalidResult('Service event handlers are invalid');
      }

      return validResult();
    }
    case 'service-events': {
      if (!isArray(value) || !size(value)) {
        return invalidResult('At least one service event is required');
      }

      for (let i = 0; i < value.length; i++) {
        const serviceEventResult = validateFieldWithResult('service-event', value[i]);

        if (!serviceEventResult.isValid) {
          return withContext(serviceEventResult, `Service event ${i} is invalid`);
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
        return invalidResult('Webhook name, method and auth are required');
      }

      if (value.handler) {
        if (value.handler.type !== 'fsm' && value.handler.type !== 'method') {
          return invalidResult('Webhook handler type is invalid');
        }

        const handlerResult = validateFieldWithResult('string', value.handler.value);

        if (!handlerResult.isValid) {
          return withContext(handlerResult, 'Webhook handler value is invalid');
        }
      }

      return validResult();
    }
    case 'service-webhooks': {
      if (!isArray(value) || !size(value)) {
        return invalidResult('At least one webhook is required');
      }

      for (let i = 0; i < value.length; i++) {
        const webhookResult = validateFieldWithResult('service-webhook', value[i]);

        if (!webhookResult.isValid) {
          return withContext(webhookResult, `Service webhook ${i} is invalid`);
        }
      }

      return validResult();
    }
    case 'auto':
    case 'any': {
      let yamlCorrect = true;
      let parsedData: any;
      try {
        parsedData = jsyaml.load(value);
      } catch (e) {
        yamlCorrect = false;
      }

      if (!yamlCorrect) {
        return invalidResult('Value is not valid YAML');
      }

      if (parsedData) {
        return withContext(
          validateFieldWithResult(getTypeFromValue(parsedData), value),
          'Auto-detected type is invalid'
        );
      }

      return invalidResult('Value is empty');
    }
    case 'processor': {
      if (!value || !value['processor-input-type'] || !value['processor-output-type']) {
        return invalidResult('Processor input and output types are required');
      }
      // Validate the input and output types
      if (value?.['processor-input-type']) {
        const inputResult = validateFieldWithResult(
          'type-selector',
          value?.['processor-input-type']
        );

        if (!inputResult.isValid) {
          return withContext(inputResult, 'Processor input type is invalid');
        }
      }

      if (value?.['processor-output-type']) {
        const outputResult = validateFieldWithResult(
          'type-selector',
          value?.['processor-output-type']
        );

        if (!outputResult.isValid) {
          return withContext(outputResult, 'Processor output type is invalid');
        }
      }

      return validResult();
    }
    case 'processor-mappings': {
      // processor-mappings is an array of field mappings
      // Each mapping must have an outputPath (the target field being mapped)
      // and either an inputPath (source field) or options configured
      if (!isArray(value)) {
        return canBeNull ? validResult() : invalidResult('Processor mappings must be a list');
      }

      for (let i = 0; i < value.length; i++) {
        const mapping = value[i];

        if (!mapping || !isObject(mapping)) {
          return invalidResult(`Mapping at index ${i} is invalid`);
        }

        // outputPath is always required - it identifies which output field is being mapped
        const outputPathResult = validateFieldWithResult('string', mapping.outputPath);

        if (!outputPathResult.isValid) {
          return withContext(outputPathResult, `Mapping ${i} output path is invalid`);
        }

        // A mapping must have either an inputPath or options (or both)
        const hasInputPath = mapping.inputPath && mapping.inputPath !== '';
        const hasOptions = mapping.options && size(mapping.options) > 0;

        if (!hasInputPath && !hasOptions) {
          return invalidResult(
            `Mapping for "${mapping.outputPath}" must have an input path or options configured`
          );
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
        return canBeNull ? validResult() : invalidResult('Tool catalog must be a list');
      }

      for (let i = 0; i < value.length; i++) {
        const selector = value[i];
        if (typeof selector !== 'string' || selector.length === 0) {
          return invalidResult(`Tool selector at index ${i} must be a non-empty string`);
        }
      }

      return validResult();
    }
    case 'fsm-list': {
      if (!isArray(value)) {
        return invalidResult('FSM list must be an array');
      }

      for (let i = 0; i < value.length; i++) {
        const itemResult = validateFieldWithResult('string', value[i]?.name);

        if (!itemResult.isValid) {
          return withContext(itemResult, `FSM entry ${i} name is invalid`);
        }
      }

      return validResult();
    }
    case 'api-manager': {
      if (!value) {
        return invalidResult('API manager value is missing');
      }

      const factoryResult = validateFieldWithResult('string', value.factory);

      if (!factoryResult.isValid) {
        return withContext(factoryResult, 'API manager factory is invalid');
      }

      const endpointsResult = validateFieldWithResult('api-endpoints', value.endpoints);

      if (!endpointsResult.isValid) {
        return withContext(endpointsResult, 'API manager endpoints are invalid');
      }

      return validResult();
    }
    case 'api-endpoints': {
      if (!isArray(value) || !size(value)) {
        return invalidResult('At least one API endpoint is required');
      }

      for (let i = 0; i < value.length; i++) {
        const endpointResult = validateFieldWithResult('string', value[i]?.value);

        if (!endpointResult.isValid) {
          return withContext(endpointResult, `Endpoint ${i} value is invalid`);
        }

        const authorizationResult = validateFieldWithResult(
          'api-endpoint-authorization',
          value[i]?.authorization,
          undefined,
          true
        );

        if (!authorizationResult.isValid) {
          return withContext(authorizationResult, `Endpoint ${i} authorization is invalid`);
        }
      }

      return validResult();
    }
    case 'api-endpoint-authorization': {
      if (!value) {
        return canBeNull ? validResult() : invalidResult('Authorization override is missing');
      }

      if (typeof value !== 'object' || isArray(value)) {
        return invalidResult('Authorization override must be an object');
      }

      if (value.mode !== undefined && !['merge', 'replace'].includes(value.mode)) {
        return invalidResult('Authorization mode must be merge or replace');
      }

      if (value.allow_anonymous !== undefined && typeof value.allow_anonymous !== 'boolean') {
        return invalidResult('Authorization allow_anonymous must be a boolean');
      }

      if (value.roles !== undefined) {
        if (!isArray(value.roles)) {
          return invalidResult('Authorization roles must be a list');
        }

        for (let i = 0; i < value.roles.length; i++) {
          const roleResult = validateFieldWithResult('string', value.roles[i]);

          if (!roleResult.isValid) {
            return withContext(roleResult, `Authorization role ${i} is invalid`);
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
            return invalidResult('Options are required');
          }

          return validResult();
        }

        // Check if all required options are resolved by the current values
        const [unresolvedRequiredOption] = getUnresolvedRequiredOptions(optionSchema, options);

        if (unresolvedRequiredOption) {
          return unresolvedRequiredOption.validation
            ? withContext(
                unresolvedRequiredOption.validation,
                `Option ${unresolvedRequiredOption.name} is invalid`
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

          if (
            (optionSchema?.[option] as TQorusFormFieldSchema)?.depends_on &&
            !hasAllDependenciesFullfilled(
              (optionSchema[option] as TQorusFormFieldSchema).depends_on,
              options,
              optionSchema
            )
          ) {
            return invalidResult(`Option ${option} dependencies are not fulfilled`);
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
            return withContext(optionResult, `Option ${option} is invalid`);
          }
        }

        return validResult();
      };

      if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const optionResult = getIsValid(value[i], field?.optionSchema);

          if (!optionResult.isValid) {
            return withContext(optionResult, `Option set ${i} is invalid`);
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

          return invalidResult('Options with operators are required');
        }

        for (const option of Object.keys(val)) {
          const optionData = val[option];
          const optionResult =
            typeof optionData !== 'object'
              ? validateFieldWithResult(getTypeFromValue(optionData), optionData)
              : validateFieldWithResult(optionData.type, optionData.value);

          if (!optionResult.isValid) {
            return withContext(optionResult, `Option ${option} is invalid`);
          }

          if (
            !optionData.op ||
            !fixOperatorValue(optionData.op).every(
              (operator) => validateFieldWithResult('string', operator).isValid
            )
          ) {
            return invalidResult(`Operators for option ${option} are invalid`);
          }
        }

        return validResult();
      };

      if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const optionResult = isValid(value[i]);

          if (!optionResult.isValid) {
            return withContext(optionResult, `Option set ${i} is invalid`);
          }
        }

        return validResult();
      }

      return isValid(value);
    }
    case 'byte-size': {
      if (typeof value !== 'string') return invalidResult('Byte size must be a string');

      const [bytes, sizeUnit] = splitByteSize(value);

      const bytesResult = validateFieldWithResult('number', bytes);

      if (!bytesResult.isValid) {
        return withContext(bytesResult, 'Byte size numeric part is invalid');
      }

      const sizeResult = validateFieldWithResult('string', sizeUnit);

      if (!sizeResult.isValid) {
        return withContext(sizeResult, 'Byte size unit is invalid');
      }

      return validResult();
    }
    case 'timeout': {
      // An integer count of milliseconds — the unit selector is display-only,
      // so the stored value validates as an int.
      const msResult = validateFieldWithResult('int', value);

      if (!msResult.isValid) {
        return withContext(msResult, 'Timeout must be a whole number of milliseconds');
      }

      return validResult();
    }
    case 'url':
    case 'uri': {
      const protocolResult = validateFieldWithResult('string', getProtocol(value));

      if (!protocolResult.isValid) {
        return withContext(protocolResult, 'URL protocol is invalid');
      }

      const addressResult = validateFieldWithResult('string', getAddress(value));

      if (!addressResult.isValid) {
        return withContext(addressResult, 'URL address is invalid');
      }

      return validResult();
    }
    case 'schema-definition': {
      // The minimal NEW_FIELD.md shape check, so malformed definitions can't
      // silently save through FormEngine.
      if (!isObject(value)) {
        return invalidResult('Schema definition must be an object');
      }
      if (!isObject((value as { schema?: unknown }).schema)) {
        return invalidResult('Schema definition must contain a `schema` section');
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
        return invalidResult('Expression value is empty');
      }

      if (!castedValue.value?.exp) {
        return invalidResult('Expression operation is required');
      }

      // Everything past this point needs the expression's definition, which
      // only the catalogue can supply. Until it loads there is nothing to check
      // against, so an expression that names an operation is left alone rather
      // than reported against a catalogue we do not have.
      if (!size(expressions)) {
        return validResult();
      }

      // Get the expression definition from the catalogue
      const expressionDefinition = expressions.find(
        (expr: any) => expr.name === castedValue.value?.exp
      );

      if (!expressionDefinition) {
        return invalidResult(`Expression definition ${String(castedValue.value?.exp)} not found`);
      }

      // If the expression has no required args, we can consider it valid
      const hasRequiredArgs = expressionDefinition.args?.some((arg: any) => arg.required);

      if (!hasRequiredArgs && size(castedValue.value?.args || []) === 0) {
        return validResult();
      }

      // If there are no args provided but the expression requires some (normal expressions require at least 1 arg
      // because we checked for required args earlier), or min_args is set
      if (size(castedValue.value?.args || []) < (expressionDefinition.min_args || 1)) {
        return invalidResult('Not enough arguments provided');
      }

      // Now we need to validate each argument, either as a normal value or as a sub-expression
      const args = castedValue.value?.args ?? [];

      for (let index = 0; index < args.length; index++) {
        const argValue: any = args[index];
        const argDefinition = expressionDefinition.varargs
          ? expressionDefinition.args[0]
          : expressionDefinition.args[index];

        if (!argValue?.value && !argDefinition?.required) {
          continue;
        }

        if (argValue?.is_expression) {
          const result = validateFieldWithResult('expression', argValue, {
            expressions,
            has_to_have_value: argDefinition?.required,
          });

          if (!result.isValid) {
            return withContext(
              result,
              `Sub-expression for argument ${index + 1} ("${argDefinition?.display_name}") is invalid`
            );
          }

          continue;
        }

        const result = validateFieldWithResult(argValue.type, argValue.value, {
          expressions,
          allowed_values: argDefinition?.allowed_values,
          element_allowed_values: argDefinition?.element_allowed_values,
          has_to_have_value: argDefinition?.required,
        });

        if (!result.isValid) {
          return withContext(
            result,
            `Value for argument ${index + 1} ("${argDefinition?.display_name}") is invalid`
          );
        }
      }

      return validResult();
    }
    case 'nothing':
      return invalidResult('Nothing is not a valid value');
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

// Memoized version
export const validateFieldWithResult: (
  type: string,
  value?: any,
  field?: IFieldValidationProps,
  canBeNull?: boolean
) => IValidationResult = memoize(
  _validateField,
  (type, value, field, canBeNull) =>
    `${type}-${JSON.stringify(value)}-${JSON.stringify(field)}-${canBeNull}`
);

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

export const validateOptionWithRequiredGroups = (
  options: TQorusForm,
  schema: IQorusFormSchema,
  groups: string[]
): boolean => {
  if (groups) {
    const optionsInGroups = getOptionsFromRequiredGroups(schema, groups);
    return optionsInGroups.some((option) =>
      isValueDefined(
        ((schema[option] as TQorusFormFieldSchema)?.ui_type as string) ||
          ((schema[option] as TQorusFormFieldSchema)?.type as string),
        options?.[option]?.value
      )
    );
  }

  return true;
};

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
      return `Option ${name} dependencies are not fulfilled`;
    case 'invalid':
      return `Option ${name} is invalid`;
    default:
      return (optionSchema?.[name] as TQorusFormFieldSchema)?.required
        ? `Option ${name} is required`
        : `Option ${name} requires a value`;
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

export const hasAllDependenciesFullfilled = (
  dependencies: string[] | string[][],
  options: TQorusForm,
  optionsSchema?: IQorusFormSchema
): boolean => {
  if (size(dependencies) === 0) {
    return true;
  }

  return dependencies.every((dependency: string | string[]) => {
    if (isArray(dependency)) {
      return (dependency as string[]).some((dep) => {
        return options?.[dep]
          ? validateField(options[dep].type, options[dep].value, {
              ...(optionsSchema?.[dep] as unknown as IFieldValidationProps),
              options,
              optionSchema: optionsSchema,
            })
          : true;
      });
    }

    if (isString(dependency)) {
      const eqIdx = (dependency as string).indexOf('=');
      if (eqIdx !== -1) {
        const depName = (dependency as string).substring(0, eqIdx);
        const depValue = (dependency as string).substring(eqIdx + 1);
        const optValue = options?.[depName]?.value;
        return optValue != null && String(optValue) === depValue;
      }
    }

    return options?.[dependency as string]
      ? validateField(
          options[dependency as string].type,
          options[dependency as string].value,
          {
            ...(optionsSchema?.[dependency as string] as unknown as IFieldValidationProps),
            options,
            optionSchema: optionsSchema,
          }
        )
      : true;
  });
};
