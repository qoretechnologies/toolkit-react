import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import yaml from 'js-yaml';

// ─── Typed ↔ YAML helpers ──────────────────────────────────────────────────────

type TTypedValue = { type: string; value: unknown };
type MaybeTyped = TTypedValue | undefined;

const inferTypedValue = (raw: unknown): MaybeTyped => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'boolean') return { type: 'bool', value: raw };
  if (typeof raw === 'number') return Number.isInteger(raw) ? { type: 'int', value: raw } : { type: 'float', value: raw };
  if (typeof raw === 'string') return { type: 'string', value: raw };
  if (Array.isArray(raw)) {
    const items = raw.map(inferTypedValue).filter(Boolean);
    return { type: 'list', value: items };
  }
  if (typeof raw === 'object') {
    const value = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, inferTypedValue(v)])
    );
    return { type: 'hash', value };
  }
  return { type: 'any', value: raw };
};

const typedToPlain = (typed: MaybeTyped): unknown => {
  if (typed === undefined || typed === null) return undefined;
  // A raw primitive (string/number/bool) is already plain — e.g. a `list` whose
  // items are bare values rather than `{ type, value }` wrappers. Destructuring it
  // would lose the value (it became `null` items in the YAML editor).
  if (typeof typed !== 'object') return typed;
  const { type, value } = typed as { type?: string; value?: unknown };
  if (type === 'list') {
    // Guard the `.map`: a malformed/non-array list value (e.g. a string from a
    // YAML round-trip) must not crash the editor — render it as-is instead.
    return Array.isArray(value) ? value.map(typedToPlain) : value;
  }
  if (type === 'hash') {
    return value && typeof value === 'object' && !Array.isArray(value) ?
        Object.fromEntries(
          Object.entries(value as Record<string, MaybeTyped>).map(([k, v]) => [k, typedToPlain(v)])
        )
      : value;
  }
  // An object with no recognised `type` wrapper is already plain data.
  if (type === undefined) return typed;
  return value;
};

export const yamlToTyped = (yamlString: string): MaybeTyped => {
  try {
    const raw = yaml.load(yamlString) as unknown;
    return inferTypedValue(raw);
  } catch {
    return { type: 'string', value: yamlString };
  }
};

export const typedToYaml = (typed: MaybeTyped): string => {
  if (typeof typed === 'undefined') return '';
  const plain = typedToPlain(typed);
  try {
    return yaml.dump(plain, { skipInvalid: true });
  } catch {
    return '';
  }
};

export const getDefaultValue = (schema: TQorusFormFieldSchema): unknown | undefined => {
  if ('default_value' in schema) {
    if (schema.default_value != null && typeof schema.default_value === 'object') {
      return schema.default_value.value;
    }

    return schema.default_value;
  }

  return undefined;
};

export const richtextToString = (richtext: IReqoreRichTextEditorProps['value']): string => {
  // A `richtext` ui_type option can still hold a plain scalar value (set
  // programmatically or loaded from the server before the editor ever touched
  // it) — only a real Slate document is an array of nodes.
  if (!Array.isArray(richtext)) {
    return richtext === undefined || richtext === null ? '' : String(richtext);
  }

  const processElement = (element: any | { text: string }): string => {
    if (element === null || element === undefined) {
      return '';
    }

    if (typeof element !== 'object') {
      return String(element);
    }

    if ('text' in element) {
      return element.text;
    }

    if (element.type === 'tag') {
      return element.value?.toString() || '';
    }

    return Array.isArray(element.children) ? element.children.map(processElement).join('') : '';
  };

  return richtext.map(processElement).join('');
};

/** One piece of a richtext document, flattened to a single line: a run of
 * plain prose (`text`) or an embedded template tag (`tag`). Used by the
 * read-first row to render tags as `$`-chips instead of raw `$prefix:name`. */
export interface IRichtextSegment {
  kind: 'text' | 'tag';
  /** Prose for `text`; the tag's display label (or its value) for `tag`. */
  text: string;
  /** The raw template value for `tag` (e.g. `$local:some-richtext`). */
  value?: string;
}

/** Like {@link richtextToString}, but keeps embedded template tags as discrete
 * segments (adjacent prose is coalesced) so a caller can render the tags as
 * chips. A non-document scalar collapses to a single text segment. */
export const richtextToSegments = (
  richtext: IReqoreRichTextEditorProps['value']
): IRichtextSegment[] => {
  if (!Array.isArray(richtext)) {
    const text = richtext === undefined || richtext === null ? '' : String(richtext);
    return text ? [{ kind: 'text', text }] : [];
  }

  const segments: IRichtextSegment[] = [];
  const pushText = (text: string): void => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last?.kind === 'text') last.text += text;
    else segments.push({ kind: 'text', text });
  };

  const walk = (element: any): void => {
    if (element === null || element === undefined) return;
    if (typeof element !== 'object') {
      pushText(String(element));
      return;
    }
    if ('text' in element) {
      pushText(element.text);
      return;
    }
    if (element.type === 'tag') {
      const value = element.value?.toString() || '';
      segments.push({ kind: 'tag', value, text: (element.label ?? value)?.toString() || value });
      return;
    }
    if (Array.isArray(element.children)) element.children.forEach(walk);
  };

  richtext.forEach(walk);
  return segments;
};

export const insertAtIndex = (array: any[] = [], index = 0, value: any): any[] => {
  return [...array.slice(0, index), value, ...array.slice(index)];
};

/** Splits a byte-size string (e.g. `"10MiB"`) into `[amount, unit]`. */
export const splitByteSize = (value?: string): [number | undefined, string | undefined] => {
  const amount = String(value ?? '').match(/\d+/g);
  const unit = String(value ?? '').match(/[a-zA-Z]+/g);
  return [amount?.[0] ? Number(amount[0]) : undefined, unit?.[0]];
};

// URL value splitting (IDE `urlField.tsx` behavior). Lives here rather than
// in the Url component so `validations.ts` can use it without pulling the
// component chain into non-DOM consumers (jest).
export const getProtocol = (v?: string): string => {
  const valueList = v?.split('://');

  if (!valueList || valueList.length <= 1) {
    return '';
  }

  return valueList[0];
};

export const getAddress = (v?: string): string => {
  const valueList = v?.split('://');

  if (!valueList || valueList.length === 0) {
    return '';
  }

  if (valueList.length === 1) {
    return valueList[0];
  }

  // We need to join back the rest of the address in case there were :// in it
  return valueList.slice(1).join('://');
};
