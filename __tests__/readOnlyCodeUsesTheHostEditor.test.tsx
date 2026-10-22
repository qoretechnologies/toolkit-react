// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Code is shown as the host shows code (qorus#646, David on FormEngine · Compact Read Only Values: "when we show
 * code, we should show it with syntax highlighting and lsp / hover / intellisense - even in read-only views"; his
 * decision: the host's code editor, read-only, and a plain block only where there is none).
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldAllowedValuesCheckGroup } from '../src/components/form/fields/allowed-values/AllowedValues';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const SOURCE = '%new-style\nsub main() {\n    print("hi\\n");\n}\n';
const OPTIONS = {
  language: {
    type: 'string',
    display_name: 'Language',
    allowed_values: [
      { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
      { display_name: 'Python', value: { type: 'string', value: 'python' } },
    ],
  },
  source: {
    type: 'string',
    ui_type: 'code-editor',
    display_name: 'Source',
    inherit_props: { language: 'language' },
  },
} as never;
const VALUE = {
  language: { type: 'string', value: 'qore' },
  source: { type: 'string', value: SOURCE },
} as never;

const renderForm = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          readOnly
          name='code'
          options={OPTIONS}
          value={VALUE}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('code shown on a read row', () => {
  it("is drawn by the host's code editor, read-only, in the language it inherits", async () => {
    const seen: Record<string, unknown>[] = [];
    const CodeEditor = (props: Record<string, unknown>) => {
      seen.push(props);
      return <div data-testid='host-code-editor'>{String(props.value)}</div>;
    };
    const { container } = renderForm({ componentOverrides: { 'code-editor': CodeEditor } });

    await waitFor(() =>
      expect(
        container.querySelector('.options-readfirst-code [data-testid="host-code-editor"]')
      ).toBeTruthy()
    );
    const preview = seen.find((props) => props.readOnly === true);
    expect(preview).toMatchObject({
      value: SOURCE,
      readOnly: true,
      language: 'qore',
      name: 'source',
    });
  });

  it("is the host's preview where it gives one", async () => {
    const { container } = renderForm({
      componentOverrides: { 'code-editor': () => <div data-testid='host-code-editor' /> },
      codePreviewRenderer: () => <div data-testid='host-preview' />,
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="host-preview"]')).toBeTruthy()
    );
    expect(
      container.querySelector('.options-readfirst-code [data-testid="host-code-editor"]')
    ).toBeNull();
  });

  it('is a plain block where the host gives no editor', async () => {
    const { container } = renderForm({});
    await waitFor(() =>
      expect(
        container.querySelector('pre.options-readfirst-code, .options-readfirst-code')
      ).toBeTruthy()
    );
    expect(container.querySelector('.options-readfirst-code')?.textContent).toContain(
      'print("hi\\n");'
    );
    expect(container.querySelector('.options-readfirst-code-editor')).toBeNull();
  });
});

describe('a short list of one choice', () => {
  it('is radios in a group, each drawn by its picture where it has one', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FieldAllowedValuesCheckGroup
          name='language'
          value='qore'
          onChange={vi.fn()}
          items={[
            { display_name: 'Qore', value: 'qore', image: 'qore.png' },
            { display_name: 'Python', value: 'python', image: 'python.png' },
          ]}
        />
      </ReqoreUIProvider>
    );
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.map((input) => input.type)).toEqual(['radio', 'radio']);
    expect(new Set(inputs.map((input) => input.name)).size).toBe(1);
    expect(inputs[0].name).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    ).toEqual(['qore.png', 'python.png']);
  });

  it('of several is checkboxes', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FieldAllowedValuesCheckGroup
          multiSelect
          name='tags'
          value={['a']}
          onChange={vi.fn()}
          items={[
            { display_name: 'A', value: 'a' },
            { display_name: 'B', value: 'b' },
          ]}
        />
      </ReqoreUIProvider>
    );
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>('input')).map((input) => input.type)
    ).toEqual(['checkbox', 'checkbox']);
  });
});
