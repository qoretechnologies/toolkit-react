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
export { useDpqlSession } from './useDpqlSession';
export type {
  IDpqlFieldMeta,
  IUseDpqlSessionOptions,
  IUseDpqlSessionResult,
} from './useDpqlSession';
// `useDpqlSyntaxHighlighting` removed in 0.10.0 — syntax highlighting
// is now LSP-driven via `useLspSemanticTokens` inside SmartEditor.
// See design/SMART_EDITOR_UX.md §7.
export {
  dpqlSlateConverter,
  getTagLabel,
  isTagCompletion,
  plainTextToSlate,
  slateSelectionToOffset,
  slateToPlainText,
} from './dpqlHelpers';
export {
  DEFAULT_TEMPLATE_COLOR,
  FIELD_REF_COLOR,
  TEMPLATE_COLORS,
  makeDpqlTagRenderer,
} from './dpqlTags';
export { dpqlCompletionInserter } from './dpqlInserter';
