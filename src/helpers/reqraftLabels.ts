// Copyright 2026 Qore Technologies, s.r.o.
import { useSyncExternalStore } from 'react';
import { DEFAULT_COLOR_VALUE_LABELS, IReqraftColorValueLabels } from '../components/colorValue/labels';
import {
  DEFAULT_COLOR_FORM_FIELD_LABELS,
  IColorFormFieldLabels,
} from '../components/form/fields/color/labels';
import {
  DEFAULT_TEMPLATE_LIST_LABELS,
  DEFAULT_TEMPLATE_PICKER_LABELS,
  IReqraftTemplateListLabels,
  ITemplatePickerLabels,
} from './templateListLabels';

/**
 * The words of the template tree: what a row says a node is, its groups, and what a template's color means. Read by
 * the picker, typing in a field and hovers alike.
 */
export interface ITemplateTreeLabels {
  /** What a row says a node is. */
  kinds: Record<
    'state' | 'context' | 'config' | 'variable' | 'field' | 'template' | 'function' | 'keyword',
    string
  >;
  recordFields: string;
  recordFieldsDescription: string;
  templateContexts: string;
  templateContextsDescription: string;
  /** The contexts group as a language server offers it. */
  serverContextsDescription: string;
  functions: string;
  functionsDescription: string;
  valuesAndKeywords: string;
  valuesAndKeywordsDescription: string;
  /** What a template's color means. */
  intentMeanings: { success: string; custom1: string; info: string };
  /** What a diagnostic says of a reference that names nothing here. */
  referenceNamesNothing: (written: string) => string;
}

/** The words of a template field's own controls and of the picker's search, levels and states. */
export interface ITemplateFieldLabels {
  setCustomValue: string;
  selectTemplate: string;
  allowedValuesWarning: string;
  removeTemplateValue: string;
  /** The tooltip of the offer to read text a field holds as an expression. */
  expressionOffer: (text: string) => string;
  useAsExpression: string;
  keepAsPlainText: string;
  keepAsPlainTextInstead: (text: string) => string;
  undo: string;
  writeCondition: string;
  useExpression: string;
  runFunction: string;
  useTemplate: string;
  useTemplateTooltip: string;
  noTemplatesOnOffer: string;
  useCustomValue: string;
  useCustomValueTooltip: string;
  createNewExpression: string;
  takesExpression: string;
  setValue: string;
  /** The tooltip of a chip whose reference is not one of the values offered, where the host says nothing else. */
  unlistedReference: string;
}

/**
 * The words of the value tabs (qorus#646). A host that translates its interface passes its own; a label that
 * holds a value is a function of it, so the host keeps its language's word order.
 */
export interface IValueTabsLabels {
  value: string;
  expression: string;
  visual: string;
  template: string;
  expressionTooltip: string;
  visualTooltip: string;
  templateTooltip: string;
  /** Said on the Value tab for an expression that is not a lone value or template. */
  cannotShowExpression: string;
  /**
   * The Expression tab's tooltip, in a field that is a condition (`isConditionOption`). The tab keeps its name:
   * a condition is written as an expression, and the hover says so (qorus#646, David: "what is "Condition"? Is
   * it meant to be an expression?").
   */
  conditionTooltip: string;
  /** The Visual tab's tooltip, in a condition field. */
  conditionVisualTooltip: string;
  /** Said on the Value tab for a condition that is not a lone value or template. */
  cannotShowCondition: string;
  /** Said on the Value tab for a template it cannot show; `tab` is the tab's own label. */
  templateShownOn: (tab: string) => string;
  replaceWithAValue: string;
  /** A template of another type than the field's; `from` and `to` name the types inside the sentence. */
  conversion: (from: string, to: string) => string;
  /**
   * The name of a type inside `conversion`'s sentence. Unless a host gives its own, it is the type catalogue's
   * sentence form ("a whole number"), in the language the server answered in (qorus#646).
   */
  typeName?: (type: string) => string;
  undo: string;
  /** The undo's tooltip; `text` is what was typed. */
  undoTooltip: (text: string) => string;
  /**
   * Said on the Value tab while the Expression tab holds text that does not parse: the field keeps the value
   * shown here, and the text waits there with its error (qorus#646).
   */
  expressionDraftNotUsed?: string;
}

/** The words of the menu of saved values of a template field. */
export interface ISavedValuesLabels {
  save: string;
  saveTooltip: string;
  use: string;
  remove: string;
}

/** The words of the template picker's search, levels and states; its actions are `ITemplatePickerLabels`. */
export interface ITemplateBrowserLabels {
  whereYouAre: string;
  back: string;
  templates: string;
  searchTemplates: string;
  searchIn: (level: string) => string;
  onlyIn: (level: string) => string;
  searchEverywhere: string;
  keyReads: (key: string, format: string) => string;
  keyFree: (key: string) => string;
  keyIn: (key: string) => string;
  use: string;
  useNamed: (label: string) => string;
  useWhole: (label: string) => string;
  loadFailed: (label: string, reason?: string) => string;
  retry: string;
  loading: string;
  noMatch: (query: string) => string;
  nothingHere: string;
  showMore: (count: number, left: number) => string;
  universalValues: string;
}

