import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
} from '../src/components/form/expressions/types';
import {
  areQorusTypesCompatible,
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
