import FormBooleanField, { IBooleanFormFieldProps } from './boolean/Boolean';
import FormNumberField from './number/Number';
import { FormStringField, IStringFormFieldProps } from './string/String';
import { TFormFieldType, TFormFieldValueType } from '../../../types/Form';
import FormColorField, { IColorFormFieldProps } from './color/Color';
import FormRadioGroupField, { IRadioGroupFormFieldProps } from './radio-group/RadioGroup';

export interface IFormFieldProps<T extends TFormFieldType = TFormFieldType> {
  type?: T;
  value: TFormFieldValueType<T>;
  onChange: (value: TFormFieldValueType<T>, event?: unknown) => void;

  validateSelf?: boolean;
  onValidateChange?: (isValid: boolean) => void;

  fieldProps?: Omit<
    T extends 'string' ? IStringFormFieldProps
    : T extends 'boolean' ? IBooleanFormFieldProps
    : T extends 'radio' ? IRadioGroupFormFieldProps
    : T extends 'color' ? IColorFormFieldProps
    : any,
    'value' | 'onChange'
  >;
}
export const FormField = <T extends TFormFieldType>({
  type,
  onChange,
  value,
  fieldProps,
  ...rest
}: IFormFieldProps<T>) => {
  const handleChange = (value: TFormFieldValueType<T>, event?: unknown) => {
    onChange(value, event);
  };

  const renderField = (type: T) => {
    switch (type) {
      case 'string':
        return (
          <FormStringField
            {...rest}
            {...fieldProps}
            onChange={(value: string) => handleChange(value as TFormFieldValueType<T>)}
            value={value as TFormFieldValueType<T>}
          />
        );

      case 'boolean':
        return (
          <FormBooleanField
            {...rest}
            {...fieldProps}
            checked={value as boolean}
            onChange={(checked) => {
              handleChange(checked as TFormFieldValueType<T>);
            }}
          />
        );

      case 'number':
        return (
          <FormNumberField
            {...rest}
            {...fieldProps}
            value={value as number}
            onChange={(value) => {
              handleChange(value as TFormFieldValueType<T>);
            }}
          />
        );

      case 'color':
        return (
          <FormColorField
            {...rest}
            {...fieldProps}
            value={value as IColorFormFieldProps['color']}
            onChange={(color) => {
              handleChange(color as TFormFieldValueType<T>);
            }}
          />
        );

      case 'radio':
        return (
          <FormRadioGroupField
            {...rest}
            {...(fieldProps as IFormFieldProps<'radio'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
          />
        );

      default:
        return null;
    }
  };

  return renderField(type);
};
