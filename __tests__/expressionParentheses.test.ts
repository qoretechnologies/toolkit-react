import { describe, expect, it } from 'vitest';

import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';
import { IExpression, IExpressionValue } from '../src/components/form/expressions/types';

/**
 * Where the offline renderer puts parentheses.
 *
 * It is an approximation of the server's `DataProvider::renderExpression`, and
 * an approximation that groups differently is not a smaller version of the
 * answer — it is a different one. The same expression would read two ways
 * depending on whether the instance happened to be reachable, and a read-first
 * row (which always renders here, synchronously) would disagree with the
 * preview beside it.
 *
 * Every case below is asserted against the Qore module's own tests in
 * `examples/test/qlib/DataProvider/Dpql.qtest`.
 */
const lit = (value: unknown): IExpression => ({ value }) as IExpression;
const nest = (value: IExpressionValue): IExpression =>
  ({ is_expression: true, value }) as IExpression;
const bin = (exp: string, left: IExpression, right: IExpression): IExpressionValue =>
  ({ exp, args: [left, right] }) as IExpressionValue;

describe('renderExpressionToText parenthesisation', () => {
  it('leaves the first operand bare — parsing puts it back where it was', () => {
    // `1 + 2 + 3` is stored left-nested, and rendering that as `(1 + 2) + 3`
    // states a grouping the author never typed. This is the reported bug.
    expect(renderExpressionToText(bin('+', nest(bin('+', lit(1), lit(2))), lit(3)))).toBe(
      '1 + 2 + 3'
    );
    expect(renderExpressionToText(bin('-', nest(bin('-', lit(1), lit(2))), lit(3)))).toBe(
      '1 - 2 - 3'
    );
  });

  it('keeps them on a later operand, where dropping them would re-associate', () => {
    // `1 - 2 - 3` means -4; the expression here means 2.
    expect(renderExpressionToText(bin('-', lit(1), nest(bin('-', lit(2), lit(3)))))).toBe(
      '1 - (2 - 3)'
    );
    expect(renderExpressionToText(bin('/', lit(1), nest(bin('/', lit(2), lit(3)))))).toBe(
      '1 / (2 / 3)'
    );
  });

  it('keeps them for `+`, which concatenates as readily as it adds', () => {
    // `1 + (2 + "a")` is "12a"; `1 + 2 + "a"` is "3a".
    expect(renderExpressionToText(bin('+', lit(1), nest(bin('+', lit(2), lit('a')))))).toBe(
      '1 + (2 + "a")'
    );
  });

  it('follows precedence: a looser argument is wrapped, a tighter one is not', () => {
    expect(renderExpressionToText(bin('*', nest(bin('+', lit(1), lit(2))), lit(3)))).toBe(
      '(1 + 2) * 3'
    );
    expect(renderExpressionToText(bin('+', lit(1), nest(bin('*', lit(2), lit(3)))))).toBe(
      '1 + 2 * 3'
    );
  });

  it('drops them for an associative operator, wherever the nesting falls', () => {
    const cmp = (field: string, value: number): IExpression =>
      nest(bin('==', lit(field), lit(value)));
    expect(
      renderExpressionToText(bin('&&', cmp('a', 1), nest(bin('&&', cmp('b', 2), cmp('c', 3)))))
    ).toBe('"a" == 1 && "b" == 2 && "c" == 3');
  });

  it('wraps a looser operator inside an associative one', () => {
    const cmp = (field: string, value: number): IExpression =>
      nest(bin('==', lit(field), lit(value)));
    expect(
      renderExpressionToText(bin('&&', cmp('a', 1), nest(bin('||', cmp('b', 2), cmp('c', 3)))))
    ).toBe('"a" == 1 && ("b" == 2 || "c" == 3)');
  });

  it('never wraps a call argument — the call already delimits it', () => {
    const call: IExpressionValue = {
      exp: 'toInt',
      args: [nest(bin('+', lit(1), lit(2)))],
    } as IExpressionValue;
    expect(renderExpressionToText(call)).toBe('toInt(1 + 2)');
  });
});

/**
 * An operator holding more than two operands (qorus#646).
 *
 * `+` and `*` take any number of operands, and the Visual view builds them that way: the IDE's
 * Message Content is one `+` of three. The server writes them infix (`DpqlSerializer::serializeArithmeticOp`,
 * since Qore's n-ary fix), and the read-first row wrote `+("…", format_number(…), "…")`, so the collapsed
 * summary disagreed with the Text view and the preview of the same value. An operator that takes two holding
 * more is refused as text by the server; the summary keeps every operand, as a call.
 */
const call = (exp: string, ...args: IExpression[]): IExpressionValue =>
  ({ exp, args }) as IExpressionValue;

describe('renderExpressionToText with more than two operands', () => {
  it('writes `+` and `*` infix, as the server does', () => {
    expect(
      renderExpressionToText(call('+', lit('run at '), lit(9000000), lit(' and that is it')))
    ).toBe('"run at " + 9000000 + " and that is it"');
    expect(renderExpressionToText(call('*', lit(2), lit(3), lit(4)))).toBe('2 * 3 * 4');
  });

  it('keeps the parentheses a later operand needs, and none the first one does', () => {
    expect(
      renderExpressionToText(
        call('+', nest(bin('+', lit(1), lit(2))), nest(bin('+', lit(3), lit(4))), lit(5))
      )
    ).toBe('1 + 2 + (3 + 4) + 5');
    expect(renderExpressionToText(call('*', nest(bin('+', lit(1), lit(2))), lit(3), lit(4)))).toBe(
      '(1 + 2) * 3 * 4'
    );
  });

  it('keeps every operand of an operator that takes two, as a call', () => {
    expect(renderExpressionToText(call('-', lit(10), lit(3), lit(2)))).toBe('-(10, 3, 2)');
  });
});
