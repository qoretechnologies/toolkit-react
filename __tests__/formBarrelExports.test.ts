/**
 * The form barrel is the package's public surface for the expression editor.
 * The library's own rule renders the `ExpressionField` shell at a root field
 * and the bare `ExpressionBuilder` for nested operands, so a host following it
 * needs both from the barrel — a deep import of `dist/…/builder` is a
 * dependency on the file layout, not on the API (#119).
 */
import { ExpressionBuilder, ExpressionField, RowOpenPickerContext } from '../src/components/form';

describe('form barrel — expression editor exports', () => {
  it('exports the bare ExpressionBuilder alongside the ExpressionField shell', () => {
    expect(ExpressionBuilder).toBeDefined();
    expect(typeof ExpressionBuilder).toBe('function');
    expect(ExpressionField).toBeDefined();
  });
});

/**
 * qorus-ide draws its own select, so the row's "open your picker" instruction
 * has to reach it the same way the row's menu channel does — through the
 * barrel, not a deep import into `dist/`.
 */
describe('form barrel — the row-open instruction', () => {
  it('exports the context a host editor reads to open its own picker', () => {
    expect(RowOpenPickerContext).toBeDefined();
    expect(RowOpenPickerContext.Provider).toBeDefined();
  });
});
