// Copyright 2026 Qore Technologies, s.r.o.
import { DEFAULT_COLOR_FORM_FIELD_LABELS, IColorFormFieldLabels } from './color/labels';

/** The parts of a cron expression, in the order it is written. */
export type TCronPart = 'minute' | 'hour' | 'day' | 'month' | 'weekday';

/** The units a timeout is shown in (`TTimeoutUnit`). */
export type TTimeoutUnitName = 'ms' | 'seconds' | 'minutes' | 'hours';

/**
 * The words of the form's field editors: choices, lists, files, objects, binary values and the help that lists a
 * field's values. A host that translates its interface gives its own (`setReqraftLabels`); the rest stay English.
 */
export interface IFieldLabels {
  /** A choice field with nothing to choose from. */
  noDataAvailable: string;
  /** A choice field with nothing chosen, where it has no placeholder of its own. */
  pleaseSelect: string;
  /** The mark of the item a field holds, in the list of its choices. */
  chosen: string;
  /** The heading of the dialog that lists a field's choices. */
  selectFromItems: string;
  /** The heading of a field's choices drawn as radios / checkboxes, where the field has no name. */
  selectOne: string;
  selectOneOrMore: string;
  /** The picker of a field's saved values and the server's suggestions. */
  savedAndSuggestedValues: string;
  /** The tabs of a file field. */
  uploadAFile: string;
  buildAFile: string;
  /** The text alternative of an uploaded image. */
  uploadedFile: string;
  /** The hover of an uploaded file, to replace it: `extensions` are the file types it takes ("JSON or YAML"). */
  uploadDifferentFile: (extensions: string) => string;
  clickOrDropFiles: string;
  /** A list's controls. */
  edit: string;
  remove: string;
  saveChanges: string;
  addItem: string;
  cancelEditing: string;
  removeItem: string;
  /** The button that adds an item to a list, for the list's name where it has one. */
  addNewItem: (name: string | undefined) => string;
  /** Why a field's schema is not shown: `schema` is its name. */
  schemaNotLoaded: (schema: string) => string;
  /** What a binary value can be written as, in its field. */
  binaryPlaceholder: string;
  /** The text box of a binary field. */
  binaryValuePlaceholder: string;
  /** A field of a type no editor draws. */
  unknownType: string;
  /** The control of a field that can be null. */
  setAsNull: string;
  unsetNull: string;
  /** The rendered half of a markdown field. */
  preview: string;
  /** An object written as text: keep or drop what was typed. */
  save: string;
  discard: string;
  /** Why typed text cannot be kept: `format` is what it must be ("JSON", "YAML"). */
  notValid: (format: string) => string;
  /** The tabs of an object field. */
  editorTab: string;
  textTab: string;
  /** @deprecated An object field draws its rows straight away now; nothing reads these. */
  newList: string;
  newObject: string;
  /**
   * A row of an object field's values: its name and its value, each with a line under it, and the name of the rows
   * where the field has none of its own (its add button reads "Add new item for …").
   */
  rowName: string;
  rowNameDescription: string;
  rowValue: string;
  rowValueDescription: string;
  rowsName: string;
  /** The heading of the window a field is edited in, full screen. */
  focusedEditing: string;
  /** The heading of the values a field holds one of, and of those it offers where it takes others too. */
  allowedValues: string;
  suggestedValues: string;
  /** The columns of that list. */
  valueColumn: string;
  nameColumn: string;
  descriptionColumn: string;
  /** The color field's words. */
  color: IColorFormFieldLabels;
  /** The kinds of value a field of no fixed type offers, by type: what each is called in its type picker. */
  valueTypes: Record<string, string>;
  /** The boxes of a cron field: what each part of the expression is called, as its placeholder and its name. */
  cronParts: Record<TCronPart, string>;
  /** The button that empties a cron field. */
  clearCron: string;
  /** A timeout's units, as its unit picker names them. */
  timeoutUnits: Record<TTimeoutUnitName, string>;
  /** A timeout's units where there is little room (a phone): "s", "m". */
  timeoutUnitSymbols: Record<TTimeoutUnitName, string>;
  /** A timeout as it reads ("45 seconds", "1 minute"): `count` in `unit`, the plural chosen by the count. */
  timeoutAmount: (count: number, unit: TTimeoutUnitName) => string;
}

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_FIELD_LABELS: IFieldLabels = {
  noDataAvailable: 'No data available',
  pleaseSelect: 'Please select',
  chosen: 'Chosen',
  selectFromItems: 'Select from items',
  selectOne: 'Select one:',
  selectOneOrMore: 'Select one or more:',
  savedAndSuggestedValues: 'Saved & suggested values',
  uploadAFile: 'Upload a file',
  buildAFile: 'Build a file',
  uploadedFile: 'Uploaded file',
  uploadDifferentFile: (extensions) => `Upload a different ${extensions} file`,
  clickOrDropFiles: 'Click or drop files here to upload',
  edit: 'Edit',
  remove: 'Remove',
  saveChanges: 'Save changes',
  addItem: 'Add item',
  cancelEditing: 'Cancel editing',
  removeItem: 'Remove item',
  addNewItem: (name) => `Add new item ${name ? `for "${name}"` : ''}`,
  schemaNotLoaded: (schema) => `The schema "${schema}" could not be loaded.`,
  binaryPlaceholder: 'Base64, 0x hex, or data: URL',
  binaryValuePlaceholder: 'Base64-encoded binary value',
  unknownType: 'Unknown type!',
  setAsNull: 'Set as null',
  unsetNull: 'Unset null',
  preview: 'Preview',
  save: 'Save',
  discard: 'Discard',
  notValid: (format) => `Not a valid ${format}`,
  editorTab: 'Editor',
  textTab: 'Text',
  newList: 'New list',
  newObject: 'New object',
  rowName: 'Name',
  rowNameDescription: 'What the value is called.',
  rowValue: 'Value',
  rowValueDescription: 'Pick what kind of value it is, then fill it in.',
  rowsName: 'Values',
  focusedEditing: 'Focused editing',
  allowedValues: 'Allowed values',
  suggestedValues: 'Suggested values',
  valueColumn: 'Value',
  nameColumn: 'Name',
  descriptionColumn: 'Description',
  color: DEFAULT_COLOR_FORM_FIELD_LABELS,
  valueTypes: {
    bool: 'True or false',
    date: 'Date',
    string: 'Text',
    binary: 'Binary data',
    float: 'Number',
    list: 'List',
    hash: 'Key/value {}',
    int: 'Whole number',
    rgbcolor: 'RGB color',
  },
  cronParts: {
    minute: 'Minute',
    hour: 'Hour',
    day: 'Day',
    month: 'Month',
    weekday: 'Weekday',
  },
  clearCron: 'Clear',
  timeoutUnits: { ms: 'ms', seconds: 'seconds', minutes: 'minutes', hours: 'hours' },
  timeoutUnitSymbols: { ms: 'ms', seconds: 's', minutes: 'm', hours: 'h' },
  timeoutAmount: (count, unit) =>
    unit === 'ms' ? `${count} ms`
    : `${count} ${count === 1 ? unit.slice(0, -1) : unit}`,
};
