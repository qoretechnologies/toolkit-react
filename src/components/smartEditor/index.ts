// Copyright 2026 Qore Technologies, s.r.o.
// Public surface of the SmartEditor primitive.

export { SmartEditor } from './SmartEditor';
export type {
  ICompletionDropdownItem,
  ICompletionGroup,
  IUseLspAutocompleteOptions,
  IUseLspAutocompleteResult,
} from './useLspAutocomplete';
export {
  groupCompletionItems,
  toDropdownItems,
  useCompletionKeys,
  useLspAutocomplete,
} from './useLspAutocomplete';
// the one look and the two lists a field offers what can be written in (qorus#646)
export { CompletionList, CompletionMenu } from './CompletionMenu';
export type { ICompletionListProps, ICompletionMenuProps } from './CompletionMenu';
export {
  COMPLETION_ITEM_STYLE,
  COMPLETION_LIST_THEME,
  FIELD_KIND,
  kindBadge,
  styleTemplateItems,
  TEMPLATE_KIND,
  templateKind,
} from './completionStyle';
export { templateChipInserter, templateCompletionItems } from './templateCompletions';
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
