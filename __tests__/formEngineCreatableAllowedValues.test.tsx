import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** A test assertion's Path: the candidates are known one level deep, and
 * anything below a field whose declared type is open is not — so the field
 * offers a list AND takes a value nobody offered. */
const pathOption = (extra: Record<string, unknown> = {}) => ({
  path: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Path',
    // Required so the read-first row starts open — the editor is what these
    // assertions are about, not the collapsed summary.
    required: true,
    supports_templates: false,
    supports_expressions: false,
    disallow_template: true,
    allowed_values_creatable: true,
    allowed_values: [
      {
        display_name: 'status from create',
        short_desc: '$.create.status (int)',
        value: { type: 'string', value: '$.create.status' },
      },
      {
        display_name: 'body from create',
        short_desc: '$.create.body (auto)',
        value: { type: 'string', value: '$.create.body' },
      },
    ],
    ...extra,
  },
});

const renderForm = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='assertion'
          initialExpandedOptions={['path']}
          {...(props as any)}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('FormEngine creatable allowed-value fields', () => {
  it('shows the chosen value as a chip under its own label, not as raw text', async () => {
    const { container } = renderForm({
      value: { path: { type: 'string', value: '$.create.status' } },
      options: pathOption(),
    });

    // The chip reads as the human label the producer gave the path, not as the
    // `$.`-grammar spelling the author never needed to learn
    const chip = await screen.findByText('status from create');
    expect(chip.closest('.reqore-tag')).toBeTruthy();

    // …and the chip belongs to the creatable picker, not to a read-only summary
    expect(screen.getByPlaceholderText(/type to search or enter a value/i)).toBeTruthy();

    // …and no text box holds the raw path beside it
    const textInputs = Array.from(container.querySelectorAll('input, textarea')).filter(
      (element) => (element as HTMLInputElement).value === '$.create.status'
    );
    expect(textInputs.length).toBe(0);
  });

  it('shows a value no candidate offers as a chip too', async () => {
    // The ordinary state of a creatable field once a deep path has been
    // entered by hand: `body` is `auto`, so nothing below it is enumerable
    renderForm({
      value: { path: { type: 'string', value: '$.create.body.items[0].sku' } },
      options: pathOption(),
    });

    const chip = await screen.findByText('$.create.body.items[0].sku');
    expect(chip.closest('.reqore-tag')).toBeTruthy();
  });

  it('emits a value the author creates outside the candidate list', async () => {
    const onChange = vi.fn();

    renderForm({ value: {}, options: pathOption(), onChange });

    const input = await screen.findByPlaceholderText(/type to search or enter a value/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '$.create.body.items[0].sku' } });

    const createEntry = (
      await screen.findAllByText('Create new "$.create.body.items[0].sku"')
    ).at(-1)!;
    fireEvent.click(createEntry);

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    expect(onChange.mock.calls.at(-1)?.[1]?.path?.value).toBe('$.create.body.items[0].sku');
  });

  it('emits an offered value with the shape the schema gave it', async () => {
    const onChange = vi.fn();

    renderForm({ value: {}, options: pathOption(), onChange });

    const input = await screen.findByPlaceholderText(/type to search or enter a value/i);
    fireEvent.focus(input);

    const candidate = (await screen.findAllByText('status from create')).at(-1)!;
    fireEvent.click(candidate);

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    expect(onChange.mock.calls.at(-1)?.[1]?.path?.value).toBe('$.create.status');
  });

  it('leaves a creatable field whose value is not a string on its raw editor', async () => {
    // A number cannot come back out of the chip control as a number, and a
    // document does not fit in a chip at all — those keep the editor they had,
    // with the saved-and-suggested picker beside it
    renderForm({
      value: { retries: { type: 'int', value: 3 } },
      options: {
        retries: {
          type: 'int',
          ui_type: 'int',
          display_name: 'Retries',
          required: true,
          supports_templates: false,
          supports_expressions: false,
          disallow_template: true,
          allowed_values_creatable: true,
          allowed_values: [
            { display_name: 'Once', value: { type: 'int', value: 1 } },
            { display_name: 'Three times', value: { type: 'int', value: 3 } },
          ],
        },
      },
      initialExpandedOptions: ['retries'],
      name: 'retry',
    });

    expect((await screen.findAllByText('Saved & Suggested Values')).length).toBeGreaterThan(0);
    // …and no chip picker took the value over
    expect(screen.queryByPlaceholderText(/type to search or enter a value/i)).toBe(null);
  });
});
