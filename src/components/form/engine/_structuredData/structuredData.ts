import yaml from 'js-yaml';

// Ported from qorus-ide's `helpers/date` (moment-based) as a native-Date
// formatter so this copy carries no extra dependency. Same output shape:
// `YYYY-MM-DD HH:mm:ss` (with `.SSS` only when sub-second precision exists).
const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
export const formatIdeTimestamp = (value: string | number | Date): string => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === 'string' ? value : String(value);
  }
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return d.getMilliseconds() ? `${base}.${pad(d.getMilliseconds(), 3)}` : base;
};

export interface IUiEncodedValue {
  type: string;
  value: unknown;
  display_name?: string;
  short_desc?: string;
  desc?: string;
  ui_type?: string;
}

// The keys a Qorus UI-encoded value envelope may carry — exported as the
// `allowedKeys` allow-list for `ReqoreDataView`'s envelope matcher.
export const UI_ENVELOPE_KEY_LIST: ReadonlyArray<string> = [
  'allowed_values',
  'default',
  'default_value',
  'desc',
  'display_name',
  'readonly',
  'required',
  'sensitive',
  'short_desc',
  'type',
  'ui_type',
  'value',
];

const UI_ENVELOPE_KEYS = new Set(UI_ENVELOPE_KEY_LIST);

const QORUS_DATE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:\s+[A-Za-z]{3})?(?:\s+([+-]\d{2}):?(\d{2}))?(?:\s+\([^)]+\))?$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isStructuredContainerValue = (value: unknown): boolean =>
  Array.isArray(value) || isRecord(value);

/**
 * A field the form materialised but left UNSET: `{type: 'int'}`, no `value` key.
 *
 * `fixOptions` omits the key entirely when the value is undefined, so this is
 * what an untouched sub-field of a schema-declared hash looks like on the wire.
 * It is an EMPTY ENVELOPE, never content — and every renderer has to agree on
 * that, because the ones that do not count the envelope's own `type` key and
 * report an unset field as "1 field" while the sub-form correctly says 0 set.
 *
 * Deliberately separate from {@link isUiEncodedValue}, which requires a `value`
 * and therefore cannot see this shape. Callers gate on knowing the field is
 * schema-declared: without a schema saying so, a `{type: …}` object could
 * legitimately be somebody's data.
 */
export const isEmptyUiEnvelope = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  !('value' in value) &&
  Object.keys(value).every((key) => UI_ENVELOPE_KEYS.has(key));

export const isUiEncodedValue = (value: unknown): value is IUiEncodedValue => {
  if (!isRecord(value) || typeof value.type !== 'string' || !('value' in value)) {
    return false;
  }

  return Object.keys(value).every((key) => UI_ENVELOPE_KEYS.has(key));
};

const normalizeYamlText = (text: string): string =>
  text
    .trim()
    .replace(/^%YAML\s+([0-9]+(?:\.[0-9]+)?)\s+---\s*/i, '%YAML $1\n---\n')
    .replace(/^---\s+([{[])/, '---\n$1');

const YAML_EMBEDDED_START_PATTERN = /%YAML\b|---\s*(?:[{[])?/i;
const STRUCTURED_TEXT_START_PATTERN = /^(%YAML\b|---\b|[{[])/i;

const normalizeEmbeddedStructuredText = (text: string): string =>
  text
    .trim()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

const parseStructuredCandidate = (candidate: string): unknown | undefined => {
  try {
    const parsed = yaml.load(normalizeYamlText(candidate));
    return isStructuredContainerValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const parseSerializedStructuredText = (
  value: string
): { prefix?: string; data: unknown } | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (STRUCTURED_TEXT_START_PATTERN.test(trimmed)) {
    const direct = parseStructuredCandidate(trimmed);
    if (direct !== undefined) return { data: direct };
  }

  const embeddedIndex = trimmed.search(YAML_EMBEDDED_START_PATTERN);
  if (embeddedIndex > 0) {
    const prefix = trimmed
      .slice(0, embeddedIndex)
      .replace(/\bError info:\s*["']?$/i, '')
      .trim();
    const embedded = parseStructuredCandidate(
      normalizeEmbeddedStructuredText(trimmed.slice(embeddedIndex))
    );
    if (embedded !== undefined) return { prefix, data: embedded };
  }

  return undefined;
};

export const qorusDateStringToIso = (value: string): string | undefined => {
  const match = value.trim().match(QORUS_DATE_PATTERN);
  if (!match) return undefined;

  const [, date, time, fraction, offsetHours, offsetMinutes] = match;
  const ms = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
  const offset = offsetHours && offsetMinutes ? `${offsetHours}:${offsetMinutes}` : '';

  return `${date}T${time}${ms}${offset}`;
};
