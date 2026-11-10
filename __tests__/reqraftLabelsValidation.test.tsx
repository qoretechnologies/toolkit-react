// Copyright 2026 Qore Technologies, s.r.o.
/* The reasons a value is refused: in a host's words where it gives them, else in English. */
import { afterEach, describe, expect, it } from 'vitest';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import {
  getUnresolvedRequiredOptionReason,
  patternMismatchReason,
  validateFieldWithResult,
} from '../src/helpers/validations';

const reason = (
  type: string,
  value: unknown,
  field?: Parameters<typeof validateFieldWithResult>[2]
) => validateFieldWithResult(type, value, field).reason;

/** A call taking any number of operands, each named "Value". */
const CONCAT = [
  {
    name: 'concat',
    varargs: true,
    min_args: 1,
    args: [{ name: 'str', display_name: 'Value', ui_type: 'string', required: true }],
  },
];

const concat = (args: unknown[]) =>
  reason(
    'expression',
    { is_expression: true, value: { exp: 'concat', args } },
    { expressions: CONCAT }
  );

/** A call whose 2nd operand is not filled in yet. */
const SECOND_MISSING = [{ type: 'string', value: 'a' }, { type: 'string' }];

afterEach(() => setReqraftLabels());

describe('the reasons a value is refused', () => {
  it('are the English ones with nothing given', () => {
    expect(reason('string', '')).toBe('Value must be a non-empty text');
    expect(reason('int', 'abc')).toBe('Value must be a whole number');
    expect(reason('int', 0, { min_value: 1 })).toBe('Value must be 1 or more');
    expect(reason('int', 'pos $local:{pos}')).toBe(
      '"pos" makes this text, not a whole number. Delete it to keep the template alone.'
    );
    expect(concat(SECOND_MISSING)).toBe('Enter the 2nd "Value"');
    expect(reason('expression', { is_expression: true, value: {} })).toBe(
      'Choose what this expression does.'
    );
    expect(patternMismatchReason({ validation_regex: '^a', example_value: 'abc' })).toBe(
      'Must match the expected form, for example abc. Pattern: ^a'
    );
    expect(getUnresolvedRequiredOptionReason({ name: 'url', reason: 'dependency' })).toBe(
      'Option url dependencies are not fulfilled'
    );
  });

  it('are the host’s words where it gives them, the rest English', () => {
    setReqraftLabels({
      validation: {
        nonEmptyText: 'Bitte einen Text eingeben',
        valueMustBe: (type) => `Der Wert muss ${type ?? 'vom Typ des Feldes'} sein`,
        atLeast: (min) => `Mindestens ${min}`,
        textAroundTemplate: (texts, type) =>
          `„${texts.join(' ')}“ macht daraus Text, nicht ${type}.`,
        enterOperand: (label, position) =>
          position ? `${position}. „${label}“ eingeben` : `„${label}“ eingeben`,
        mustMatchExpectedForm: (example, pattern) => `Wie ${example} (${pattern})`,
        optionDependenciesNotFulfilled: (name) => `${name} wartet auf andere Felder`,
      },
      expressions: { noOperationYet: () => 'Wähle, was dieser Ausdruck tut.' },
    });

    expect(reason('string', '')).toBe('Bitte einen Text eingeben');
    // the type is still the catalogue's; only the sentence around it is the host's
    expect(reason('int', 'abc')).toBe('Der Wert muss a whole number sein');
    expect(reason('int', 0, { min_value: 1 })).toBe('Mindestens 1');
    expect(reason('int', 'pos $local:{pos}')).toBe(
      '„pos“ macht daraus Text, nicht a whole number.'
    );
    expect(concat(SECOND_MISSING)).toBe('2. „Value“ eingeben');
    expect(reason('expression', { is_expression: true, value: {} })).toBe(
      'Wähle, was dieser Ausdruck tut.'
    );
    expect(patternMismatchReason({ validation_regex: '^a', example_value: 'abc' })).toBe(
      'Wie abc (^a)'
    );
    expect(getUnresolvedRequiredOptionReason({ name: 'url', reason: 'dependency' })).toBe(
      'url wartet auf andere Felder'
    );
    // a word not given stays English
    expect(reason('date', 'not a date')).toBe('Date is invalid');
  });

  it('join a reason to what was being checked in the host’s words', () => {
    const list = () =>
      reason('list', ['abc'], { element_type: 'int', has_to_have_value: true });
    expect(list()).toBe('List item 0 is invalid: Value must be a whole number');

    setReqraftLabels({
      validation: {
        inContext: (context, why) => `${context} — ${why}`,
        listItemInvalid: (index) => `Eintrag ${index + 1} ist ungültig`,
      },
    });
    expect(list()).toBe('Eintrag 1 ist ungültig — Value must be a whole number');
  });

  it('kept from before the host gave its words are said again in them, for the same value', () => {
    // asked for, and so kept, in English
    expect(reason('cron', '')).toBe('Cron value is required');

    setReqraftLabels({ validation: { cronRequired: 'Zeitplan fehlt' } });
    expect(reason('cron', '')).toBe('Zeitplan fehlt');

    // and in English again when the host takes its words back
    setReqraftLabels();
    expect(reason('cron', '')).toBe('Cron value is required');
  });
});
