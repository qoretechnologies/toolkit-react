import {
  IQorusFormField,
  IQorusFormSchema,
  TQorusFormFieldSchema,
  TQorusType,
} from '@qoretechnologies/ts-toolkit';
import { isRendererOnlyUiType } from './rendererTypes';
import { isUiEncodedValue } from './_structuredData/structuredData';
import { renderExpressionToText } from '../expressions/renderExpressionToText';
import { IExpressionValue } from '../expressions/types';
import yaml from 'js-yaml';
import { formatTimeoutValue, richtextToString } from '../../../helpers/common';

/** "N noun" with naive pluralisation ("1 item", "2 items"). */
const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

// The server's typed-value serialization wraps each value in an envelope —
// `{ type, value }` plus optional descriptive keys. Only this exact shape is
// unwrapped; any foreign key means it's a real user hash, not an envelope.
// One envelope definition for the whole engine: the structured tree and the
// hash summaries must agree on what unwraps (`isUiEncodedValue` carries the
// full server allow-list, incl. keys like `sensitive`/`required`).
const isTypedEnvelope = (raw: unknown): raw is IQorusFormField => isUiEncodedValue(raw);

/** Reduce ONE list item to a short, human label — never an object. Unwraps a
 * typed `{type, value}` envelope, prefers a `name`/`display_name`, and returns
 * undefined for a bare object (no name) so the caller falls back to a count
 * instead of printing "[object Object]". */
const summarizeListItem = (item: unknown): string | number | undefined => {
  if (item === null || item === undefined) return undefined;
  if (typeof item !== 'object') return item as string | number;
  const obj = item as Record<string, unknown>;
  // A named object (or allowed-value) → its label.
  if (typeof obj.name === 'string' || typeof obj.name === 'number') return obj.name;
  if (typeof obj.display_name === 'string') return obj.display_name;
  // A typed envelope ({type, value}) or a {value} wrapper → look inside once.
  if ('value' in obj) {
    const inner = obj.value;
    if (inner === null || inner === undefined) return undefined;
    if (typeof inner !== 'object') return inner as string | number;
    const innerName = (inner as Record<string, unknown>).name;
    return typeof innerName === 'string' || typeof innerName === 'number' ? innerName : undefined;
  }
  return undefined;
};

/**
 * Label ONE list item from the sub-schema that describes it.
 *
 * `summarizeListItem` can only read an item that names ITSELF — one carrying a
 * `name` or `display_name` key. A hash whose fields are all domain fields names
 * itself nowhere: an auth profile's scheme has `type`, `cookie_name`,
 * `redirect_url`, and the row fell back to "2 items" — true, and silent about
 * which two.
 *
 * The `arg_schema` is the same description the sub-form was built from, so the
 * row can read an item the way the form asked for it: the FIRST declared field
 * the item actually has, resolved through that field's allowed values. The
 * scheme list then reads "Default RBAC, Cookie" — the words the author picked —
 * instead of a count.
 *
 * Schema order, not value order: the first declared field is the one the form
 * puts at the top of the item, which is the one that identifies it to its author.
 * Value order is insertion order and would vary between two equal items.
 */
const summarizeHashItemFromSchema = (
  item: unknown,
  argSchema: Record<string, TQorusFormFieldSchema> | undefined
): string | number | undefined => {
  if (!argSchema) {
    return undefined;
  }
  const record = isTypedEnvelope(item) ? item.value : item;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return undefined;
  }
  const fields = record as Record<string, unknown>;
  const key = Object.keys(argSchema).find((name) => {
    const raw = fields[name];
    const value = isTypedEnvelope(raw) ? raw.value : raw;
    return value !== undefined && value !== null && value !== '';
  });
  if (!key) {
    return undefined;
  }
  const raw = fields[key];
  const value = isTypedEnvelope(raw) ? raw.value : raw;
  const label = getAllowedValueLabel(value, argSchema[key]);
  if (label) {
    return label;
  }
  // No allowed values (a free-text field): the stored value IS what was typed,
  // so it reads correctly as-is. An object at this position has no short form,
  // and a count beats printing its shape.
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
};

