import { ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
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
  return (
    <ReqoreTextarea
      scaleWithContent
      fluid
      wrapperStyle={{
        width: '100%',
      }}
      onClearClick={() => {
        onClearClick?.();
        onChange?.('');
      }}
      onChange={(event) => onChange(event.currentTarget.value, event)}
      rows={4}
      {...rest}
    />
  );
};

export default LongStringFormField;
