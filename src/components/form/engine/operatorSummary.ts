// Copyright 2026 Qore Technologies, s.r.o.
import { isValueTemplate } from '../../../helpers/templates';

/** An operator as the server describes it: its key's entry in the form's `operators`. */
interface IOperatorName {
  name?: string;
  display_name?: string;
}

/**
 * What an option compared by an operator says, in names: `Status equals (==) "COMPLETE"`.
 *
 * The option by its display name, each operator by the server's `display_name`, and the value as the row reads
 * it, text in quotes. It was `WHERE status IS equals "COMPLETE"`: keywords no form uses, the option's key, the
 * operator's key and the value written as JSON (qorus#646, David: "what is this expression, and what is
 * 'is equals'?").
 */
export const operatorSummary = ({
  label,
  operatorKeys,
  operators,
  value,
  shown,
}: {
  /** The option's display name. */
  label: string;
  /** The operators chosen, outermost first, by their keys in `operators`. */
  operatorKeys: (string | null | undefined)[];
  operators?: Record<string, IOperatorName | undefined>;
  /** The value held, to tell text (quoted) from a number, a yes/no or a field (as they are). */
  value: unknown;
  /** The value as the row reads it (`formatOptionValue`). */
  shown: string;
}): string => {
  const named = operatorKeys
    .filter((key): key is string => typeof key === 'string' && key !== '')
    .map((key) => operators?.[key]?.display_name || operators?.[key]?.name || key);
  const isText = (typeof value === 'string' && !isValueTemplate(value)) || Array.isArray(value);
  const said =
    shown === '' ? ''
    : isText ? `"${shown}"`
    : shown;
  return [label, ...named, said].filter(Boolean).join(' ');
};
