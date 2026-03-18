import { DatePicker, useReqoreTheme } from '@qoretechnologies/reqore';
import { IDatePickerProps, TDateValue } from '@qoretechnologies/reqore/dist/components/DatePicker';

export interface IDateFormFieldProps extends Omit<IDatePickerProps<TDateValue>, 'onChange' | 'value'> {
  value?: string | Date;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const DateFormField = ({ value, onChange, disabled, ...rest }: IDateFormFieldProps) => {
  const theme = useReqoreTheme();

  const handleChange = (date: TDateValue): void => {
    onChange?.(date as string);
  };

  return (
    <DatePicker
      {...rest}
      style={{ width: '100%' }}
      value={value ?? null}
      onChange={handleChange}
      customTheme={theme}
      isDisabled={disabled}
    />
  );
};

export default DateFormField;
