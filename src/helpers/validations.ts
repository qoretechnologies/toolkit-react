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
      const nameValue = value?.name?.value ?? value?.name;
      const contentValue = value?.content?.value ?? value?.content;
      const nameResult = validateFieldWithResult('string', nameValue);
      const contentResult = validateFieldWithResult('string', contentValue);

      if (!nameResult.isValid) {
        return withContext(nameResult, 'File name is invalid');
      }

      if (!contentResult.isValid) {
        return withContext(contentResult, 'File content is invalid');
      }

      return validResult();
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
