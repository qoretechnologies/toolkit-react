// Copyright 2026 Qore Technologies, s.r.o.

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
  /** Start an empty list or object in an object field. */
  newList: string;
  newObject: string;
  /** The heading of the window a field is edited in, full screen. */
  focusedEditing: string;
  /** The heading of the values a field holds one of, and of those it offers where it takes others too. */
  allowedValues: string;
  suggestedValues: string;
  /** The columns of that list. */
  valueColumn: string;
  nameColumn: string;
  descriptionColumn: string;
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
  uploadDifferentFile: (extensions) => `Click here to upload a different ${extensions} file`,
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
  focusedEditing: 'Focused editing',
  allowedValues: 'Allowed values',
  suggestedValues: 'Suggested values',
  valueColumn: 'Value',
  nameColumn: 'Name',
  descriptionColumn: 'Description',
};
