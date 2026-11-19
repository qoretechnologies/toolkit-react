import { DatePicker, useReqoreTheme } from '@qoretechnologies/reqore';
import { IDatePickerProps, TDateValue } from '@qoretechnologies/reqore/dist/components/DatePicker';

export interface IDateFormFieldProps extends Omit<IDatePickerProps<TDateValue>, 'onChange' | 'value'> {
  value?: string | Date;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * A plain date: a day with no time and no zone, held as `YYYY-MM-DD` (Reqore's `plainDate`, 0.79+). The value
   * reaches the picker as the day it is: made a full date-time it would be UTC midnight, the day before for anyone
   * west of UTC. On an older Reqore the picker ignores it.
   */
  plainDate?: boolean;
}

const toFullIso = (value?: string | Date): string | Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  // DatePicker requires a full ISO 8601 datetime string — append time if only a date is given
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}.000Z`;
  return value;
};

/**
 * The language a date is written in: the page's own (`<html lang>`, which is the
 * application's interface language), else the browser's preferred language.
 *
 * Reqore's DatePicker, given no locale, takes the first NON-English entry of
 * `navigator.languages`, so a browser set to English with French as its second
 * language showed "jj / mm / aaaa" in an English application.
 */
const pageLocale = (): string | undefined => {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  return typeof navigator !== 'undefined' ? navigator.language : undefined;
};

export const DateFormField = ({
  value,
  onChange,
  disabled,
  locale,
  plainDate,
  ...rest
}: IDateFormFieldProps) => {
  const theme = useReqoreTheme();

  const handleChange = (date: TDateValue): void => {
    onChange?.(date as string);
  };

  return (
    <DatePicker
      {...rest}
      locale={locale ?? pageLocale()}
      style={{ width: '100%' }}
      // a plain date is the day it is (see `plainDate`), never UTC midnight
      value={(plainDate ? (value ?? null) : toFullIso(value)) as TDateValue}
      // spread: the prop is Reqore 0.79's, and the Reqore this builds on may not declare it
      {...(plainDate ? { plainDate } : {})}
      onChange={handleChange}
      customTheme={theme}
      isDisabled={disabled}
    />
  );
};

export default DateFormField;
