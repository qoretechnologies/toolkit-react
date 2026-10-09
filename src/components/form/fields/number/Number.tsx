import { ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { useEmittedValues } from '../emittedValues';
// Const-only usage at render time — the cycle (Number → TemplateField → Number)
// is safe the same way Field → AutoFormField → Field is.
import { TemplateBrowser } from '../template/TemplateBrowser';
import { TemplatesListProps } from '../template/TemplateField';

export interface INumberFormFieldProps extends Omit<IReqoreInputProps, 'value' | 'onChange' | 'type'> {
  value?: number | string;
  type?: 'int' | 'float';
  onChange?: (value: number | string) => void;
  /** Template values selectable from a focus dropdown (IDE `NumberField` parity). */
  templates?: IReqoreFormTemplates;
  /**
   * The inclusive bounds the schema declares for this field (`MetaFieldInfo::min_value`).
   *
   * Taken under the schema's own names rather than the input's `min` / `max` because the
   * field descriptor is spread onto this component whole, so these arrive here anyway —
   * naming them is what keeps them off the DOM node, where React would warn about an
   * unknown attribute, and lets the spinner agree with the validator instead of offering
   * steps the form is about to refuse.
   */
  min_value?: number;
  max_value?: number;
}

/** A whole number as typed: an optional sign and digits. */
const WHOLE_NUMBER = /^[-+]?\d+$/;
/** A decimal number as typed: an optional sign, digits with a point, and an exponent. */
const DECIMAL_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * What a typed text is: the number it writes, or - when it writes none - the text as typed. A field of a
 * number type is typed freely (David's review of qorus#646): a template (`$local:x`) or an expression
 * (`@qty * 2`) is taken up by the field around it, and anything else is kept as typed for the form to flag
 * as not a number. `parseInt` cut `12abc` to 12 without a word.
 */
export const typedNumber = (text: string, type: 'int' | 'float'): number | string => {
  const trimmed = text.trim();
  return (type === 'int' ? WHOLE_NUMBER : DECIMAL_NUMBER).test(trimmed) ? Number(trimmed) : text;
};

export const NumberFormField = ({
  onChange,
  autoFocus,
  type = 'int',
  value,
  templates,
  min_value,
  max_value,
  ...rest
}: INumberFormFieldProps) => {
  // What is shown is what was typed; what the form gets is the number it writes, or the text when it writes
  // none. Showing the number instead dropped a decimal point mid-typing: `10.` is 10, and `10.9` became `109`.
  const [text, setText] = useState<string>(value === undefined || value === null ? '' : String(value));
  const localValue = text === '' ? '' : typedNumber(text, type);
  // The parent's echo of an emit still in flight is not a change: copying it
  // over the local value lost what was typed since. See `EmittedValues`.
  const emitted = useEmittedValues<number | string | undefined>();

  useEffect(() => {
    if (emitted.isEcho(value)) {
      return;
    }
    if (value !== localValue) {
      setText(value === undefined || value === null ? '' : String(value));
    }
  }, [value]);

  useDebounce(
    () => {
      if (localValue !== emitted.settled(value)) {
        emitted.record(localValue);
        onChange?.(localValue);
      }
    },
    100,
    [localValue, onChange]
  );

  const handleChange = useCallback((rawValue: number | string): void => {
    setText(String(rawValue));
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      handleChange(event.target.value);
    },
    [handleChange]
  );

  const handleResetClick = useCallback((): void => {
    setText('0');
    emitted.record(0);
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

  const handleItemSelect = useCallback((item) => setText(String(item.value)), []);

  // The schema's bounds are the form's to check (a text input has no min or max); they are named in the
  // props only to keep them off the DOM node.
  void min_value;
  void max_value;

  // IDE `NumberField` parity: with templates the input is wrapped in a
  // focus-opened dropdown of the template values.
  if (templates?.items) {
    return (
      // the list a field's templates are browsed in (`TemplateBrowser`): the input keeps the keyboard
      <TemplateBrowser
        {...(rest as any)}
        component={ReqoreInput}
        fluid
        icon='MoneyDollarCircleLine'
        templates={templates}
        value={text}
        onItemSelect={handleItemSelect}
        onChange={handleInputChange}
        // typed freely: a number input drops what is not part of a number, so a template or an expression
        // could not be typed; the keyboard is still a numeric one
        type='text'
        inputMode={type === 'int' ? 'numeric' : 'decimal'}
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
      value={text}
      onChange={handleInputChange}
      // typed freely, on a numeric keyboard (see above)
      type='text'
      inputMode={type === 'int' ? 'numeric' : 'decimal'}
      onClearClick={handleResetClick}
      focusRules={focusRules}
      {...rest}
    />
  );
};

export default NumberFormField;
