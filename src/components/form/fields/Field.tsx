import { TFormFieldType, TFormFieldValueType } from '../../../types/Form';
import BooleanFormField, { IBooleanFormFieldProps } from './boolean/Boolean';
import ColorFormField, { IColorFormFieldProps } from './color/Color';
import LongStringFormField, { ILongStringFormFieldProps } from './long-string/LongString';
import MarkdownFormField, { IMarkdownFormFieldProps } from './markdown/Markdown';
import NumberFormField from './number/Number';
import RadioGroupFormField, { IRadioGroupFormFieldProps } from './radio-group/RadioGroup';
import { IStringFormFieldProps, StringFormField } from './string/String';

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
    : T extends 'longstring' ? ILongStringFormFieldProps
    : T extends 'markdown' ? IMarkdownFormFieldProps
    : never,
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
          <StringFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'string'>['fieldProps'])}
            onChange={(value: string) => handleChange(value as TFormFieldValueType<T>)}
            value={value as TFormFieldValueType<T>}
          />
        );

      case 'boolean':
        return (
          <BooleanFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'boolean'>['fieldProps'])}
            checked={value as boolean}
            onChange={(checked) => {
              handleChange(checked as TFormFieldValueType<T>);
            }}
          />
        );

      case 'number':
        return (
          <NumberFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'number'>['fieldProps'])}
            value={value as number}
            onChange={(value) => {
              handleChange(value as TFormFieldValueType<T>);
            }}
          />
        );

      case 'color':
        return (
          <ColorFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'color'>['fieldProps'])}
            value={value as IColorFormFieldProps['color']}
            onChange={(color) => {
              handleChange(color as TFormFieldValueType<T>);
            }}
          />
        );

      case 'radio':
        return (
          <RadioGroupFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'radio'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
          />
        );

      case 'longstring':
        return (
          <LongStringFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'longstring'>['fieldProps'])}
            value={value as TFormFieldValueType<T>}
            onChange={(selected) => {
              handleChange(selected as TFormFieldValueType<T>);
            }}
          />
        );

      case 'markdown':
        return (
          <MarkdownFormField
            {...rest}
            {...(fieldProps as IFormFieldProps<'markdown'>['fieldProps'])}
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