/** The words of an editor that completes as it is typed in (DPQL and any other language it edits). */
export interface IEditorLabels {
  noValueAtTheEnd: string;
  templateContext: string;
  templatesSection: string;
  noRecordFields: string;
  noTemplates: string;
  unfinishedParts: (hole: string) => string;
  browseAllTemplates: string;
  allOf: (context: string) => string;
  inTrail: (trail: string) => string;
  fromSource: (source: string) => string;
  writeInContext: (context: string) => string;
  valueAfterIt: string;
  noLspConnection: string;
  validationFailed: string;
  warning: string;
  hideWhatItIs: (label: string) => string;
  showWhatItIs: (label: string) => string;
  whatItIs: (label: string) => string;
  loadingCompletions: string;
  noAlternatives: string;
  insertTemplate: string;
  connecting: string;
  loadingSchema: string;
  loading: string;
  showWordAtCursor: string;
  details: string;
  /** A language server's completion kinds (LSP `CompletionItemKind`), each a section of the list. */
  completionSections: Record<number, string>;
  otherSection: string;
  /** The same kinds, as the chip of one completion. */
  completionKinds: Record<number, string>;
  findInText: string;
  find: string;
  noSearch: string;
  matchOf: (current: number, total: number) => string;
  noResults: string;
  matchCase: string;
  previousMatch: string;
  previousMatchTooltip: string;
  nextMatch: string;
  nextMatchTooltip: string;
  hideReplace: string;
  replace: string;
  closeSearch: string;
  closeSearchTooltip: string;
  replaceWith: string;
  replaceAll: string;
}

/** The words of a form: its rows, toolbar, boxes, messages and what a value reads as in its row. */
export interface IFormEngineLabels {
  opensInNewTab: (address: string) => string;
  valueIsExpression: string;
  oneOf: string;
  coveredBy: (label: string) => string;
  covers: string;
  revertChanges: string;
  clearValue: string;
  clearValueConfirm: (label: string) => string;
  draft: string;
  cancelEdit: string;
  cancelEditTooltip: string;
  closeField: string;
  done: string;
  defaultIs: (value: string, description: string) => string;
  takes: (type: string) => string;
  noDescription: string;
  helpOn: (label: string) => string;
  help: string;
  helpFor: (name: string) => string;
  moreActions: string;
  actionNumber: (index: number) => string;
  viewFullscreen: string;
  editFullscreen: string;
  removeField: string;
  collapse: (label: string) => string;
  focusedView: string;
  lineCount: (count: number) => string;
  charCount: (count: number) => string;
  fieldDisabled: string;
  setByServer: string;
  dependenciesNotFulfilled: string;
  dependencyUnset: (label: string) => string;
  dependsOnOthers: string;
  unlockedBy: string;
  anyOf: string;
  edit: (label: string) => string;
  view: (label: string) => string;
  fieldActions: string;
  sortDefault: string;
  sortDefaultTooltip: string;
  sortAlpha: string;
  sortAlphaTooltip: string;
  sortAlphaDesc: string;
  sortAlphaDescTooltip: string;
  sortUnset: string;
  sortUnsetTooltip: string;
  sortInvalid: string;
  sortInvalidTooltip: string;
  incomplete: string;
  ready: string;
  needAttention: (count: number) => string;
  filterFields: string;
  fields: string;
  requiredOnly: string;
  requiredOnlyTooltip: string;
  showFieldTypes: string;
  hideFieldTypes: string;
  showFieldTypesTooltip: string;
  sortBy: string;
  selectAll: string;
  selectAllTooltip: string;
  defaultFields: string;
  defaultFieldsTooltip: string;
  revertAll: string;
  revertAllTooltip: string;
  hideAllInformation: string;
  showAllInformation: string;
  failedToLoadOptions: string;
  dependentOptionsWarning: string;
  boxAttention: string;
  boxSet: string;
  boxOptional: string;
  oneOfRequired: string;
  nothingSet: string;
  noFieldsMatch: string;
  showFewer: string;
  moreFields: (count: number, optional: boolean) => string;
  unsavedChanges: (count: number) => string;
  applyChanges: string;
  resolveInvalid: string;
  save: string;
  discard: string;
  noOptions: string;
  searchOptionsRequired: string;
  showingInvalidOnly: string;
  invalidFields: (count: number) => string;
  fieldsNotSupported: (count: number) => string;
  moreOptions: string;
  clickToLearnMore: string;
  focusedEditing: string;
  removeValue: string;
  removeOption: string;
  removeSelectedOption: string;
  revertChangesTitle: string;
  hiddenUntilItApplies: (label: string, conditions: string, invalidReason?: string) => string;
  mustHaveNoValue: (label: string) => string;
  mustBe: (label: string, value: string) => string;
  mustNotBe: (label: string, value: string) => string;
  /** How a field's alternative dependencies are joined: "a or b". */
  orJoin: (alternatives: string[]) => string;
  unavailable: (dependsOn?: string) => string;
  disabledByDependencies: (dependsOn?: string) => string;
  valueNotValid: string;
  required: string;
  noStructuredData: string;
  itemCount: (count: number) => string;
  fieldCount: (count: number) => string;
  set: string;
  beforeSaving: (name: string, why: string | undefined, more: number) => string;
  schema: string;
  tableCount: (count: number) => string;
  expression: string;
  yes: string;
  no: string;
  /** A timeout in its row: `45 seconds`. */
  timeoutValue: (amount: number, unit: string) => string;
  timeoutUnits: Record<'ms' | 'seconds' | 'minutes' | 'hours', string>;
}

