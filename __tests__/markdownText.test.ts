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
    expect(markdownToPlainText('See [the runbook](https://example.com/x) and ![a chart](c.png).')).toBe(
      'See the runbook and a chart.'
    );
  });

  it('keeps what only looks like a mark: an intraword underscore, a lone asterisk', () => {
    expect(markdownToPlainText('retry_count_max is 2 * 3')).toBe('retry_count_max is 2 * 3');
  });

  it('keeps paragraph breaks, a line per list item, and joins a paragraph’s wrapped lines', () => {
    expect(
      markdownToPlainText('## Order intake\n\nReceives orders\nfrom the portal.\n\n- one\n- `two`\n\n---')
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
