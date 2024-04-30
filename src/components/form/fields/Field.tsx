import { TFormFieldType, TFormFieldValueType } from '../../../types/Form';
import { FormStringField } from './string/String';

export interface IFormFieldProps<T extends TFormFieldType = TFormFieldType> {
  type?: T;
  value: TFormFieldValueType<T>;
  onChange: (value: TFormFieldValueType<T>, event?: unknown) => void;

  validateSelf?: boolean;
  onValidateChange?: (isValid: boolean) => void;
}

export const FormField = <T extends TFormFieldType>({
  type,
  onChange,
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
            onChange={(value: string) => handleChange(value as TFormFieldValueType<T>)}
          />
        );
      default:
        return null;
    }
  };

  return renderField(type);
};
