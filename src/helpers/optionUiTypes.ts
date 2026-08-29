/**
 * The Qorus option `ui_type` vocabulary.
 *
 * A `ui_type` names the widget an option is rendered with, and — because the
 * widget decides what a complete value looks like — it is also what
 * `validateField` switches on. Both readers have to agree about which strings
 * are in the vocabulary, so the lists live here rather than beside either one.
 *
 * Grouped by what the group means to a reader, not by alphabet: the scalar
 * types hold a single value, the collection types hold several, the choice
 * types pick from a supplied set, and the interface types name another Qorus
 * object by its name — which is why `isOptionInterfaceUiType` is enough for
 * validation to treat the whole group as a non-empty string.
 */

export const OPTION_SCALAR_UI_TYPES = [
  'string',
  'long-string',
  'data',
  'binary',
  'richtext',
  'bool',
  'boolean',
  'date',
  'int',
  'integer',
  'float',
  'number',
  'byte-size',
  'url',
  'code-editor',
  'rgbcolor',
  'any',
  'auto',
  // semantic string formats (string-backed types that carry a UI-renderable identity; see the qore
  // DataProvider QoreStringFormatDataType)
  'email',
  'uri',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'phone',
] as const;

export const OPTION_COLLECTION_UI_TYPES = [
  'hash',
  'free-hash',
  'list',
  'free-list',
  'option_hash',
  'file',
  'file-as-string',
  'collection-documents',
] as const;

export const OPTION_CHOICE_UI_TYPES = [
  'enum',
  'select-string',
  'select-array',
  'multi-select',
] as const;

export const OPTION_INTERFACE_UI_TYPES = [
  'workflow',
  'service',
  'job',
  'connection',
  'mapper',
  'class',
  'value-map',
  'fsm',
  'qog',
  'api-schema',
  'auth-profile',
  'ai-collection',
  'ai-endpoint',
  'ai-guardrail',
  'ml-model',
  'release-config',
  'alertrule',
  'alertsilence',
  'installed-release',
  'business-process',
  'schema',
  'test',
] as const;

export const OPTION_CUSTOM_UI_TYPES = [
  'processor',
  'processor-mappings',
  'data-provider',
  'tool-catalog',
  'schema-definition',
  'test-cases',
  'test-value-contract',
  'dpql',
  'active-windows',
] as const;

export const OPTION_UI_TYPES = [
  ...OPTION_SCALAR_UI_TYPES,
  ...OPTION_COLLECTION_UI_TYPES,
  ...OPTION_CHOICE_UI_TYPES,
  ...OPTION_INTERFACE_UI_TYPES,
  ...OPTION_CUSTOM_UI_TYPES,
] as const;

export type TOptionUiType = (typeof OPTION_UI_TYPES)[number];
export type TOptionInterfaceUiType = (typeof OPTION_INTERFACE_UI_TYPES)[number];

export const LEGACY_FIELD_UI_TYPES = [
  'api-manager',
  'array',
  'array-auto',
  'array-of-pairs',
  'class-array',
  'class-connectors',
  'constant-array',
  'context-selector',
  'cron',
  'data-provider-options',
  'file-array',
  'fsm-list',
  'function-array',
  'http-content',
  'method-name',
  'opcua-method-arguments',
  'opcua-write-values',
  'options',
  'select',
  'service-events',
  'service-webhooks',
  'type-selector',
] as const;

export const KNOWN_QORUS_UI_TYPES = [...OPTION_UI_TYPES, ...LEGACY_FIELD_UI_TYPES] as const;

export type TLegacyFieldUiType = (typeof LEGACY_FIELD_UI_TYPES)[number];
export type TKnownQorusUiType = (typeof KNOWN_QORUS_UI_TYPES)[number];

const optionUiTypeSet = new Set<string>(OPTION_UI_TYPES);
const interfaceUiTypeSet = new Set<string>(OPTION_INTERFACE_UI_TYPES);
const knownQorusUiTypeSet = new Set<string>(KNOWN_QORUS_UI_TYPES);

export const isOptionUiType = (type: unknown): type is TOptionUiType =>
  typeof type === 'string' && optionUiTypeSet.has(type);

export const isOptionInterfaceUiType = (type: unknown): type is TOptionInterfaceUiType =>
  typeof type === 'string' && interfaceUiTypeSet.has(type);

export const isKnownQorusUiType = (type: unknown): type is TKnownQorusUiType =>
  typeof type === 'string' && knownQorusUiTypeSet.has(type);
