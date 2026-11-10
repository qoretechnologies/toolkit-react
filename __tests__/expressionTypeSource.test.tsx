// Copyright 2026 Qore Technologies, s.r.o.
import { afterEach, describe, expect, it } from 'vitest';
import {
  expressionTypeMismatchText,
  expressionTypeSource,
  operandLabel,
} from '../src/helpers/expressions';
import { builtInTypeSentenceForm, typesInASentence } from '../src/helpers/qorusTypeCatalogue';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';

const form = (type: string | undefined) => builtInTypeSentenceForm(type);

/** `+`: its type is that of its operands, by the server's priority. */
const PLUS = {
  return_type: 'auto',
  ui_return_type: 'any',
  return_type_arg_priority: ['number', 'float', 'int', 'string'],
};
/** `substr`: gives text, whatever its operands. */
const SUBSTR = { return_type: 'string', ui_return_type: 'richtext' };
/** `==`: gives true or false. */
const EQUALS = { return_type: 'bool', ui_return_type: 'bool' };
/** `coalesce`: gives what its operands give. */
const COALESCE = { return_type: 'auto', ui_return_type: 'any' };

describe('what a type mismatch says of where the type comes from', () => {
  afterEach(() => setReqraftLabels({}));

  it('names the operand an operation takes its type from', () => {
    const source = expressionTypeSource(
      'string',
      [
        { label: '"Order note"', type: 'string' },
        { label: '"5"', type: 'int' },
      ],
      form,
      PLUS
    );
    expect(source).toEqual({ label: '"Order note"', isOperation: false });
    expect(expressionTypeMismatchText('text', 'a whole number', source)).toBe(
      'This expression gives text because "Order note" is text, but this field takes a whole number. Choose an ' +
        'expression that gives a whole number, or put this one inside an expression that converts it.'
    );
  });

  it('says an operation operand "gives" the type', () => {
    const source = expressionTypeSource(
      'string',
      [{ label: '"Lower Case"', type: 'string', isOperation: true }],
      form,
      COALESCE
    );
    expect(expressionTypeMismatchText('text', 'a whole number', source)).toMatch(
      /because "Lower Case" gives text,/
    );
  });

  it('names nobody for an operation that declares its own type: substr gives text whatever it takes', () => {
    expect(
      expressionTypeSource('string', [{ label: '"Order note"', type: 'string' }], form, SUBSTR)
    ).toBeUndefined();
  });

  it('names nobody for a comparison, whose operand types are not what it gives', () => {
    expect(
      expressionTypeSource('bool', [{ label: '"Flag"', type: 'bool' }], form, EQUALS)
    ).toBeUndefined();
  });

  it('names nobody when no operand gives the type, or the rule is not known', () => {
    expect(
      expressionTypeSource('string', [{ label: '"Interface ID"', type: 'int' }], form, PLUS)
    ).toBeUndefined();
    expect(
      expressionTypeSource('string', [{ label: '"Order note"', type: 'string' }], form, undefined)
    ).toBeUndefined();
  });

  it('is said in the host language', () => {
    setReqraftLabels({
      formEngine: {
        typeMismatch: (gives, takes, source) => `gibt ${gives} (${source?.label}) statt ${takes}`,
      },
    });
    expect(
      expressionTypeMismatchText('Text', 'eine Zahl', { label: '"Notiz"', isOperation: false })
    ).toBe('gibt Text ("Notiz") statt eine Zahl');
  });
});

describe('an operand named without raw data', () => {
  it('is a template label where the field offers the template', () => {
    expect(operandLabel('$local:id', 'Interface ID')).toBe('"Interface ID"');
  });

  it('is a template kind where it does not', () => {
    expect(operandLabel('$data:{Xy1.Name}', undefined)).toBe('a $data template');
  });

  it('is "this value" for rich text or a list', () => {
    expect(operandLabel([{ type: 'paragraph', children: [{ text: 'x' }] }], undefined)).toBe(
      'this value'
    );
  });

  it('is "this value" for rich text stored as text, and for long or multi-line text', () => {
    expect(operandLabel('Dear customer', undefined, 'richtext')).toBe('this value');
    expect(operandLabel('line one\nline two', undefined, 'string')).toBe('this value');
    expect(operandLabel('x'.repeat(25), undefined, 'string')).toBe('this value');
  });

  it('quotes a value written as text or a number', () => {
    expect(operandLabel('abc', undefined)).toBe('"abc"');
    expect(operandLabel(5, undefined)).toBe('"5"');
  });
});

describe('the types a field takes', () => {
  it('says each type once, as a short list', () => {
    expect(typesInASentence(['number', 'float', 'int', 'integer'], form)).toBe(
      'an exact number, a number or a whole number'
    );
  });

  it('joins two types with or alone', () => {
    expect(typesInASentence(['int', 'string'], form)).toBe('a whole number or text');
  });

  it('says text once for a field that takes text of any kind: the data field', () => {
    expect(
      typesInASentence(
        [
          'string',
          'richtext',
          'binary',
          'email',
          'uri',
          'uuid',
          'hostname',
          'ipv4',
          'ipv6',
          'phone',
        ],
        form
      )
    ).toBe('text or binary data');
  });

  it('names a kind of text where the field takes only that kind', () => {
    expect(typesInASentence(['email'], form)).toBe('an email address');
  });
});
