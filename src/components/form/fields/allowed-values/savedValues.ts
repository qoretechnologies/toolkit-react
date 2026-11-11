import { createContext, useContext, useMemo } from 'react';
import { ISelectFormFieldItem } from '../select/Select';

/**
 * SEAM (reqraft): values a person saved to reuse in other fields.
 *
 * Where they are kept is the host's business — the IDE stores them in the
 * user's settings — so this package draws them and asks the host to save one;
 * it never stores anything itself. Without a provider a form offers neither,
 * which is what it did before the seam existed (`showSavedValues` and
 * `allowSaving` were inert).
 */
export interface ISavedValueChoice extends ISelectFormFieldItem {
  /** The type of the saved value: a field offers only the values of its own type. */
  valueType?: string;
}

export interface ISavedValues {
  /** Every saved value, drawn as choices by a field that shows saved values. */
  items: ISavedValueChoice[];
  /** Saves a field's current value; the host asks what to call it. */
  saveValue?: (field: { value: unknown; type?: string }) => void;
  /** The label of the row-menu item that saves a value. */
  saveLabel?: string;
}

export const SavedValuesContext = createContext<ISavedValues | undefined>(undefined);

const NO_SAVED_VALUES: ISavedValueChoice[] = [];

/**
 * The editors that all store text. A field's type names its EDITOR, so a rich-text
 * field reports `richtext` while the value saved from it, or from a plain string
 * field, is text all the same; matching the names exactly offered no saved text to
 * the rich-text fields most text is written in.
 */
const TEXT_TYPES = new Set([
  'string',
  'richtext',
  'long-string',
  'email',
  'uri',
  'url',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'phone',
]);

const storedKind = (type?: string) => (type && TEXT_TYPES.has(type) ? 'string' : type);

/** The saved values a field of `type` can choose from. */
export const useSavedValueChoices = (type?: string): ISavedValueChoice[] => {
  const items = useContext(SavedValuesContext)?.items;
  return useMemo(
    () =>
      !items ? NO_SAVED_VALUES
      : type ?
        items.filter((item) => !item.valueType || storedKind(item.valueType) === storedKind(type))
      : items,
    [items, type]
  );
};
