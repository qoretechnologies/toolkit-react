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
