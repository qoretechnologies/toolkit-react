// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A description is markdown. Where no host renderer draws it, it reads as the text it renders to: the words and
 * the paragraph breaks, none of the marks.
 */
import { describe, expect, it } from 'vitest';
import { markdownToPlainText, markdownToProse } from '../src/helpers/markdownText';

describe('markdownToPlainText', () => {
  it('drops the marks and keeps the words', () => {
    expect(markdownToPlainText('Each `POST /conversations` starts a **new** _thread_.')).toBe(
      'Each POST /conversations starts a new thread.'
    );
    expect(
      markdownToPlainText('See [the runbook](https://example.com/x) and ![a chart](c.png).')
    ).toBe('See the runbook and a chart.');
  });

  it('keeps what only looks like a mark: an intraword underscore, a lone asterisk', () => {
    expect(markdownToPlainText('retry_count_max is 2 * 3')).toBe('retry_count_max is 2 * 3');
  });

  it('keeps paragraph breaks, a line per list item, and joins a paragraph’s wrapped lines', () => {
    expect(
      markdownToPlainText(
        '## Order intake\n\nReceives orders\nfrom the portal.\n\n- one\n- `two`\n\n---'
      )
    ).toBe('Order intake\n\nReceives orders from the portal.\n\none\ntwo');
  });

  it('keeps a fenced block’s lines', () => {
    expect(markdownToPlainText('Run:\n\n```\nqctl restart\nqctl status\n```')).toBe(
      'Run:\n\nqctl restart\nqctl status'
    );
  });

  it('is empty for what is not text', () => {
    expect(markdownToPlainText(undefined)).toBe('');
    expect(markdownToPlainText(12)).toBe('');
  });
});

describe('markdownToProse', () => {
  it('is the plain text on one line', () => {
    expect(markdownToProse('The **name**.\n\n- a\n- b')).toBe('The name. a b');
  });
});

/**
 * qorus#646 (found by the IDE agent): a code span's backticks were taken off after the emphasis passes, so what
 * the span quoted was read as markup - `__other__` came out as "other", `*y*` as "y". And a backslash escape was
 * not read at all: `\_\_x\_\_` came out with its backslashes. A code span holds its text exactly, and an escaped
 * mark is the mark itself, as CommonMark reads them.
 */
describe('what markdown quotes literally', () => {
  it.each([
    ['emphasis marks in a code span', 'Set it to `__other__`.', 'Set it to __other__.'],
    ['stars in a code span', 'Match `*y*` or `**/*.csv`.', 'Match *y* or **/*.csv.'],
    ['a backtick in a code span', 'Write ``a `b` c`` as is.', 'Write a `b` c as is.'],
    ['a code span padded with a space each side', 'The tick: `` ` ``.', 'The tick: `.'],
    ['a backslash in a code span', 'The path `C:\\_x\\_`.', 'The path C:\\_x\\_.'],
    ['escaped underscores', 'Use \\_\\_x\\_\\_ here.', 'Use __x__ here.'],
    ['escaped stars', 'Not \\*emphasis\\* at all.', 'Not *emphasis* at all.'],
    ['escaped backticks', 'Not \\`code\\` at all.', 'Not `code` at all.'],
    ['an escaped backslash', 'One \\\\ backslash.', 'One \\ backslash.'],
    ['an escaped bracket', '\\[not a link\\](x)', '[not a link](x)'],
  ])('%s', (_case, markdown, text) => {
    expect(markdownToProse(markdown)).toBe(text);
    expect(markdownToPlainText(markdown)).toBe(text);
  });

  it('keeps a backslash that escapes nothing', () => {
    expect(markdownToProse('C:\\Users\\me and \\n')).toBe('C:\\Users\\me and \\n');
  });

  it('keeps a run of backticks that nothing closes', () => {
    expect(markdownToProse('one ` tick')).toBe('one ` tick');
    // two backticks are closed only by two: the single one after `c` closes nothing either
    expect(markdownToProse('two ``c` ticks')).toBe('two ``c` ticks');
  });

  it('still drops the marks around a code span', () => {
    expect(markdownToProse('**Bold** then `__code__` then _it_')).toBe(
      'Bold then __code__ then it'
    );
  });

  it('keeps a code span exact in a list item and a heading', () => {
    expect(markdownToPlainText('# The `__ctx__` key\n\n- `*.csv`\n- `__other__`')).toBe(
      'The __ctx__ key\n\n*.csv\n__other__'
    );
  });
});
