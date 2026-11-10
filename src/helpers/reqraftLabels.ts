// Copyright 2026 Qore Technologies, s.r.o.
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_TEMPLATE_LIST_LABELS,
  DEFAULT_TEMPLATE_PICKER_LABELS,
  IReqraftTemplateListLabels,
  ITemplatePickerLabels,
} from './templateListLabels';
import { DEFAULT_VALIDATION_LABELS, IValidationLabels } from './validationLabels';
import { DEFAULT_EXPRESSION_LABELS, IExpressionLabels } from '../components/form/expressions/labels';
import { DEFAULT_FIELD_LABELS, IFieldLabels } from '../components/form/fields/labels';
import {
  DEFAULT_SCHEMA_DEFINITION_LABELS,
  ISchemaDefinitionLabels,
} from '../components/form/fields/schema-definition/labels';
import { DEFAULT_LOG_LABELS, ILogLabels } from '../components/log/labels';
import { DEFAULT_COMPOSER_LABELS, IComposerLabels } from '../components/composer/labels';
import {
  DEFAULT_SUPPORT_TICKET_LABELS,
  ISupportTicketLabels,
} from '../components/supportTicket/labels';
import { DEFAULT_AB_TEST_LABELS, IAbTestLabels } from '../tracking/ui/labels';

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
  /** A template's or a value's hover where nothing describes it: why, never a blank. */
  noValueDescription: string;
  /** A record field's hover where nothing describes it. */
  noFieldDescription: string;
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
  /** What that row says it opens. */
  browseAllTemplatesDescription: string;
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
  /** The readiness line's count of what is set, of what the form needs: "3/7 set". */
  setOfTotal: (set: number, total: number) => string;
  /**
   * The readiness line's link to the required fields nobody has been to yet: the next step, not a fault, so it is
   * said apart from `needAttention` and in the quiet colour.
   */
  toFillIn: (count: number) => string;
  /** The same count where it is not a link: after `needAttention` on the line, and in a list item's header. */
  toFillInCount: (count: number) => string;
  /** `needAttention` where it is not a link: a calm list item's header, which says what its fields still need. */
  needAttentionCount: (count: number) => string;
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
  /** The first box while nothing in it is a fault: required fields still to fill in on a new form. */
  boxPending: string;
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
  /** The types a place takes, each named inside a sentence: "a whole number or text". */
  typesJoin: (types: string[]) => string;
  unavailable: (dependsOn?: string) => string;
  disabledByDependencies: (dependsOn?: string) => string;
  valueNotValid: string;
  required: string;
  /**
   * What a calm form says of an empty required field, where its value would be and under its editor: amber words
   * that say what to do, in place of the red `required` (waiting for a person is not a failure).
   */
  calmRequired: string;
  /** `calmRequired` in a read-only form, where the reader cannot add anything: only what is the case. */
  calmRequiredRead: string;
  /** An empty field of a required group: it, or one of the `others` (their names), is required. */
  requiredOrOthers: (others: string[]) => string;
  /** Why a stored value is not one of the field's choices: the value, as it is named (quoted). */
  notAChoice: (name: string) => string;
  /** The same of several values of a list. */
  notAmongTheChoices: (names: string[]) => string;
  /** Why a value cannot be picked, where its refusal gives no reason of its own. */
  valueNotAvailable: string;
  /**
   * A value that is not one of a field's choices, in a form where it can be changed: the reason (`"gone" is not one
   * of the choices`) and what to do about it. A read view says the reason alone, because a reader cannot pick
   * anything. Creatable choices are never judged, so there is no "or type a new one" case.
   */
  unlistedChoice: (reason: string) => string;
  /**
   * Beside a yes/no switch that shows the field's default because nothing has been chosen yet; gone once it is
   * changed.
   */
  defaultMark: string;
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
  /**
   * What the expression builder says of an expression whose result does not fit its place: what it gives (`gives`,
   * a type inside a sentence, undefined for nothing yet), what the place takes (`takes`, undefined where not known),
   * the operand the type comes from (`source`: a quoted name, and whether it is an operation, which "gives" its type,
   * or a value, which "is" it), and what to do.
   */
  typeMismatch: (
    gives: string | undefined,
    takes: string | undefined,
    source?: { label: string; isOperation: boolean }
  ) => string;
  /** An operand named by its kind where the reader has no name for it: a template of a kind ("a $local template"). */
  templateOfKind: (kind: string) => string;
  /** An operand that has no name the reader knows. */
  thisValue: string;
  /** Beside an argument whose operation's type is known only when it runs, and its tooltip. */
  /** Under a value that depends on the incoming data, so its type is checked only when it runs. Plain words. */
  knownWhenItRuns: string;
}

