/**
 * Is a stored value one of a field's fixed choices?
 *
 * Two questions share this one predicate: the read-first row asks it to LABEL a
 * value with the choice's display name, and the validator asks it to decide
 * whether a value is one of the choices at all. Answering them differently is
 * how values were lost: a value the row could name was erased by a narrower
 * test, and the emptied form was then saved.
 */
import { TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import isEqual from 'lodash/isEqual';
import { isRendererOnlyUiType } from '../components/form/engine/rendererTypes';
import { richtextHasTag, richtextToString } from './common';
import { getListElementValue } from './options';
import { isValueTemplate } from './templates';

const isStructured = (value: unknown): boolean => value !== null && typeof value === 'object';

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
    { allowed_values?: any[]; element_allowed_values?: any[]; items?: any[] } | undefined;
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

  // A rich-text document is its text: a field with fixed choices can hold the document an editor wrote
  // (for example while its choices could not be loaded), and the document for "Case" is the choice "Case".
  const text = Array.isArray(stored) ? richtextToString(stored as never) : undefined;

  return options.find(
    (option) =>
      option?.value?.value === value ||
      option?.value === value ||
      option?.name === value ||
      option?.value?.value === stored ||
      option?.value === stored ||
      option?.name === stored ||
      (text !== undefined &&
        (option?.value?.value === text || option?.value === text || option?.name === text)) ||
      // A hash- or list-valued choice is a fresh object every time the schema
      // arrives, so identity can never match it; its contents can.
      (isStructured(stored) &&
        (isEqual(option?.value?.value, stored) || isEqual(option?.value, stored)))
  );
};

/**
 * A Slate rich-text document: a non-empty array of element nodes, each with
 * `children`. Told apart from a LIST value, which is an array of elements.
 */
const isRichTextDocument = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (node) => !!node && typeof node === 'object' && Array.isArray((node as any).children)
  );

/** A value resolved only when the interface runs — never one of the choices. */
const isResolvedAtRunTime = (value: unknown): boolean =>
  (typeof value === 'string' && isValueTemplate(value)) || richtextHasTag(value);

const isEmptyChoiceValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** The fields of a schema entry the choice check reads. */
export interface IChoiceFieldSchema {
  allowed_values?: any[];
  allowed_values_creatable?: boolean;
  element_allowed_values?: any[];
  element_allowed_values_creatable?: boolean;
  multiselect?: boolean;
  /** Set when the value is an expression, which is resolved at run time. */
  isFunction?: boolean;
  is_expression?: boolean;
  /** The editor the field is drawn with; see {@link hasOwnEditor}. */
  ui_type?: string | readonly string[];
  /**
   * Set by a form that knows the field is drawn by a bespoke editor of the
   * consumer's own (one it declared in `rendererOnlyUiTypes`), which reqraft's
   * built-in list cannot name.
   */
  hasOwnEditor?: boolean;
}

/**
 * Does a bespoke editor, rather than reqraft's choice picker, draw this field?
 *
 * Then the editor alone decides what a value means, and `allowed_values` is not
 * a closed set of values the field may hold. The AI endpoint's Tools field is
 * the case that proved it: its `tool-catalog` editor stores SELECTORS -- `*` for
 * every tool, `system:*`, a connection name, `connection/tool` -- and the host
 * hangs the tool catalogue's SOURCES on `allowed_values` for the editor to
 * browse. Judging the selectors against the sources flagged the server's own
 * default, `["*"]`, as "not one of the choices", so no chat endpoint could be
 * published with it. The server says the same: a custom `ui_type` "defines its
 * own value shape".
 */
const hasOwnEditor = (field: IChoiceFieldSchema): boolean =>
  !!field.hasOwnEditor || isRendererOnlyUiType(field.ui_type);

/**
 * The parts of a stored value that are not among the field's fixed choices.
 *
 * Empty when the value is acceptable, or when there is nothing to judge it
 * against:
 * - an empty value (whether one is needed is the required check's question);
 * - an expression, a template string or a document holding a template tag,
 *   all of which are resolved when the interface runs;
 * - `allowed_values: []` — the server has no choices to offer right now, which
 *   is "unknown", not "nothing is allowed";
 * - creatable choices, where any value may be added;
 * - a field drawn by a bespoke editor (a renderer-only `ui_type` such as
 *   `tool-catalog`), whose values are whatever that editor says they are.
 *
 * A single-valued field is judged as a whole. A multi-select field, and a list
 * whose elements are constrained by `element_allowed_values`, are judged per
 * element, so the answer names exactly the elements that are not choices.
 */
export const getUnlistedChoices = (value: unknown, field?: IChoiceFieldSchema): unknown[] => {
  if (
    !field ||
    isEmptyChoiceValue(value) ||
    field.isFunction ||
    field.is_expression ||
    hasOwnEditor(field)
  ) {
    return [];
  }

  const judgeElements = (elements: unknown[], choices: any[]): unknown[] =>
    elements.filter((element) => {
      const stored = getListElementValue(element);
      if (isEmptyChoiceValue(stored) || isResolvedAtRunTime(stored)) {
        return false;
      }
      if ((element as { is_expression?: boolean })?.is_expression) {
        return false;
      }
      return !findAllowedValueOption(element, { allowed_values: choices } as never);
    });

  if (isResolvedAtRunTime(value)) {
    return [];
  }

  if (field.allowed_values?.length && !field.allowed_values_creatable) {
    if (findAllowedValueOption(value, { allowed_values: field.allowed_values } as never)) {
      return [];
    }
    // A multi-select holds a list of choices; any list that is not itself a
    // choice is judged element by element.
    if (Array.isArray(value) && !isRichTextDocument(value)) {
      return judgeElements(value, field.allowed_values);
    }
    return [value];
  }

  if (
    field.element_allowed_values?.length &&
    !field.element_allowed_values_creatable &&
    !field.allowed_values_creatable &&
    Array.isArray(value) &&
    !isRichTextDocument(value)
  ) {
    return judgeElements(value, field.element_allowed_values);
  }

  return [];
};

/** How a value not among the choices is named in the message. */
const describeChoiceValue = (value: unknown): string => {
  const stored = getListElementValue(value);
  if (typeof stored === 'string') {
    return stored;
  }
  if (isRichTextDocument(stored)) {
    return richtextToString(stored as never);
  }
  if (stored === null || typeof stored !== 'object') {
    return String(stored);
  }
  try {
    return JSON.stringify(stored);
  } catch {
    return String(stored);
  }
};

/**
 * Why a stored value is not acceptable for a field with fixed choices, or
 * `undefined` when it is (see {@link getUnlistedChoices} for what is judged).
 *
 * The value is kept — it is never erased for not being a choice — and this
 * reason is what makes the field invalid, so the form shows it under "Needs
 * attention" and blocks submitting until the author picks a choice.
 */
export const getUnlistedChoiceReason = (
  value: unknown,
  field?: IChoiceFieldSchema
): string | undefined => {
  const unlisted = getUnlistedChoices(value, field);
  if (!unlisted.length) {
    return undefined;
  }
  const names = unlisted.map((item) => `"${describeChoiceValue(item)}"`);
  if (names.length === 1) {
    return `${names[0]} is not one of the choices`;
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are not among the choices`;
};
