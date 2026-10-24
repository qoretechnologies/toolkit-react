export * from './components/form';
export * from './components/log/Log';
export {
  validateField,
  validateFieldWithResult,
  isValueSet,
  getTypeFromValue,
  maybeParseYaml,
  hasAllDependenciesFullfilled,
  parseDependency,
  validateOptionWithRequiredGroups,
  unsatisfiedRequiredGroups,
} from './helpers/validations';
export type { IValidationResult } from './helpers/validations';
export { thinScrollbar } from './helpers/scrollbar';
export * from './components/imageLightbox';
export { ReqraftMenu } from './components/menu/Menu';
export type {
  IReqraftMenuItem,
  IReqraftMenuProps,
  TReqraftMenu,
  TReqraftMenuItem,
} from './components/menu/Menu';

export { useFetch } from './hooks/useFetch/useFetch';
export type { IReqraftUseFetch } from './hooks/useFetch/useFetch';
export { useReqraftStorage } from './hooks/useStorage/useStorage';
export type { TReqraftUseStorage } from './hooks/useStorage/useStorage';
export * from './hooks/useWebSocket/useWebSocket';
export {
  initializeReqraft,
  ReqraftProvider,
  ReqraftQueryClient,
} from './providers/ReqraftProvider';
export { currentUserStore as ReqraftCurrentUserStore } from './stores/currentUser/currentUser';
export type {
  ICurrentUser,
  ICurrentUserStore,
} from './stores/currentUser/currentUser';
export {
  fetchConfig,
  isQueryCancelled,
  query,
  queryRaw,
  reqraftApiPath,
  reqraftCacheKey,
  setupFetch,
} from './utils/fetch';
export type {
  IReqraftFetchConfig,
  IReqraftFetchResponse,
  IReqraftQueryConfig,
  IReqraftRawResponse,
} from './utils/fetch';
export * from './utils/websocket';
export { ReqraftLspClient } from './utils/lspClient';
export type { IReqraftLspClientOptions } from './utils/lspClient';
export type {
  ILspCompletionItem,
  ILspDiagnostic,
  ILspMarkupContent,
  ILspParameterInformation,
  ILspPosition,
  ILspRange,
  ILspSemanticToken,
  ILspSemanticTokensLegend,
  ILspServerCapabilities,
  ILspSignatureHelp,
  ILspSignatureInformation,
  ILspTextEdit,
  TLspDocumentText,
} from './utils/lspClient.types';
export * from './components/composer';
export * from './components/smartEditor';
export * from './components/dpqlEditor';
export * from './components/qonsoleSmartInput';
export * from './components/supportTicket';
export * from './components/ticketThread';
export * from './components/ticketReferences';
export * from './components/searchFilterBar';
export * from './components/codeSize';
export * from './components/colorValue';
// The Qorus type catalogue: the built-in copy of GET /system/qorus-type-info, what a type is called and takes
// (`qorusTypeEntry`: by its name, an optional, soft or complex form of one, or its base type), and what a picker
// that lists every type offers (qorus#646).
export {
  defaultQorusTypes,
  getQorusTypes,
  offeredQorusTypes,
  qorusTypeDisplayName,
  qorusTypeEntry,
  qorusTypeSentenceForm,
  UNKNOWN_TYPE_NAME,
  useQorusTypes,
} from './hooks/useQorusTypes';
export type { IQorusTypeObject, IUseTypes } from './hooks/useQorusTypes';
// A template's type and base type, as a typed member of its row (`metadata.type`, `metadata.baseType`), else the
// row's badge where a host keeps it there: a list of templates names the type in the badge it draws (qorus#646).
export { templateBaseType, templateType } from './helpers/templateType';
export type { ITemplateTypeRow } from './helpers/templateType';

// First-party tracking, consent and A/B testing (design/TRACKING.md). Also importable
// on its own, without the rest of Reqraft: `@qoretechnologies/reqraft/dist/tracking`
// (the engine, React only) and `@qoretechnologies/reqraft/dist/tracking/ui` (the A/B test UI).
export * from './tracking';
export * from './tracking/ui';
