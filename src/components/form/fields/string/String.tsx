import { ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { ChangeEvent } from 'react';

import { TFormFieldValueType } from '../../../../types/Form';

export interface IStringFormFieldProps extends Omit<IReqoreInputProps, 'onChange' | 'value'> {
  sensitive?: boolean;
  value?: TFormFieldValueType<'string'>;
  onChange?: (value?: TFormFieldValueType<'string'>, event?: ChangeEvent<HTMLInputElement>) => void;
}

export const StringFormField = ({ onChange, sensitive, ...rest }: IStringFormFieldProps) => {
  // When input value changes
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value?.toString(), event);
  };

  // Clear the input on reset click
  const handleClearClick = (): void => {
    onChange('');
  };

  return (
    <ReqoreInput
      wrapperStyle={{
        width: '100%',
      }}
      onFocus={(event) => {
        event.stopPropagation();
        rest?.onFocus?.(event);
      }}
      onClick={(event) => {
        event.stopPropagation();
        rest?.onClick?.(event);
      }}
      onChange={handleChange}
      type={sensitive ? 'password' : 'text'}
      onClearClick={handleClearClick}
      {...rest}
    />
  );
};
