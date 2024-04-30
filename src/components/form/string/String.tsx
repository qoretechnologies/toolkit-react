import { ReqoreControlGroup, ReqoreInput, ReqoreTag } from '@qoretechnologies/reqore';
import { IReqoreControlGroupProps } from '@qoretechnologies/reqore/dist/components/ControlGroup';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { ChangeEvent, useCallback } from 'react';

export interface IStringFormFieldProps extends Omit<IReqoreInputProps, 'onChange' | 'value'> {
  sensitive?: boolean;
  value?: string;
  label?: IReqoreTagProps['label'];
  labelPosition?: 'top' | 'left' | 'right' | 'bottom';
  labelProps?: IReqoreTagProps;
  wrapperProps?: IReqoreControlGroupProps;
  onChange?: (value?: string, event?: ChangeEvent<HTMLInputElement>) => void;
}

export const FormStringField = ({
  onChange,
  wrapperProps,
  labelProps,
  label,
  labelPosition = 'top',
  sensitive,
  ...rest
}: IStringFormFieldProps) => {
  // When input value changes
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    event.persist();

    onChange(event.target.value?.toString(), event);
  }, []);

  // Clear the input on reset click
  const handleClearClick = useCallback((): void => {
    onChange('');
  }, []);

  return (
    <ReqoreControlGroup
      stack
      {...wrapperProps}
      vertical={labelPosition === 'bottom' || labelPosition === 'top'}
    >
      {(label || label === 0) && (labelPosition === 'top' || labelPosition === 'left') ? (
        <ReqoreTag label={label} fluid {...labelProps} />
      ) : null}
      <ReqoreInput
        fluid
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
      {(label || label === 0) && (labelPosition === 'bottom' || labelPosition === 'right') ? (
        <ReqoreTag label={label} fluid {...labelProps} />
      ) : null}
    </ReqoreControlGroup>
  );
};
