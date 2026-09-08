import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** The form's shared vocabulary, offered to every template-capable field. */
const SHARED_TEMPLATES = {
  items: [{ label: 'Config items', items: [{ value: '$config:retries', label: 'retries' }] }],
};

/** One field's own list — values that only this field's question is about. */
const FIELD_TEMPLATES = {
  items: [{ label: 'Values this case captures', items: [{ value: '$.order.id', label: 'order id' }] }],
};

const renderForm = (options: Record<string, unknown>, props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          // The COMPACT (read-first) form is where the hand-off under test
          // lives; the classic form rest-spreads the field descriptor, so a
          // schema's own templates reach the picker there either way.
          compact
          // opens the required row, so its editor is on screen without a click
          expandFirstRequired
          name='per-field-templates'
          allowTemplates
          stringTemplates={SHARED_TEMPLATES as never}
          value={{}}
          options={options as never}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );


describe('a field may declare templates of its own', () => {
  it('does not ask an untyped field for a data type when it carries its own templates', async () => {
    // The regression. `TemplateField` opens an any-like field on the TEMPLATE
    // selector when there is something to pick, and falls back to the type
    // picker only when there is not — deliberately, because an empty picker is a
    // worse place to start. Handing every field the engine-wide list
    // unconditionally overwrote the schema's own, so a field that declared
    // references arrived with none and asked for `string`/`int`/`hash` before it
    // would let the author name a value they had already captured.
    // The engine-wide list is EMPTY on purpose: it is the only way to tell
    // whether the field's OWN list reached the picker. With a shared list to
    // fall back on the field renders identically either way, which is what made
    // an earlier version of this test pass against the unfixed code.
    const { container, findByText, queryByText } = renderForm(
      {
        actual: {
          type: 'auto',
          ui_type: 'auto',
          display_name: 'Actual',
          required: true,
          supports_templates: true,
          templates: FIELD_TEMPLATES,
        },
      },
      { stringTemplates: undefined }
    );

    // Wait on the field's own label so the assertion below is about a rendered
    // form and not an empty one.
    expect(await findByText('Actual')).toBeTruthy();
    // The discriminator is which QUESTION the row asks. With the field's own
    // list reaching the picker it offers the references ("Select Template");
    // without it the row renders the type picker instead - an `any` pill over
    // the nine types - which is the reported symptom.
    expect(container.textContent).toContain('Select Template');
    expect(queryByText('Please select data type')).toBeNull();
  });

  it('still asks for a type when the field has no templates of its own and the shared list is empty', async () => {
    // The other half, so the fix cannot be mistaken for "never ask for a type".
    // With nothing to pick the type picker IS the right question.
    const { container, findByText } = renderForm(
      {
        actual: {
          type: 'auto',
          ui_type: 'auto',
          display_name: 'Actual',
          required: true,
          supports_templates: true,
        },
      },
      { stringTemplates: undefined }
    );

    expect(await findByText('Actual')).toBeTruthy();
    // Nothing to pick, so the type picker IS the right question and the row must
    // still ask it. This is what stops the fix from being read as "never ask".
    expect(container.textContent).not.toContain('Select Template');
  });

  it('reads a value from the field\'s own list as its display name, not the raw reference', async () => {
    // The read-first row decided "is this a template?" with `isValueTemplate`, a
    // guess at the shape of the built-in `$name:key` grammar. A host's own
    // grammar fails it, so a chosen reference printed as a raw path on the
    // collapsed row while the editor showed a chip - the same value reading two
    // different ways depending on whether the row was open.
    const { findByText, queryByText } = renderForm(
      {
        path: {
          type: 'string',
          display_name: 'Path',
          supports_templates: true,
          templates: FIELD_TEMPLATES,
        },
      },
      { value: { path: { type: 'string', value: '$.order.id' } }, stringTemplates: undefined }
    );

    // the label the reference was CHOSEN by, not the path it resolves to
    expect(await findByText('order id')).toBeTruthy();
    // the raw path stays available as the chip's tooltip, not as the line itself
    expect(queryByText('$.order.id')).toBeNull();
  });
});
