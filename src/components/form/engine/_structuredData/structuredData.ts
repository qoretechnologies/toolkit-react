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

export interface IStructuredScalar {
  display: string;
  raw?: string;
  type?: string;
  isDate: boolean;
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

export const isUiEncodedValue = (value: unknown): value is IUiEncodedValue => {
  if (!isRecord(value) || typeof value.type !== 'string' || !('value' in value)) {
    return false;
  }

  return Object.keys(value).every((key) => UI_ENVELOPE_KEYS.has(key));
};

export const unwrapUiEncodedValue = (value: unknown): unknown =>
  isUiEncodedValue(value) ? value.value : value;

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

const normalizedType = (type: unknown): string | undefined =>
  typeof type === 'string' && type.trim() ? type.trim().toLowerCase() : undefined;

export const isDateType = (type: unknown): boolean => {
  const normalized = normalizedType(type);
  return !!normalized && /^(date|datetime|time|timestamp|qore::date)$/i.test(normalized);
};

export const qorusDateStringToIso = (value: string): string | undefined => {
  const match = value.trim().match(QORUS_DATE_PATTERN);
  if (!match) return undefined;

  const [, date, time, fraction, offsetHours, offsetMinutes] = match;
  const ms = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';
  const offset = offsetHours && offsetMinutes ? `${offsetHours}:${offsetMinutes}` : '';

  return `${date}T${time}${ms}${offset}`;
};

export const dateLikeStringToIso = (value: string, type?: unknown): string | undefined => {
  const qorusIso = qorusDateStringToIso(value);
  if (qorusIso) return qorusIso;

  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return undefined;

  if (!isDateType(type) && !/\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
};

export const formatStructuredScalar = (value: unknown, type?: unknown): IStructuredScalar => {
  const displayType = normalizedType(type);

  if (value === undefined || value === null || value === '') {
    return { display: '-', type: displayType, isDate: false };
  }

  if (value instanceof Date) {
    return {
      display: formatIdeTimestamp(value.toISOString()),
      raw: value.toISOString(),
      type: displayType ?? 'date',
      isDate: true,
    };
  }

  if (typeof value === 'string') {
    const iso = dateLikeStringToIso(value, type);
    if (iso) {
      return {
        display: formatIdeTimestamp(iso),
        raw: value,
        type: displayType ?? 'date',
        isDate: true,
      };
    }

    return { display: value, type: displayType, isDate: false };
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { display: String(value), type: displayType, isDate: false };
  }

  try {
    return {
      display: JSON.stringify(value, null, 2),
      type: displayType,
      isDate: false,
    };
  } catch {
    return { display: String(value), type: displayType, isDate: false };
  }
};

export const hasStructuredValue = (value: unknown): boolean => {
  const unwrapped = unwrapUiEncodedValue(value);

  if (unwrapped === undefined || unwrapped === null || unwrapped === '') {
    return false;
  }

  if (Array.isArray(unwrapped)) {
    return unwrapped.length > 0;
  }

  if (isRecord(unwrapped)) {
    return Object.keys(unwrapped).length > 0;
  }

  return true;
};
