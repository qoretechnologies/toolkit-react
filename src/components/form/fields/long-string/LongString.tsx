import { ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useCallback } from 'react';
import { TFormFieldValueType } from '../../../../types/Form';

export interface ILongStringFormFieldProps extends Omit<IReqoreTextareaProps, 'onChange'> {
  onChange?: (
    value?: TFormFieldValueType<'string'>,
    event?: React.FormEvent<HTMLTextAreaElement>
  ) => void;
}

export const LongStringFormField = ({
  onChange,
  onClearClick,
  ...rest
}: ILongStringFormFieldProps) => {
  const handleClearClick = useCallback(() => {
    onClearClick?.();
    onChange?.('');
  }, [onClearClick, onChange]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(event.currentTarget.value, event);
    },
    [onChange]
  );

  return (
    <ReqoreTextarea
      scaleWithContent
      fluid
      onClearClick={handleClearClick}
      onChange={handleChange}
      rows={4}
      {...rest}
    />
  );
};

export default LongStringFormField;
