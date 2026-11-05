// Copyright 2026 Qore Technologies, s.r.o.

/** The words of what a validation says of a value. */
export interface IValidationLabels {
  mustBeX: (desc: unknown) => string;
  mustMatchTheExpectedFormFor: (exampleText: unknown) => string;
  mustMatchTheExpectedForm: string;
  xPatternX: (main: unknown, validationregex: unknown) => string;
  valueMustBeXOrMore: (min: unknown) => string;
  valueMustBeXOrLess: (max: unknown) => string;
  valueMustBeX: (named: unknown) => string;
  valueMustBeOfThisField: string;
  ofThisFieldSType: string;
  textAndMoreThanOneTemplate: (notA: unknown) => string;
  templatesSideBySideMakeThis: (notA: unknown) => string;
  xMakesThisTextNotX: (value: unknown, notA: unknown) => string;
  missingValue: string;
  missingType: string;
  templateMustIncludeKeyAndValue: string;
  textValueIsEmpty: string;
  connectionValueIsMissing: string;
  connectionIsNotAllowed: string;
  connectionIsDisabledOrNotAuthenticated: string;
  connectionStringValidationFailed: string;
  valueMustBeANonEmpty: string;
  valueIsNotAValidX: (type: unknown) => string;
  binaryValueMustBeAString: string;
  binaryValueIsEmpty: string;
  binaryHexValueIsInvalid: string;
  binaryValueMustBeBase64A: string;
  valueIsNotAValidIdentifier: string;
  valueIsRequired: string;
  fileNameIsInvalid: string;
  fileContentIsInvalid: string;
  valueMustBeAListOf: string;
  rowXIsNotAnObject: (value: unknown) => string;
  rowXIsMissingAName: (value: unknown) => string;
  rowXXHasNeitherUploaded: (value: unknown, name: unknown) => string;
  contentNorAServerDocumentId: string;
  valueMustBeAList: string;
  allPairsMustIncludeBothFields: string;
  pairsMustUseUniqueKeys: string;
  atLeastOneConnectorIsRequired: string;
  eachConnectorMustHaveAName: string;
  connectorNamesMustBeUnique: string;
  atLeastOneClassMustBe: string;
  eachClassMustHaveAName: string;
  classNamesMustBeUnique: string;
  atLeastOneValueIsRequired: string;
  cronValueIsRequired: string;
  cronExpressionIsInvalid: string;
  dateIsInvalid: string;
  hashArgumentsAreInvalid: string;
  listItemXIsInvalid: (i: unknown) => string;
  valueMustBeAListOf2: string;
  hashAtIndexXMustNot: (i: unknown) => string;
  hashAtIndexXIsInvalid: (i: unknown) => string;
  mapperCodeIsRequired: string;
  mapperCodeIsInvalid: string;
  mapperMethodIsInvalid: string;
  variableTypeIsInvalid: string;
  variableNameIsInvalid: string;
  variableActionTypeIsInvalid: string;
  transactionActionIsInvalid: string;
  variableDataIsMissing: string;
  variableActionIsInvalid: string;
  providerValueIsInvalid: string;
  apiCallMustSupportRequests: string;
  variableProviderMustSupportAtLeast: string;
  sendMessageProviderMustIncludeMessage: string;
  messageIdIsInvalid: string;
  messageContentIsMissing: string;
  messageContentIsInvalid: string;
  argumentsAreMissing: string;
  argumentsAreInvalid: string;
  searchArgumentsAreInvalid: string;
  updateCreateArgumentsAreInvalid: string;
  factoryOptionsAreNotSaved: string;
  factoryProviderIsIncomplete: string;
  searchOptionsMustBeSaved: string;
  searchOptionsAreInvalid: string;
  providerTypeAndNameRequired: string;
  contextSelectorPrefixIsInvalid: string;
  contextSelectorNameIsInvalid: string;
  contextSelectorRequiresIfaceKindAnd: string;
  serviceEventTypeIsInvalid: string;
  serviceEventHandlersAreInvalid: string;
  atLeastOneServiceEventIs: string;
  serviceEventXIsInvalid: (i: unknown) => string;
  webhookNameMethodAndAuthAre: string;
  webhookHandlerTypeIsInvalid: string;
  webhookHandlerValueIsInvalid: string;
  atLeastOneWebhookIsRequired: string;
  serviceWebhookXIsInvalid: (i: unknown) => string;
  valueIsNotValidYAML: string;
  valueIsEmpty: string;
  autoDetectedTypeIsInvalid: string;
  processorInputAndOutputTypesAre: string;
  processorInputTypeIsInvalid: string;
  processorOutputTypeIsInvalid: string;
  processorMappingsMustBeAList: string;
  mappingAtIndexXIsInvalid: (i: unknown) => string;
  mappingXOutputPathIsInvalid: (i: unknown) => string;
  mappingForXMustHaveAn: (outputPath: unknown) => string;
  toolCatalogMustBeAList: string;
  toolSelectorAtIndexXMust: (i: unknown) => string;
  qogListMustBeAnArray: string;
  qogEntryXNameIsInvalid: (i: unknown) => string;
  apiManagerValueIsMissing: string;
  apiManagerFactoryIsInvalid: string;
  apiManagerEndpointsAreInvalid: string;
  atLeastOneAPIEndpointIs: string;
  endpointXValueIsInvalid: (i: unknown) => string;
  endpointXAuthorizationIsInvalid: (i: unknown) => string;
  optionsAreRequired: string;
  optionXIsInvalid: (name: unknown) => string;
  optionXIsInvalid2: (option: unknown) => string;
  optionSetXIsInvalid: (i: unknown) => string;
  optionsWithOperatorsAreRequired: string;
  operatorsForOptionXAreInvalid: (option: unknown) => string;
  byteSizeMustBeAString: string;
  byteSizeNumericPartIsInvalid: string;
  byteSizeUnitIsInvalid: string;
  timeoutMustBeAWholeNumber: string;
  urlProtocolIsInvalid: string;
  urlAddressIsInvalid: string;
  schemaDefinitionMustBeAnObject: string;
  schemaDefinitionMustContainASchema: string;
  fillInThisExpression: string;
  chooseWhatThisExpressionDoes: string;
  qorusHasNoOperationX: (value: unknown) => string;
  notEnoughArgumentsProvided: string;
  argumentX: (value: unknown) => string;
  theXX: (value: unknown, argLabel: unknown) => string;
  theExpressionInXHasAn: (value: unknown) => string;
  enterX: (operand: unknown) => string;
  enterAValueForX: (argLabel: unknown) => string;
  xIsInvalid: (value: unknown) => string;
  xIsInvalid2: (argLabel: unknown) => string;
  nothingIsNotAValidValue: string;
  optionXDependenciesAreNotFulfilled: (name: unknown) => string;
  optionXIsRequired: (name: unknown) => string;
  optionXRequiresAValue: (name: unknown) => string;
  thisFieldIsRequired: string;
  thisFieldOrXIsRequired: (requiredOptions: unknown) => string;
  thisValueIsNotAvailable: string;
  xIsNotOneOfThe: (value: unknown) => string;
  xAndXAreNotAmong: (value: unknown, value2: unknown) => string;
  xMustEvaluateToTrueOr: (value: unknown, value2: unknown) => string;
  thisExpressionGivesXButThis: (value: unknown, takes: unknown) => string;
  thisExpressionGivesXWhichThis: (value: unknown) => string;
  convertedXX: (value: unknown, value2: unknown) => string;
  theConditionEvaluatesToXQorus: (named: unknown) => string;
  theConditionEvaluatesToXQorus2: (named: unknown) => string;
  theConditionEvaluatesToXQorus3: (named: unknown) => string;
  theConditionSValueIsNot: string;
  theConditionEvaluatesToXBut: (typeInSentence: unknown) => string;
  theCondition: string;
  fromX: (from: unknown) => string;
  toX: (to: unknown) => string;
  xAndX: (value: unknown, value2: unknown) => string;
  aColorIsStoredAsIts: string;
  noColorIsSet: string;
  xNotAsX: (STOREDAS: unknown, value: unknown) => string;
  xNotAsTheHexCode: (STOREDAS: unknown, value: unknown) => string;
  xXMissing: (value: unknown, value2: unknown) => string;
  xXMustBeAWhole: (name: unknown, key: unknown, value: unknown) => string;
  opacityAMustBeANumber: (value: unknown) => string;
  theColorAlsoHasXWhich: (value: unknown) => string;
  theHexCodeX: (value: unknown) => string;
  colorStoredAs: string;
  authorizationOverrideMissing: string;
  authorizationOverrideObject: string;
  authorizationMode: string;
  authorizationAllowAnonymous: string;
  authorizationRolesList: string;
  authorizationRoleInvalid: (i: unknown) => string;
  noValueDescription: string;
  noFieldDescription: string;
}

