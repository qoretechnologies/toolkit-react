import { ReqoreCheckbox } from '@qoretechnologies/reqore';
import { IReqoreCheckboxProps } from '@qoretechnologies/reqore/dist/components/Checkbox';

export interface IBooleanFormFieldProps extends Omit<IReqoreCheckboxProps, 'onChange'> {
  onChange?(checked: boolean): void;
}

export const FormBooleanField = ({
  checked,
  onChange,
  onClick,
  ...rest
}: IBooleanFormFieldProps) => {
  const toggle: IReqoreCheckboxProps['onClick'] = (event) => {
    onChange(!checked);
    onClick?.(event);
  };

  return (
    <ReqoreCheckbox
      checked={checked ?? false}
      onClick={toggle}
      asSwitch
      onText='Yes'
      offText='No'
      checkedIcon='CheckLine'
      uncheckedIcon='CloseLine'
      margin='none'
      {...rest}
    />
  );
};

export default FormBooleanField;