/** The words of a form's field types. */
export interface IFormFieldLabels {
  selectOneOrMore: string;
  selectOne: string;
  savedAndSuggested: string;
  removeItem: string;
  addNewItem: string;
  addNewItemFor: (name: string) => string;
  edit: string;
  remove: string;
  saveChanges: string;
  addItem: string;
  cancelEditing: string;
  schemaNotLoaded: (schema: string) => string;
  binaryPlaceholder: string;
  unknownType: string;
  unsetNull: string;
  setAsNull: string;
  cronFields: [string, string, string, string, string];
  uploadFile: string;
  buildFile: string;
  uploadedFile: string;
  uploadDifferentFile: (extensions: string) => string;
  dropFilesHere: string;
  save: string;
  discard: string;
  notValid: (format: string) => string;
  editor: string;
  text: string;
  newList: string;
  newObject: string;
  noData: string;
  pleaseSelect: string;
  chosen: string;
  selectFromItems: string;
}

/** The words of the buttons that switch an expression between its text and its visual form. */
export interface IExpressionModeLabels {
  text: string;
  visual: string;
  /** The Text button's hover when there is no language server to write the expression with. */
  textUnavailable: string;
}

/** The words of an expression's field and builder. */
export interface IExpressionLabels {
  notRendered: string;
  textCannotBeRead: string;
  mayNotFit: string;
  doesNotFit: string;
  typeMismatch: (inferred: string | undefined, target: string | undefined) => string;
  convertedWhenItRuns: string;
  preview: string;
  cannotBeShownAsText: string;
  textNeedsServer: string;
  notAcceptedType: (types: string) => string;
  typeFitsMayConvert: string;
  typeNeededHere: (types: string) => string;
  otherTypeNeeded: string;
  addArgument: (name: string) => string;
  fillInCurrentFirst: string;
  addAnother: (name: string) => string;
  dragToReorder: string;
  positionTooltip: string;
  removeArgument: string;
  transformedCount: (count: number) => string;
  confirmMismatched: string;
  discardAll: string;
  acceptAll: string;
  confirmSelection: string;
  typesDiffer: string;
  deselectToKeep: string;
  clearedNotConverted: string;
  noConversionNeeded: string;
  confirmTypeSelection: string;
  needsOneOfTypes: string;
  useTypeAnyway: string;
  dontShowAgain: string;
  moveBefore: string;
  moveAfter: string;
  moveToStart: string;
  moveToEnd: string;
  moveArgument: string;
  removeNamed: (name: string) => string;
  runsOutside: string;
  selectOperation: string;
  wrap: string;
  wrapTooltip: string;
  remove: string;
  unwrapTooltip: string;
  explain: string;
  hideExplanation: string;
  showExplanationTooltip: string;
  hideExplanationTooltip: string;
  removeTooltip: string;
  cancel: string;
  confirm: string;
  selectTemplateOrField: string;
  selectField: string;
  selectTemplate: string;
  couldNotCheck: string;
  choosePart: (takes?: string) => string;
  chooseExpression: (takes?: string) => string;
  loading: string;
  atLeastOne: string;
  allOfThese: string;
  ifCondition: string;
  addCondition: string;
  focusedEditing: string;
  moveToPosition: string;
  currentPosition: string;
  moveToOrdinal: (ordinal: string) => string;
  moveToThatPosition: string;
  more: string;
  invalidSummary: string;
  /** An argument's position: 1st, 2nd, 3rd. */
  ordinal: (position: number) => string;
}

/**
 * The words of the schema editor. A hint is written with `**` around what is drawn in bold. A section's name comes from
 * the catalogue that defines it, in that catalogue's language.
 */
export interface ISchemaDefinitionLabels {
  uniqueNameShort: string;
  uniqueNameLong: string;
  noValuesSet: string;
  removeNoun: (noun: string) => string;
  removeNounConfirm: (noun: string, title: string) => string;
  name: string;
  noneDefined: (section: string) => string;
  addSingular: (singular: string) => string;
  nameInUse: string;
  nameInUseContent: (singular: string, name: string) => string;
  order: string;
  moveUp: string;
  moveDown: string;
  numbered: (singular: string, position: number) => string;
  nameMismatch: string;
  nameMismatchContent: (schemaName: string, wrapperName: string) => string;
  syncName: string;
  structureChanged: string;
  structureChangedContent: (version: string) => string;
  addMigrationBlock: string;
  saveRejected: string;
  loading: string;
  removeMigrationBlock: string;
  removeMigrationBlockConfirm: (version: string) => string;
  removeBlock: string;
  noMigrationsReadOnly: string;
  noMigrations: string;
  migrationsHintTitle: string;
  migrationsHint: string;
  noVersion: string;
  stepCount: (count: number) => string;
  moveEarlier: string;
  moveLater: string;
  table: string;
  tableName: string;
  removeTable: string;
  removeTableConfirm: (table: string, columns: number) => string;
  noTablesReadOnly: string;
  noTables: string;
  addTable: string;
  tablesHintTitle: string;
  tablesHint: string;
  columnCount: (count: number) => string;
  catalogNotLoaded: string;
  sectionSchema: string;
  sectionTables: string;
  sectionSequences: string;
  sectionReferenceData: string;
  sectionMigrations: string;
  sectionAdvanced: string;
  editorHintTitle: string;
  editorHint: string;
  referenceHintTitle: string;
  referenceHint: string;
  loadingEditor: string;
  optionsNotLoaded: string;
}

/** The words a type is named with inside a sentence, where the server's catalogue has not said. */
export interface ITypeCatalogueLabels {
  valueOfType: (type: string) => string;
  unknownType: string;
  /** The built-in catalogue's sentence forms, by type name; those of the server's are in its language already. */
  sentenceForms: Record<string, string>;
}

