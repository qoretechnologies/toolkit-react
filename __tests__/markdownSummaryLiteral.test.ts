// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { formatOptionValue, summariseMarkdown } from '../src/components/form/engine/readFirst';

/**
 * qorus#646: a compact row's one-line summary of a markdown value reads it with markdownToProse, so a value it
 * quotes in a code span, or writes with escaped marks, is summarised as written.
 */
describe("a markdown value's one-line summary", () => {
  it('keeps what a code span quotes and what is escaped', () => {
    expect(summariseMarkdown('Falls back to `__other__`; \\*not\\* emphasis.')).toBe(
      'Falls back to __other__; *not* emphasis.'
    );
  });

  it("is the row's summary of a markdown field", () => {
    expect(
      formatOptionValue(
        { type: 'string', value: 'Falls back to `__other__`' } as never,
        {
          type: 'string',
          ui_type: 'markdown',
        } as never
      )
    ).toBe('Falls back to __other__');
  });
});

describe("a markdown value's one-line summary, beside code", () => {
  it('keeps a code span written with three backticks inside a line', () => {
    expect(summariseMarkdown('Run ```a `b` c``` now')).toBe('Run a `b` c now');
  });

  it('still leaves out a fenced block, which opens on a line of its own', () => {
    expect(summariseMarkdown('Before\n\n```qore\nfoo();\n```\n\nAfter')).toBe('Before After');
  });

  it('leaves out a fenced block nothing closes, to the end, as markdown does', () => {
    expect(summariseMarkdown('Before\n\n```\nfoo();\nbar();')).toBe('Before');
  });
});
