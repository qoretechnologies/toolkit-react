import { ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import {
  flattenToSingleLine,
  hasLineBreak,
  isSingleLineStringType,
} from '../../../../helpers/singleLineString';
import { useEmittedValues } from '../emittedValues';

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
  /* What this field last TOLD its parent, which is not the same as the value it
     was given. Comparing against the prop loses a clear wherever the parent
     does not feed the value back: the prop stays `undefined`, so emptying the
     text makes `localValue` '' and `value ?? ''` '' too, and the parent never
     learns the field was emptied. Seeded from the initial value so a mount
     reports nothing — an empty field's text is '' and its value `undefined`,
     and reporting that difference marked every form holding an empty text
     field as changed before anyone typed. */
  const lastEmittedRef = useRef<string>(value ?? '');
  /* The emits the parent has not handed back yet. Its echo of an earlier one
     arrives while the next keys are being typed, and copying it over the text
     lost them ("ship-order" typed 150 ms apart became "shp-order"). An echo is
     the parent catching up, not a change; see `EmittedValues`. */
  const emitted = useEmittedValues<string>();

  const emit = useCallback(
    (next: string) => {
      lastEmittedRef.current = next;
      emitted.record(next);
      onChange?.(next);
    },
    [onChange, emitted]
  );

  useEffect(() => {
    const incoming = value ?? '';
    if (emitted.isEcho(incoming)) {
      return;
    }
    if (incoming !== localValue) {
      setLocalValue(incoming);
    }
    // A value from outside is not something to report back to whoever sent it.
    lastEmittedRef.current = incoming;
  }, [value]);

  useDebounce(
    () => {
      if (localValue !== lastEmittedRef.current) {
        emit(localValue);
      }
    },
    100,
    [localValue, emit]
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
    // Reported at once, and recorded like any emit, so the debounce does not
    // report it a second time and its echo is not mistaken for a change.
    emit('');
    onClearClick?.();
  }, [emit, onClearClick]);

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
