// Copyright 2026 Qore Technologies, s.r.o.
// Detecting that text typed into a plain field is really a DPQL expression.
//
// Every `parsed` fixture in this file is a REAL `dpql/parse` response,
// captured from the live Qorus LSP rather than invented — including the
// awkward one the whole design turns on: `hello` parses SUCCESSFULLY, as a
// literal wrapped in `{exp: 'value'}`. A test written against an imagined
// server would have "proved" that a successful parse means an expression.
import {
  canBeLiteralOfType,
  classifyTypedText,
  hasErrorDiagnostic,
  isRealExpressionAst,
  mightBeDpqlExpression,
} from '../src/helpers/dpqlDetection';

/** A literal, as the server wraps one. */
const literalAst = (type: string, value: any) => ({
  is_expression: true,
  value: { exp: 'value', args: [{ type, value }] },
});

/** A real expression. */
const expressionAst = (exp: string, args: any[] = []) => ({
  is_expression: true,
  value: { exp, args },
});

const parsedOk = (expression: any, diagnostics: any[] = []) => ({
  success: true,
  expression,
  diagnostics,
});

describe('mightBeDpqlExpression', () => {
  it('does not fire on plain prose, which must never cost a round-trip', () => {
    expect(mightBeDpqlExpression('hello')).toBe(false);
    expect(mightBeDpqlExpression('My service description')).toBe(false);
  });

  it('does not fire on a date, a negative number or a path', () => {
    // Each of these contains a `-` or `/`; none is an expression, and a
    // probe on every keystroke of a date field would be pure waste.
    expect(mightBeDpqlExpression('2026-09-06')).toBe(false);
    expect(mightBeDpqlExpression('-5')).toBe(false);
    expect(mightBeDpqlExpression('some/path/file.txt')).toBe(false);
  });

  it('does not fire on an email address', () => {
    expect(mightBeDpqlExpression('someone@example.com')).toBe(false);
  });

  it('fires on comparisons', () => {
    expect(mightBeDpqlExpression('@a > 5')).toBe(true);
    expect(mightBeDpqlExpression('@a >= 5')).toBe(true);
    expect(mightBeDpqlExpression('@a != 5')).toBe(true);
    expect(mightBeDpqlExpression('@a = 5')).toBe(true);
    expect(mightBeDpqlExpression('@a == 5')).toBe(true);
  });

  it('fires on spaced arithmetic but not on a hyphenated word', () => {
    expect(mightBeDpqlExpression('$local:count + 1')).toBe(true);
    expect(mightBeDpqlExpression('@a - 1')).toBe(true);
    expect(mightBeDpqlExpression('well-known-name')).toBe(false);
  });

  it('fires on word operators and function calls', () => {
    expect(mightBeDpqlExpression('@n LIKE "a%"')).toBe(true);
    expect(mightBeDpqlExpression('toInt("5")')).toBe(true);
    expect(mightBeDpqlExpression('upper(@name)')).toBe(true);
  });

  it('ignores anything that is not a non-empty short string', () => {
    expect(mightBeDpqlExpression(undefined)).toBe(false);
    expect(mightBeDpqlExpression(42)).toBe(false);
    expect(mightBeDpqlExpression({ exp: '>' })).toBe(false);
    expect(mightBeDpqlExpression('   ')).toBe(false);
    // A document, not a field value — never worth probing.
    expect(mightBeDpqlExpression(`${'a > b '.repeat(200)}`)).toBe(false);
  });
});

describe('isRealExpressionAst', () => {
  it('rejects the literal wrapper the server returns for ordinary text', () => {
    expect(isRealExpressionAst(literalAst('string', 'hello'))).toBe(false);
    expect(isRealExpressionAst(literalAst('int', 42))).toBe(false);
    expect(isRealExpressionAst(literalAst('date', '2026-09-06T00:00:00+02:00'))).toBe(false);
  });

  it('rejects a bare record-field reference, which is a value not an expression', () => {
    expect(isRealExpressionAst(literalAst('auto', '$record:{a}'))).toBe(false);
  });

  it('rejects a bare template reference — that is template mode\'s job', () => {
    expect(isRealExpressionAst(expressionAst('template'))).toBe(false);
  });

  it('accepts operators and function calls', () => {
    expect(isRealExpressionAst(expressionAst('>'))).toBe(true);
    expect(isRealExpressionAst(expressionAst('+'))).toBe(true);
    expect(isRealExpressionAst(expressionAst('like'))).toBe(true);
    expect(isRealExpressionAst(expressionAst('toInt'))).toBe(true);
  });

  it('accepts a bare AST node as well as the field-ready envelope', () => {
    expect(isRealExpressionAst({ exp: '>', args: [] })).toBe(true);
    expect(isRealExpressionAst({ exp: 'value', args: [] })).toBe(false);
  });

  it('is safe on rubbish', () => {
    expect(isRealExpressionAst(undefined)).toBe(false);
    expect(isRealExpressionAst(null)).toBe(false);
    expect(isRealExpressionAst('>')).toBe(false);
    expect(isRealExpressionAst({})).toBe(false);
    expect(isRealExpressionAst({ value: {} })).toBe(false);
    expect(isRealExpressionAst({ value: { exp: '' } })).toBe(false);
  });
});

