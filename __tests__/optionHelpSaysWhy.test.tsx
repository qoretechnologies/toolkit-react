// Copyright 2026 Qore Technologies, s.r.o.
/**
 * An option's help says what the option takes, its description or why it has none, and its allowed values as the
 * policy has them (qorus#646, David: "there should be a reason given why there is no description" and "use a
 * bulleted list with an "Allowed values" header in bold and data styling for each value").
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AllowedValuesHelp } from '../src/components/Description/AllowedValuesHelp';
import { OptionsHelpDialog } from '../src/components/form/engine/OptionsHelpDialog';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const help = (option: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <OptionsHelpDialog
        option={{ display_name: 'Option', ...option } as never}
        onClose={vi.fn()}
      />
    </ReqoreUIProvider>
  );

describe("an option's help", () => {
  it('says why where the option has no description', () => {
    help({ type: 'int' });
    expect(document.body.textContent).toContain('Takes a whole number.');
    expect(document.body.textContent).toContain('No description was given for this option.');
  });

  it('says its description, and no reason, where it has one', () => {
    help({ type: 'string', short_desc: 'What it is' });
    expect(document.body.textContent).toContain('What it is');
    expect(document.body.textContent).not.toContain('No description was given');
  });

  it('lists its allowed values under a bold heading, in a table, each exact value as data', () => {
    help({
      type: 'string',
      desc: 'The language the code is written in.',
      allowed_values: [
        {
          display_name: 'Qore',
          short_desc: 'Runs in the server',
          value: { type: 'string', value: 'qore' },
        },
        { value: 'python' },
      ],
    });
    const list = document.body.querySelector('.allowed-values-help') as HTMLElement;
    expect(list.querySelector('.allowed-values-heading')?.textContent).toBe('Allowed values');
    const table = list.querySelector('table') as HTMLTableElement;
    expect(Array.from(table.querySelectorAll('th')).map((th) => th.textContent)).toEqual([
      'Value',
      'Name',
      'Description',
    ]);
    expect(
      Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent)
      )
    ).toEqual([
      ['qore', 'Qore', 'Runs in the server'],
      ['python', '', ''],
    ]);
    expect(
      Array.from(table.querySelectorAll('td code.allowed-value')).map((code) => code.textContent)
    ).toEqual(['qore', 'python']);
  });

  it('leaves out a column no value has anything in', () => {
    help({ type: 'string', allowed_values: [{ value: 'a' }, { value: 'b' }] });
    expect(
      Array.from(document.body.querySelectorAll('.allowed-values-help th')).map(
        (th) => th.textContent
      )
    ).toEqual(['Value']);
  });

  it("calls a field's values suggestions where it takes others too", () => {
    help({
      type: 'string',
      allowed_values_creatable: true,
      allowed_values: [{ value: 'general' }],
    });
    expect(document.body.querySelector('.allowed-values-heading')?.textContent).toBe(
      'Suggested values'
    );
  });

  it('lists no values where it has none', () => {
    help({ type: 'string', short_desc: 'Free text' });
    expect(document.body.querySelector('.allowed-values-help')).toBeNull();
  });
});

describe('an allowed value as help shows it', () => {
  it('is its exact value, written out where it is not text', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <AllowedValuesHelp
          values={[
            { value: { type: 'int', value: 3 } },
            { name: 'auto', display_name: 'Automatic' },
          ]}
        />
      </ReqoreUIProvider>
    );
    expect(
      Array.from(container.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent)
      )
    ).toEqual([
      ['3', ''],
      ['auto', 'Automatic'],
    ]);
  });
});

describe("an option's name, hovered", () => {
  it('says why there is no description where it has none, beside what it takes', async () => {
    const { container, findByText } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='why'
            options={{ retries: { type: 'int', display_name: 'Retries' } } as never}
            value={{ retries: { type: 'int', value: 3 } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await findByText('Retries');
    const titled = container.querySelector('[data-field="retries"] [title*="Takes"]');
    expect(titled?.getAttribute('title')).toBe(
      'No description was given for this option.\nTakes a whole number.'
    );
  });
});
