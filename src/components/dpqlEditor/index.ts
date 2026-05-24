// Copyright 2026 Qore Technologies, s.r.o.
// Public surface of the DpqlEditor component.

export { DpqlEditor } from './DpqlEditor';
export type {
  IDpqlEditorProps,
  IDpqlEditorRef,
  IDpqlParseResult,
  ISlateElement,
  ISlateText,
  TSlateNode,
} from './types';
export type {
  IDpqlFieldMeta,
  IUseDpqlLspOptions,
  IUseDpqlLspResult,
} from './useDpqlLsp';
export { useDpqlLsp } from './useDpqlLsp';
export type {
  ICompletionDropdownItem,
  ICompletionGroup,
  IUseDpqlAutocompleteOptions,
  IUseDpqlAutocompleteResult,
} from './useDpqlAutocomplete';
export { useDpqlAutocomplete } from './useDpqlAutocomplete';
export { useDpqlSyntaxHighlighting } from './useDpqlSyntaxHighlighting';
