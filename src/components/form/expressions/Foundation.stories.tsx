import { ReqoreControlGroup, ReqoreP, ReqoreTag } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { useEffect, useState } from 'react';

import { StoryMeta } from '../../../types';
import { startDpqlMockLsp } from './dpqlMockLsp';
import { mockExpressions } from './mockExpressions';
import { IExpressionValue } from './types';
import { useExpressions } from './useExpressions';
import { useRenderExpression } from './useRenderExpression';

/** `name == "John" && contains(email, "@")` as an AST. */
const SAMPLE: IExpressionValue = {
  exp: '&&',
  args: [
    {
      is_expression: true,
      value: {
        exp: '==',
        args: [
          { type: 'string', value: '$local:name' },
          { type: 'string', value: 'John' },
        ],
      },
    },
    {
      is_expression: true,
      value: {
        exp: 'contains',
        args: [
          { type: 'string', value: '$local:email' },
          { type: 'string', value: '@' },
        ],
      },
    },
  ],
};

/**
 * Phase 0 foundation check: the catalogue hook (via the `override` seam)
 * and the Explain renderer (`useRenderExpression`) — no UI yet.
 */
const FoundationDemo = () => {
  const { expressions } = useExpressions({ override: mockExpressions });
  const { render } = useRenderExpression();
  const [text, setText] = useState('');

  useEffect(() => {
    render(SAMPLE, expressions).then(setText);
  }, [render, expressions]);

  return (
    <ReqoreControlGroup vertical fluid gapSize='normal'>
      <ReqoreP>{expressions.length} expressions loaded</ReqoreP>
      <ReqoreControlGroup>
        {expressions.map((e) => (
          <ReqoreTag key={e.name} label={`${e.display_name} (${e.symbol})`} />
        ))}
      </ReqoreControlGroup>
      <code data-testid='rendered'>{text}</code>
    </ReqoreControlGroup>
  );
};

const meta = {
  component: FoundationDemo,
  title: 'Components/Form/Expressions/Foundation',
} as StoryMeta<typeof FoundationDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // `useRenderExpression` is server-first (LSP `dpql/renderExpression`);
  // run the mock so the rendering is served deterministically. Offline the
  // hook would fall back client-side, but only after the connection-wait,
  // which is longer than `findByText`'s default timeout.
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Catalogue hook returns the fixture (8 boolean comparators/logicals +
    // 6 varargs/function entries added for the ExpressionBuilder story families).
    await expect(canvas.getByText('14 expressions loaded')).toBeInTheDocument();
    await expect(canvas.getByText('String Contains (contains)')).toBeInTheDocument();
    // Explain renderer produced readable text from the AST (async setText,
    // so wait for it via findByText).
    const rendered = await canvas.findByText(/== "John"/);
    await expect(rendered.textContent).toContain('contains(');
  },
};
