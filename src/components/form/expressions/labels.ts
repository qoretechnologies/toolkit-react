// Copyright 2026 Qore Technologies, s.r.o.

/** The words of an expression field's Text / Visual toggle. */
export interface IExpressionModeLabels {
  text: string;
  visual: string;
  /** The Text button's hover when there is no language server to write the expression with. */
  textUnavailable: string;
}

/** English ordinals: 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
const englishOrdinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/**
 * The words of an expression field and its builder. A host that translates its interface gives its own
 * (`setReqraftLabels`); the rest stay English.
 */
export interface IExpressionLabels {
  /** The Text / Visual toggle; a field's `modeLabels` come before these. */
  modes: IExpressionModeLabels;
  /** Above the Text view's editor when there is no language server to read the text with. */
  textUnreadable: string;
  /** Above the Visual view when there is no language server for the Text view. */
  textViewUnavailable: string;
  /** Above the Visual view when the expression cannot be written as text: `reason` is the server's. */
  textRefused: (reason: string) => string;
  /** The title of the note under the Text view whose expression gives a type the field may not take. */
  mayNotFit: string;
  /** The same, where the type cannot be taken. */
  doesNotFit: string;
  /**
   * That note's sentence: what the expression gives and what the field takes (types inside a sentence), and, where
   * the value may still fit (`mayFail`), that Qorus converts and checks it when it runs.
   */
  typeNote: (gives: string | undefined, takes: string | undefined, mayFail: boolean) => string;
  /** The title of the box that renders the expression in words under the Text view. */
  preview: string;
  /** Where the expression cannot be rendered in words. */
  notRendered: string;
  /** In the builder's explanation, where the expression is not valid. */
  notExplained: string;
  /**
   * What is said of a condition that gives text, a date or a time: what it gives (`typeInSentence`, undefined where
   * no type can be named) and how to make it one, by an `example` comparison written in DPQL.
   */
  conditionError: (typeInSentence: string | undefined, example: string) => string;
  /**
   * What is said of a condition that gives a number, a list, a hash or a type that is not known (`other`): how Qorus
   * reads it and how to say it explicitly. `named` is the type inside a sentence.
   */
  conditionByTruthiness: (kind: 'number' | 'list' | 'hash' | 'other', named: string) => string;
  /**
   * What an expression, or a part of one, whose operation is not chosen yet says: what it lacks, and what its place
   * takes where that is a type (`takes`, a type inside a sentence). `part`: a part of an expression, not the whole.
   */
  noOperationYet: (part: boolean, takes?: string) => string;
  /** Under an operation Qorus could not check, where the check gave no reason. */
  couldNotCheck: string;
  /** The description of an expression a server outside Qorus runs. */
  runsOutsideQorus: string;
  selectOperation: string;
  /** The action that puts the expression inside another one, and its hover. */
  wrap: string;
  wrapTooltip: string;
  /** The action that takes the expression away and keeps what is inside it, and its hover. */
  unwrap: string;
  unwrapTooltip: string;
  /** The hover of the action that removes the expression and everything inside it. */
  removeExpressionTooltip: string;
  explain: string;
  explainTooltip: string;
  hideExplanation: string;
  hideExplanationTooltip: string;
  /** What an operand's field offers, by where its value can come from. */
  selectTemplateOrField: string;
  selectField: string;
  selectTemplate: string;
  loading: string;
  /** The heading of a group of conditions, one of which must be true (OR), all of which (AND), and the top one. */
  anyOfConditions: string;
  allOfConditions: string;
  /**
   * The two actions that join another condition to an expression: one that must also be true, and one that can be
   * true instead. Written in sentence case; the classic look draws them in capitals.
   */
  joinWithAnd: string;
  joinWithOr: string;
  joinWithAndTooltip: string;
  joinWithOrTooltip: string;
  /** Between two parts of a group: what joins them. Small; the classic look draws them in capitals. */
  joinedByAnd: string;
  joinedByOr: string;
  ifConditions: string;
  addCondition: string;
  /** An operand's position: 1st, 2nd, 3rd. */
  ordinal: (position: number) => string;
  /** The ⋮ menu's section that moves an operand, and its items. */
  moveArgument: string;
  moveBefore: string;
  moveAfter: string;
  moveToStart: string;
  moveToEnd: string;
  moveToPosition: string;
  currentPosition: string;
  /** The hover of a position to move an operand to (`position` counts from 1). */
  moveToOrdinal: (position: number) => string;
  moveToThatPosition: string;
  /** The menu of the positions not shown as buttons. */
  morePositions: string;
  dragToReorder: string;
  positionTooltip: string;
  removeArgument: string;
  /** The phone's action that removes an operand, named by the operation's operand (undefined where it has no name). */
  removeOperand: (name: string | undefined) => string;
  /** The slot after the last operand: add one, its hover, and its hover while the operands are not filled in. */
  addOperand: (name: string | undefined) => string;
  addOperandTooltip: (name: string | undefined) => string;
  fillInCurrentValuesFirst: string;
  /** An operand's hover where its value is not a type the operand takes (`accepted`, the types inside a sentence). */
  operandNotOfType: (accepted: string | undefined) => string;
  /** An operand's hover where its type fits but Qorus may convert it. */
  operandMayConvert: string;
  /** An operand's hover where it needs other types (`accepted`, undefined where the types are not known). */
  operandNeedsType: (accepted: string | undefined) => string;
  /** The dialog that confirms converting operands whose values have other types. */
  confirmMismatchedTitle: string;
  mismatchedExplanation: string;
  mismatchedInstruction: string;
  discardAll: string;
  acceptAll: string;
  confirmSelection: string;
  clearedNotConverted: string;
  noConversionNeeded: string;
  /** What an operand that is converted is converted from and to (types inside a sentence, either may be unknown). */
  converted: (from: string | undefined, to: string | undefined) => string;
  /** How many operands will be converted. */
  transformedCount: (count: number) => string;
  /** The dialog that confirms a type the value does not take. */
  confirmTypeTitle: string;
  needsOneOfTypes: string;
  useTypeAnyway: string;
  dontShowAgain: string;
  /** The answers of that dialog where its caller gives none. */
  cancel: string;
  confirm: string;
}

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_EXPRESSION_LABELS: IExpressionLabels = {
  modes: {
    text: 'Text',
    visual: 'Visual',
    textUnavailable: 'The expression language server is not available',
  },
  textUnreadable:
    'The expression language server is not available, so this text cannot be read yet. It is kept as you typed it; the Visual view builds the expression without the server.',
  textViewUnavailable:
    'The Text view needs the expression language server, which is not available: the expression is built here instead.',
  textRefused: (reason) => `This expression cannot be shown as text, so it is built here: ${reason}`,
  mayNotFit: 'This may not fit',
  doesNotFit: 'This does not fit',
  typeNote: (gives, takes, mayFail) =>
    `The expression gives ${gives}, and this field takes ${takes}.${
      mayFail ? ' Qorus converts the value when it runs, and checks it then.' : ''
    }`,
  preview: 'Preview',
  notRendered: 'This expression could not be rendered.',
  notExplained: 'Expression is invalid, unable to render summary',
  conditionError: (typeInSentence, example) =>
    `${typeInSentence ? `The condition evaluates to ${typeInSentence}, but it` : 'The condition'} must evaluate to true or false. Compare the value instead, for example ${example}.`,
  conditionByTruthiness: (kind, named) =>
    kind === 'number' ?
      `The condition evaluates to ${named}; Qorus treats it as true unless it is 0. To make that explicit, compare it, for example @count > 0.`
    : kind === 'list' ?
      `The condition evaluates to ${named}; Qorus treats it as true unless it is empty. To make that explicit, compare its size, for example size(@items) > 0.`
    : kind === 'hash' ?
      `The condition evaluates to ${named}; Qorus treats it as true unless it holds no pairs. To make that explicit, compare its size, for example size(@details) > 0.`
    : "The condition's value is not true or false; Qorus treats it as true unless it is 0 or empty. To make that explicit, compare it, for example @count > 0.",
  noOperationYet: (part, takes) =>
    part ?
      `Choose what this part does${takes ? `: it must give ${takes}` : ''}.`
    : `Choose what this expression does${takes ? `: this field takes ${takes}` : ''}.`,
  couldNotCheck: 'Qorus could not check this expression.',
  runsOutsideQorus: 'This expression runs outside Qorus',
  selectOperation: 'Select operation',
  wrap: 'Wrap',
  wrapTooltip: 'Put this expression inside another one',
  unwrap: 'Remove',
  unwrapTooltip: 'Remove this expression and keep what is inside it',
  removeExpressionTooltip: 'Remove this expression and everything inside it',
  explain: 'Explain',
  explainTooltip: 'Show explanation of this expression',
  hideExplanation: 'Hide Explanation',
  hideExplanationTooltip: 'Hide explanation of this expression',
  selectTemplateOrField: 'Select Template Or Field',
  selectField: 'Select Field',
  selectTemplate: 'Select Template',
  loading: 'Loading...',
  anyOfConditions: 'At least one of these is true (OR)',
  allOfConditions: 'All of these are true (AND)',
  joinWithAnd: 'And',
  joinWithOr: 'Or',
  joinWithAndTooltip: 'Add a condition that must also be true',
  joinWithOrTooltip: 'Add a condition that can be true instead',
  joinedByAnd: 'and',
  joinedByOr: 'or',
  ifConditions: 'If',
  addCondition: 'Add a condition',
  ordinal: englishOrdinal,
  moveArgument: 'Move Argument',
  moveBefore: 'Move before',
  moveAfter: 'Move after',
  moveToStart: 'Move to start',
  moveToEnd: 'Move to end',
  moveToPosition: 'Move to position',
  currentPosition: 'Current position',
  moveToOrdinal: (position) => `Move to ${englishOrdinal(position)}`,
  moveToThatPosition: 'Move to that position',
  morePositions: 'More',
  dragToReorder: 'Drag to reorder',
  positionTooltip: 'Position — pick a new one to move this argument',
  removeArgument: 'Remove argument',
  removeOperand: (name) => `Remove ${(name || 'argument').toLowerCase()}`,
  addOperand: (name) => `Add ${(name || 'argument').toLowerCase()}`,
  addOperandTooltip: (name) => `Add another ${(name || 'argument').toLowerCase()} after the last one`,
  fillInCurrentValuesFirst: 'Fill in the current values first',
  operandNotOfType: (accepted) =>
    `This value is not ${accepted}. Put it inside an expression that converts it`,
  operandMayConvert: 'The type fits; Qorus may convert the value',
  operandNeedsType: (accepted) =>
    accepted ?
      // the sentence starts with them
      `${accepted.charAt(0).toUpperCase()}${accepted.slice(1)} is needed here`
      // a place whose types are not known names none
    : 'A value of another type is needed here',
  confirmMismatchedTitle: 'Confirm type selection for mismatched arguments',
  mismatchedExplanation:
    'These values have other types than expected. Qorus converts them when it runs.',
  mismatchedInstruction: 'Please deselect the arguments you do not wish to transform:',
  discardAll: 'Discard all',
  acceptAll: 'Accept all',
  confirmSelection: 'Confirm selection',
  clearedNotConverted: 'Cleared, not converted',
  noConversionNeeded: 'No conversion needed',
  converted: (from, to) => `Converted${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}`,
  transformedCount: (count) =>
    `${count} ${count === 1 ? 'argument' : 'arguments'} will be transformed.`,
  confirmTypeTitle: 'Confirm type selection',
  needsOneOfTypes: 'This value needs one of these types:',
  useTypeAnyway: 'Use this type anyway?',
  dontShowAgain: "Don't show again",
  cancel: 'Cancel',
  confirm: 'Confirm',
};
