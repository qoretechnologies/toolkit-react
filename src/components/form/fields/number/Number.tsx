import { ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { ChangeEvent, ChangeEventHandler } from 'react';

export interface INumberFormFieldProps
  extends Omit<IReqoreInputProps, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange?(value: number): void;
  // TODO: remove step prop definition, A PR has been submitted on Reqore to address the step prop type issue.
  step?: number;
}

export const FormNumberField = ({
  onChange,
  autoFocus,
  step = 1,
  ...rest
}: INumberFormFieldProps) => {
  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    onChange?.(+event.target.value || 0);
  };

  const handleResetClick = (): void => {
    onChange(0);
  };

  return (
    <ReqoreInput
      wrapperStyle={{
        width: '100px',
      }}
      onChange={handleInputChange}
      type='number'
      onClearClick={handleResetClick}
      focusRules={
        autoFocus
          ? {
              type: 'auto',
              viewportOnly: true,
            }
          : undefined
      }
      // @ts-expect-error A PR has been submitted on Reqore to address the step prop type issue.
      step={step}
      {...rest}
    />
  );
};

export default FormNumberField;