/** Every word Reqraft draws that a host can give in its own language, by where it is drawn. */
export interface IReqraftLabels {
  templateList: IReqraftTemplateListLabels;
  templatePicker: ITemplatePickerLabels;
  templateTree: ITemplateTreeLabels;
  templateField: ITemplateFieldLabels;
  valueTabs: IValueTabsLabels;
  savedValues: ISavedValuesLabels;
  templateBrowser: ITemplateBrowserLabels;
  editor: IEditorLabels;
  formEngine: IFormEngineLabels;
  formFields: IFormFieldLabels;
  colorField: IColorFormFieldLabels;
  colorValue: IReqraftColorValueLabels;
  expressionMode: IExpressionModeLabels;
  expression: IExpressionLabels;
  schemaDefinition: ISchemaDefinitionLabels;
  typeCatalogue: ITypeCatalogueLabels;
}

/** What a host gives: any of the words of any part, and one or more entries of a part's maps. */
export type TReqraftLabelOverrides = {
  [Part in keyof IReqraftLabels]?: {
    [Word in keyof IReqraftLabels[Part]]?: IReqraftLabels[Part][Word] extends (...args: never[]) => unknown ?
      IReqraftLabels[Part][Word]
    : IReqraftLabels[Part][Word] extends readonly unknown[] ? IReqraftLabels[Part][Word]
    : IReqraftLabels[Part][Word] extends object ? Partial<IReqraftLabels[Part][Word]>
    : IReqraftLabels[Part][Word];
  };
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const ordinalInEnglish = (n: number): string => {
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

/** The English words: what a host gets for any word it does not give. */
export const DEFAULT_REQRAFT_LABELS: IReqraftLabels = {
  templateList: DEFAULT_TEMPLATE_LIST_LABELS,
  templatePicker: DEFAULT_TEMPLATE_PICKER_LABELS,
  templateTree: {
    kinds: {
      state: 'State data',
      context: 'Context',
      config: 'Config',
      variable: 'Variable',
      field: 'Field',
      template: 'Template',
      function: 'Function',
      keyword: 'Keyword',
    },
    recordFields: 'Record fields',
    recordFieldsDescription: 'The fields of the record the expression is about',
    templateContexts: 'Template contexts',
    templateContextsDescription: 'Each context, to pick what is in it or to take it whole',
    serverContextsDescription: 'Write one and pick what is in it',
    functions: 'Functions',
    functionsDescription: 'What the expression can call',
    valuesAndKeywords: 'Values and keywords',
    valuesAndKeywordsDescription: 'Literal values and operators',
    intentMeanings: {
      success: 'From the event that starts the Qog.',
      custom1: 'A value Qorus gives.',
      info: 'Any other data this value can use.',
    },
    referenceNamesNothing: (written) =>
      `No template here is called \`${written}\`: pick one from the list, or remove it.`,
  },
  templateField: {
    setCustomValue: 'Set Custom Value',
    selectTemplate: 'Select Template',
    allowedValuesWarning:
      'This field has pre-defined allowed values, make sure the template you select is compatible with those',
    removeTemplateValue: 'Remove template value',
    expressionOffer: (text) =>
      `"${text}" could be an expression. It is kept as text; use it as an expression instead?`,
    useAsExpression: 'Use as expression',
    keepAsPlainText: 'Keep it as plain text',
    keepAsPlainTextInstead: (text) => `Keep "${text}" as plain text instead`,
    undo: 'Undo',
    writeCondition: 'Write a condition',
    useExpression: 'Use Expression',
    runFunction: 'Run a function on this value',
    useTemplate: 'Use Template',
    useTemplateTooltip: 'Use a template',
    noTemplatesOnOffer: 'No templates are offered here for this field.',
    useCustomValue: 'Use Custom Value',
    useCustomValueTooltip: 'Write the value here instead of choosing a template',
    createNewExpression: 'Create New Expression',
    takesExpression: 'This field takes an expression.',
    setValue: 'Set value',
    unlistedReference: 'Not one of the values offered here',
  },
  valueTabs: {
    value: 'Value',
    expression: 'Expression',
    visual: 'Visual',
    template: 'Template',
    expressionTooltip: 'Write an expression - it also takes templates',
    visualTooltip: 'Build the expression visually',
    templateTooltip: 'Choose a template',
    cannotShowExpression: "This expression can't be shown as a value.",
    conditionTooltip: 'Write the condition as an expression',
    conditionVisualTooltip: 'Build the condition visually',
    cannotShowCondition: "This condition can't be shown as a value.",
    templateShownOn: (tab) => `A template is shown on the ${tab} tab, not here.`,
    replaceWithAValue: 'Replace it with a value',
    // the sentence starts with the first type
    conversion: (from, to) =>
      `${from.charAt(0).toUpperCase()}${from.slice(1)} is converted to ${to} when the value is used; a value that does not convert fails`,
    undo: 'Undo',
    undoTooltip: (text) => `Keep "${text}" as a value instead`,
    expressionDraftNotUsed:
      'The Expression tab holds text that does not parse, so the field keeps this value until it does.',
  },
  savedValues: {
    save: 'Save this value',
    saveTooltip: 'Save this value to use it again',
    use: 'Use a saved value',
    remove: 'Remove saved value',
  },
  templateBrowser: {
    whereYouAre: 'Where you are in the templates',
    back: 'Back',
    templates: 'Templates',
    searchTemplates: 'Search templates',
    searchIn: (level) => `Search in ${level}`,
    onlyIn: (level) => `Only in ${level}`,
    searchEverywhere: 'Search everywhere',
    keyReads: (key, format) => `Write what ${key} reads: ${format}.`,
    keyFree: (key) => `${key} holds any keys: write the key to use (a path: order.id).`,
    keyIn: (key) => `Key in ${key}`,
    use: 'Use',
    useNamed: (label) => `Use ${label}`,
    useWhole: (label) => `Use the whole record: all of ${label} as one value`,
    loadFailed: (label, reason) =>
      `Could not load what is in ${label}${reason ? `: ${reason}` : '.'}`,
    retry: 'Retry',
    loading: 'Loading…',
    noMatch: (query) => `No template matches "${query}"`,
    nothingHere: 'Nothing here',
    showMore: (count, left) => `Show ${count} more of ${left}`,
    universalValues: 'Universal values that can be used in multiple places',
  },
  editor: {
    noValueAtTheEnd:
      'A template goes where a value can: after an operator, an opening bracket or a comma, or in an empty expression.',
    templateContext: 'Template context',
    templatesSection: 'Templates',
    noRecordFields: 'No record fields here',
    noTemplates: 'No templates here',
    unfinishedParts: (hole) => `Fill in each ${hole} (the parts not chosen yet).`,
    browseAllTemplates: 'Browse all templates',
    allOf: (context) => `all of ${context}`,
    inTrail: (trail) => `in ${trail}`,
    fromSource: (source) => `from ${source}`,
    writeInContext: (context) =>
      `Write what ${context} refers to after the ':', or pick from the list`,
    valueAfterIt: 'a value is written after it',
    noLspConnection: 'No LSP connection',
    validationFailed: 'Validation request failed',
    warning: 'Warning',
    hideWhatItIs: (label) => `Hide what ${label} is`,
    showWhatItIs: (label) => `Show what ${label} is`,
    whatItIs: (label) => `What ${label} is`,
    loadingCompletions: 'Loading completions…',
    noAlternatives: 'No alternatives available',
    insertTemplate: 'Insert a template',
    connecting: 'Connecting to language server…',
    loadingSchema: 'Loading schema…',
    loading: 'Loading…',
    showWordAtCursor: 'Show what the word at the cursor is',
    details: 'Details',
    completionSections: {
      2: 'Methods',
      3: 'Functions',
      5: 'Fields',
      6: 'Variables',
      14: 'Keywords',
      15: 'Snippets',
    },
    otherSection: 'Other',
    completionKinds: {
      1: 'Text',
      2: 'Method',
      3: 'Function',
      4: 'Constructor',
      5: 'Field',
      6: 'Variable',
      7: 'Class',
      8: 'Interface',
      9: 'Module',
      10: 'Property',
      11: 'Unit',
      12: 'Value',
      13: 'Enum',
      14: 'Keyword',
      15: 'Snippet',
      16: 'Color',
      17: 'File',
      18: 'Reference',
      19: 'Folder',
      20: 'EnumMember',
      21: 'Constant',
      22: 'Struct',
      23: 'Event',
      24: 'Operator',
      25: 'TypeParameter',
    },
    findInText: 'Find in the text',
    find: 'Find',
    noSearch: 'No search',
    matchOf: (current, total) => `${current} of ${total}`,
    noResults: 'No results',
    matchCase: 'Match case',
    previousMatch: 'Previous match',
    previousMatchTooltip: 'Previous match (Shift+Enter)',
    nextMatch: 'Next match',
    nextMatchTooltip: 'Next match (Enter)',
    hideReplace: 'Hide replace',
    replace: 'Replace',
    closeSearch: 'Close the search',
    closeSearchTooltip: 'Close (Escape)',
    replaceWith: 'Replace with',
    replaceAll: 'Replace all',
  },
  formEngine: {
    opensInNewTab: (address) => `${address} (opens in a new tab)`,
    valueIsExpression: 'This value is an expression',
    oneOf: 'One of',
    coveredBy: (label) => `Covered by “${label}”`,
    covers: 'Covers',
    revertChanges: 'Revert changes',
    clearValue: 'Clear value',
    clearValueConfirm: (label) => `Clear the current value of "${label}"?`,
    draft: 'Draft',
    cancelEdit: 'Cancel edit',
    cancelEditTooltip: 'Cancel edit — discard the changes made since this field was opened',
    closeField: 'Close field',
    done: 'Done',
    defaultIs: (value, description) => `Default: ${value} — ${description}`,
    takes: (type) => `Takes ${type}.`,
    noDescription: 'No description was given for this option.',
    helpOn: (label) => `Help: ${label}`,
    help: 'Help',
    helpFor: (name) => `Help For "${name}"`,
    moreActions: 'More actions',
    actionNumber: (index) => `Action ${index}`,
    viewFullscreen: 'View fullscreen',
    editFullscreen: 'Edit fullscreen',
    removeField: 'Remove field',
    collapse: (label) => `Collapse ${label}`,
    focusedView: 'Focused View',
    lineCount: (count) => plural(count, 'line'),
    charCount: (count) => plural(count, 'char'),
    fieldDisabled: 'This field is disabled',
    setByServer: 'Set by Qorus — not editable',
    dependenciesNotFulfilled: 'Disabled — dependencies are not fulfilled',
    dependencyUnset: (label) => `${label} unset`,
    dependsOnOthers: 'Disabled — depends on other fields. Click to locate them.',
    unlockedBy: 'Unlocked by:',
    anyOf: 'any of:',
    edit: (label) => `Edit ${label}`,
    view: (label) => `View ${label}`,
    fieldActions: 'Field actions',
    sortDefault: 'Default order',
    sortDefaultTooltip: 'The schema’s declared field order',
    sortAlpha: 'Name A→Z',
    sortAlphaTooltip: 'Sort fields by name, ascending',
    sortAlphaDesc: 'Name Z→A',
    sortAlphaDescTooltip: 'Sort fields by name, descending',
    sortUnset: 'Unset first',
    sortUnsetTooltip: 'Fields without a value first',
    sortInvalid: 'Invalid first',
    sortInvalidTooltip: 'Fields needing attention first',
    incomplete: 'Incomplete',
    ready: 'Ready',
    needAttention: (count) => `${count} need attention →`,
    filterFields: 'Filter fields...',
    fields: 'Fields',
    requiredOnly: 'Required only',
    requiredOnlyTooltip: 'Show only required fields',
    showFieldTypes: 'Show field types',
    hideFieldTypes: 'Hide field types',
    showFieldTypesTooltip: 'Annotate each field with its type',
    sortBy: 'Sort by',
    selectAll: 'Select all',
    selectAllTooltip: 'Add every optional field',
    defaultFields: 'Default fields',
    defaultFieldsTooltip: 'Reset to the default set of fields',
    revertAll: 'Revert all changes',
    revertAllTooltip: 'Undo all edits back to the loaded values',
    hideAllInformation: 'Hide all field information',
    showAllInformation: 'Show all field information',
    failedToLoadOptions: 'Failed to load options',
    dependentOptionsWarning:
      'Other options depend on this option, changing it may result in configuration changes.',
    boxAttention: 'Needs attention',
    boxSet: 'Set',
    boxOptional: 'Optional',
    oneOfRequired: 'One of the below is required',
    nothingSet: 'Nothing is set.',
    noFieldsMatch: 'No fields match the current filters.',
    showFewer: 'Show fewer',
    moreFields: (count, optional) =>
      `${count} more ${optional ? 'optional ' : ''}field${count === 1 ? '' : 's'}`,
    unsavedChanges: (count) => plural(count, 'unsaved change'),
    applyChanges: 'Apply the staged changes',
    resolveInvalid: 'Resolve the invalid fields before saving',
    save: 'Save',
    discard: 'Discard',
    noOptions: 'No options available',
    searchOptionsRequired:
      'This provider record requires some search options to be set. You can set them below.',
    showingInvalidOnly: 'Showing invalid fields only. Click here again to show all fields.',
    invalidFields: (count) =>
      `${count < 2 ? 'A field is not valid and requires' : `${count} fields are not valid and require`} attention. Click here to only show invalid fields.`,
    fieldsNotSupported: (count) =>
      `${plural(count, 'field')} hidden because they are not supported on the current instance`,
    moreOptions: 'More Options Available',
    clickToLearnMore: '. Click to learn more.',
    focusedEditing: 'Focused editing',
    removeValue: 'Remove value',
    removeOption: 'Remove option',
    removeSelectedOption: 'Remove Selected Option',
    revertChangesTitle: 'Revert Changes',
    hiddenUntilItApplies: (label, conditions, invalidReason) =>
      `"${label}" is hidden until it applies (${conditions}). Its value is kept${
        invalidReason ? `, but it is not valid: ${invalidReason}` : ', and not used until then'
      }.`,
    mustHaveNoValue: (label) => `${label} must have no value`,
    mustBe: (label, value) => `${label} must be "${value}"`,
    mustNotBe: (label, value) => `${label} must not be "${value}"`,
    orJoin: (alternatives) => `(${alternatives.join(' or ')})`,
    unavailable: (dependsOn) =>
      `Unavailable because some dependencies are not fulfilled${dependsOn ? `: ${dependsOn}` : ''}`,
    disabledByDependencies: (dependsOn) =>
      `This field is disabled because some dependencies are not fulfilled${dependsOn ? `: ${dependsOn}` : ''}`,
    valueNotValid: 'Field value is not valid',
    required: 'This field is required',
    noStructuredData: 'No structured data.',
    itemCount: (count) => plural(count, 'item'),
    fieldCount: (count) => plural(count, 'field'),
    set: 'Set',
    beforeSaving: (name, why, more) =>
      `Before saving, fix ${name}${why ? `: ${why}` : ''}${
        more ? ` (and ${more} more field${more === 1 ? '' : 's'})` : ''
      }`,
    schema: 'Schema',
    tableCount: (count) => plural(count, 'table'),
    expression: 'Expression',
    yes: 'Yes',
    no: 'No',
    timeoutValue: (amount, unit) => `${amount} ${unit}`,
    timeoutUnits: { ms: 'ms', seconds: 'seconds', minutes: 'minutes', hours: 'hours' },
  },
  formFields: {
    selectOneOrMore: 'Select one or more:',
    selectOne: 'Select one:',
    savedAndSuggested: 'Saved & Suggested Values',
    removeItem: 'Remove item',
    addNewItem: 'Add new item',
    addNewItemFor: (name) => `Add new item for "${name}"`,
    edit: 'Edit',
    remove: 'Remove',
    saveChanges: 'Save changes',
    addItem: 'Add item',
    cancelEditing: 'Cancel editing',
    schemaNotLoaded: (schema) => `The schema "${schema}" could not be loaded.`,
    binaryPlaceholder: 'Base64, 0x hex, or data: URL',
    unknownType: 'Unknown type!',
    unsetNull: 'Unset null',
    setAsNull: 'Set as null',
    cronFields: ['Minute', 'Hour', 'Day', 'Month', 'Weekday'],
    uploadFile: 'Upload a File',
    buildFile: 'Build a File',
    uploadedFile: 'Uploaded file',
    uploadDifferentFile: (extensions) => `Click here to upload a different ${extensions} file`,
    dropFilesHere: 'Click or drop files here to upload',
    save: 'Save',
    discard: 'Discard',
    notValid: (format) => `Not a valid ${format}`,
    editor: 'Editor',
    text: 'Text',
    newList: 'New List',
    newObject: 'New Object',
    noData: 'No data available',
    pleaseSelect: 'Please select',
    chosen: 'Chosen',
    selectFromItems: 'Select from items',
  },
  colorField: DEFAULT_COLOR_FORM_FIELD_LABELS,
  colorValue: DEFAULT_COLOR_VALUE_LABELS,
  expressionMode: {
    text: 'Text',
    visual: 'Visual',
    textUnavailable: 'The expression language server is not available',
  },
  expression: {
    notRendered: 'This expression could not be rendered.',
    textCannotBeRead:
      'The expression language server is not available, so this text cannot be read yet. It is kept as you typed it; the Visual view builds the expression without the server.',
    mayNotFit: 'This may not fit',
    doesNotFit: 'This does not fit',
    typeMismatch: (inferred, target) =>
      `The expression gives ${inferred}, and this field takes ${target}.`,
    convertedWhenItRuns: ' Qorus converts the value when it runs, and checks it then.',
    preview: 'Preview',
    cannotBeShownAsText: 'This expression cannot be shown as text, so it is built here:',
    textNeedsServer:
      'The Text view needs the expression language server, which is not available: the expression is built here instead.',
    notAcceptedType: (types) =>
      `This value is not ${types}. Put it inside an expression that converts it`,
    typeFitsMayConvert: 'The type fits; Qorus may convert the value',
    typeNeededHere: (types) => `${types.charAt(0).toUpperCase()}${types.slice(1)} is needed here`,
    otherTypeNeeded: 'A value of another type is needed here',
    addArgument: (name) => `Add ${name}`,
    fillInCurrentFirst: 'Fill in the current values first',
    addAnother: (name) => `Add another ${name} after the last one`,
    dragToReorder: 'Drag to reorder',
    positionTooltip: 'Position — pick a new one to move this argument',
    removeArgument: 'Remove argument',
    transformedCount: (count) =>
      `${count} ${count === 1 ? 'argument' : 'arguments'} will be transformed.`,
    confirmMismatched: 'Confirm type selection for mismatched arguments',
    discardAll: 'Discard all',
    acceptAll: 'Accept all',
    confirmSelection: 'Confirm selection',
    typesDiffer: 'These values have other types than expected. Qorus converts them when it runs.',
    deselectToKeep: 'Please deselect the arguments you do not wish to transform:',
    clearedNotConverted: 'Cleared, not converted',
    noConversionNeeded: 'No conversion needed',
    confirmTypeSelection: 'Confirm type selection',
    needsOneOfTypes: 'This value needs one of these types:',
    useTypeAnyway: 'Use this type anyway?',
    dontShowAgain: "Don't show again",
    moveBefore: 'Move before',
    moveAfter: 'Move after',
    moveToStart: 'Move to start',
    moveToEnd: 'Move to end',
    moveArgument: 'Move Argument',
    removeNamed: (name) => `Remove ${name}`,
    runsOutside: 'This expression runs outside Qorus',
    selectOperation: 'Select operation',
    wrap: 'Wrap',
    wrapTooltip: 'Put this expression inside another one',
    remove: 'Remove',
    unwrapTooltip: 'Remove this expression and keep what is inside it',
    explain: 'Explain',
    hideExplanation: 'Hide Explanation',
    showExplanationTooltip: 'Show explanation of this expression',
    hideExplanationTooltip: 'Hide explanation of this expression',
    removeTooltip: 'Remove this expression and everything inside it',
    cancel: 'Cancel',
    confirm: 'Confirm',
    selectTemplateOrField: 'Select Template Or Field',
    selectField: 'Select Field',
    selectTemplate: 'Select Template',
    couldNotCheck: 'Qorus could not check this expression.',
    choosePart: (takes) => `Choose what this part does${takes ? `: it must give ${takes}` : ''}.`,
    chooseExpression: (takes) =>
      `Choose what this expression does${takes ? `: this field takes ${takes}` : ''}.`,
    loading: 'Loading...',
    atLeastOne: 'At least one of these is true (OR)',
    allOfThese: 'All of these are true (AND)',
    ifCondition: 'If',
    addCondition: 'Add a condition',
    focusedEditing: 'Focused Editing',
    moveToPosition: 'Move to position',
    currentPosition: 'Current position',
    moveToOrdinal: (ordinal) => `Move to ${ordinal}`,
    moveToThatPosition: 'Move to that position',
    more: 'More',
    invalidSummary: 'Expression is invalid, unable to render summary',
    ordinal: ordinalInEnglish,
  },
  schemaDefinition: {
    uniqueNameShort: 'Unique name within the schema',
    uniqueNameLong: 'The unique name identifying this entry.',
    noValuesSet: 'No values set.',
    removeNoun: (noun) => `Remove ${noun}`,
    removeNounConfirm: (noun, title) =>
      `Remove the ${noun} "${title}"? This cannot be undone from inside the editor — re-add or revert the form to restore it.`,
    name: 'Name',
    noneDefined: (section) => `No ${section} defined yet.`,
    addSingular: (singular) => `Add ${singular}`,
    nameInUse: 'Name already in use',
    nameInUseContent: (singular, name) =>
      `A ${singular} named "${name}" already exists in this section.`,
    order: 'Order',
    moveUp: 'Move up',
    moveDown: 'Move down',
    numbered: (singular, position) => `${singular} ${position}`,
    nameMismatch: 'Schema name does not match the interface name',
    nameMismatchContent: (schemaName, wrapperName) =>
      `The DataSchema name is "${schemaName}" but the schema object is named "${wrapperName}". The server requires them to match.`,
    syncName: 'Sync name',
    structureChanged: 'Structure changed — bump the schema version',
    structureChangedContent: (version) =>
      `Tables, sequences, or reference data changed but schema.version is still "${version}". Bump the version and add a migration block so existing databases can be aligned.`,
    addMigrationBlock: 'Add migration block',
    saveRejected: 'The last save was rejected',
    loading: 'Loading…',
    removeMigrationBlock: 'Remove migration block',
    removeMigrationBlockConfirm: (version) =>
      `Remove migration block "v${version}" and any steps it contains?`,
    removeBlock: 'Remove block',
    noMigrationsReadOnly: 'This schema defines no migrations.',
    noMigrations:
      'No migrations yet. Add a migration block when a schema change needs to be applied to existing databases.',
    migrationsHintTitle: 'When to add a migration',
    migrationsHint:
      'Aligning a schema to an empty datasource just creates everything. A datasource already running an older version needs **upgrading** — that is what migrations are for. When you change tables, columns, or reference data, bump **schema.version** and add a migration block: an ordered list of steps (add column, rename, …) run before and after alignment. Each block targets one version.',
    noVersion: '(no version)',
    stepCount: (count) => plural(count, 'step'),
    moveEarlier: 'Move earlier',
    moveLater: 'Move later',
    table: 'Table',
    tableName: 'Table name',
    removeTable: 'Remove table',
    removeTableConfirm: (table, columns) =>
      `Remove the table "${table}"${columns > 0 ? ` and its ${plural(columns, 'column')}` : ''}?`,
    noTablesReadOnly: 'This schema defines no tables.',
    noTables: 'No tables yet. Add the first table to start building the schema.',
    addTable: 'Add table',
    tablesHintTitle: 'Working with tables',
    tablesHint:
      'Each row is a database table. Expand one to reach its columns, primary key, indexes, and constraints — each on its own sub-tab. **Click a column row to edit it in a side panel** where you set its full definition.',
    columnCount: (count) => plural(count, 'column'),
    catalogNotLoaded: 'The schema option catalog could not be loaded.',
    sectionSchema: 'Schema',
    sectionTables: 'Tables',
    sectionSequences: 'Sequences',
    sectionReferenceData: 'Reference data',
    sectionMigrations: 'Migrations',
    sectionAdvanced: 'Advanced',
    editorHintTitle: 'Building a database schema',
    editorHint:
      'This editor builds a **DataSchema document** — the definition of the tables, sequences, and reference data this schema manages. Each tab is one section: lay out your tables and their columns, add sequences, seed reference data, and record migrations so databases on an older version can be upgraded. **Click any row to edit it in a side panel.** Once saved, the schema can be aligned to a datasource to create or update those objects.',
    referenceHintTitle: 'Reference data modes',
    referenceHint:
      'Reference data is the set of rows the schema guarantees exist in a table — lookup values, enums, seed records. The **mode** decides how an align treats rows already in the database: **strict** removes any row not in the schema, **normal** inserts and updates, **create_only** only inserts missing rows, and **insert_only** inserts but never updates existing rows.',
    loadingEditor: 'Loading schema editor…',
    optionsNotLoaded: 'Could not load schema options',
  },
  typeCatalogue: {
    valueOfType: (type) => `a value of type ${type}`,
    unknownType: 'a value of an unknown type',
    sentenceForms: {},
  },
};

const merged = (given: TReqraftLabelOverrides): IReqraftLabels => {
  const labels = {} as Record<string, Record<string, unknown>>;
  for (const [part, defaults] of Object.entries(DEFAULT_REQRAFT_LABELS)) {
    const words = (given as Record<string, Record<string, unknown> | undefined>)[part] ?? {};
    const out: Record<string, unknown> = { ...defaults };
    for (const [word, value] of Object.entries(words)) {
      const fallback = (defaults as Record<string, unknown>)[word];
      if (value === undefined) {
        continue;
      }
      // a map's entries are given one by one: what a row says a node is, a completion's kind
      out[word] =
        fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? { ...fallback, ...(value as object) } : value;
    }
    labels[part] = out;
  }
  return labels as unknown as IReqraftLabels;
};

let current: IReqraftLabels = DEFAULT_REQRAFT_LABELS;
const listeners = new Set<() => void>();

/**
 * Gives Reqraft's words in the host's language, merged over the English defaults: a host that gives nothing has today's
 * English, and each call replaces what the last one gave. A host calls it when its language changes; what is drawn
 * changes with it. It is one setting for the page, not a prop, because the words are read where no component is: the
 * trees and completions built outside React, and lists a page keeps between forms.
 */
export const setReqraftLabels = (labels: TReqraftLabelOverrides = {}): void => {
  current = merged(labels);
  listeners.forEach((listener) => listener());
};

/** The words now: for code outside a component. A component reads `useReqraftLabels`, to be drawn again with new ones. */
export const reqraftLabels = (): IReqraftLabels => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The words now, and a new render when a host gives others. */
export const useReqraftLabels = (): IReqraftLabels =>
  useSyncExternalStore(subscribe, reqraftLabels, reqraftLabels);
