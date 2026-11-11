import { ReqoreRadioGroup } from '@qoretechnologies/reqore';
import { IReqoreRadioGroupProps } from '@qoretechnologies/reqore/dist/components/RadioGroup';
import { useMemo } from 'react';
import { useIsCalmForm } from '../../engine/formAppearance';
import { choicePictureState, pictureBesideTheName } from '../allowed-values/choicePicture';

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
  const calm = useIsCalmForm();
  const items: IReqoreRadioGroupProps['items'] = useMemo(
    () =>
      _items.map((item) => ({
        margin: 'right',
        // Calm: an option's name as written — a choice is read, not shouted.
        labelEffect:
          calm ?
            { textSize: 'small' }
          : {
              spaced: 1,
              weight: 'bold',
              uppercase: true,
              textSize: 'small',
            },
        ...item,
        // a picture beside the name, the radio kept: it says which is chosen without color (qorus#646)
        ...pictureBesideTheName(
          (item as { image?: unknown }).image,
          rest.size || 'normal',
          choicePictureState(
            item.value === value,
            _items.some((choice) => choice.value === value)
          )
        ),
        disabled: disabled || item.disabled,
      })),
    [_items, value, rest.size, calm]
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