describe('hasErrorDiagnostic', () => {
  it('reads both the string severity this route sends and the LSP number', () => {
    expect(hasErrorDiagnostic([{ severity: 'error' }])).toBe(true);
    expect(hasErrorDiagnostic([{ severity: 1 }])).toBe(true);
  });

  it('does not treat a warning as an error', () => {
    // `upper(@name)` parses to a real expression with a warning that the
    // function is unknown — the author should still be offered the editor.
    expect(hasErrorDiagnostic([{ severity: 'warning' }])).toBe(false);
    expect(hasErrorDiagnostic([{ severity: 2 }])).toBe(false);
  });

  it('is safe on absent, empty and malformed lists', () => {
    expect(hasErrorDiagnostic(undefined)).toBe(false);
    expect(hasErrorDiagnostic([])).toBe(false);
    expect(hasErrorDiagnostic([undefined, null])).toBe(false);
  });
});

describe('canBeLiteralOfType', () => {
  it('says yes for text on a string field — the reason such a field never auto-switches', () => {
    expect(canBeLiteralOfType('a + b', 'string')).toBe(true);
    expect(canBeLiteralOfType('@a > 5', 'string')).toBe(true);
  });

  it('says no for an expression on a typed field', () => {
    expect(canBeLiteralOfType('@a > 5', 'int')).toBe(false);
    expect(canBeLiteralOfType('1 + 2', 'int')).toBe(false);
    expect(canBeLiteralOfType('@a > 5', 'float')).toBe(false);
  });

  it('says yes when there is no declared type to contradict', () => {
    expect(canBeLiteralOfType('@a > 5', undefined)).toBe(true);
  });

  it('honours a string field that constrains its literals', () => {
    expect(
      canBeLiteralOfType('@a > 5', 'string', { has_to_be_valid_identifier: true })
    ).toBe(false);
    expect(
      canBeLiteralOfType('valid_name', 'string', { has_to_be_valid_identifier: true })
    ).toBe(true);
  });
});

describe('classifyTypedText', () => {
  it('does nothing when the text is not an expression at all', () => {
    // The case the whole design turns on: the parse SUCCEEDED.
    expect(
      classifyTypedText({
        text: 'hello',
        type: 'string',
        parsed: parsedOk(literalAst('string', 'hello')),
      })
    ).toBe('none');
  });

  it('does nothing when the text does not parse', () => {
    expect(
      classifyTypedText({
        text: 'hello world',
        type: 'string',
        parsed: { success: false, expression: null, diagnostics: [{ severity: 'error' }] },
      })
    ).toBe('none');
  });

  it('does nothing before a parse has run', () => {
    expect(classifyTypedText({ text: '@a > 5', type: 'int' })).toBe('none');
  });

  it('OFFERS an expression that could also stand as a literal here', () => {
    // `a + b` is a perfectly good string. Rewriting it silently would
    // destroy what the author meant.
    expect(
      classifyTypedText({
        text: 'a + b',
        type: 'string',
        parsed: parsedOk(expressionAst('+')),
      })
    ).toBe('offer');
  });

  it('SWITCHES an expression that could not be a literal here', () => {
    expect(
      classifyTypedText({
        text: '@a > 5',
        type: 'int',
        parsed: parsedOk(expressionAst('>')),
      })
    ).toBe('switch');
  });

  it('refuses to act on a parse that carries an error', () => {
    expect(
      classifyTypedText({
        text: '@a > 5',
        type: 'int',
        parsed: parsedOk(expressionAst('>'), [{ severity: 'error' }]),
      })
    ).toBe('none');
  });

  it('still acts when the parse only warns', () => {
    expect(
      classifyTypedText({
        text: 'upper(@name)',
        type: 'int',
        parsed: parsedOk(expressionAst('upper'), [
          { severity: 'warning', message: "Unknown function 'upper'" },
        ]),
      })
    ).toBe('switch');
  });
});
