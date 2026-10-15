// Copyright 2026 Qore Technologies, s.r.o.
import { isEqual } from 'lodash';
import { useCallback, useEffect, useRef } from 'react';
import { useEmittedValues } from '../emittedValues';

const isEmptyValue = (value: unknown) => value === undefined || value === '';

/**
 * The same value, as a host editor would read it: equal, or both no value - `''` and `undefined` are one
 * empty value on its way through a form and back (the form engine stores an emptied field either way, and
 * reads them as one: `normalizeEmptyFieldValues`). `null` is a value of its own, not an empty one.
 */
export const sameHostEditorValue = (a: unknown, b: unknown): boolean =>
  (isEmptyValue(a) && isEmptyValue(b)) || isEqual(a, b);

export interface IHostEditorValue {
  /** What the host editor is handed. */
  value: unknown;
  /** Notes what the host editor reported, before it is sent on. */
  record: (emitted: unknown) => void;
}

/**
 * The value a host editor (`componentOverrides`) is handed: never its own report coming back.
 *
 * A host editor keeps what is being typed and reports it after a pause, and the form hands it back down -
 * sometimes more than once, and not always as it was reported: an emptied field reported `''` came back as
 * `''` and then, once the form had stored it, as `undefined`. A host editor that takes any value it is handed
 * for a change from outside put that in place of what had been typed since: in the Qorus IDE a test case's
 * Value lost the `1` typed after a reference was erased, and Slate, its caret left past the end of the
 * emptied text, threw "Cannot resolve a DOM point" (qorus#646).
 *
 * So the value coming down is compared with what the host editor reported. Its last report, or one still on
 * its way back, is handed down as the host editor reported it - the same value, the same object - and a host
 * editor comparing with what it holds finds nothing changed. Anything else is a change from outside, and is
 * handed down as it is. A change from outside that equals what the host editor reported is indistinguishable
 * from its echo, and is treated as one: harmless, it sets the value the editor already holds.
 */
export const useHostEditorValue = (value: unknown): IHostEditorValue => {
  const inFlight = useEmittedValues<unknown>(sameHostEditorValue);
  const lastReport = useRef<{ value: unknown } | undefined>(undefined);

  const isOwnReport =
    !!lastReport.current &&
    (sameHostEditorValue(value, lastReport.current.value) || inFlight.includes(value));

  useEffect(() => {
    const echo = inFlight.isEcho(value);
    // a value that is no report of the editor's own: there is nothing of its own to hold back any more
    if (!echo && !(lastReport.current && sameHostEditorValue(value, lastReport.current.value))) {
      lastReport.current = undefined;
    }
  }, [JSON.stringify(value)]);

  const record = useCallback(
    (emitted: unknown) => {
      inFlight.record(emitted);
      lastReport.current = { value: emitted };
    },
    [inFlight]
  );

  return { value: isOwnReport ? lastReport.current!.value : value, record };
};
