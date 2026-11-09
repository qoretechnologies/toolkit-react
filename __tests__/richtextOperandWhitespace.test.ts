// Copyright 2026 Qore Technologies, s.r.o.
// A rich-text operand that holds one template tag alone is that template; spaces or tabs around it make it text,
// as the server reads it: evaluation keeps them. Only empty text is dropped.
import { describe, expect, it } from 'vitest';
import { expressionOperand } from '../src/components/form/expressions/expressionOperands';

const paragraph = (...children: unknown[]) => [{ type: 'paragraph', children }];
const tag = { type: 'tag', value: '$local:id', label: 'Interface ID', children: [{ text: '' }] };

describe('a rich-text operand', () => {
  it('holding a template tag alone is that template', () => {
    expect(
      expressionOperand({ type: 'richtext', value: paragraph({ text: '' }, tag, { text: '' }) })
    ).toEqual({ type: 'auto', value: '$local:id' });
  });

  it('holding a tag with spaces around it is text, which keeps the spaces', () => {
    expect(
      expressionOperand({ type: 'richtext', value: paragraph({ text: ' ' }, tag, { text: ' ' }) })
    ).toEqual({ type: 'string', value: ' $local:id ' });
  });

  it('holding a tag after a tab is text', () => {
    expect(expressionOperand({ type: 'richtext', value: paragraph({ text: '\t' }, tag) })).toEqual({
      type: 'string',
      value: '\t$local:id',
    });
  });

  it('holding nothing is not given', () => {
    expect(expressionOperand({ type: 'richtext', value: paragraph({ text: '' }) })).toBeUndefined();
  });

  it('holding a tag and a newline is text', () => {
    expect(expressionOperand({ type: 'richtext', value: paragraph(tag, { text: '\n' }) })).toEqual({
      type: 'string',
      value: '$local:id\n',
    });
  });

  it('holding a tag between no-break spaces is text', () => {
    expect(
      expressionOperand({
        type: 'richtext',
        value: paragraph({ text: ' ' }, tag, { text: ' ' }),
      })
    ).toEqual({ type: 'string', value: ' $local:id ' });
  });

  it('holding a tag and an empty paragraph after it is text, as the server joins paragraphs with a newline', () => {
    expect(
      expressionOperand({
        type: 'richtext',
        value: [...paragraph(tag), ...paragraph({ text: '' })],
      })
    ).toEqual({ type: 'string', value: '$local:id\n' });
  });

  it('holding a template written as text, alone, is that template', () => {
    expect(
      expressionOperand({ type: 'richtext', value: paragraph({ text: '$local:id' }) })
    ).toEqual({ type: 'auto', value: '$local:id' });
  });
});
