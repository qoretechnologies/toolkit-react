// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A regular expression literal after `=~` or `!~` is one value: an `@` or a `$` in it is the pattern's, never a
 * reference drawn as a chip (qorus#646, qlip #418: DpqlEditor · With Semantic Tokens drew `@example` of
 * `/^[a-z]+@example\.com$/i` as the chip record: example).
 */
import { describe, expect, it } from 'vitest';
import { dpqlReferencesIn, plainTextToSlate } from '../../src/components/dpqlEditor/dpqlHelpers';

const tags = (text: string) =>
  plainTextToSlate(text)
    .flatMap((paragraph) => paragraph.children)
    .filter((child) => (child as { type?: string }).type === 'tag')
    .map((child) => (child as { value?: string }).value);

describe('a regular expression literal', () => {
  it('holds no reference after =~ or !~', () => {
    expect(tags('@email =~ /^[a-z]+@example\\.com$/i && @balance > 0')).toEqual(['@email', '@balance']);
    expect(tags('@name !~ /$local:x/')).toEqual(['@name']);
    expect(dpqlReferencesIn('@email =~ /@example/').map(({ value }) => value)).toEqual(['@email']);
  });

  it('is only a literal after a match operator: a division reads on', () => {
    expect(tags('@total / @count > 2')).toEqual(['@total', '@count']);
  });
});