/** Summarise a list value: join item labels, or fall back to an "N items" count
 * (e.g. a list of anonymous hashes). Never prints raw objects. */
/**
 * Join a list into one line, labelling each item from the field's allowed values
 * where it has them.
 *
 * A multi-select stores what the server stores -- a parse option is
 * `PO_REQUIRE_TYPES`, a permission is a code -- and the picker is what turns
 * that into something readable. The row has the same allowed values the picker
 * does, so it can read the same way instead of printing the wire form back.
 */
const formatList = (items: unknown[], schema?: TQorusFormFieldSchema): string => {
  const argSchema = (schema as { arg_schema?: Record<string, TQorusFormFieldSchema> } | undefined)
    ?.arg_schema;
  const parts = items
    .map(
      (item) =>
        getAllowedValueLabel(item, schema) ??
        summarizeListItem(item) ??
        summarizeHashItemFromSchema(item, argSchema)
    )
    .filter((part) => part !== '' && part !== undefined && part !== null);

  return parts.length ? parts.join(', ') : pluralize(items.length, 'item');
};

/** Summarise a hash/object by its field count ("2 fields"), or "Set" when empty. */
const fieldCountLabel = (obj: object): string => {
  const keys = Object.keys(obj);
  return keys.length ? pluralize(keys.length, 'field') : 'Set';
};

/** The object/list editor stores complex values as a serialized YAML string
 * (`%YAML 1.2 --- […]`) — parse it back for the summary; undefined when the
 * string isn't a serialized structure. */
const parseSerialized = (value: string, type?: string): unknown => {
  const looksLikeYamlDoc = /^\s*(%YAML|---)\s/.test(value);
  if (type !== 'list' && type !== 'hash' && !looksLikeYamlDoc) {
    return undefined;
  }
  try {
    return yaml.load(value);
  } catch {
    return undefined;
  }
};

/**
 * Pure helpers for FormEngine compact (read-first) mode: format an option's
 * stored value into a short summary and resolve its group. Unit-testable.
 */

/** A value is "empty" (nothing set) when it is nullish, an empty string, or an empty array. */
export const isOptionValueEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

export const isFixedCompactAllowedValueOption = (
  schema: TQorusFormFieldSchema | undefined
): boolean => {
  if (!schema) {
    return false;
  }

  const selectableSchema = schema as TQorusFormFieldSchema & { items?: unknown[] };
  const options =
    selectableSchema.allowed_values?.length ?
      selectableSchema.allowed_values
    : selectableSchema.items;

  return !!(
    options?.length &&
    !schema.allowed_values_creatable &&
    !schema.multiselect &&
    !schema.arg_schema
  );
};

export const shouldAutoCollapseCompactAllowedValueOption = (
  schema: TQorusFormFieldSchema | undefined,
  value: unknown
): boolean => !isOptionValueEmpty(value) && isFixedCompactAllowedValueOption(schema);

/** Boolean fields have three meaningful states: unset, Yes, and No. Once the
 * user chooses either boolean value in compact mode, the choice is complete
 * and the inline editor can close without a separate confirmation. */
export const isCompactBooleanOption = (schema: TQorusFormFieldSchema | undefined): boolean => {
  const type = (schema?.ui_type || schema?.type)?.toLowerCase();
  return type === 'bool' || type === 'boolean';
};

export const shouldAutoCollapseCompactOption = (
  schema: TQorusFormFieldSchema | undefined,
  value: unknown
): boolean =>
  !isOptionValueEmpty(value) &&
  (isCompactBooleanOption(schema) || isFixedCompactAllowedValueOption(schema));

/**
 * Prefer the matching allowed_values entry's display_name (fallback `name`)
 * over the raw stored value.
 *
 * A LIST carries its options under `element_allowed_values` — they constrain
 * each element, not the list itself — so a multi-select that was missing here
 * printed what it stores rather than what you picked: `orders, batch` for
 * fields whose picker reads "Orders, Batch". The gap shows worst exactly where
 * allowed values earn their keep, since the stored form is often not readable
 * at all (a permission code, `PO_REQUIRE_TYPES`, an app-specific id).
 *
 * Exported (as `findAllowedValueOption`) because the form engine's value
 * validation has to answer the SAME question — "is this stored value one of the
 * declared choices?" — and answering it differently loses data. An
 * `allowed_values` entry is written three ways: an envelope (`{value: {type,
 * value}}`), a bare value (`{value: 'default'}`) or a named entry
 * (`{name: 'default'}`). This has always accepted all three; the engine's
 * clearing guard accepted only the first and the third, so a schema using the
 * bare form had its value ERASED on load while this function went on rendering
 * the display name for it — the row read "Default RBAC" collapsed and "—" when
 * opened, and the value was gone from the submitted data.
 */
