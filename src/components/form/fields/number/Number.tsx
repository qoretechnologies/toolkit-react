import { ChangeEvent, ChangeEventHandler } from 'react';
import { ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';

export interface INumberFormFieldProps
  extends Omit<IReqoreInputProps, 'value' | 'onChange' | 'type'> {
  value?: number;
  onChange?(value: number): void;
  type?: 'int' | 'float';
}

export const FormNumberField = ({
  onChange,
  autoFocus,
  type = 'int',
  value,
  ...rest
}: INumberFormFieldProps) => {
  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    const value = type === 'int' ? parseInt(event.target.value) : parseFloat(event.target.value);
    onChange?.(value ?? undefined);
  };

  const handleResetClick = (): void => {
    onChange(undefined);
  };

  return (
    <ReqoreInput
      wrapperStyle={{
        width: '100px',
      }}
      value={value ?? ''}
      onChange={handleInputChange}
      type='number'
      onClearClick={handleResetClick}
      focusRules={
        autoFocus ?
          {
            type: 'auto',
            viewportOnly: true,
          }
        : undefined
      }
      // @ts-expect-error A PR has been submitted on Reqore to address the step prop type issue.
      step={type === 'int' ? 1 : 0.1}
      {...rest}
    />
  );
};

export default FormNumberField;
