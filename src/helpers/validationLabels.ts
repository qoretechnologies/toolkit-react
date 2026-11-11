// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The words a value's validation says why it is refused with. A host that translates its interface gives its own (`setReqraftLabels`); the rest stay English.
 *
 * A word that names a type takes it as the type catalogue says it inside a sentence ("a whole number"), in the
 * language the server answered in, or `undefined` where the catalogue has no name for it. A position (`row`, `index`,
 * `position`) is a number as it is counted where the reason is said.
 */
export interface IValidationLabels {
  /** A reason said inside another: what was being checked (`context`, one of these words), then why it failed. */
  inContext: (context: string, reason: string) => string;

  // a value that does not match its field's pattern
  /** What the pattern accepts, as the server describes it ("a host name and a port"): the whole sentence. */
  mustBe: (description: string) => string;
  /**
   * The form a value must have, where the server does not describe it: by the field's example where it has one, and
   * the pattern itself last, as a detail.
   */
  mustMatchExpectedForm: (example?: string, pattern?: string) => string;

  // a value that is not of its field's type
  /** `type` as the type catalogue says it inside a sentence; `undefined` where it has no name for the field's type. */
  valueMustBe: (type: string | undefined) => string;
  /** A number below the field's least value. */
  atLeast: (min: number) => string;
  /** A number above the field's greatest value. */
  atMost: (max: number) => string;
  /** Text and more than one template, in a field whose type is not text (`type`: as `valueMustBe`'s). */
  textAndTemplatesMakeText: (type: string | undefined) => string;
  /** Templates side by side, with no text between them, in a field whose type is not text. */
  templatesSideBySide: (type: string | undefined) => string;
  /** Text around one template, in a field whose type is not text; `texts` is that text, each piece as written. */
  textAroundTemplate: (texts: string[], type: string | undefined) => string;

  missingValue: string;
  missingType: string;
  templateNeedsKeyAndValue: string;
  textEmpty: string;
  nonEmptyText: string;
  /** A value that is not a valid `format`: `email`, `uuid`, `hostname`, `ipv4`, `ipv6` or `phone`, as named. */
  notValidFormat: (format: string) => string;
  notIdentifier: string;
  required: string;
  notList: string;
  atLeastOneValue: string;
  dateInvalid: string;
  notYaml: string;
  valueEmpty: string;
  /** What an `auto` field's value was checked as, said before why that failed. */
  autoTypeInvalid: string;
  nothingNotValid: string;

  // a connection
  connectionMissing: string;
  connectionNotAllowed: string;
  connectionDisabled: string;
  connectionTextInvalid: string;

  // binary data
  binaryNotText: string;
  binaryEmpty: string;
  binaryHexInvalid: string;
  binaryForm: string;

  // a file
  fileNameInvalid: string;
  fileContentInvalid: string;

  // a collection's documents; `row` counts from 1
  documentsNotList: string;
  documentRowNotObject: (row: number) => string;
  documentRowNoName: (row: number) => string;
  /** A document row with neither uploaded content nor the server's id for it; `name` is the document's. */
  documentRowNoContent: (row: number, name: string) => string;

  // pairs, connectors and classes
  pairsNeedBothFields: string;
  pairsUniqueKeys: string;
  connectorRequired: string;
  connectorNameAndMethod: string;
  connectorNamesUnique: string;
  classRequired: string;
  classNeedsName: string;
  classNamesUnique: string;

  // a schedule
  cronRequired: string;
  cronInvalid: string;

  // hashes and lists; `index` counts from 0
  hashArgumentsInvalid: string;
  listItemInvalid: (index: number) => string;
  notListOfHashes: string;
  hashEmptyAt: (index: number) => string;
  hashInvalidAt: (index: number) => string;

  // a mapper's code
  mapperCodeRequired: string;
  mapperCodeInvalid: string;
  mapperMethodInvalid: string;

  // a variable's action
  variableTypeInvalid: string;
  variableNameInvalid: string;
  variableActionTypeInvalid: string;
  transactionActionInvalid: string;
  variableDataMissing: string;
  variableActionInvalid: string;

