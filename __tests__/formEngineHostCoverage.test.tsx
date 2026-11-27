import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/* Behaviours of the form engine a host app tested only through its own stories, which it no longer keeps. */

const renderForm = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine name='host' onChange={vi.fn()} {...(props as any)} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const text = () => document.body.textContent ?? '';

describe('a compact form', () => {
  it('reads a pre-filled optional field as its value, and keeps the unset ones behind "N more optional fields"', async () => {
    renderForm({
      compact: true,
      compactCollapsedGroups: [],
      maxFieldsShown: 1,
      options: {
        region: { type: 'string', ui_type: 'string', display_name: 'Region' },
        zone: { type: 'string', ui_type: 'string', display_name: 'Zone' },
        rack: { type: 'string', ui_type: 'string', display_name: 'Rack' },
        shelf: { type: 'string', ui_type: 'string', display_name: 'Shelf' },
      },
      value: { region: { type: 'string', value: 'eu-west' } },
    });

    await waitFor(() => expect(text()).toContain('eu-west'));
    // the field set is a row of its own, read as its value
    const region = document.querySelector('.readfirst-row[data-field="region"]');
    expect(region?.textContent).toContain('eu-west');
    // of the three nobody set, one is shown and two wait behind the fold
    await waitFor(() => expect(text()).toContain('2 more optional fields'));
    expect(document.querySelector('.readfirst-row[data-field="shelf"]')).toBeNull();
    // pressing it lists them
    (document.querySelector('.readfirst-more-row') as HTMLElement).click();
    await waitFor(() =>
      expect(document.querySelector('.readfirst-row[data-field="shelf"]')).toBeTruthy()
    );
  });

  it('says on the row what is wrong with a value of another type, and counts it as needing attention', async () => {
    renderForm({
      compact: true,
      options: {
        port: { type: 'int', ui_type: 'int', display_name: 'Port', required: true },
      },
      value: { port: { type: 'int', value: 'eighty' } },
    });

    await waitFor(() =>
      expect(document.querySelector('.readfirst-row[data-field="port"]')?.textContent).toMatch(
        /Value must be/
      )
    );
    expect(document.querySelector('.options-readfirst-completion')?.textContent).toContain(
      '1 need attention'
    );
  });
});

describe('a field that opens in a view of its own', () => {
  it('opens as an expression when its schema says default_view: expression', async () => {
    renderForm({
      options: {
        condition: {
          type: 'bool',
          ui_type: 'bool',
          display_name: 'Condition',
          default_view: 'expression',
          supports_expressions: true,
          preselected: true,
        },
      },
      value: {},
    });

    await waitFor(() => expect(document.querySelector('.expression-field')).toBeTruthy());
  });

  it('a field with no default_view opens on its own editor', async () => {
    renderForm({
      options: {
        condition: {
          type: 'bool',
          ui_type: 'bool',
          display_name: 'Condition',
          supports_expressions: true,
          preselected: true,
        },
      },
      value: {},
    });

    await waitFor(() => expect(text()).toContain('Condition'));
    expect(document.querySelector('.expression-field')).toBeNull();
  });
});

describe('a nested expression in a compact row', () => {
  it('reads as one line: substring of substring', async () => {
    const SUBSTRING = {
      name: 'substring',
      display_name: 'Substring',
      return_type: 'string',
      args: [
        { name: 'string', display_name: 'Text', ui_type: 'string', required: true },
        { name: 'int', display_name: 'Start', ui_type: 'int', required: true },
      ],
    };
    renderForm({
      compact: true,
      options: {
        part: {
          type: 'string',
          ui_type: 'string',
          display_name: 'Part',
          supports_expressions: true,
          expressions: [SUBSTRING],
        },
      },
      value: {
        part: {
          type: 'string',
          is_expression: true,
          value: {
            exp: 'substring',
            args: [
              {
                is_expression: true,
                value: {
                  exp: 'substring',
                  args: [
                    { type: 'string', value: 'order-12345' },
                    { type: 'int', value: 6 },
                  ],
                },
              },
              { type: 'int', value: 2 },
            ],
          },
        },
      },
    });

    const summary = await waitFor(() => {
      const element = document.querySelector('.readfirst-row[data-field="part"] .dpql-rendering');
      expect(element?.textContent).toMatch(/substring\(\s*substring\(/);
      return element as HTMLElement;
    });
    // one line: the inner call sits inside the outer one, nothing breaks it onto a line of its own
    expect(summary.textContent).not.toContain('\n');
    expect(summary.querySelectorAll('br')).toHaveLength(0);
  });
});

describe('clearing a required value', () => {
  it('asks first, then says the field is required', async () => {
    const { fireEvent, within } = await import('@testing-library/react');
    renderForm({
      compact: true,
      options: {
        enabled: { type: 'bool', ui_type: 'bool', display_name: 'Enabled', required: true },
      },
      value: { enabled: { type: 'bool', value: true } },
    });

    const row = await waitFor(() => {
      const element = document.querySelector('.readfirst-row[data-field="enabled"]') as HTMLElement;
      expect(element).toBeTruthy();
      return element;
    });
    fireEvent.click(row);
    const clear = await waitFor(() => {
      const element = document.querySelector(
        '[data-field="enabled"] .options-readfirst-clear'
      ) as HTMLElement;
      expect(element).toBeTruthy();
      return element;
    });
    fireEvent.click(clear);

    // it asks before it clears
    const confirm = await waitFor(() => {
      const modal = document.querySelector('.reqore-confirmation-modal') as HTMLElement;
      expect(modal).toBeTruthy();
      return within(modal).getByRole('button', { name: 'Clear value' });
    });
    expect(document.querySelector('[data-field="enabled"]')?.textContent).not.toMatch(/Required/);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(document.querySelector('[data-field="enabled"]')?.textContent).toMatch(/Required/)
    );
  });
});
