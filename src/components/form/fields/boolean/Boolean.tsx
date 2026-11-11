import { ReqoreCheckbox, ReqoreSpan } from '@qoretechnologies/reqore';
import { IReqoreCheckboxProps } from '@qoretechnologies/reqore/dist/components/Checkbox';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';

export interface IBooleanFormFieldProps extends Omit<IReqoreCheckboxProps, 'onChange'> {
  onChange?(checked: boolean): void;
  /**
   * What `checked` shows is the field's default: nothing has been chosen yet. A quiet "Default" beside the switch
   * says so until it is changed, as the folded row shows the default rather than an answer. Beside it, not in it:
   * the switch's own words are sized for Yes and No.
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
  const feWords = useReqraftLabels().formEngine;
  const toggle: IReqoreCheckboxProps['onClick'] = (event) => {
    onChange(!checked);
    onClick?.(event);
  };

  const control = (
    <ReqoreCheckbox
      checked={checked}
      onClick={toggle}
      asSwitch
      onText={feWords.yes}
      offText={feWords.no}
      checkedIcon='CheckLine'
      uncheckedIcon='CloseLine'
      margin='none'
      {...rest}
    />
  );

  if (!isDefault) {
    return control;
  }

  return (
    <span
      className='reqraft-boolean-default'
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
    >
      {control}
      <ReqoreSpan size='small' effect={{ opacity: 0.6 }}>
        {feWords.defaultMark}
      </ReqoreSpan>
    </span>
  );
};

export default BooleanFormField;
