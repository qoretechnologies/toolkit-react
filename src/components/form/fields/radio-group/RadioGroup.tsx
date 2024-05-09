import { ReqoreRadioGroup } from '@qoretechnologies/reqore';
import { IReqoreRadioGroupProps } from '@qoretechnologies/reqore/dist/components/RadioGroup';

export interface IRadioGroupFormFieldProps
  extends Omit<IReqoreRadioGroupProps, 'onChange' | 'onSelectClick' | 'selected'> {
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

export const FormRadioGroupField = ({
  items,
  disabled,
  onChange,
  value,
  ...rest
}: IRadioGroupFormFieldProps) => {
  return (
    <ReqoreRadioGroup
      items={items.map((item) => ({
        margin: 'right',
        labelEffect: {
          spaced: 1,
          weight: 'bold',
          uppercase: true,
          textSize: 'small',
        },
        ...item,
        disabled: disabled || item.disabled,
      }))}
      disabled={disabled}
      onSelectClick={onChange}
      selected={value}
      {...rest}
    />
  );
};

export default FormRadioGroupField;
