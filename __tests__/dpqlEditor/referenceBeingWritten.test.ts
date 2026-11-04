// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What a template picked in an expression's text takes the place of (qorus#646, David's review): a `$` typed to ask
 * for one stayed in front of the chip, and `pos + 1 + $pos` is refused by the server.
 */
import { describe, expect, it } from 'vitest';
import {
  dpqlReferenceBeingWritten,
  dpqlSlateConverter,
} from '../../src/components/dpqlEditor/dpqlHelpers';

describe('a reference being written, before the caret', () => {
  it('is a $ typed to ask for a template', () => {
    expect(dpqlReferenceBeingWritten('$')).toBe(1);
    expect(dpqlReferenceBeingWritten('$record:{pos} + 1 + $')).toBe(1);
    expect(dpqlReferenceBeingWritten('concat($')).toBe(1);
  });

  it('is a $ with part of a template after it', () => {
    expect(dpqlReferenceBeingWritten('1 + $rec')).toBe(4);
    expect(dpqlReferenceBeingWritten('1 + $record:')).toBe(8);
    expect(dpqlReferenceBeingWritten('1 + $record:{po')).toBe(11);
  });

  it('is an @ with no name after it', () => {
    expect(dpqlReferenceBeingWritten('1 + @')).toBe(1);
  });

  it('is a $ in a string, where a template is still one', () => {
    expect(dpqlReferenceBeingWritten('concat("price: $')).toBe(1);
  });

  it('is not a whole reference, which is a value already', () => {
    expect(dpqlReferenceBeingWritten('$record:{pos}')).toBe(0);
    expect(dpqlReferenceBeingWritten('1 + $data:total')).toBe(0);
    expect(dpqlReferenceBeingWritten('1 + @pos')).toBe(0);
  });

  it('is not an @ in a string, which is text there, even one opened on a line before', () => {
    expect(dpqlReferenceBeingWritten('concat("mail me @')).toBe(0);
    expect(dpqlReferenceBeingWritten("concat('first line\nmail me @")).toBe(0);
    // closed before it: the @ is a field's
    expect(dpqlReferenceBeingWritten('concat("a", @')).toBe(1);
  });

  it('is nothing where no $ or @ ends the text', () => {
    expect(dpqlReferenceBeingWritten('')).toBe(0);
    expect(dpqlReferenceBeingWritten('pos + 1')).toBe(0);
    expect(dpqlReferenceBeingWritten('pos + 1 + ')).toBe(0);
    expect(dpqlReferenceBeingWritten('$ ')).toBe(0);
  });

  it('is what the DPQL converter tells the editor', () => {
    expect(dpqlSlateConverter.referenceBeingWritten?.('1 + $')).toBe(1);
  });
});
