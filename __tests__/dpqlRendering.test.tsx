// Copyright 2026 Qore Technologies, s.r.o.
// The one read-only rendering of DPQL, and the server rendering it waits for.
//
// The Explain panel used to race the language server with a 1.5s timer and,
// when the page's first connection was still opening, show a client-side
// approximation marked "Approximate — server rendering unavailable" — on the
// first Explain of every page, while Qorus was up the whole time.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editorProps: Array<Record<string, unknown>> = [];

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: (props: Record<string, unknown>) => {
    editorProps.push(props);
    return <span data-testid='fake-dpql'>{String(props.value)}</span>;
  },
}));

let settle: (rendering: { text: string; richtext: unknown } | null) => void = () => undefined;
const renderRich = vi.fn(
  () =>
    new Promise<{ text: string; richtext: unknown } | null>((resolve) => {
      settle = resolve;
    })
);

vi.mock('../src/components/form/expressions/useRenderExpression', () => ({
  useRenderExpression: () => ({ renderRich }),
}));

import {
  DpqlRendering,
  ExpressionRendering,
} from '../src/components/form/expressions/DpqlRendering';

const AST = { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] } as never;

const mount = (node: React.ReactNode) => render(<ReqoreUIProvider>{node}</ReqoreUIProvider>);

beforeEach(() => {
  editorProps.length = 0;
  renderRich.mockClear();
});

describe('DpqlRendering', () => {
  it('shows the text through a read-only DPQL editor, without diagnostics, hover or overlay', () => {
    const { container } = mount(<DpqlRendering text='1 + 2 > 3' data-testid='shown' />);

    expect(container.querySelector('[data-testid="shown"]')?.textContent).toBe('1 + 2 > 3');
    expect(editorProps[0]).toMatchObject({
      value: '1 + 2 > 3',
      readOnly: true,
      showDiagnostics: false,
      enableHover: false,
      // The text is known up front; no "Connecting…" overlay may hide it.
      loadingIndicator: null,
    });
  });
});

describe('ExpressionRendering', () => {
  it('waits in the form waiting shape, then shows the server rendering', async () => {
    const { container } = mount(<ExpressionRendering expression={AST} />);

    await waitFor(() => expect(renderRich).toHaveBeenCalledWith(AST));
    expect(container.querySelector('[data-wait="expression-rendering"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Approximate');

    settle({ text: '1 + 2', richtext: null });

    await waitFor(() => expect(container.querySelector('.dpql-rendering')?.textContent).toBe('1 + 2'));
    expect(container.querySelector('[data-wait]')).toBeNull();
  });

  it('says plainly when the server cannot render, instead of approximating', async () => {
    const { container } = mount(<ExpressionRendering expression={AST} />);

    await waitFor(() => expect(renderRich).toHaveBeenCalled());
    settle(null);

    await waitFor(() =>
      expect(container.textContent).toContain('This expression could not be rendered.')
    );
    expect(container.querySelector('.dpql-rendering')).toBeNull();
    expect(container.textContent).not.toContain('Approximate');
  });
});
