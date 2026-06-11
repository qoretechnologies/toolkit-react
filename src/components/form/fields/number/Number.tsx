import { ReqoreDropdown, ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
// Const-only usage at render time — the cycle (Number → TemplateField → Number)
// is safe the same way Field → AutoFormField → Field is.
import { TemplatesListProps } from '../template/TemplateField';

export interface INumberFormFieldProps extends Omit<IReqoreInputProps, 'value' | 'onChange' | 'type'> {
  value?: number | string;
  type?: 'int' | 'float';
  onChange?: (value: number | string) => void;
  /** Template values selectable from a focus dropdown (IDE `NumberField` parity). */
  templates?: IReqoreFormTemplates;
}

export const NumberFormField = ({
  onChange,
  autoFocus,
  type = 'int',
  value,
  templates,
  ...rest
}: INumberFormFieldProps) => {
  const [localValue, setLocalValue] = useState<number | string>(value ?? '');

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  useDebounce(
    () => {
      if (localValue !== value) {
        onChange?.(localValue);
      }
    },
    100,
    [localValue, onChange]
  );

  const handleChange = useCallback(
    (rawValue: number | string): void => {
      if (rawValue === '' || rawValue === '-' || rawValue === '-.') {
        setLocalValue(rawValue);
        return;
      }
      const parsed = type === 'int' ? parseInt(rawValue as string, 10) : parseFloat(rawValue as string);
      setLocalValue(isNaN(parsed) ? rawValue : parsed);
    },
    [type]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      handleChange(event.target.value);
    },
    [handleChange]
  );

  const handleResetClick = useCallback((): void => {
    setLocalValue(0);
    onChange?.(0);
  }, [onChange]);

  const focusRules = useMemo(
    () =>
      autoFocus
        ? {
            type: 'auto' as const,
            viewportOnly: true,
          }
        : undefined,
    [autoFocus]
  );

  const handleItemSelect = useCallback((item) => setLocalValue(item.value), []);

  // IDE `NumberField` parity: with templates the input is wrapped in a
  // focus-opened dropdown of the template values.
  if (templates?.items) {
    return (
      <ReqoreDropdown<IReqoreInputProps>
        {...(rest as any)}
        component={ReqoreInput}
        fluid
        icon='MoneyDollarCircleLine'
        items={templates?.items}
        filterable
        value={localValue}
        onItemSelect={handleItemSelect}
        onChange={handleInputChange}
        type='number'
        step={type === 'int' ? 1 : 0.1}
        onClearClick={handleResetClick}
        focusRules={focusRules}
        {...TemplatesListProps}
      />
    );
  }

  return (
    <ReqoreInput
      fluid
      icon='MoneyDollarCircleLine'
      value={localValue}
      onChange={handleInputChange}
      type='number'
      step={type === 'int' ? 1 : 0.1}
      onClearClick={handleResetClick}
      focusRules={focusRules}
      {...rest}
    />
  );
};

export default NumberFormField;