  // a data provider
  providerInvalid: string;
  apiCallNeedsRequests: string;
  variableProviderNeedsAction: string;
  sendMessageProviderIncomplete: string;
  messageIdInvalid: string;
  messageContentMissing: string;
  messageContentInvalid: string;
  argumentsMissing: string;
  argumentsInvalid: string;
  searchArgumentsInvalid: string;
  updateCreateArgumentsInvalid: string;
  factoryOptionsNotSaved: string;
  factoryIncomplete: string;
  searchOptionsNotSaved: string;
  searchOptionsInvalid: string;
  providerTypeAndName: string;

  // a context selector
  contextPrefixInvalid: string;
  contextNameInvalid: string;
  contextSelectorIncomplete: string;

  // a service's events and webhooks; `index` counts from 0
  serviceEventTypeInvalid: string;
  serviceEventHandlersInvalid: string;
  serviceEventRequired: string;
  serviceEventInvalid: (index: number) => string;
  webhookIncomplete: string;
  webhookHandlerTypeInvalid: string;
  webhookHandlerValueInvalid: string;
  webhookRequired: string;
  serviceWebhookInvalid: (index: number) => string;

  // a processor and its mappings; `index` counts from 0
  processorTypesRequired: string;
  processorInputInvalid: string;
  processorOutputInvalid: string;
  processorMappingsNotList: string;
  mappingInvalidAt: (index: number) => string;
  mappingOutputPathInvalid: (index: number) => string;
  /** A mapping with neither an input path nor options; `outputPath` is the field it maps. */
  mappingNeedsInput: (outputPath: string) => string;

  // tools and Qogs; `index` counts from 0
  toolCatalogNotList: string;
  toolSelectorAt: (index: number) => string;
  qogListNotArray: string;
  qogEntryNameInvalid: (index: number) => string;

  // an API manager; `index` counts from 0
  apiManagerMissing: string;
  apiManagerFactoryInvalid: string;
  apiManagerEndpointsInvalid: string;
  apiEndpointRequired: string;
  endpointValueInvalid: (index: number) => string;
  endpointAuthorizationInvalid: (index: number) => string;
  authorizationMissing: string;
  authorizationNotObject: string;
  authorizationMode: string;
  authorizationAllowAnonymous: string;
  authorizationRolesNotList: string;
  authorizationRoleInvalid: (index: number) => string;

  // options; `name` is the option's key, `index` counts from 0
  optionsRequired: string;
  optionInvalid: (name: string) => string;
  optionSetInvalid: (index: number) => string;
  optionsWithOperatorsRequired: string;
  operatorsInvalid: (name: string) => string;
  optionDependenciesNotFulfilled: (name: string) => string;
  /** A required option with no value. */
  optionRequired: (name: string) => string;
  /** An option required through a group, none of whose options has a value. */
  optionRequiresValue: (name: string) => string;

  // sizes, timeouts, addresses and schema definitions
  byteSizeNotText: string;
  byteSizeNumberInvalid: string;
  byteSizeUnitInvalid: string;
  timeoutMilliseconds: string;
  urlProtocolInvalid: string;
  urlAddressInvalid: string;
  schemaDefinitionNotObject: string;
  schemaDefinitionNoSchema: string;

