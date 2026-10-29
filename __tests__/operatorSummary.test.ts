// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What an option compared by an operator says: in names (qorus#646, David on FormEngine · Compact Operators:
 * "what is 'WHERE status IS equals "COMPLETE"' - what is this expression, and what is "is equals"?").
 */
import { describe, expect, it } from 'vitest';
import { operatorSummary } from '../src/components/form/engine/operatorSummary';

// as the server sends its search operators
const OPERATORS = {
  '==': { name: '==', display_name: 'equals (==)' },
  '!': { name: '!', display_name: 'logical not (!)' },
  like: { name: 'like', display_name: 'like' },
};

describe('the sentence under an option compared by an operator', () => {
  it('names the option, the operator and the value, text in quotes', () => {
    expect(
      operatorSummary({
        label: 'Status',
        operatorKeys: ['=='],
        operators: OPERATORS,
        value: 'COMPLETE',
        shown: 'COMPLETE',
      })
    ).toBe('Status equals (==) "COMPLETE"');
  });

  it('says each operator of a chain, outermost first', () => {
    expect(
      operatorSummary({
        label: 'Hostname',
        operatorKeys: ['!', 'like'],
        operators: OPERATORS,
        value: 'qore%',
        shown: 'qore%',
      })
    ).toBe('Hostname logical not (!) like "qore%"');
  });

  it('writes a number, a yes/no and a field as they are, never as JSON', () => {
    const say = (value: unknown, shown: string) =>
      operatorSummary({ label: 'Count', operatorKeys: ['=='], operators: OPERATORS, value, shown });
    expect(say(5, '5')).toBe('Count equals (==) 5');
    expect(say(true, 'Yes')).toBe('Count equals (==) Yes');
    expect(say('$local:count', '$local:count')).toBe('Count equals (==) $local:count');
  });

  it('names an operator the server did not describe by its key, and leaves out a value not given', () => {
    expect(
      operatorSummary({
        label: 'Status',
        operatorKeys: ['~=', undefined],
        value: undefined,
        shown: '',
      })
    ).toBe('Status ~=');
  });
});
