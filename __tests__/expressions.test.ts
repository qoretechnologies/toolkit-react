import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
} from '../src/components/form/expressions/types';
import {
  areQorusTypesCompatible,
  conditionPartCards,
  conditionByTruthinessText,
  conditionErrorText,
  conditionPartsWithMessages,
  conditionWholeMessage,
  conditionPartVerdict,
  expressionFitsReturnType,
  conditionVerdict,
  isConditionType,
  isTextOrDateType,
  argumentMatchesType,
  getArgumentType,
} from '../src/helpers/expressions';

const expressions = [
  { name: 'CONCAT', ui_return_type: 'string' },
  { name: 'COUNT', ui_return_type: 'int' },
] as IExpressionSchema[];

const arg = (partial: Partial<IExpression>): IExpression => partial as IExpression;
const schema = (partial: Partial<IExpressionSchemaArg>): IExpressionSchemaArg =>
  partial as IExpressionSchemaArg;

describe('helpers/expressions', () => {
  describe('getArgumentType', () => {
    it('resolves a sub-expression to its return type', () => {
      const subExp = arg({ is_expression: true, value: { exp: 'COUNT' } });
      expect(getArgumentType(expressions, subExp)).toBe('int');
    });

    it('returns undefined for a sub-expression with an unknown operation', () => {
      const subExp = arg({ is_expression: true, value: { exp: 'NOPE' } });
      expect(getArgumentType(expressions, subExp)).toBeUndefined();
    });

    it('prefers the literal argument type over the schema type', () => {
      expect(
        getArgumentType(expressions, arg({ type: 'int', value: 4 }), schema({ ui_type: 'string' }))
      ).toBe('int');
    });

    it('falls back to the schema ui_type when the argument has no type', () => {
      expect(getArgumentType(expressions, arg({}), schema({ ui_type: 'string' }))).toBe('string');
      expect(getArgumentType(expressions, undefined, schema({ ui_type: 'date' }))).toBe('date');
    });
  });

  describe('argumentMatchesType', () => {
    it('accepts an exact type match', () => {
      expect(
        argumentMatchesType(expressions, arg({ type: 'int' }), schema({ ui_type: 'int' }))
      ).toBe(true);
    });

    it('rejects an incompatible literal type', () => {
      expect(
        argumentMatchesType(expressions, arg({ type: 'string' }), schema({ ui_type: 'int' }))
      ).toBe(false);
    });

    it('accepts any-typed arguments anywhere', () => {
      expect(
        argumentMatchesType(expressions, arg({ type: 'any' }), schema({ ui_type: 'int' }))
      ).toBe(true);
    });

    it('matches a sub-expression by its return type', () => {
      const subExp = arg({ is_expression: true, value: { exp: 'COUNT' } });
      expect(argumentMatchesType(expressions, subExp, schema({ ui_type: 'int' }))).toBe(true);
      expect(argumentMatchesType(expressions, subExp, schema({ ui_type: 'date' }))).toBe(false);
    });

    it('is permissive when the schema type is unknown to the type catalogue', () => {
      expect(
        argumentMatchesType(expressions, arg({ type: 'string' }), schema({ ui_type: 'mystery' }))
      ).toBe(true);
    });
  });

  describe('areQorusTypesCompatible', () => {
    it('treats any as compatible with everything', () => {
      expect(areQorusTypesCompatible('any', 'date')).toBe(true);
      expect(areQorusTypesCompatible('string', 'any')).toBe(true);
    });

    it('accepts exact matches and accepted widenings', () => {
      expect(areQorusTypesCompatible('int', 'integer')).toBe(true);
      expect(areQorusTypesCompatible('float', 'int')).toBe(true);
      expect(areQorusTypesCompatible('data', 'binary')).toBe(true);
    });

    // the server's catalogue knows each type by one name: Qore's other name for it is the same type (qorus#646)
    it("takes Qore's other name for a type as the type it names", () => {
      expect(areQorusTypesCompatible('integer', 'float')).toBe(true);
      expect(areQorusTypesCompatible('number', 'integer')).toBe(true);
      expect(areQorusTypesCompatible('boolean', 'bool')).toBe(true);
      expect(areQorusTypesCompatible('bool', 'boolean')).toBe(true);
      expect(areQorusTypesCompatible('integer', 'string')).toBe(false);
      expect(areQorusTypesCompatible('boolean', 'int')).toBe(false);
    });

    it('rejects unrelated scalar types', () => {
      expect(areQorusTypesCompatible('int', 'string')).toBe(false);
      expect(areQorusTypesCompatible('date', 'bool')).toBe(false);
    });

    it('rejects unknown main types', () => {
      expect(areQorusTypesCompatible('mystery', 'string')).toBe(false);
    });

    it('handles array forms on both sides', () => {
      expect(areQorusTypesCompatible(['int', 'float'], 'int')).toBe(true);
      expect(areQorusTypesCompatible(['date'], ['bool', 'int'])).toBe(false);
      expect(areQorusTypesCompatible('float', ['string', 'int'])).toBe(true);
    });
  });
});

