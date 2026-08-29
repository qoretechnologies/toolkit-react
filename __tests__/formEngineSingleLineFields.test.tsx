import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const queryMock = vi.fn(async () => ({ ok: true, data: [] }));
vi.mock('../src/utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/fetch')>()),
  query: () => queryMock(),
}));

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
} as never;

/**
 * A single-line field must still be single-line once FormEngine has built it.
 *
 * `longStringSingleLine.test.tsx` proves the field enforces the rule when it is
 * told the type. This proves it is TOLD — which is the half that was missing,
 * and the reason the reported bug survived a fix.
 *
 * The rule and the field were both correct in qorus-ide. What no test covered
 * was the wiring: `TemplateField`'s wrapper destructured `type` away before
 * calling the field, deliberately, "to keep it off the underlying ReQore
 * component". So every string field in every FormEngine form was a growing
 * textarea, and an alert rule's Internal Name — declared `ui_type: "string"`,
 * a value that becomes a YAML key — accepted Enter.
 *
 * Removing the forwarding again passes every other suite in this repo. It fails
 * here.
 */

/** The metadata group an interface editor puts at the top of every object. */
const METADATA_OPTIONS = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Internal Name',
    short_desc: 'The internal technical name of the object',
  },
  short_desc: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Short Description',
    short_desc: 'The short plain-text description of the object',
  },
  desc: {
    type: 'string',
    ui_type: 'long-string',
    display_name: 'Description',
    short_desc: 'The long description',
  },
} as never;

const renderForm = (value?: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='meta' value={value} options={METADATA_OPTIONS} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The editable control inside one field's row. */
const fieldControl = (container: HTMLElement, field: string): HTMLElement | null =>
  container.querySelector(`[data-field="${field}"] textarea`) ??
  container.querySelector(`[data-field="${field}"] input`);

/**
 * Opens one field's row and hands back its editable control.
 *
 * A compact form's rows are read-first: the value is shown, and the editor is a
 * click away. That is exactly why the reported bug was easy to miss — a test
 * that stops at the collapsed row never touches the control that takes Enter.
 */
const openField = async (container: HTMLElement, field: string): Promise<HTMLElement> => {
  await waitFor(() => expect(container.querySelector(`[data-field="${field}"]`)).toBeTruthy());
  if (!fieldControl(container, field)) {
    fireEvent.click(container.querySelector(`[data-field="${field}"]`)!);
  }
  await waitFor(() => expect(fieldControl(container, field)).toBeTruthy());
  return fieldControl(container, field)!;
};

describe('FormEngine tells a field whether it holds one line', () => {
  it('refuses Enter in the internal name', async () => {
    const { container } = renderForm({
      name: { type: 'string', value: 'my-object' },
    } as never);

    const control = await openField(container, 'name');

    // fireEvent returns false when a handler called preventDefault
    expect(fireEvent.keyDown(control, { key: 'Enter' })).toBe(false);
  });

  it('refuses Enter in the short description', async () => {
    const { container } = renderForm({
      short_desc: { type: 'string', value: 'a short one' },
    } as never);

    const control = await openField(container, 'short_desc');
    expect(fireEvent.keyDown(control, { key: 'Enter' })).toBe(false);
  });

  it('still accepts Enter in the long description', async () => {
    const { container } = renderForm({
      desc: { type: 'string', value: 'the long one' },
    } as never);

    const control = await openField(container, 'desc');
    expect(fireEvent.keyDown(control, { key: 'Enter' })).toBe(true);
  });

  it('flattens a line break pasted into the internal name', async () => {
    const { container } = renderForm({
      name: { type: 'string', value: '' },
    } as never);

    const control = (await openField(container, 'name')) as HTMLTextAreaElement;

    fireEvent.change(control, { target: { value: 'two\nwords' } });
    await waitFor(() => expect(control.value).toBe('two words'));
  });
});
