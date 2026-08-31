/**
 * Which string field types hold one line, and how to keep them that way.
 *
 * The server already draws this distinction and the IDE was throwing it away:
 * a service's `name` is declared `ui_type: "string"` while its `description` is
 * `ui_type: "long-string"` with `markdown: True` (see `ServiceMetadata.qc`).
 * Every one of them — plus `email`, `uuid`, `hostname`, `ipv4`, `ipv6` and
 * `phone` — rendered through the same growing textarea, so a technical name, a
 * version and an IP address all accepted Enter.
 *
 * That is not a cosmetic problem. These values become YAML keys, class names,
 * URLs and identifiers; a newline in one of them is invalid input that the form
 * happily accepted and passed on, and the operator had no way to see it.
 *
 * The rule is the server's own contract, stated once here rather than guessed
 * per field, and it is enforced in `LongString.tsx`.
 *
 * It lives in reqraft rather than in a consumer because the consumer is not the
 * only renderer: qorus-ide fixed this in its OWN long-string field, and every
 * form that goes through FormEngine — which is where an alert rule's Internal
 * Name, Name and Short Description are — reaches THIS one instead. The fix was
 * real and the field in front of the operator still took Enter.
 */

/**
 * The string types that hold exactly one line — the ones routed to a textarea
 * today.
 *
 * Listed explicitly rather than derived by excluding the document types,
 * because the two directions fail very differently. Missing a single-line type
 * here leaves it behaving as it does now — no worse. Wrongly treating a new
 * DOCUMENT type as single-line would flatten a user's text as they typed it,
 * which is data loss. So an unrecognised type stays multi-line.
 */
const SINGLE_LINE_STRING_TYPES = new Set([
  'string',
  'email',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'phone',
]);

/** True when a string field of this type holds a single line. */
export const isSingleLineStringType = (type?: string): boolean =>
  !!type && SINGLE_LINE_STRING_TYPES.has(type);

/**
 * Flattens any line break to a single space.
 *
 * A space rather than nothing, because the newline is usually where a word
 * boundary was — pasting two lines into a name should read as two words, not
 * one run-together one. CR, LF and CRLF all collapse to one space, and the
 * result is trimmed of leading/trailing whitespace the break introduced.
 */
export const flattenToSingleLine = (value: string): string =>
  value.replace(/\r\n|\r|\n/g, ' ').replace(/ {2,}/g, ' ');

/** True when the value carries a line break this field should not hold. */
export const hasLineBreak = (value: string): boolean => /\r|\n/.test(value);
