/**
 * Which string fields hold one line, and how they are kept that way.
 *
 * The rule lives here rather than in a consumer because the consumer is not the
 * only renderer. qorus-ide fixed this in its own long-string field, and every
 * form that goes through FormEngine — which is where an alert rule's Internal
 * Name, Name and Short Description are — reaches reqraft's instead. The fix was
 * real and the field in front of the operator still took Enter.
 */
import { describe, expect, it } from 'vitest';
import {
  flattenToSingleLine,
  hasLineBreak,
  isSingleLineStringType,
} from '../src/helpers/singleLineString';

describe('isSingleLineStringType', () => {
  it('recognises the string types that hold exactly one line', () => {
    for (const type of ['string', 'email', 'uuid', 'hostname', 'ipv4', 'ipv6', 'phone']) {
      expect(isSingleLineStringType(type)).toBe(true);
    }
  });

  it('leaves the document types multi-line', () => {
    for (const type of ['long-string', 'markdown', 'richtext', 'data', 'code-editor']) {
      expect(isSingleLineStringType(type)).toBe(false);
    }
  });

  /**
   * The two directions fail very differently, so the list is explicit rather
   * than derived by excluding the document types. Missing a single-line type
   * leaves it behaving as it does now — no worse. Wrongly treating a new
   * DOCUMENT type as single-line would flatten a user's text as they typed it,
   * which is data loss.
   */
  it('treats an unrecognised type as multi-line', () => {
    expect(isSingleLineStringType('some-future-document-type')).toBe(false);
    expect(isSingleLineStringType(undefined)).toBe(false);
    expect(isSingleLineStringType('')).toBe(false);
  });

  it('leaves the collection types alone, which share the same field', () => {
    // ComponentMap routes list/hash/binary to the long-string field too; a
    // YAML value must keep its newlines
    for (const type of ['list', 'hash', 'binary', 'free-list', 'free-hash']) {
      expect(isSingleLineStringType(type)).toBe(false);
    }
  });
});

describe('hasLineBreak', () => {
  it('detects every line-break spelling', () => {
    expect(hasLineBreak('a\nb')).toBe(true);
    expect(hasLineBreak('a\r\nb')).toBe(true);
    expect(hasLineBreak('a\rb')).toBe(true);
  });

  it('is false for a value that has none', () => {
    expect(hasLineBreak('one line')).toBe(false);
    expect(hasLineBreak('')).toBe(false);
  });
});

describe('flattenToSingleLine', () => {
  /**
   * A space rather than nothing, because the newline is usually where a word
   * boundary was — pasting two lines into a name should read as two words, not
   * one run-together one.
   */
  it('collapses a break to a single space', () => {
    expect(flattenToSingleLine('two\nwords')).toBe('two words');
    expect(flattenToSingleLine('two\r\nwords')).toBe('two words');
    expect(flattenToSingleLine('two\rwords')).toBe('two words');
  });

  it('collapses a run of breaks and spaces to one space', () => {
    expect(flattenToSingleLine('two\n\n\nwords')).toBe('two words');
    expect(flattenToSingleLine('two \n words')).toBe('two words');
  });

  it('leaves a value with no break untouched', () => {
    expect(flattenToSingleLine('already one line')).toBe('already one line');
  });

  it('is idempotent — flattening a flattened value changes nothing', () => {
    const once = flattenToSingleLine('a\nb\nc');
    expect(flattenToSingleLine(once)).toBe(once);
  });
});
