// Copyright 2026 Qore Technologies, s.r.o.
// Public surface of the SmartEditor primitive.

export { SmartEditor } from './SmartEditor';
export type {
  ICompletionDropdownItem,
  ICompletionGroup,
  IUseLspAutocompleteOptions,
  IUseLspAutocompleteResult,
} from './useLspAutocomplete';
export { useLspAutocomplete } from './useLspAutocomplete';
export type {
  IUseLspSessionOptions,
  IUseLspSessionResult,
} from './useLspSession';
export { useLspSession } from './useLspSession';
export {
  defaultFromSlateNodes,
  defaultSelectionToOffset,
  defaultSlateConverter,
  defaultToSlateNodes,
  lspPositionToOffset,
  mapCompletionKindToIcon,
  offsetToLspPosition,
} from './helpers';
export type {
  ICompletionInserterContext,
  ILspCompletionItem,
  ISlateConverter,
  ISlateElement,
  ISlateText,
  ISmartEditorProps,
  TCompletionInserter,
  TSlateNode,
} from './types';
