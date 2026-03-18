import { ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

export interface ILongStringFormFieldProps extends Omit<IReqoreTextareaProps, 'onChange'> {
  value?: string;
  onChange?: (value: string, event?: ChangeEvent<HTMLTextAreaElement>) => void;
}

export const LongStringFormField = ({
  value,
  onChange,
  onClearClick,
  ...rest
}: ILongStringFormFieldProps) => {
  const [localValue, setLocalValue] = useState<string>(value ?? '');

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  useDebounce(
    () => {
      if (localValue !== value) {
        onChange?.(localValue);
      }
    },
    100,
    [localValue, onChange]
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
    setLocalValue(event.target.value);
  }, []);

  const handleClearClick = useCallback(() => {
    setLocalValue('');
    onChange?.('');
    onClearClick?.();
  }, [onChange, onClearClick]);

  return (
    <ReqoreTextarea
      scaleWithContent
      fluid
      value={localValue}
      onChange={handleChange}
      onClearClick={handleClearClick}
      {...rest}
    />
  );
};

export default LongStringFormField;
