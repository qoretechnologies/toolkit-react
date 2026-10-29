// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The stories' stand-in server reads what the real one reads (qorus#646, qlip #418: DpqlEditor · With Semantic
 * Tokens and A Record Field Is One Chip showed errors the real server never gives): a regular expression literal
 * after `=~` - a `$` or an `@` in it the pattern's - and a record field with accessors, braced or written with `@`.
 */
import { describe, expect, it } from 'vitest';
import { mockPublishedDiagnostics } from '../src/components/form/expressions/dpqlMockLanguage';

const said = (text: string) => mockPublishedDiagnostics(text).map((diagnostic) => diagnostic.message);

describe("the stand-in server's diagnostics", () => {
  it('reads a regular expression literal after =~ and !~ as one value', () => {
    expect(said('@email =~ /^[a-z]+@example\\.com$/i && @balance > 0')).toEqual([]);
    expect(said('$record:{email} !~ /^x$/')).toEqual([]);
  });

  it('reads a record field with accessors, braced or with an @, quoted, and a braced path with escaped braces', () => {
    expect(said('@orders[*].id == $record:{orders[*].id}')).toEqual([]);
    expect(
      said('@"create.Unit\\.Price" == $record:{create.a\\{b\\}} && @"create.order-id" != "@name"')
    ).toEqual([]);
  });

  it('reads in (…) and between … and …', () => {
    expect(
      said(
        '@status in ("active", "pending") && @age between 18 and 65 && @email =~ /^[a-z]+@example\\.com$/i && @balance > 0 && @deleted != true'
      )
    ).toEqual([]);
  });

  it('still says what it cannot read', () => {
    expect(said('@a = 1')).toEqual(["'=' can't be used here: remove it, or put it in quotes to make it text."]);
  });
});
