import { describe, expect, it } from 'vitest';
import {
  addMissingExpressionArgs,
  isExpressionArgumentMissing,
} from '../src/components/form/expressions/argumentPresence';

/**
 * Editing an argument that is DECLARED `any`.
 *
 * Reported from the live IDE: an assertion's Expected Value, written as the
 * text expression `null`, came back from the draft as
 * `{"type": "any", "required": true}` — an argument DEFINITION where its value
 * belonged — and the visual view then said
 * `Value for argument 1 ("any") is invalid: Value is empty`. Retyping the value
 * did not repair it.
 *
 * Two rules were wrong, and they hid each other: the argument could not be
 * edited (so the author could not put the value back), and a clear stored a
 * definition (so what was left behind did not look like an empty field).
 */
const VALUE = {
  name: 'value',
  display_name: 'Value',
  return_type: 'any',
  args: [{ name: 'any', display_name: 'Any', ui_type: 'any', required: true }],
};

const CATALOGUE = [VALUE];

describe('an argument that carries no value is missing', () => {
  it('treats a stored argument DEFINITION as missing', () => {
    // Exactly what a draft came back holding. `required` is a schema key that
    // nothing reads back off a value, so its presence must not make the
    // argument look supplied.
    expect(isExpressionArgumentMissing({ type: 'any', required: true })).toBe(true);
  });

  it('treats an envelope holding undefined as missing', () => {
    expect(isExpressionArgumentMissing({ type: 'any', value: undefined })).toBe(true);
  });

  it('still counts an explicit null as supplied', () => {
    expect(isExpressionArgumentMissing({ type: 'any', value: null })).toBe(false);
  });

  it('still counts a sub-expression as supplied', () => {
    expect(
      isExpressionArgumentMissing({ is_expression: true, value: { exp: '+', args: [] } })
    ).toBe(false);
  });

  it('still counts falsy values as supplied', () => {
    expect(isExpressionArgumentMissing({ type: 'int', value: 0 })).toBe(false);
    expect(isExpressionArgumentMissing({ type: 'string', value: '' })).toBe(false);
    expect(isExpressionArgumentMissing({ type: 'bool', value: false })).toBe(false);
  });

  it('repairs an argument definition left in a saved draft', () => {
    // The next time the builder touches the expression, the definition is
    // replaced by a genuinely empty argument rather than kept as data.
    const [repaired] = addMissingExpressionArgs(CATALOGUE, 'value', [
      { type: 'any', required: true },
    ]);

    expect(repaired).not.toHaveProperty('required');
    expect(isExpressionArgumentMissing(repaired)).toBe(true);
  });

  it('leaves a supplied null alone', () => {
    const [kept] = addMissingExpressionArgs(CATALOGUE, 'value', [{ type: 'any', value: null }]);

    expect(kept).toEqual({ type: 'any', value: null });
  });
});
