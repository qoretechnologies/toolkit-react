// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { formatOptionValue } from '../src/components/form/engine/readFirst';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * qorus#646 (found by the IDE agent): a template or an expression on a color option read "Set" in its
 * collapsed row. The row's color branch came before its template and expression branches, and the color
 * summary calls anything that is not a color "Set". A template is the field it names and an expression
 * reads as DPQL, whatever the field's type: those checks come first, before any type draws its own value.
 * A file had the same order and the same "Set".
 */
const ROW_FIELDS = {
  items: [
    {
      label: 'Fields of the row',
      items: [{ label: 'Position', value: '$record:{pos}', badge: 'string' }],
    },
  ],
};

const AST = {
  exp: '+',
  args: [
    { type: 'int', value: 1 },
    { type: 'int', value: 2 },
  ],
};

const TYPES = ['rgbcolor', 'file'] as const;

const renderRow = (type: string, field: unknown) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='read'
          stringTemplates={ROW_FIELDS as never}
          value={{ choice: field } as never}
          options={
            {
              choice: {
                type,
                display_name: 'Choice',
                supports_templates: true,
                supports_expressions: true,
              },
            } as never
          }
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const readRow = async (container: HTMLElement): Promise<HTMLElement> => {
  await waitFor(() => expect(container.querySelector('.readfirst-row')).not.toBeNull());
  return container.querySelector('.readfirst-row') as HTMLElement;
};

describe.each(TYPES)('a %s option, read', (type) => {
  it('summarises a template as the template, not as Set', () => {
    expect(formatOptionValue({ type, value: '$record:{pos}' } as never, { type } as never)).toBe(
      '$record:{pos}'
    );
  });

  it('shows the field a template names, by its name, in the collapsed row', async () => {
    const { container } = renderRow(type, { type, value: '$record:{pos}' });
    const row = await readRow(container);
    // the template's chip names the field as the catalogue does; the type's own rendering printed
    // "Set" (a color) or the raw reference (a file)
    await waitFor(() => expect(row.textContent).toContain('Position'));
    expect(row.textContent).not.toContain('Set');
    expect(row.textContent).not.toContain('$record');
  });

  it('shows an expression as marked DPQL in the collapsed row', async () => {
    const { container } = renderRow(type, { type, is_expression: true, value: AST });
    const row = await readRow(container);
    await waitFor(() => {
      expect(row.querySelector('.reqraft-expression-marker')).not.toBeNull();
      expect(row.querySelector('.dpql-rendering')?.textContent).toContain('1 + 2');
    });
  });

  it('shows an expression saved in the nested envelope as marked DPQL too', async () => {
    const { container } = renderRow(type, { type, value: { is_expression: true, value: AST } });
    const row = await readRow(container);
    await waitFor(() => {
      expect(row.querySelector('.reqraft-expression-marker')).not.toBeNull();
      expect(row.querySelector('.dpql-rendering')?.textContent).toContain('1 + 2');
    });
  });
});

describe('a color, read', () => {
  it('is still summarised as its hex code', () => {
    expect(
      formatOptionValue(
        { type: 'rgbcolor', value: { r: 255, g: 0, b: 0, a: 1 } } as never,
        {
          type: 'rgbcolor',
        } as never
      )
    ).toBe('#FF0000');
  });

  it('still shows its hex code on a wash of the color in the collapsed row', async () => {
    const { container } = renderRow('rgbcolor', {
      type: 'rgbcolor',
      value: { r: 255, g: 0, b: 0, a: 1 },
    });
    const row = await readRow(container);
    await waitFor(() => expect(row.textContent).toContain('#FF0000'));
    const washed = Array.from(row.querySelectorAll('span')).find((span) =>
      span.style.background.includes('color-mix')
    );
    expect(washed?.textContent).toBe('#FF0000');
    expect(row.querySelector('.reqraft-expression-marker')).toBeNull();
  });
});
