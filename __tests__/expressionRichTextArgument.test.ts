import { describe, expect, it } from 'vitest';

import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';
import { IExpression, IExpressionValue } from '../src/components/form/expressions/types';

/**
 * A rich-text argument reads as the string it is.
 *
 * The editor stores rich text as its document — paragraphs of text and template
 * tags — and the offline renderer printed that object as JSON. A Qog's Message
 * Content row read `+([{"type":"paragraph","children":[…]}], …)`: the editor's
 * node tree, which is no value anyone wrote and not what the server renders.
 */
const richtext = (...children: unknown[]): IExpression =>
  ({ type: 'richtext', value: [{ type: 'paragraph', children }] }) as IExpression;
const lit = (value: unknown): IExpression => ({ value }) as IExpression;

describe('renderExpressionToText with a rich-text argument', () => {
  it('writes the rich text as a string literal', () => {
    const value = {
      exp: '+',
      args: [richtext({ text: 'This Qog was run at ' }), lit(' by me')],
    } as IExpressionValue;

    expect(renderExpressionToText(value)).toBe('"This Qog was run at " + " by me"');
  });

  it('writes a template tag inside it as its reference', () => {
    const value = {
      exp: '+',
      args: [
        richtext(
          { text: 'Day ends at ' },
          { type: 'tag', label: 'Day End', value: '$timestamp:next_midnight', children: [{ text: '' }] }
        ),
        lit('!'),
      ],
    } as IExpressionValue;

    expect(renderExpressionToText(value)).toBe('"Day ends at $timestamp:next_midnight" + "!"');
  });

  it('still writes any other object as it is', () => {
    const value = { exp: '+', args: [lit({ a: 1 }), lit(2)] } as IExpressionValue;

    expect(renderExpressionToText(value)).toBe('{"a":1} + 2');
  });
});