/** The words of the navigation menu. */
export interface IMenuLabels {
  /** Its search box: `shortcut` is the key that moves the focus to it. */
  filterMenu: (shortcut: string) => string;
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
  /** Why a value is refused, said under its field. */
  validation: IValidationLabels;
  /** An expression field and its builder. */
  expressions: IExpressionLabels;
  /** The field editors a form draws: lists, files, choices, objects. */
  fields: IFieldLabels;
  schemaDefinition: ISchemaDefinitionLabels;
  log: ILogLabels;
  menu: IMenuLabels;
  composer: IComposerLabels;
  supportTicket: ISupportTicketLabels;
  /** The A/B test card and overlay. */
  abTest: IAbTestLabels;
}

/** What a host gives: any of the words of any part, and one or more entries of a part's maps. */
export type TReqraftLabelOverrides = {
  [Part in keyof IReqraftLabels]?: {
    [Word in keyof IReqraftLabels[Part]]?: IReqraftLabels[Part][Word] extends (
      (...args: never[]) => unknown
    ) ?
      IReqraftLabels[Part][Word]
    : IReqraftLabels[Part][Word] extends object ? Partial<IReqraftLabels[Part][Word]>
    : IReqraftLabels[Part][Word];
  };
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

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
    noValueDescription: 'No description was given for this value.',
    noFieldDescription: 'No description was given for this field.',
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
    browseAllTemplatesDescription: 'Every template and field this value can use, by group.',
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
    setOfTotal: (set, total) => `${set}/${total} set`,
    toFillIn: (count) => `${count} to fill in →`,
    toFillInCount: (count) => `${count} to fill in`,
    needAttentionCount: (count) => `${count} need attention`,
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
    boxPending: 'To fill in',
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
    // "a whole number", "a whole number or text", "a whole number, a number or an exact number"
    typesJoin: (types) =>
      types.length > 2 ?
        `${types.slice(0, -1).join(', ')} or ${types[types.length - 1]}`
      : types.join(' or '),
    unavailable: (dependsOn) =>
      `Unavailable because some dependencies are not fulfilled${dependsOn ? `: ${dependsOn}` : ''}`,
    disabledByDependencies: (dependsOn) =>
      `This field is disabled because some dependencies are not fulfilled${dependsOn ? `: ${dependsOn}` : ''}`,
    valueNotValid: 'Field value is not valid',
    required: 'This field is required',
    calmRequired: 'Required · add a value',
    calmRequiredRead: 'Required · not set',
    requiredOrOthers: (others) => `This field or ${others.join(' or ')} is required`,
    notAChoice: (name) => `${name} is not one of the choices`,
    notAmongTheChoices: (names) =>
      `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are not among the choices`,
    valueNotAvailable: 'This value is not available',
    unlistedChoice: (reason) => `${reason} · pick one from the list`,
    defaultMark: 'Default',
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
    typeMismatch: (gives, takes, source) => {
      // where the type comes from: ("because "Order note" is text", "because "Lower Case" gives text")
      const because =
        gives && source ?
          ` because ${source.label} ${source.isOperation ? 'gives' : 'is'} ${gives}`
        : '';
      return takes ?
          `This expression gives ${gives ?? 'nothing'}${because}, but this field takes ${takes}. Choose an expression that gives ${takes}, or put this one inside an expression that converts it.`
        : `This expression gives ${gives ?? 'nothing'}${because}, which this field does not take. Choose another expression, or put this one inside an expression that converts it.`;
    },
    templateOfKind: (kind) => `a $${kind} template`,
    thisValue: 'this value',
    knownWhenItRuns: 'Depends on the incoming data, so it is checked when this runs.',
  },
  validation: DEFAULT_VALIDATION_LABELS,
  expressions: DEFAULT_EXPRESSION_LABELS,
  fields: DEFAULT_FIELD_LABELS,
  schemaDefinition: DEFAULT_SCHEMA_DEFINITION_LABELS,
  log: DEFAULT_LOG_LABELS,
  menu: {
    filterMenu: (shortcut) => `Filter menu "${shortcut}"`,
  },
  composer: DEFAULT_COMPOSER_LABELS,
  supportTicket: DEFAULT_SUPPORT_TICKET_LABELS,
  abTest: DEFAULT_AB_TEST_LABELS,
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
        fallback && typeof fallback === 'object' ? { ...fallback, ...(value as object) } : value;
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

/**
 * Hears every change of the words, for what keeps something worded outside React (a memoized reason, a list built
 * once): it is worded again, or dropped, when the host gives other words. Returns what stops hearing.
 */
export const onReqraftLabelsChange = (listener: () => void): (() => void) => subscribe(listener);

/** The words now, and a new render when a host gives others. */
export const useReqraftLabels = (): IReqraftLabels =>
  useSyncExternalStore(subscribe, reqraftLabels, reqraftLabels);