describe('auto is the other spelling of any', () => {
  /**
   * `auto` and `any` are synonyms across the codebase — `Field.tsx` maps both to
   * one renderer, and FormEngine tests `=== 'any' || === 'auto'` in several
   * places — but the TYPES LIST only carries `any`.
   *
   * An unknown main type falls into the "not found" branch and answers FALSE for
   * every check, so an `auto`-typed field was judged incompatible with
   * everything. The visible cost was in the template picker:
   * `filterTemplatesByType()` removed every template from such a field, and the
   * author was offered a group header with nothing under it — a field that
   * looked like it had no templates, when in fact its templates had been
   * filtered away by a name mismatch.
   */
  it.each(['string', 'int', 'bool', 'hash', 'list', 'date'])(
    'treats an auto-typed field as compatible with %s, exactly as any is',
    (checkType) => {
      expect(areQorusTypesCompatible('auto', checkType)).toBe(
        areQorusTypesCompatible('any', checkType)
      );
      expect(areQorusTypesCompatible('auto', checkType)).toBe(true);
    }
  );

  it('normalizes auto on the CHECKED side too', () => {
    // The mismatch is symmetric: a template badged `auto` was being compared
    // against a typed field and losing for the same reason.
    expect(areQorusTypesCompatible('string', 'auto')).toBe(
      areQorusTypesCompatible('string', 'any')
    );
  });

  it('still rejects a genuinely unknown type', () => {
    // The not-found branch is not being weakened - only `auto` is folded into
    // `any`. A misspelled or unsupported type must still answer false, or the
    // filter would stop filtering anything at all.
    expect(areQorusTypesCompatible('not-a-type', 'string')).toBe(false);
  });
});

describe('the operations offered for a type', () => {
  const greater = { ui_return_type: 'bool' };
  const size = { ui_return_type: 'number' };
  const count = { ui_return_type: 'int' };
  const join = { ui_return_type: 'richtext' };
  const lower = { ui_return_type: 'string' };
  const today = { ui_return_type: 'date' };
  const split = { ui_return_type: 'list' };
  const plus = { ui_return_type: 'any', return_type_first_arg: true };
  const unknown = {};

  it('a condition is built from any operation whose result decides it: not text, not a date', () => {
    expect(expressionFitsReturnType('bool', greater)).toBe(true);
    // a number, a list, a hash, binary data decide a condition by their truthiness
    expect(expressionFitsReturnType('bool', size)).toBe(true);
    expect(expressionFitsReturnType('bool', count)).toBe(true);
    expect(expressionFitsReturnType('bool', split)).toBe(true);
    expect(expressionFitsReturnType('bool', { ui_return_type: 'hash' })).toBe(true);
    expect(expressionFitsReturnType('bool', { ui_return_type: 'binary' })).toBe(true);
    expect(expressionFitsReturnType('bool', { ui_return_type: '*int' })).toBe(true);
    // text and dates are compared explicitly instead
    expect(expressionFitsReturnType('bool', join)).toBe(false);
    expect(expressionFitsReturnType('bool', lower)).toBe(false);
    expect(expressionFitsReturnType('bool', today)).toBe(false);
    expect(expressionFitsReturnType('bool', { ui_return_type: '*softstring' })).toBe(false);
  });

  it('keeps an operation whose result is known only once it is built', () => {
    expect(expressionFitsReturnType('bool', plus)).toBe(true);
    expect(expressionFitsReturnType('bool', unknown)).toBe(true);
    expect(expressionFitsReturnType('bool', { ui_return_type: 'auto' })).toBe(true);
  });

  it('offers everything where anything is taken', () => {
    for (const anyType of [undefined, 'any', 'auto', 'context', [] as string[]]) {
      expect(expressionFitsReturnType(anyType, lower)).toBe(true);
    }
  });

  it('only a condition narrows the list: any other type keeps every operation', () => {
    expect(expressionFitsReturnType('string', join)).toBe(true);
    expect(expressionFitsReturnType('string', size)).toBe(true);
    expect(expressionFitsReturnType(['int', 'number'], lower)).toBe(true);
    expect(expressionFitsReturnType(['bool'], lower)).toBe(false);
    expect(expressionFitsReturnType('*bool', today)).toBe(false);
  });
});

