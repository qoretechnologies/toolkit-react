import { ReqoreRadioGroup } from '@qoretechnologies/reqore';
import { IReqoreRadioGroupProps } from '@qoretechnologies/reqore/dist/components/RadioGroup';
import { useMemo } from 'react';

export interface IRadioGroupFormFieldProps
  extends Omit<IReqoreRadioGroupProps, 'onChange' | 'onSelectClick' | 'selected'> {
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

export const RadioGroupFormField = ({
  items: _items,
  disabled,
  onChange,
  value,
  ...rest
}: IRadioGroupFormFieldProps) => {
  const items: IReqoreRadioGroupProps['items'] = useMemo(
    () =>
      _items.map((item) => ({
        margin: 'right',
        labelEffect: {
          spaced: 1,
          weight: 'bold',
          uppercase: true,
          textSize: 'small',
        },
        ...item,
        disabled: disabled || item.disabled,
      })),
    [_items]
  );

  return (
    <ReqoreRadioGroup
      items={items}
      disabled={disabled}
      onSelectClick={onChange}
      selected={value}
      {...rest}
    />
  );
};

export default RadioGroupFormField;