export const findAllowedValueOption = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): any | undefined => {
  const s = schema as
    | { allowed_values?: any[]; element_allowed_values?: any[]; items?: any[] }
    | undefined;
  const options =
    (s?.allowed_values?.length && s.allowed_values) ||
    (s?.element_allowed_values?.length && s.element_allowed_values) ||
    s?.items;
  if (!options?.length) {
    return undefined;
  }
  // A stored element can be the bare value or the typed `{type, value}`
  // envelope the form engine round-trips; match either against either.
  const stored =
    value && typeof value === 'object' && 'value' in (value as Record<string, unknown>) ?
      (value as Record<string, unknown>).value
    : value;

  return options.find(
    (option) =>
      option?.value?.value === value ||
      option?.value === value ||
      option?.name === value ||
      option?.value?.value === stored ||
      option?.value === stored ||
      option?.name === stored
  );
};

const getAllowedValueLabel = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const match = findAllowedOption(value, schema);
  return match ? match.display_name || match.title || match.name || undefined : undefined;
};

/** Local alias for the module's own callers. */
const findAllowedOption = findAllowedValueOption;

/** True when the field's selectable options carry images (logos). Such a choice
 * renders too tall/rich for an inline row, so compact opens it in the card. */
export const optionHasImages = (schema?: TQorusFormFieldSchema): boolean => {
  const s = schema as { allowed_values?: any[]; items?: any[] } | undefined;
  const options = s?.allowed_values?.length ? s.allowed_values : s?.items;
  return !!options?.some((option) => !!option?.image);
};

/** The selected option's image (logo), when it carries one — for the value cell. */
export const getAllowedValueImage = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const match = findAllowedOption(value, schema);
  return (match?.image as string) || undefined;
};

/** Clamp an RGB channel to a 0–255 integer. */
const clampChannel = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const toHexPart = (n: number): string => clampChannel(n).toString(16).padStart(2, '0');

/** The shape the rgbcolor field stores (react-color's RGBA result). */
type TColorValue = { r?: number; g?: number; b?: number; a?: number; hex?: string };

/** Normalised colour parts parsed from any shape the rgbcolor field can store. */
interface IParsedColor {
  hex?: string;
  r?: number;
  g?: number;
  b?: number;
  a: number;
}

/** Whether parsed colour parts carry usable RGB channels. */
const hasRgb = (c: IParsedColor): c is IParsedColor & { r: number; g: number; b: number } =>
  c.r !== undefined && c.g !== undefined && c.b !== undefined;

/** Parse an `rgbcolor` into normalised parts: accepts `{ r, g, b, a }` (may
 * carry `hex`), `{ hex }`, or a raw hex string; undefined when unrecognisable. */
const parseColor = (value: unknown): IParsedColor | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.startsWith('#') ? { hex: trimmed, a: 1 } : undefined;
  }
  if (value && typeof value === 'object') {
    const c = value as TColorValue;
    const a = typeof c.a === 'number' ? c.a : 1;
    const hex = typeof c.hex === 'string' && c.hex.trim() ? c.hex.trim() : undefined;
    if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
      return { r: c.r, g: c.g, b: c.b, a, hex };
    }
    if (hex) {
      return { hex, a };
    }
  }
  return undefined;
};

/** Uppercase hex (`#0000FF`), or `rgba(…)` when non-opaque; undefined when
 * unrecognisable (the caller falls back to the generic marker). */