/** The English words. */
export const DEFAULT_VALIDATION_LABELS: IValidationLabels = {
  mustBeX: (desc) => `Must be ${desc}`,
  mustMatchTheExpectedFormFor: (exampleText) =>
    `Must match the expected form, for example ${exampleText}.`,
  mustMatchTheExpectedForm: 'Must match the expected form.',
  xPatternX: (main, validationregex) => `${main} Pattern: ${validationregex}`,
  valueMustBeXOrMore: (min) => `Value must be ${min} or more`,
  valueMustBeXOrLess: (max) => `Value must be ${max} or less`,
  valueMustBeX: (named) => `Value must be ${named}`,
  valueMustBeOfThisField: "Value must be of this field's type",
  ofThisFieldSType: "of this field's type",
  textAndMoreThanOneTemplate: (notA) =>
    `Text and more than one template make this text, not ${notA}. Keep one template alone.`,
  templatesSideBySideMakeThis: (notA) =>
    `Templates side by side make this text, not ${notA}. Keep one of them alone.`,
  xMakesThisTextNotX: (value, notA) =>
    `"${value}" makes this text, not ${notA}. Delete it to keep the template alone.`,
  missingValue: 'Missing value',
  missingType: 'Missing type',
  templateMustIncludeKeyAndValue: 'Template must include key and value',
  textValueIsEmpty: 'Text value is empty',
  connectionValueIsMissing: 'Connection value is missing',
  connectionIsNotAllowed: 'Connection is not allowed',
  connectionIsDisabledOrNotAuthenticated: 'Connection is disabled or not authenticated',
  connectionStringValidationFailed: 'Connection string validation failed',
  valueMustBeANonEmpty: 'Value must be a non-empty text',
  valueIsNotAValidX: (type) => `Value is not a valid ${type}`,
  binaryValueMustBeAString: 'Binary value must be a string',
  binaryValueIsEmpty: 'Binary value is empty',
  binaryHexValueIsInvalid: 'Binary hex value is invalid',
  binaryValueMustBeBase64A: 'Binary value must be base64, a data: URL, or 0x-prefixed hex',
  valueIsNotAValidIdentifier: 'Value is not a valid identifier',
  valueIsRequired: 'Value is required',
  fileNameIsInvalid: 'File name is invalid',
  fileContentIsInvalid: 'File content is invalid',
  valueMustBeAListOf: 'Value must be a list of documents',
  rowXIsNotAnObject: (value) => `Row ${value} is not an object`,
  rowXIsMissingAName: (value) => `Row ${value} is missing a name`,
  rowXXHasNeitherUploaded: (value, name) => `Row ${value} ("${name}") has neither uploaded `,
  contentNorAServerDocumentId: 'content nor a server document id',
  valueMustBeAList: 'Value must be a list',
  allPairsMustIncludeBothFields: 'All pairs must include both fields',
  pairsMustUseUniqueKeys: 'Pairs must use unique keys',
  atLeastOneConnectorIsRequired: 'At least one connector is required',
  eachConnectorMustHaveAName: 'Each connector must have a name and method',
  connectorNamesMustBeUnique: 'Connector names must be unique',
  atLeastOneClassMustBe: 'At least one class must be provided',
  eachClassMustHaveAName: 'Each class must have a name',
  classNamesMustBeUnique: 'Class names must be unique',
  atLeastOneValueIsRequired: 'At least one value is required',
  cronValueIsRequired: 'Cron value is required',
  cronExpressionIsInvalid: 'Cron expression is invalid',
  dateIsInvalid: 'Date is invalid',
  hashArgumentsAreInvalid: 'Hash arguments are invalid',
  listItemXIsInvalid: (i) => `List item ${i} is invalid`,
  valueMustBeAListOf2: 'Value must be a list of hashes',
  hashAtIndexXMustNot: (i) => `Hash at index ${i} must not be empty`,
  hashAtIndexXIsInvalid: (i) => `Hash at index ${i} is invalid`,
  mapperCodeIsRequired: 'Mapper code is required',
  mapperCodeIsInvalid: 'Mapper code is invalid',
  mapperMethodIsInvalid: 'Mapper method is invalid',
  variableTypeIsInvalid: 'Variable type is invalid',
  variableNameIsInvalid: 'Variable name is invalid',
  variableActionTypeIsInvalid: 'Variable action type is invalid',
  transactionActionIsInvalid: 'Transaction action is invalid',
  variableDataIsMissing: 'Variable data is missing',
  variableActionIsInvalid: 'Variable action is invalid',
  providerValueIsInvalid: 'Provider value is invalid',
  apiCallMustSupportRequests: 'API call must support requests',
  variableProviderMustSupportAtLeast: 'Variable provider must support at least one action',
  sendMessageProviderMustIncludeMessage:
    'Send message provider must include message id and content',
  messageIdIsInvalid: 'Message id is invalid',
  messageContentIsMissing: 'Message content is missing',
  messageContentIsInvalid: 'Message content is invalid',
  argumentsAreMissing: 'Arguments are missing',
  argumentsAreInvalid: 'Arguments are invalid',
  searchArgumentsAreInvalid: 'Search arguments are invalid',
  updateCreateArgumentsAreInvalid: 'Update/create arguments are invalid',
  factoryOptionsAreNotSaved: 'Factory options are not saved',
  factoryProviderIsIncomplete: 'Factory provider is incomplete',
  searchOptionsMustBeSaved: 'Search options must be saved',
  searchOptionsAreInvalid: 'Search options are invalid',
  providerTypeAndNameRequired: 'Provider type and name required',
  contextSelectorPrefixIsInvalid: 'Context selector prefix is invalid',
  contextSelectorNameIsInvalid: 'Context selector name is invalid',
  contextSelectorRequiresIfaceKindAnd: 'Context selector requires iface_kind and name',
  serviceEventTypeIsInvalid: 'Service event type is invalid',
  serviceEventHandlersAreInvalid: 'Service event handlers are invalid',
  atLeastOneServiceEventIs: 'At least one service event is required',
  serviceEventXIsInvalid: (i) => `Service event ${i} is invalid`,
  webhookNameMethodAndAuthAre: 'Webhook name, method and auth are required',
  webhookHandlerTypeIsInvalid: 'Webhook handler type is invalid',
  webhookHandlerValueIsInvalid: 'Webhook handler value is invalid',
  atLeastOneWebhookIsRequired: 'At least one webhook is required',
  serviceWebhookXIsInvalid: (i) => `Service webhook ${i} is invalid`,
  valueIsNotValidYAML: 'Value is not valid YAML',
  valueIsEmpty: 'Value is empty',
  autoDetectedTypeIsInvalid: 'Auto-detected type is invalid',
  processorInputAndOutputTypesAre: 'Processor input and output types are required',
  processorInputTypeIsInvalid: 'Processor input type is invalid',
  processorOutputTypeIsInvalid: 'Processor output type is invalid',
  processorMappingsMustBeAList: 'Processor mappings must be a list',
  mappingAtIndexXIsInvalid: (i) => `Mapping at index ${i} is invalid`,
  mappingXOutputPathIsInvalid: (i) => `Mapping ${i} output path is invalid`,
  mappingForXMustHaveAn: (outputPath) =>
    `Mapping for "${outputPath}" must have an input path or options configured`,
  toolCatalogMustBeAList: 'Tool catalog must be a list',
  toolSelectorAtIndexXMust: (i) => `Tool selector at index ${i} must be a non-empty string`,
  qogListMustBeAnArray: 'Qog list must be an array',
  qogEntryXNameIsInvalid: (i) => `Qog entry ${i} name is invalid`,
  apiManagerValueIsMissing: 'API manager value is missing',
  apiManagerFactoryIsInvalid: 'API manager factory is invalid',
  apiManagerEndpointsAreInvalid: 'API manager endpoints are invalid',
  atLeastOneAPIEndpointIs: 'At least one API endpoint is required',
  endpointXValueIsInvalid: (i) => `Endpoint ${i} value is invalid`,
  endpointXAuthorizationIsInvalid: (i) => `Endpoint ${i} authorization is invalid`,
  optionsAreRequired: 'Options are required',
  optionXIsInvalid: (name) => `Option ${name} is invalid`,
  optionXIsInvalid2: (option) => `Option ${option} is invalid`,
  optionSetXIsInvalid: (i) => `Option set ${i} is invalid`,
  optionsWithOperatorsAreRequired: 'Options with operators are required',
  operatorsForOptionXAreInvalid: (option) => `Operators for option ${option} are invalid`,
  byteSizeMustBeAString: 'Byte size must be a string',
  byteSizeNumericPartIsInvalid: 'Byte size numeric part is invalid',
  byteSizeUnitIsInvalid: 'Byte size unit is invalid',
  timeoutMustBeAWholeNumber: 'Timeout must be a whole number of milliseconds',
  urlProtocolIsInvalid: 'URL protocol is invalid',
  urlAddressIsInvalid: 'URL address is invalid',
  schemaDefinitionMustBeAnObject: 'Schema definition must be an object',
  schemaDefinitionMustContainASchema: 'Schema definition must contain a `schema` section',
  fillInThisExpression: 'Fill in this expression.',
  chooseWhatThisExpressionDoes: 'Choose what this expression does.',
  qorusHasNoOperationX: (value) => `Qorus has no operation ${value}.`,
  notEnoughArgumentsProvided: 'Not enough arguments provided',
  argumentX: (value) => `argument ${value}`,
  theXX: (value, argLabel) => `the ${value} "${argLabel}"`,
  theExpressionInXHasAn: (value) => `The expression in ${value} has an error`,
  enterX: (operand) => `Enter ${operand}`,
  enterAValueForX: (argLabel) => `Enter a value for "${argLabel}"`,
  xIsInvalid: (value) => `${value} is invalid`,
  xIsInvalid2: (argLabel) => `"${argLabel}" is invalid`,
  nothingIsNotAValidValue: 'Nothing is not a valid value',
  optionXDependenciesAreNotFulfilled: (name) => `Option ${name} dependencies are not fulfilled`,
  optionXIsRequired: (name) => `Option ${name} is required`,
  optionXRequiresAValue: (name) => `Option ${name} requires a value`,
  thisFieldIsRequired: 'This field is required',
  thisFieldOrXIsRequired: (requiredOptions) => `This field or ${requiredOptions} is required`,
  thisValueIsNotAvailable: 'This value is not available',
  xIsNotOneOfThe: (value) => `${value} is not one of the choices`,
  xAndXAreNotAmong: (value, value2) => `${value} and ${value2} are not among the choices`,
  xMustEvaluateToTrueOr: (value, value2) =>
    `${value} must evaluate to true or false. Compare the value instead, for example ${value2}.`,
  thisExpressionGivesXButThis: (value, takes) =>
    `This expression gives ${value}, but this field takes ${takes}. Choose an expression that gives ${takes}, or put this one inside an expression that converts it.`,
  thisExpressionGivesXWhichThis: (value) =>
    `This expression gives ${value}, which this field does not take. Choose another expression, or put this one inside an expression that converts it.`,
  convertedXX: (value, value2) => `Converted${value}${value2}`,
  theConditionEvaluatesToXQorus: (named) =>
    `The condition evaluates to ${named}; Qorus treats it as true unless it is 0. To make that explicit, compare it, for example @count > 0.`,
  theConditionEvaluatesToXQorus2: (named) =>
    `The condition evaluates to ${named}; Qorus treats it as true unless it is empty. To make that explicit, compare its size, for example size(@items) > 0.`,
  theConditionEvaluatesToXQorus3: (named) =>
    `The condition evaluates to ${named}; Qorus treats it as true unless it holds no pairs. To make that explicit, compare its size, for example size(@details) > 0.`,
  theConditionSValueIsNot:
    "The condition's value is not true or false; Qorus treats it as true unless it is 0 or empty. To make that explicit, compare it, for example @count > 0.",
  theConditionEvaluatesToXBut: (typeInSentence) =>
    `The condition evaluates to ${typeInSentence}, but it`,
  theCondition: 'The condition',
  fromX: (from) => ` from ${from}`,
  toX: (to) => ` to ${to}`,
  xAndX: (value, value2) => `${value} and ${value2}`,
  aColorIsStoredAsIts: 'A color is stored as its red, green and blue values (r, g, b)',
  noColorIsSet: 'No color is set.',
  xNotAsX: (STOREDAS, value) => `${STOREDAS}, not as ${value}.`,
  xNotAsTheHexCode: (STOREDAS, value) => `${STOREDAS}, not as the hex code ${value}.`,
  xXMissing: (value, value2) => `${value} ${value2} missing`,
  xXMustBeAWhole: (name, key, value) =>
    `${name} (${key}) must be a whole number from 0 to 255, not ${value}`,
  opacityAMustBeANumber: (value) => `opacity (a) must be a number from 0 to 1, not ${value}`,
  theColorAlsoHasXWhich: (value) => `the color also has ${value}, which a stored color can't have`,
  theHexCodeX: (value) => `the hex code ${value}`,
  colorStoredAs: 'A color is stored as its red, green and blue values (r, g, b)',
  authorizationOverrideMissing: 'Authorization override is missing',
  authorizationOverrideObject: 'Authorization override must be an object',
  authorizationMode: 'Authorization mode must be merge or replace',
  authorizationAllowAnonymous: 'Authorization allow_anonymous must be a boolean',
  authorizationRolesList: 'Authorization roles must be a list',
  authorizationRoleInvalid: (i) => `Authorization role ${i} is invalid`,
  noValueDescription: 'No description was given for this value.',
  noFieldDescription: 'No description was given for this field.',
};
