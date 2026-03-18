import { DatePicker, useReqoreTheme } from '@qoretechnologies/reqore';
import { IDatePickerProps, TDateValue } from '@qoretechnologies/reqore/dist/components/DatePicker';

export interface IDateFormFieldProps extends Omit<IDatePickerProps<TDateValue>, 'onChange' | 'value'> {
  value?: string | Date;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const toFullIso = (value?: string | Date): string | Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  // DatePicker requires a full ISO 8601 datetime string — append time if only a date is given
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}.000Z`;
  return value;
};

export const DateFormField = ({ value, onChange, disabled, ...rest }: IDateFormFieldProps) => {
  const theme = useReqoreTheme();

  const handleChange = (date: TDateValue): void => {
    onChange?.(date as string);
  };

  return (
    <DatePicker
      {...rest}
      style={{ width: '100%' }}
      value={toFullIso(value) as TDateValue}
      onChange={handleChange}
      customTheme={theme}
      isDisabled={disabled}
    />
  );
};

export default DateFormField;