export const formatColorValue = (value: unknown): string | undefined => {
  const c = parseColor(value);
  if (!c) {
    return undefined;
  }
  // Prefer rgba(…) for non-opaque colours; the hex shortcut would drop alpha.
  if (c.a < 1 && hasRgb(c)) {
    const alpha = Math.round(c.a * 100) / 100;
    return `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${alpha})`;
  }
  if (c.hex) {
    return c.hex.toUpperCase();
  }
  return hasRgb(c) ?
      `#${toHexPart(c.r)}${toHexPart(c.g)}${toHexPart(c.b)}`.toUpperCase()
    : undefined;
};

/** CSS colour for the swatch preview (keeps alpha); undefined when
 * unrecognisable. */
export const colorToCss = (value: unknown): string | undefined => {
  const c = parseColor(value);
  if (!c) {
    return undefined;
  }
  return hasRgb(c) ?
      `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${c.a})`
    : c.hex;
};

/** Filename for a `file` value: accepts `{ name, content, size }`, the
 * build-tab `{ name: { value } }` shape, or a raw path; undefined when no
 * filename resolves. */
export const formatFileValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const name = value.trim().split(/[\\/]/).pop();
    return name || undefined;
  }
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    const nested = (name as { value?: unknown } | undefined)?.value;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  }
  return undefined;
};

/** The byte size of a `file` value, when present (for the muted size suffix). */
export const getFileSize = (value: unknown): number | undefined => {
  const size = (value as { size?: unknown } | undefined)?.size;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
};

/**
 * Effective UI type for DISPLAY — which preview/summary a value renders as.
 *
 * A renderer-only `ui_type` wins outright: the field's stored `type` holds the
 * STORAGE type for those (a `code-editor` stores a string), so consulting the
 * stored type here would render the bespoke editor's value as a plain string and
 * silently drop its preview. Every other case keeps the stored type first, so an
 * `any`/`auto` field still displays as whatever concrete type the user picked.
 */
export const getValueType = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const uiType = (schema as { ui_type?: string } | undefined)?.ui_type;

  if (isRendererOnlyUiType(uiType as TQorusType)) {
    return uiType;
  }

  return (option?.type || uiType || (schema as { type?: string } | undefined)?.type) as
    string | undefined;
};

/** Human-readable byte count (e.g. `1.2 KB`). */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || Number.isInteger(size) ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};

/**
 * Short read-first summary of a value; '' when unset (the caller renders the
 * placeholder). Bools → Yes/No, allowed_values → display label, colour →
 * hex/rgba, file → filename, richtext → plain text, timeout → scaled duration
 * ("45 seconds"), list → joined names, hash → "N fields" (generic "Set"
 * fallback).
 */
/** Read-first summary of a `schema-definition` value: the schema name plus a
 * table count (e.g. `orders · 2 tables`). */
const formatSchemaDefinition = (value: unknown): string => {
  if (!value || typeof value !== 'object') return 'Schema';
  const def = value as { schema?: { name?: string }; tables?: object };
  const name = def.schema?.name;
  const count = def.tables ? Object.keys(def.tables).length : 0;
  const tables = count ? ` · ${count} table${count === 1 ? '' : 's'}` : '';
  return name ? `${name}${tables}` : 'Schema';
};

/**
/**
 * How much prose a one-line summary may carry.
 *
 * The row's value cell is a single CSS-clipped line (`text-overflow: ellipsis`),
 * so the CELL needs no cap — the browser does that. The `title` hover does: it
 * is handed this same string whole, and a description is a document. Without a
 * bound, hovering a 4,000-word description produces a 4,000-word native
 * tooltip, which no browser renders usefully and no reader can scroll.
 *
 * 240 comfortably overfills the widest realistic cell (~80-120 characters), so
 * nothing visible is lost, and leaves the hover as what it is useful as — the
 * next sentence or two. The whole document is never far away: it renders in the
 * row's inset below.
 */
export const SUMMARY_MAX_LENGTH = 240;

/** Clip to {@link SUMMARY_MAX_LENGTH}, on a word boundary where there is one
 *  close enough to the end, so a hover never stops mid-identifier. */
