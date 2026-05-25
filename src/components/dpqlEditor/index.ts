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
export { useDpqlSyntaxHighlighting } from './useDpqlSyntaxHighlighting';
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