describe('text or a date', () => {
  it('is what a condition cannot be', () => {
    for (const t of ['string', 'softstring', '*string', 'richtext', 'date', 'softdate', '*date', 'time', '*time']) {
      expect(isTextOrDateType(t)).toBe(true);
    }
    for (const t of ['bool', 'int', 'number', 'float', 'list', 'hash', 'binary', 'any', '*int', 'data']) {
      expect(isTextOrDateType(t)).toBe(false);
    }
  });
});

describe('a place that takes a condition', () => {
  it('is one whose result must be true or false', () => {
    expect(isConditionType('bool')).toBe(true);
    expect(isConditionType('*boolean')).toBe(true);
    expect(isConditionType('softbool')).toBe(true);
    expect(isConditionType('*softbool')).toBe(true);
    expect(isConditionType(['bool'])).toBe(true);
    expect(isConditionType(['bool', 'int'])).toBe(false);
    expect(isConditionType('int')).toBe(false);
    expect(isConditionType(undefined)).toBe(false);
    expect(isConditionType([])).toBe(false);
  });
});

describe('what is said of a condition (qorus#646)', () => {
  it('says nothing of true or false, or of a result it cannot tell', () => {
    for (const type of ['bool', '*bool', 'softbool', 'boolean', 'any', 'auto', undefined, '']) {
      expect(conditionVerdict(type)).toBeUndefined();
    }
  });

  it('refuses text, a date or a time', () => {
    for (const type of ['string', '*string', 'softstring', 'richtext', 'date', '*date', 'time']) {
      expect(conditionVerdict(type)).toBe('error');
    }
  });

  it('warns of a number, a list or a hash: true unless it is zero or empty', () => {
    for (const type of ['int', '*int', 'softint', 'number', 'float', 'list', 'list<string>', 'hash', 'binary']) {
      expect(conditionVerdict(type)).toBe('warning');
    }
  });
});

describe('the parts of a condition (qorus#646)', () => {
  const field = (name: string): IExpression => ({ type: 'auto', value: `$record:{${name}}` });
  const op = (exp: string, ...args: IExpression[]): IExpression => ({
    is_expression: true,
    value: { exp, args },
  });
  const int = { type: 'int', reading: 'truthiness' as const };
  const bool = { type: 'bool', reading: 'condition' as const };
  const text = { type: 'string', reading: 'not_a_condition' as const };

  it("puts each part of an AND or an OR on its own card, in the server's walk order", () => {
    expect(conditionPartCards(op('&&', field('n'), field('flag')), [int, bool])).toEqual({
      'value.args.0': int,
      'value.args.1': bool,
    });
  });

  it('walks into a nested AND or OR, whose own parts are the parts', () => {
    const value = op('||', op('&&', field('n'), field('flag')), field('name'));
    expect(conditionPartCards(value, [int, bool, text])).toEqual({
      'value.args.0.value.args.0': int,
      'value.args.0.value.args.1': bool,
      'value.args.1': text,
    });
  });

  it("puts the part a NOT reads on the NOT's own card", () => {
    expect(conditionPartCards(op('!', field('items')), [int])).toEqual({ '': int });
    expect(conditionPartCards(op('&&', field('flag'), op('!', field('n'))), [bool, int])).toEqual({
      'value.args.0': bool,
      'value.args.1': int,
    });
  });

  it('has no parts for a condition that is not an AND, an OR or a NOT', () => {
    expect(conditionPartCards(op('>', field('n'), { type: 'int', value: 0 }), [])).toEqual({});
  });

  it("trusts no answer that is not about this expression: the server's parts must match its own", () => {
    expect(conditionPartCards(op('&&', field('n'), field('flag')), [int])).toEqual({});
    expect(conditionPartCards(op('&&', field('n'), field('flag')), undefined)).toEqual({});
  });

  it('says what a part is read as: nothing for true or false or an unknown, else a warning or an error', () => {
    expect(conditionPartVerdict(bool)).toBeUndefined();
    expect(conditionPartVerdict({ type: 'auto', reading: 'unknown' })).toBeUndefined();
    expect(conditionPartVerdict(int)).toBe('warning');
    expect(conditionPartVerdict(text)).toBe('error');
    expect(conditionPartVerdict(undefined)).toBeUndefined();
  });
});

