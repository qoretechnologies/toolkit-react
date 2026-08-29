import { ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import {
  flattenToSingleLine,
  hasLineBreak,
  isSingleLineStringType,
} from '../../../../helpers/singleLineString';

export interface ILongStringFormFieldProps extends Omit<IReqoreTextareaProps, 'onChange'> {
  value?: string;
  onChange?: (value: string, event?: ChangeEvent<HTMLTextAreaElement>) => void;
  /**
   * The field's declared type, which decides whether it holds one line.
   *
   * Without it every string field is a growing textarea, so a technical name, a
   * version and an IP address all accept Enter — and become YAML keys, class
   * names and URLs with a newline in them. See `helpers/singleLineString`.
   */
  type?: string;
}

export const LongStringFormField = ({
  value,
  onChange,
  onClearClick,
  type,
  ...rest
}: ILongStringFormFieldProps) => {
  const [localValue, setLocalValue] = useState<string>(value ?? '');

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

  const singleLine = isSingleLineStringType(type);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      const raw = event.target.value;
      // Flatten here rather than only blocking the Enter key: a line break also
      // arrives by paste, by drag-and-drop, from autofill and from an IME, and
      // a keydown guard catches none of those.
      setLocalValue(singleLine && hasLineBreak(raw) ? flattenToSingleLine(raw) : raw);
    },
    [singleLine]
  );

  // Stop Enter before it inserts anything, so the caret does not jump to a
  // second line that is then flattened away under the cursor.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (singleLine && event.key === 'Enter') {
        event.preventDefault();
      }
      (rest as { onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void }).onKeyDown?.(
        event
      );
    },
    [singleLine, rest.onKeyDown]
  );

  const handleClearClick = useCallback(() => {
    setLocalValue('');
    onChange?.('');
    onClearClick?.();
  }, [onChange, onClearClick]);

  return (
    <ReqoreTextarea
      // A one-line field must not grow, and must not offer a resize grip that
      // implies it can hold more than it will keep.
      scaleWithContent={!singleLine}
      rows={singleLine ? 1 : undefined}
      fluid
      value={localValue}
      onChange={handleChange}
      onClearClick={handleClearClick}
      {...rest}
      onKeyDown={handleKeyDown}
    />
  );
};

export default LongStringFormField;
