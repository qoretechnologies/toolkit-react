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
  if (!typed) return undefined;
  const { type, value } = typed;
  if (type === 'list') return (value as MaybeTyped[]).map(typedToPlain);
  if (type === 'hash') {
    return Object.fromEntries(
      Object.entries(value as Record<string, MaybeTyped>).map(([k, v]) => [k, typedToPlain(v)])
    );
  }
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
  const processElement = (element: any | { text: string }): string => {
    if ('text' in element) {
      return element.text;
    }

    if (element.type === 'tag') {
      return element.value?.toString() || '';
    }

    return element.children.map(processElement).join('');
  };

  return richtext.map(processElement).join('');
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
