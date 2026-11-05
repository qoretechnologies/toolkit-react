import { ReqoreCheckbox } from '@qoretechnologies/reqore';
import { IReqoreCheckboxProps } from '@qoretechnologies/reqore/dist/components/Checkbox';

export interface IBooleanFormFieldProps extends Omit<IReqoreCheckboxProps, 'onChange'> {
  onChange?(checked: boolean): void;
  /**
   * What `checked` shows is the field's default: nothing has been chosen yet. The switch says so ("Yes · default")
   * until it is changed, as the folded row shows the default rather than an answer.
   */
  isDefault?: boolean;
}

/**
 * What a yes / no shows for the value it holds: No for false, Yes for true, and no answer for no value - the
 * switch's unset state, not No (qorus#646, David: an empty yes / no read No while the form asked for a value).
 */
export const yesNoShown = (value: unknown): boolean | undefined =>
  value === undefined || value === null ? undefined : !!value;

export const BooleanFormField = ({
  checked,
  onChange,
  onClick,
  isDefault,
  ...rest
}: IBooleanFormFieldProps) => {
  const toggle: IReqoreCheckboxProps['onClick'] = (event) => {
    onChange(!checked);
    onClick?.(event);
  };

  return (
    <ReqoreCheckbox
      checked={checked}
      onClick={toggle}
      asSwitch
      onText={isDefault && checked ? 'Yes · default' : 'Yes'}
      offText={isDefault && checked === false ? 'No · default' : 'No'}
      checkedIcon='CheckLine'
      uncheckedIcon='CloseLine'
      margin='none'
      {...rest}
    />
  );
};

export default BooleanFormField;
