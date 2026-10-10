import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The Text view of an expression built in the Visual view (David's review of qorus#646).
 *
 * Two operand shapes are not DPQL: an operand switched to "Use Expression" whose operation is not
 * chosen yet, and a custom Text value (a rich-text document). Handed to `dpql/serialize` as they were,
 * the Text view showed `undefined([object Object]) > [object Object]` and `[object Object] > [object
 * Object]`; the server writes them as hashes (`{args=(null)} > {type=int}`).
 */
const serialized: unknown[] = [];
vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onReady }, ref) => {
    // a session that is up: the field reads and writes its text through it from the start
    useEffect(() => {
      onReady?.();
    }, []);
    useImperativeHandle(
      ref,
      () => ({
        serialize: async (expression: any) => {
          serialized.push(expression);
          // as the server writes a field operand and a string operand
          const write = (arg: any): string =>
            typeof arg?.value === 'string' && /^\$record:\{(.+)\}$/.test(arg.value)
              ? `@${/^\$record:\{(.+)\}$/.exec(arg.value)![1]}`
              : typeof arg?.value === 'string'
                ? JSON.stringify(arg.value)
                : String(arg?.value ?? arg);
          return `${write(expression.args[0])} ${expression.exp} ${write(expression.args[1])}`;
        },
      }),
      []
    );
    return <textarea data-testid='fake-dpql' readOnly value={value ?? ''} />;
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';
import { incompleteExpressionText, serializableExpression } from '../src/components/form/expressions/textOfExpression';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const richtext = (...children: unknown[]) => [{ type: 'paragraph', children: [{ text: '' }, ...children, { text: '' }] }];
const tag = (value: string, label: string) => ({ type: 'tag', value, label, children: [{ text: '' }] });

/** ">" with its first operand switched to "Use Expression", nothing chosen, and the second empty. */
const USE_EXPRESSION_UNCHOSEN = {
  exp: '>',
  args: [{ value: { args: [null] }, is_expression: true }, {}],
};
/** ">" with a custom Text value holding a field template on each side. */
const TEXT_TEMPLATES = {
  exp: '>',
  args: [
    { type: 'richtext', value: richtext(tag('$record:{bestellnummer}', 'bestellnummer')), is_expression: false },
    { type: 'richtext', value: richtext(tag('$record:{pos}', 'pos')), is_expression: false },
  ],
};

const textViewOf = async (ast: any) => {
  serialized.length = 0;
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <ExpressionField
          value={{ is_expression: true, value: ast }}
          onChange={() => undefined}
          type='bool'
          defaultMode='text'
          expressions={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  await waitFor(() => expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).not.toBe(''));
  return (screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value;
};

describe('the Text view of a visual expression', () => {
  it('shows a hole for an operand whose operation is not chosen, and asks nothing to write it', async () => {
    expect(await textViewOf(USE_EXPRESSION_UNCHOSEN)).toBe('… > …');
    expect(serialized).toEqual([]);
  });

  it('writes custom Text values holding templates as the templates they are', async () => {
    expect(await textViewOf(TEXT_TEMPLATES)).toBe('@bestellnummer > @pos');
    expect(serialized).toEqual([
      {
        exp: '>',
        args: [
          { type: 'auto', value: '$record:{bestellnummer}' },
          { type: 'auto', value: '$record:{pos}' },
        ],
      },
    ]);
  });
});

describe('what DPQL can write', () => {
  it('is nothing while a part is not filled in', () => {
    expect(serializableExpression(USE_EXPRESSION_UNCHOSEN as any)).toBeUndefined();
    expect(serializableExpression({ exp: '>', args: [{ type: 'int', value: 1 }, { type: 'richtext' }] })).toBeUndefined();
    expect(serializableExpression({ exp: '>', args: [{ type: 'int', value: 1 }, { type: 'richtext', value: richtext() }] })).toBeUndefined();
  });

  it('is a rich text with words as the string it says', () => {
    expect(
      serializableExpression({
        exp: '==',
        args: [
          { type: 'string', value: 'a' },
          { type: 'richtext', value: richtext({ text: 'Order ' }, tag('$record:{pos}', 'pos')) },
        ],
      })
    ).toEqual({ exp: '==', args: [{ type: 'string', value: 'a' }, { type: 'string', value: 'Order $record:{pos}' }] });
  });

  it('keeps literals, null included, and nested expressions', () => {
    const ast = {
      exp: '&&',
      args: [
        { is_expression: true, value: { exp: '>', args: [{ type: 'int', value: 1 }, { type: 'nothing', value: null }] } },
        true,
      ],
    };
    expect(serializableExpression(ast as any)).toEqual(ast);
  });

  it('writes the parts it has around the holes', () => {
    expect(
      incompleteExpressionText({
        exp: '&&',
        args: [
          { is_expression: true, value: { exp: '>', args: [{ type: 'auto', value: '$record:{pos}' }, {}] } },
          { is_expression: true, value: { args: [] } },
        ],
      })
    ).toBe('@pos > … && …');
  });
});

describe('the read-first summary of an expression', () => {
  it('writes a custom Text value as what it holds, and a part not filled in as a hole', () => {
    expect(renderExpressionToText(TEXT_TEMPLATES as any)).toBe('"$record:{bestellnummer}" > "$record:{pos}"');
    expect(renderExpressionToText(USE_EXPRESSION_UNCHOSEN as any)).toBe('… > …');
    expect(
      renderExpressionToText({
        exp: '==',
        args: [{ type: 'richtext', value: richtext({ text: 'open' }) }, { type: 'nothing', value: null }],
      } as any)
    ).toBe('"open" == null');
  });
});