describe('what the server says of each part (qorus#646)', () => {
  const WARN = { code: 'CONDITION_BY_TRUTHINESS', message: 'true unless zero' };
  const REFUSE = { code: 'NOT_A_CONDITION', message: "A condition can't give Text" };
  const int = { type: 'int', reading: 'truthiness' as const };
  const bool = { type: 'bool', reading: 'condition' as const };
  const text = { type: 'string', reading: 'not_a_condition' as const };

  it("gives each part the server's words, in the order it judged them", () => {
    expect(conditionPartsWithMessages([int, bool, text], 'bool', [WARN, REFUSE])).toEqual([
      { ...int, message: WARN.message },
      bool,
      { ...text, message: REFUSE.message },
    ]);
  });

  it('skips what it said of the whole expression first', () => {
    // a whole that is not true or false is said first, before its parts
    expect(conditionPartsWithMessages([text], 'int', [WARN, REFUSE])).toEqual([
      { ...text, message: REFUSE.message },
    ]);
  });

  it('keeps no words when the diagnostics do not line up with the readings', () => {
    expect(conditionPartsWithMessages([int, text], 'bool', [REFUSE, WARN])).toEqual([int, text]);
    expect(conditionPartsWithMessages([int], 'bool', [])).toEqual([int]);
    expect(conditionPartsWithMessages(undefined, 'bool', [WARN])).toBeUndefined();
  });

  it('ignores what else the server said', () => {
    expect(
      conditionPartsWithMessages([int], 'bool', [{ code: 'DPQL-W004', message: 'w' }, WARN])
    ).toEqual([{ ...int, message: WARN.message }]);
  });
});

/**
 * What reqraft says of a condition when the server said nothing: the server's own words (qorus#646), so the IDE's
 * convention test can compare them. An example by type for one that is not a condition, and how Qorus reads one
 * by its value, by type.
 */
describe('the condition fallback texts', () => {
  it('says how to make text, a date or a time a condition, with an example for its type', () => {
    expect(conditionErrorText('Text', 'string')).toBe(
      'The condition evaluates to Text, but it must evaluate to true or false. Compare the value instead, for example @status == "open".'
    );
    expect(conditionErrorText('Date', '*date')).toContain('for example @shipped_on > @ordered_on.');
    expect(conditionErrorText('Time', 'softtime')).toContain('for example @starts_at < @ends_at.');
  });

  // the type named by its sentence form, as the server names it (QonsoleDesignI18n::conditionByTruthinessText)
  it('says how Qorus reads a condition by its value, by the type it gives', () => {
    expect(conditionByTruthinessText('int')).toBe(
      'The condition evaluates to a whole number; Qorus treats it as true unless it is 0. To make that explicit, compare it, for example @count > 0.'
    );
    expect(conditionByTruthinessText('*float')).toContain('evaluates to a number;');
    expect(conditionByTruthinessText('number')).toContain('evaluates to an exact number;');
    expect(conditionByTruthinessText('softinteger')).toContain('evaluates to a whole number;');
    expect(conditionByTruthinessText('hash<auto>')).toContain('evaluates to key-value pairs (a hash);');
    expect(conditionByTruthinessText('list<string>')).toBe(
      'The condition evaluates to a list; Qorus treats it as true unless it is empty. To make that explicit, compare its size, for example size(@items) > 0.'
    );
    expect(conditionByTruthinessText('hash')).toBe(
      'The condition evaluates to key-value pairs (a hash); Qorus treats it as true unless it holds no pairs. To make that explicit, compare its size, for example size(@details) > 0.'
    );
    for (const unknown of ['binary', undefined]) {
      expect(conditionByTruthinessText(unknown)).toBe(
        "The condition's value is not true or false; Qorus treats it as true unless it is 0 or empty. To make that explicit, compare it, for example @count > 0."
      );
    }
  });

  it('finds what the server says of the whole condition, in its words', () => {
    const said = [
      { code: 'CONDITION_BY_TRUTHINESS', message: 'whole' },
      { code: 'NOT_A_CONDITION', message: 'part' },
    ];
    expect(conditionWholeMessage('int', said)).toBe('whole');
    // true or false, or a type it cannot tell: nothing said of the whole
    expect(conditionWholeMessage('bool', said)).toBeUndefined();
    expect(conditionWholeMessage('any', said)).toBeUndefined();
    // the first condition diagnostic is not the kind the whole's type gives: not the whole's
    expect(conditionWholeMessage('string', said)).toBeUndefined();
    expect(conditionWholeMessage('string', [{ code: 'NOT_A_CONDITION', message: 'refused' }])).toBe(
      'refused'
    );
  });
});
