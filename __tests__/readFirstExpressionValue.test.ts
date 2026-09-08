import { describe, expect, it } from 'vitest';
import { formatOptionValue } from '../src/components/form/engine/readFirst';

/**
 * A read-first row must never print an expression's AST at itself.
 *
 * Reported twice from the running IDE: opening an assertion showed
 * `is_expression true / value / exp + / args 1 2 / type hash` where the
 * expression belongs. The formatter did handle expressions — but only in the
 * FLAT shape the editor writes at runtime. A value read back from a saved
 * draft carries the envelope NESTED, with no flag on the option itself, and
 * fell through to the generic object formatter.
 */
/* A real AST: args are typed `{type,value}` operands, not bare literals. With
   bare numbers the renderer answers "null + null", which would have made this
   test agree with a broken formatter. */
const AST = {
  exp: '+',
  args: [
    { type: 'int', value: 1 },
    { type: 'int', value: 2 },
  ],
} as never;

describe('an expression in a read-first row', () => {
  it('is rendered as an expression when the flag is on the option', () => {
    expect(formatOptionValue({ is_expression: true, value: AST } as never, {} as never)).toBe(
      '1 + 2'
    );
  });

  it('is rendered as an expression when the envelope is NESTED, as a reloaded draft has it', () => {
    /* Asserted exactly, because the weaker "does not contain 'args'" version
       passed against the BROKEN formatter too: it answers "2 fields", which
       contains neither word while still being the generic object summary the
       row then expands into the raw hash tree. */
    expect(
      formatOptionValue(
        { type: 'hash', value: { is_expression: true, value: AST } } as never,
        {} as never
      )
    ).toBe('1 + 2');
  });
});