  // an expression
  expressionEmpty: string;
  /** An expression naming an operation the server's catalogue does not have; `operation` as it is named. */
  noSuchOperation: (operation: string) => string;
  notEnoughArguments: string;
  /** An operand's name where the catalogue gives none; `position` counts from 1. */
  unnamedOperand: (position: number) => string;
  /**
   * An operand holding an expression that has an error. `label` is the operand's name as the editor shows it;
   * `position` (counting from 1, left to right) is given where the name alone does not say which operand it is.
   */
  operandExpressionHasError: (label: string, position?: number) => string;
  /** An operand not filled in yet; `label` and `position` as `operandExpressionHasError`'s. */
  enterOperand: (label: string, position?: number) => string;
  /** An operand whose value is wrong, said before why; `label` and `position` as `operandExpressionHasError`'s. */
  operandInvalid: (label: string, position?: number) => string;
  /** A stored color (`rgbcolor`) with no value. */
  colorNotSet: string;
  /**
   * A stored color written another way: `shown` is the value as written (quoted), `isHex` whether it is a hex code.
   */
  colorStoredAs: (shown: string, isHex: boolean) => string;
  /** A stored color's channels that are missing (`r`, `g`, `b`). */
  colorChannelsMissing: (channels: ('r' | 'g' | 'b')[]) => string;
  /** A channel that is not a whole number from 0 to 255; `shown` is its value as written. */
  colorChannelNotWhole: (channel: 'r' | 'g' | 'b', shown: string) => string;
  /** An opacity (`a`) that is not a number from 0 to 1. */
  colorOpacityInvalid: (shown: string) => string;
  /** Fields a stored color cannot have, as written (quoted). */
  colorExtraFields: (shownKeys: string[]) => string;
  /** What is wrong with a stored color, its problems (each said by the words above) joined in one sentence. */
  colorProblems: (problems: string[]) => string;
}

/** A sentence ends with a stop: one is added where the text has none. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/** The field's type inside a sentence, where the catalogue has no name for it. */
const notA = (type: string | undefined): string => type ?? "of this field's type";

/** 1st, 2nd, 3rd, 4th, … 11th, 12th, 13th, … 21st: a position as it is written. */
const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) {
    return `${n}th`;
  }
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** An operand by its position and name ("the 2nd "Value""), or by its name alone. */
const operand = (label: string, position?: number): string =>
  position === undefined ? `"${label}"` : `the ${ordinal(position)} "${label}"`;

/** The channels of a stored color, with the words a reader knows them by. */
const COLOR_CHANNEL_NAMES = { r: 'red', g: 'green', b: 'blue' } as const;

