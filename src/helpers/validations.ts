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
import { getAddress, getProtocol, splitByteSize } from './common';
import { getOptionsFromRequiredGroups } from './options';
import { getTemplateKey, getTemplateValue, isValueTemplate } from './templates';

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
  options?: TQorusForm;
  isFunction?: boolean;
  arg_schema?: IQorusFormSchema;
  ui_element_type?: string;
  element_type?: string;
  allowed_values?: any[];
  disabled?: boolean;
  metadata?: Record<string, any>;
  [key: string]: any;
}

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
  // Expression values (`is_expression`) carry the AST `{ exp, args }` instead
  // of a typed literal — validate that an expression is chosen, not the
  // base type. (`isFunction` is set by FormEngine for expression options.)
  if (field?.isFunction) {
    const ast = (value as { value?: any })?.value ?? value;
    return resultFromBoolean(
      !!(ast as { exp?: string })?.exp,
      'Expression operation is required'
    );
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

  // Check if the field has required groups
  if (field?.required_groups) {
    if (
      !isValueDefined(type, value) &&
      validateOptionWithRequiredGroups(field.options, field.optionSchema, field.required_groups)
    ) {
      return validResult();
    }
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
    case 'binary': {
      if (typeof value !== 'string') {
        return invalidResult('Binary value must be a string');
      }

      const hex = value.trim().replace(/^0x/i, '');

      if (hex.length === 0) {
        return invalidResult('Binary value is empty');
      }

      if (hex.length % 2 !== 0) {
        return invalidResult('Binary hex length must be even');
      }

      if (!/^[0-9a-fA-F]+$/.test(hex)) {
        return invalidResult('Binary value must contain only hex characters');
      }

      return validResult();
    }
    case 'string':
    case 'mapper':
    case 'workflow':
    case 'service':
    case 'job':
    case 'long-string':
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
    case 'multi-select':
    case 'array':
    case 'file-tree':
      return resultFromBoolean(value && value.length > 0, 'At least one value is required');
    case 'cron':
      if (!value) {
        return invalidResult('Cron value is required');
      }
      return resultFromBoolean(isValidCron(value, { alias: true }), 'Cron expression is invalid');
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
            if (parsedValue?.[argName] === undefined) {
              return !fieldData.required;
            }

            return validateFieldWithResult(
              (fieldData.ui_type as string) || (fieldData.type as string),
              parsedValue?.[argName]?.value,
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
            parsedValue[i].value,
            field
          );

          if (!itemResult.isValid) {
            return withContext(itemResult, `List item ${i} is invalid`);
          }
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
    case 'options': {
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

        if (optionSchema) {
          for (const [option, optionData] of Object.entries(optionSchema)) {
            if (
              optionData.required &&
              (!options?.[option] || options?.[option]?.value === undefined)
            ) {
              return invalidResult(`Option ${option} is required`);
            }

            if (
              !options?.[option]?.value &&
              optionData.required_groups &&
              !validateOptionWithRequiredGroups(options, optionSchema, optionData.required_groups)
            ) {
              return invalidResult(`Option ${option} requires a value`);
            }
          }
        }

        for (const option of Object.keys(options)) {
          if (
            optionSchema?.[option]?.depends_on &&
            !hasAllDependenciesFullfilled(optionSchema[option].depends_on, options, optionSchema)
          ) {
            return invalidResult(`Option ${option} dependencies are not fulfilled`);
          }

          if (
            optionSchema?.[option]?.preselected &&
            !optionSchema?.[option]?.required &&
            !options[option]?.value
          ) {
            continue;
          }

          const optionData = options[option];
          const optionResult =
            typeof optionData !== 'object'
              ? validateFieldWithResult(getTypeFromValue(optionData), optionData)
              : validateFieldWithResult(optionData.type, optionData.value, {
                  ...omit(optionSchema?.[option] as any, []),
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
    case 'byte-size': {
      // Ported from qorus-ide validations (`sizeUnit` instead of the IDE's
      // `size`, which would shadow the lodash import here).
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
    case 'url': {
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
      // No IDE counterpart (the editor validates inline there); this is the
      // minimal NEW_FIELD.md shape check so malformed definitions can't
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
      // Ported from qorus-ide validations `'expression'` case. The catalogue
      // is supplied via `field.expressions` (the ExpressionBuilder passes it),
      // not a global store as in the IDE.
      const castedValue = value as {
        value?: { exp?: string; args?: any[] };
        is_expression?: boolean;
        type?: string;
      };
      const expressions: any[] = (field as { expressions?: any[] })?.expressions ?? [];

      // Expressions not loaded yet — skip validation until they're available.
      if (!size(expressions)) {
        return validResult();
      }
      if (!castedValue) {
        return invalidResult('Expression value is empty');
      }
      if (!castedValue.value?.exp) {
        return invalidResult('Expression operation is required');
      }
      const expressionDefinition = expressions.find((expr) => expr.name === castedValue.value?.exp);
      if (!expressionDefinition) {
        return invalidResult(`Expression definition ${String(castedValue.value?.exp)} not found`);
      }
      const hasRequiredArgs = expressionDefinition.args?.some((arg: any) => arg.required);
      if (!hasRequiredArgs && size(castedValue.value?.args || []) === 0) {
        return validResult();
      }
      if (size(castedValue.value?.args || []) < (expressionDefinition.min_args || 1)) {
        return invalidResult('Not enough arguments provided');
      }
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
          } as any);
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
        } as any);
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

export const getTypeFromValue = (value: any): string => {
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
        (schema[option]?.ui_type as string) || (schema[option]?.type as string),
        options?.[option]?.value
      )
    );
  }

  return true;
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