const capSummary = (text: string): string => {
  if (text.length <= SUMMARY_MAX_LENGTH) {
    return text;
  }

  const cut = text.slice(0, SUMMARY_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > SUMMARY_MAX_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut;

  return `${body.trimEnd()}…`;
};

/**
 * Summarise a markdown value as the prose it renders to.
 *
 * A read-first row has one line to work with, and for markdown that line was
 * the SOURCE: a description opening with a heading read as `## Partner portal`,
 * which is punctuation where the reader wanted the sentence. The markers are
 * stripped rather than the value truncated, because what the row is standing in
 * for is the rendered document, not the file behind it.
 *
 * Deliberately not a markdown parser: this feeds a one-line summary and the
 * row's hover title, and the real document renders in the inset below the row.
 *
 * The inline rules below are CommonMark-shaped on purpose, because the naive
 * versions corrupt exactly the text these descriptions are full of. `(\*|_)(.*?)\1`
 * turns "2 * 3 * 4 items" into "2 3 4 items" and `retry_count_max` into
 * `retrycountmax`: emphasis delimiters have to hug the text they wrap, and an
 * underscore must not be intraword, or an option key loses its underscores.
 */
export const summariseMarkdown = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const prose = value
    // a fenced block is never the summary of the thing it sits in
    .replace(/```[\s\S]*?```/g, ' ')
    // images before links — an image's `!` prefix would otherwise survive
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // autolinks: <https://example.com> → https://example.com
    .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
    // leading block markers: heading hashes, blockquote carets, list bullets
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    // setext underlines and thematic breaks carry no prose
    .replace(/^\s{0,3}(?:={2,}|-{2,}|\*{3,}|_{3,})\s*$/gm, '')
    // Emphasis / strong / strikethrough markers around their own text. The
    // delimiters must hug the text they wrap, as CommonMark requires, and
    // underscores additionally must not be intraword.
    .replace(/(\*\*\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(___)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/(\*\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(__)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/(\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(_)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, '$1')
    // inline code spans
    .replace(/`+([^`]+)`+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return capSummary(prose);
};

export const formatOptionValue = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): string => {
  const value = option?.value;

  if (isOptionValueEmpty(value)) {
    return '';
  }

  // A sensitive option (passwords, tokens) must never print its value in the
  // read-first row — the formatted string also feeds the row's hover title.
  if ((schema as { sensitive?: boolean } | undefined)?.sensitive) {
    return '••••••';
  }

  if (option?.is_expression) {
    // Offline summary of the {exp,args} AST already in the form value — the
    // same client-side renderer the editor's "Explain" seam falls back to when
    // the LSP is unreachable. The drill-in editor shows the canonical DPQL.
    return renderExpressionToText(option?.value as IExpressionValue | undefined) || 'Expression';
  }

  // schema-definition is stored as a hash envelope; summarise it as the schema
  // name + table count rather than a meaningless top-level key count.
  if ((schema as { ui_type?: string } | undefined)?.ui_type === 'schema-definition') {
    return formatSchemaDefinition(value);
  }

  // Same reasoning, different notation: show what the markdown says, not how it
  // is written.
  if ((schema as { ui_type?: string } | undefined)?.ui_type === 'markdown') {
    // `|| 'Set'` is not defensive padding. A description that is ONLY a fenced
    // code block summarises to the empty string — the block is dropped, and
    // there is no prose behind it — and CompactRow reads `formatted === ''` as
    // "no value" and renders a faint em-dash. A field holding a whole code
    // block would show as empty. `'Set'` is this file's established answer for
    // "there is a value here that does not reduce to a line" (colours, files,
    // richtext all use it), and the block itself still renders in the inset.
    return summariseMarkdown(value) || 'Set';
  }

  const type = getValueType(option, schema);

  if (type === 'bool' || type === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  const allowedLabel = getAllowedValueLabel(value, schema);
  if (allowedLabel) {
    return allowedLabel;
  }

  if (type === 'rgbcolor') {
    return formatColorValue(value) ?? 'Set';
  }

  // Raw milliseconds read poorly at a glance — scale to the largest exact
  // unit, matching what the expanded TimeoutFormField shows.
  if (type === 'timeout' && typeof value === 'number') {
    return formatTimeoutValue(value);
  }

  if (type === 'file') {
    return formatFileValue(value) ?? 'Set';
  }

  if (type === 'richtext') {
    const text = richtextToString(value as any);
    return text && text.trim() ? text : 'Set';
  }

  // A markdown value reads as prose, not as source: the row's one line — and
  // the hover title built from it — would otherwise open with `# ` or spend its
  // width on `[label](https://…)`. The rendered document itself is drawn in the
  // row's inset below.
  if (type === 'markdown' && typeof value === 'string') {
    const text = summariseMarkdown(value);
    return text || 'Set';
  }

  if (Array.isArray(value)) {
    return formatList(value, schema);
  }

  // A serialized list/hash (the object editor stores them as a YAML string):
  // parse it back and summarise rather than showing the raw `%YAML 1.2 --- …`.
  if (typeof value === 'string') {
    const parsed = parseSerialized(value, type);
    if (Array.isArray(parsed)) {
      return formatList(parsed, schema);
    }
    if (parsed && typeof parsed === 'object') {
      return fieldCountLabel(parsed as object);
    }
    if (parsed !== undefined && parsed !== null && typeof parsed !== 'object') {
      return String(parsed);
    }
  }

  if (typeof value === 'object') {
    return fieldCountLabel(value as object);
  }

  return String(value);
};

/** One sub-field of a hash value, summarised for a read-first sub-row. */
export interface IReadFirstHashEntry {
  /** The raw key in the hash. */
  name: string;
  /** Display label — the sub-field's `display_name` (from `arg_schema`) or the key. */
  label: string;
  /** The sub-field's value formatted via `formatOptionValue` ('' when unset). */
  value: string;
}

/**
 * Expand a hash into sub-fields for the "view more" sub-rows. Handles the three
 * hash shapes: arg_schema descriptors, serialized-YAML string, plain object.
 * [] when not expandable; entry values format via `formatOptionValue`.
 */
export const getHashEntries = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): IReadFirstHashEntry[] => {
  const value = option?.value;
  if (isOptionValueEmpty(value)) {
    return [];
  }

  let hashObject: Record<string, unknown> | undefined;
  if (typeof value === 'string') {
    const parsed = parseSerialized(value, 'hash');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      hashObject = parsed as Record<string, unknown>;
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    hashObject = value as Record<string, unknown>;
  }

  if (!hashObject) {
    return [];
  }

  const argSchema = (schema as { arg_schema?: Record<string, TQorusFormFieldSchema> } | undefined)
    ?.arg_schema;

  return Object.keys(hashObject).map((key) => {
    const raw = hashObject![key];
    const subSchema = argSchema?.[key];
    // A schema-declared (`arg_schema`) hash stores each entry as a
    // `{ type, value }` field descriptor — gate on the sub-schema's presence.
    // A schema-less hash *usually* stores raw values, but the server's typed
    // serialization can nest envelopes there too (e.g. a hash default_value
    // whose entries are `{ type: 'string', value: 'x' }`) — recognise those by
    // their strict shape (a string `type`, a `value`, and no foreign keys) so
    // the sub-row shows 'x' rather than counting the envelope's own keys.
    const isFieldShape =
      (!!subSchema &&
        !!raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        'value' in (raw as object)) ||
      isTypedEnvelope(raw);
    const subOption: IQorusFormField =
      isFieldShape ?
        (raw as IQorusFormField)
      : ({ type: subSchema?.type as IQorusFormField['type'], value: raw } as IQorusFormField);

    return {
      name: key,
      label: subSchema?.display_name || key,
      value: formatOptionValue(subOption, subSchema),
    };
  });
};

const titleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Raw group key for an option: the server's `group`, else "general" for
 * required/preselected (never buried — `group` is still rolling out
 * server-side, qorus #259) and "optional" for the rest.
 */
export const getOptionGroup = (schema?: TQorusFormFieldSchema): string => {
  const group = (schema as { group?: string } | undefined)?.group;

  if (typeof group === 'string' && group.trim()) {
    return group.trim();
  }

  return (
      schema?.required ||
        (schema as { required_groups?: string[] } | undefined)?.required_groups ||
        (schema as { preselected?: boolean } | undefined)?.preselected
    ) ?
      'general'
    : 'optional';
};

/** Display label for a group key: the consumer-supplied label (FormEngine
 * `groups` prop) or the title-cased key. */
export const getOptionGroupLabel = (
  key: string,
  groups?: Record<string, { label?: string } | undefined>
): string => groups?.[key]?.label ?? titleCase(key);

/** Completion summary for the read-first progress meter. */
export interface IReadFirstCompletion {
  total: number;
  set: number;
  pct: number;
}

/** Read-first row status, shared by the status DOT (CompactRow) and the
 * status BOX bucketing (FormEngine) so the two can never disagree:
 *   invalid  — a value fails validation, or a danger message is present (red)
 *   todo     — empty & required (or has a warning message), needs a value (amber)
 *   set      — has a valid value (green)
 *   optional — empty & not required, or covered by a one-of sibling (calm) */
export type TReadFirstStatus = 'invalid' | 'todo' | 'set' | 'optional';

export const getReadFirstStatus = (s: {
  empty: boolean;
  required: boolean;
  /** Empty member of a one-of required group already satisfied by a sibling. */
  covered: boolean;
  /** Non-empty value fails validation, or a danger message is attached. */
  invalid: boolean;
  /** A warning message is attached (surfaces an empty field for attention). */
  warned: boolean;
}): TReadFirstStatus => {
  if (s.invalid) return 'invalid';
  if (!s.empty) return 'set';
  // A one-of member covered by a satisfied sibling reads as "set" (green) — the
  // requirement is met; the row just shows a "Covered by …" note.
  if (s.covered) return 'set';
  if (s.required || s.warned) return 'todo';
  return 'optional';
};

/** Coarse bucket for the three status boxes (Needs attention / Set / Optional). */
export const getReadFirstBucket = (status: TReadFirstStatus): 'attention' | 'set' | 'optional' =>
  status === 'set' ? 'set'
  : status === 'optional' ? 'optional'
  : 'attention';

/** Count how many of the shown options have a value set, for the progress meter. */
export const getReadFirstCompletion = (
  shownOptions: Record<string, IQorusFormField | undefined> = {}
): IReadFirstCompletion => {
  const names = Object.keys(shownOptions);
  const total = names.length;
  const set = names.filter((name) => !isOptionValueEmpty(shownOptions[name]?.value)).length;
  const pct = total ? Math.round((set / total) * 100) : 0;

  return { total, set, pct };
};

/** What the "first field to fix" selector needs to know about one field.
 * Kept deliberately minimal — both verdicts are supplied by the caller — so the
 * selector is decoupled from the engine's value/schema shapes and unit-testable
 * in isolation. */
export interface IFirstAttentionFieldMeta {
  /** Whether the field can actually receive focus — the caller folds in
   *  disabled / readonly / read-only-form / unmet-dependency gating here. */
  focusable: boolean;
  /** Whether the form considers this field to "need attention". The caller
   *  supplies this from the SAME `getOptionBucket` the read-first status boxes
   *  use, so it covers every attention case — empty-required, an unsatisfied
   *  one-of group, AND a filled-but-invalid value — and the autofocus target can
   *  never drift from the visible needs-attention set. */
  needsAttention: boolean;
}

/**
 * Pick the first field the user must fix: the first focusable field — in the
 * supplied (already ordered) name list — that the form buckets as "needs
 * attention".
 *
 * Pure and side-effect free. It deliberately does NOT re-derive emptiness /
 * required / validity itself; the caller passes `needsAttention` straight from
 * the engine's own `getOptionBucket`, so there is a single source of truth and
 * the "focus the first field to fix" affordance can never disagree with the
 * per-row status the user sees (including filled-but-invalid rows). Returns
 * `undefined` when nothing needs attention.
 */
export const getFirstAttentionOptionName = (
  orderedNames: string[],
  getFieldMeta: (name: string) => IFirstAttentionFieldMeta | undefined
): string | undefined => {
  for (const name of orderedNames) {
    const meta = getFieldMeta(name);
    if (meta?.focusable && meta.needsAttention) {
      return name;
    }
  }

  return undefined;
};

/* ------------------------------------------------------------------------- */
/* Record identity — which field says WHICH item this is                      */
/*                                                                            */
/* Lives here, beside the formatters it uses, rather than in the view that    */
/* first needed it: it is data logic, not rendering, and BOTH list renderers  */
/* plus their tests import it. Keeping it in `SchemaDataView` dragged React,  */
/* styled-components and every Reqore component it renders into any module    */
/* that only wanted to know an item's name — which broke `arrayAutoField`'s   */
/* mocked-Reqore test the moment the editable list started using it.          */
/* ------------------------------------------------------------------------- */

/** A UI-encoded value carries its type alongside it; the record's own value is inside. */
const unwrap = (value: unknown): unknown =>
  isUiEncodedValue(value) ? (value as { value: unknown }).value : value;

/** Whether a value is worth a row of its own. `false` and `0` are values. */
export const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length);

/**
 * The keys to render, in the order to render them: the schema's own order first
 * (that is the order the form puts the fields in), then anything stored that the
 * schema does not mention, so undescribed data is shown rather than dropped.
 */
export const orderedKeys = (record: Record<string, unknown>, schema: IQorusFormSchema): string[] => {
  const described = Object.keys(schema).filter((key) => isSet(unwrap(record[key])));
  const extra = Object.keys(record).filter((key) => !(key in schema) && isSet(unwrap(record[key])));
  return [...described, ...extra];
};

/** A field whose content is source code. `ui_type` is what the form renders by,
 *  so it is what the preview reads by too — the storage type is just `string`. */
export const isCodeField = (fieldSchema: TQorusFormFieldSchema | undefined): boolean => {
  const uiType = (fieldSchema as { ui_type?: string } | undefined)?.ui_type;
  return uiType === 'code-editor';
};

/**
 * The field whose value heads the item — the first DECLARED one holding a plain
 * scalar.
 *
 * Schema order, not value order: the first declared field is the one the form
 * puts at the top of an item, which is the one that says which item it is. A
 * code body or a nested level is skipped, not because it is unimportant but
 * because it has no one-line form — it belongs in the rows below where it can
 * actually be read.
 *
 * One definition, used both to RENDER the heading and to omit that field from
 * the rows. Computing it twice is how the heading and the rows start disagreeing
 * about which field was promoted, and the item shows its name twice or not at
 * all.
 */
export const titleKeyFor = (
  record: Record<string, unknown>,
  schema: IQorusFormSchema
): string | undefined =>
  orderedKeys(record, schema).find((key) => {
    const fieldSchema = schema[key] as TQorusFormFieldSchema | undefined;
    if (isCodeField(fieldSchema)) {
      return false;
    }
    const raw = unwrap(record[key]);
    return typeof raw === 'string' || typeof raw === 'number';
  });

/** What identifies one record: which field was promoted, and how to draw it. */
export interface IRecordIdentity {
  /** The promoted field's key, so a caller can omit it from the rows below. */
  key: string;
  /** The value, formatted the way its own row would format it. */
  text: string;
  /** The promoted field's label — a caption for the heading, not a second line. */
  label: string;
  /** A literal keeps its mono face; a chosen label is prose. */
  mono: boolean;
}

/**
 * The identity of one record, for any surface that heads a list item with it.
 *
 * Exported because the preview is not the only place a list of records is shown:
 * the editable list (`ArrayAuto`) heads the same records, and it must promote the
 * same field and format it the same way. Two implementations would drift the
 * moment one of them learned about a new field type, and the reader would meet
 * an item called `init` in the preview and `#1` in the editor.
 */
export const recordIdentity = (
  record: Record<string, unknown>,
  schema: IQorusFormSchema | undefined
): IRecordIdentity | undefined => {
  if (!schema) {
    return undefined;
  }

  const key = titleKeyFor(record, schema);

  if (!key) {
    return undefined;
  }

  const fieldSchema = schema[key] as TQorusFormFieldSchema | undefined;
  const raw = unwrap(record[key]);

  return {
    key,
    text: formatOptionValue({ type: fieldSchema?.type, value: raw } as IQorusFormField, fieldSchema),
    label: fieldLabel(key, fieldSchema),
    mono: !findAllowedValueOption(raw, fieldSchema),
  };
};

export const fieldLabel = (key: string, fieldSchema: TQorusFormFieldSchema | undefined): string =>
  (fieldSchema as { display_name?: string } | undefined)?.display_name || key;
