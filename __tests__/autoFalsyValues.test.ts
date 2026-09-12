import { describe, expect, it } from 'vitest';
import { validateField, validateFieldWithResult } from '../src/helpers/validations';

/**
 * An `auto`/`any` field may legitimately hold a FALSY value.
 *
 * Reported on a test assertion's **Expected Value**: the field held `null` and
 * the expression builder refused it with *"Value for argument 1 ("any") is
 * invalid: Value is empty"*. `null` is not empty — it is the value the author
 * chose, and `equals`/`is_nothing` assertions are written against it.
 *
 * The same gate catches `0`, `false` and `""`, which are the expected values of
 * any test that checks a count is zero, a flag is off, or a string is blank.
 * Only `undefined` — nothing entered — is actually empty.
 */
describe('an auto/any field holding a falsy value', () => {
  (['auto', 'any'] as const).forEach((type) => {
    describe(type, () => {
      it('accepts an explicit null', () => {
        expect(validateField(type, null)).toBe(true);
      });

      it('accepts the number zero', () => {
        expect(validateField(type, 0)).toBe(true);
      });

      it('accepts false', () => {
        expect(validateField(type, false)).toBe(true);
      });

      it('accepts an empty string written as a YAML string', () => {
        expect(validateField(type, '""')).toBe(true);
      });

      it('still reports nothing-entered as empty', () => {
        const result = validateFieldWithResult(type, undefined);
        expect(result.isValid).toBe(false);
        expect(result.reasons.join(' ')).toContain('empty');
      });

      it('still reports an unparseable value', () => {
        expect(validateField(type, '{ unclosed')).toBe(false);
      });

      // the YAML text spellings an author actually types
      it('accepts the text "null"', () => {
        expect(validateField(type, 'null')).toBe(true);
      });

      it('accepts the text "0" and "false"', () => {
        expect(validateField(type, '0')).toBe(true);
        expect(validateField(type, 'false')).toBe(true);
      });
    });
  });
});
