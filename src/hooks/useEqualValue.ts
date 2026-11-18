// Copyright 2026 Qore Technologies, s.r.o.
import { isEqual } from 'lodash';
import { useRef } from 'react';

/**
 * The value, as the same reference for as long as it stays equal to what it was.
 *
 * A host writes some props as literals in its render (`cardEditorTypes={[...]}`, `readSummaries={{ ... }}`), so
 * each render of the host hands the form a new array or object that says the same thing. Anything memoized on such a
 * prop was rebuilt on every render of the host: the form's row context was a new value each time, and every row's
 * every selector was asked again (use-context-selector notifies each one). In the Qorus IDE's API schema forms
 * that was a thousand updates for one late render of the page around the form (board t-96, f70).
 *
 * Compared deeply (lodash `isEqual`, functions by reference), which is cheap for what it is used on: lists of names,
 * maps of components, a host's actions.
 */
export const useEqualValue = <T>(value: T): T => {
  const kept = useRef(value);

  if (kept.current !== value && !isEqual(kept.current, value)) {
    kept.current = value;
  }

  return kept.current;
};
