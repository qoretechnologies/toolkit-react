/**
 * A field the person never touched whose value is its default reads as a default under the form ("Uses Qore ·
 * Change"), not as a "Set" row. A field they changed or opened, or one whose
 * value is not its default, is an ordinary row. Story: `Form/Engine/Defaults`.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const schema = {
  name: { type: 'string', display_name: 'Name', required: true },
  lang: {
    type: 'string',
    display_name: 'Language',
    required: true,
    default_value: 'qore',
    allowed_values: [
      { value: 'qore', display_name: 'Qore' },
      { value: 'python', display_name: 'Python' },
    ],
  },
  timeout: { type: 'int', display_name: 'Timeout', default_value: 30 },
} as unknown as IOptionsSchema;

const renderForm = (value: Record<string, unknown>, readOnly = false) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='workflow' options={schema} value={value as never} readOnly={readOnly} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const note = (name: string) =>
  document.querySelector<HTMLElement>(`.form-default-note[data-field-default="${name}"]`);

test('a default nobody set is said under the form, not drawn as a row', async () => {
  renderForm({ timeout: { type: 'int', value: 30 } });

  await waitFor(() => expect(note('lang')?.textContent).toContain('Uses Qore'));
  expect(note('timeout')?.textContent).toContain('Uses 30 for Timeout');
  expect(document.querySelector('.readfirst-row[data-field="lang"]')).toBeNull();
  // the defaults are said in the schema's order
  const order = [...document.querySelectorAll('.form-default-note')].map((el) =>
    el.getAttribute('data-field-default')
  );
  expect(order).toEqual(['lang', 'timeout']);
});

test('a value that is not its default is an ordinary row', async () => {
  renderForm({ lang: { type: 'string', value: 'python' } });

  await waitFor(() => expect(document.querySelector('[data-field="lang"]')).toBeTruthy());
  expect(note('lang')).toBeNull();
});

test('"Change" opens the field as a row', async () => {
  renderForm({});

  await waitFor(() => expect(note('lang')).toBeTruthy());
  fireEvent.click(note('lang')!.querySelector('.form-default-change')!);

  await waitFor(() => expect(document.querySelector('[data-field="lang"]')).toBeTruthy());
  expect(note('lang')).toBeNull();
});

test('a form that is only read says the default, with nothing to change it by', async () => {
  renderForm({ lang: { type: 'string', value: 'qore' } }, true);

  await waitFor(() => expect(note('lang')?.textContent).toContain('Uses Qore'));
  expect(note('lang')!.querySelector('.form-default-change')).toBeNull();
});