/** "a", "a and b", "a, b and c". */
const listAnd = (items: string[]): string =>
  items.length < 2 ?
    items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_VALIDATION_LABELS: IValidationLabels = {
  inContext: (context, reason) => `${context}: ${reason}`,

  mustBe: (description) => sentence(`Must be ${description}`),
  mustMatchExpectedForm: (example, pattern) => {
    const main =
      example ?
        `Must match the expected form, for example ${example}.`
      : 'Must match the expected form.';
    return pattern ? `${main} Pattern: ${pattern}` : main;
  },

  valueMustBe: (type) => (type ? `Value must be ${type}` : "Value must be of this field's type"),
  atLeast: (min) => `Value must be ${min} or more`,
  atMost: (max) => `Value must be ${max} or less`,
  textAndTemplatesMakeText: (type) =>
    `Text and more than one template make this text, not ${notA(type)}. Keep one template alone.`,
  templatesSideBySide: (type) =>
    `Templates side by side make this text, not ${notA(type)}. Keep one of them alone.`,
  textAroundTemplate: (texts, type) =>
    `"${texts.join(' … ')}" makes this text, not ${notA(type)}. Delete it to keep the template alone.`,

  missingValue: 'Missing value',
  missingType: 'Missing type',
  templateNeedsKeyAndValue: 'Template must include key and value',
  textEmpty: 'Text value is empty',
  nonEmptyText: 'Value must be a non-empty text',
  notValidFormat: (format) => `Value is not a valid ${format}`,
  notIdentifier: 'Value is not a valid identifier',
  required: 'Value is required',
  notList: 'Value must be a list',
  atLeastOneValue: 'At least one value is required',
  dateInvalid: 'Date is invalid',
  notYaml: 'Value is not valid YAML',
  valueEmpty: 'Value is empty',
  autoTypeInvalid: 'Auto-detected type is invalid',
  nothingNotValid: 'Nothing is not a valid value',

  connectionMissing: 'Connection value is missing',
  connectionNotAllowed: 'Connection is not allowed',
  connectionDisabled: 'Connection is disabled or not authenticated',
  connectionTextInvalid: 'Connection string validation failed',

  binaryNotText: 'Binary value must be a string',
  binaryEmpty: 'Binary value is empty',
  binaryHexInvalid: 'Binary hex value is invalid',
  binaryForm: 'Binary value must be base64, a data: URL, or 0x-prefixed hex',

  fileNameInvalid: 'File name is invalid',
  fileContentInvalid: 'File content is invalid',

  documentsNotList: 'Value must be a list of documents',
  documentRowNotObject: (row) => `Row ${row} is not an object`,
  documentRowNoName: (row) => `Row ${row} is missing a name`,
  documentRowNoContent: (row, name) =>
    `Row ${row} ("${name}") has neither uploaded content nor a server document id`,

  pairsNeedBothFields: 'All pairs must include both fields',
  pairsUniqueKeys: 'Pairs must use unique keys',
  connectorRequired: 'At least one connector is required',
  connectorNameAndMethod: 'Each connector must have a name and method',
  connectorNamesUnique: 'Connector names must be unique',
  classRequired: 'At least one class must be provided',
  classNeedsName: 'Each class must have a name',
  classNamesUnique: 'Class names must be unique',

  cronRequired: 'Cron value is required',
  cronInvalid: 'Cron expression is invalid',

  hashArgumentsInvalid: 'Hash arguments are invalid',
  listItemInvalid: (index) => `List item ${index} is invalid`,
  notListOfHashes: 'Value must be a list of hashes',
  hashEmptyAt: (index) => `Hash at index ${index} must not be empty`,
  hashInvalidAt: (index) => `Hash at index ${index} is invalid`,

  mapperCodeRequired: 'Mapper code is required',
  mapperCodeInvalid: 'Mapper code is invalid',
  mapperMethodInvalid: 'Mapper method is invalid',

  variableTypeInvalid: 'Variable type is invalid',
  variableNameInvalid: 'Variable name is invalid',
  variableActionTypeInvalid: 'Variable action type is invalid',
  transactionActionInvalid: 'Transaction action is invalid',
  variableDataMissing: 'Variable data is missing',
  variableActionInvalid: 'Variable action is invalid',

  providerInvalid: 'Provider value is invalid',
  apiCallNeedsRequests: 'API call must support requests',
  variableProviderNeedsAction: 'Variable provider must support at least one action',
  sendMessageProviderIncomplete: 'Send message provider must include message id and content',
  messageIdInvalid: 'Message id is invalid',
  messageContentMissing: 'Message content is missing',
  messageContentInvalid: 'Message content is invalid',
  argumentsMissing: 'Arguments are missing',
  argumentsInvalid: 'Arguments are invalid',
  searchArgumentsInvalid: 'Search arguments are invalid',
  updateCreateArgumentsInvalid: 'Update/create arguments are invalid',
  factoryOptionsNotSaved: 'Factory options are not saved',
  factoryIncomplete: 'Factory provider is incomplete',
  searchOptionsNotSaved: 'Search options must be saved',
  searchOptionsInvalid: 'Search options are invalid',
  providerTypeAndName: 'Provider type and name required',

  contextPrefixInvalid: 'Context selector prefix is invalid',
  contextNameInvalid: 'Context selector name is invalid',
  contextSelectorIncomplete: 'Context selector requires iface_kind and name',

  serviceEventTypeInvalid: 'Service event type is invalid',
  serviceEventHandlersInvalid: 'Service event handlers are invalid',
  serviceEventRequired: 'At least one service event is required',
  serviceEventInvalid: (index) => `Service event ${index} is invalid`,
  webhookIncomplete: 'Webhook name, method and auth are required',
  webhookHandlerTypeInvalid: 'Webhook handler type is invalid',
  webhookHandlerValueInvalid: 'Webhook handler value is invalid',
  webhookRequired: 'At least one webhook is required',
  serviceWebhookInvalid: (index) => `Service webhook ${index} is invalid`,

  processorTypesRequired: 'Processor input and output types are required',
  processorInputInvalid: 'Processor input type is invalid',
  processorOutputInvalid: 'Processor output type is invalid',
  processorMappingsNotList: 'Processor mappings must be a list',
  mappingInvalidAt: (index) => `Mapping at index ${index} is invalid`,
  mappingOutputPathInvalid: (index) => `Mapping ${index} output path is invalid`,
  mappingNeedsInput: (outputPath) =>
    `Mapping for "${outputPath}" must have an input path or options configured`,

  toolCatalogNotList: 'Tool catalog must be a list',
  toolSelectorAt: (index) => `Tool selector at index ${index} must be a non-empty string`,
  qogListNotArray: 'Qog list must be an array',
  qogEntryNameInvalid: (index) => `Qog entry ${index} name is invalid`,

  apiManagerMissing: 'API manager value is missing',
  apiManagerFactoryInvalid: 'API manager factory is invalid',
  apiManagerEndpointsInvalid: 'API manager endpoints are invalid',
  apiEndpointRequired: 'At least one API endpoint is required',
  endpointValueInvalid: (index) => `Endpoint ${index} value is invalid`,
  endpointAuthorizationInvalid: (index) => `Endpoint ${index} authorization is invalid`,
  authorizationMissing: 'Authorization override is missing',
  authorizationNotObject: 'Authorization override must be an object',
  authorizationMode: 'Authorization mode must be merge or replace',
  authorizationAllowAnonymous: 'Authorization allow_anonymous must be a boolean',
  authorizationRolesNotList: 'Authorization roles must be a list',
  authorizationRoleInvalid: (index) => `Authorization role ${index} is invalid`,

  optionsRequired: 'Options are required',
  optionInvalid: (name) => `Option ${name} is invalid`,
  optionSetInvalid: (index) => `Option set ${index} is invalid`,
  optionsWithOperatorsRequired: 'Options with operators are required',
  operatorsInvalid: (name) => `Operators for option ${name} are invalid`,
  optionDependenciesNotFulfilled: (name) => `Option ${name} dependencies are not fulfilled`,
  optionRequired: (name) => `Option ${name} is required`,
  optionRequiresValue: (name) => `Option ${name} requires a value`,

  byteSizeNotText: 'Byte size must be a string',
  byteSizeNumberInvalid: 'Byte size numeric part is invalid',
  byteSizeUnitInvalid: 'Byte size unit is invalid',
  timeoutMilliseconds: 'Timeout must be a whole number of milliseconds',
  urlProtocolInvalid: 'URL protocol is invalid',
  urlAddressInvalid: 'URL address is invalid',
  schemaDefinitionNotObject: 'Schema definition must be an object',
  schemaDefinitionNoSchema: 'Schema definition must contain a `schema` section',

  expressionEmpty: 'Fill in this expression.',
  noSuchOperation: (operation) => `Qorus has no operation ${operation}.`,
  notEnoughArguments: 'Not enough arguments provided',
  unnamedOperand: (position) => `argument ${position}`,
  operandExpressionHasError: (label, position) =>
    `The expression in ${operand(label, position)} has an error`,
  enterOperand: (label, position) =>
    position === undefined ? `Enter a value for "${label}"` : `Enter ${operand(label, position)}`,
  operandInvalid: (label, position) =>
    position === undefined ?
      `"${label}" is invalid`
    : `The ${ordinal(position)} "${label}" is invalid`,

  colorNotSet: 'No color is set.',
  colorStoredAs: (shown, isHex) =>
    `A color is stored as its red, green and blue values (r, g, b), not as ${isHex ? `the hex code ${shown}` : shown}.`,
  colorChannelsMissing: (channels) =>
    `${listAnd(channels.map((key) => `${COLOR_CHANNEL_NAMES[key]} (${key})`))} ${channels.length === 1 ? 'is' : 'are'} missing`,
  colorChannelNotWhole: (channel, shown) =>
    `${COLOR_CHANNEL_NAMES[channel]} (${channel}) must be a whole number from 0 to 255, not ${shown}`,
  colorOpacityInvalid: (shown) => `opacity (a) must be a number from 0 to 1, not ${shown}`,
  colorExtraFields: (shownKeys) =>
    `the color also has ${listAnd(shownKeys)}, which a stored color can't have`,
  colorProblems: (problems) => {
    const said = problems.join('; ');
    return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
  },
};
