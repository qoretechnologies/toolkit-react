// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { toSentenceCase } from '../src/helpers/sentenceCase';

describe('a catalogue name in sentence case', () => {
  it('lowers the capital of each later Title Case word', () => {
    expect(toSentenceCase('String Value')).toBe('String value');
    expect(toSentenceCase('Regex Options')).toBe('Regex options');
    expect(toSentenceCase('Ignore Case?')).toBe('Ignore case?');
    expect(toSentenceCase('Logical Greater Than Or Equal')).toBe('Logical greater than or equal');
  });

  it('keeps an acronym, a mixed-case word and a number as they are', () => {
    expect(toSentenceCase('Source URL')).toBe('Source URL');
    expect(toSentenceCase('JSON String')).toBe('JSON string');
    expect(toSentenceCase('Max 10 Items')).toBe('Max 10 items');
    expect(toSentenceCase('Use iPhone')).toBe('Use iPhone');
  });

  it('keeps one word and gives a name its first capital', () => {
    expect(toSentenceCase('Value')).toBe('Value');
    expect(toSentenceCase('substring')).toBe('Substring');
    expect(toSentenceCase('')).toBe('');
    expect(toSentenceCase(undefined)).toBeUndefined();
  });
});
