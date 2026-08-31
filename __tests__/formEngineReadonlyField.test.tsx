import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * A `readonly` field must not render an editable control.
 *
 * The reported case: a test object's `testid` — the number Qorus assigns when the
 * object is created — declared `readonly: true` and rendered as an editable input,
 * on a CREATE form for an object that has no id yet.
 *
 * The cause is that `readonly` and `disabled` are different properties on
 * different projections. `hashdecl FieldInfo`, which is what
 * `creator-get-fields-as-options` serves, has `readonly` and deliberately has no
 * `disabled` — `disabled` is a UI-Compat concept, and the mapping
 * `if (f.readonly) h.disabled = True` exists only on that older projection. So the
 * form was handed `readonly` alone and honoured only `disabled`. Every interface
 * kind with a system-assigned field was affected, not only tests.
 */
const SCHEMA = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
    short_desc: 'An ordinary editable field',
  },
  testid: {
    type: 'int',
    ui_type: 'int',
    display_name: 'Test ID',
    short_desc: 'Assigned by Qorus when the object is created',
    readonly: true,
  },
} as never;

const renderForm = (compact: boolean) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact={compact}
          name='test'
          value={{ name: { type: 'string', value: 'a' }, testid: { type: 'int', value: 42 } } as never}
          options={SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('a readonly field is not editable', () => {
  it('locks the read-first row rather than opening an editor', async () => {
    const { container } = renderForm(true);

    await waitFor(() => expect(row(container, 'testid')).toBeTruthy());

    // The lock the compact row renders in place of the open control. The
    // editable sibling has none, so this is not asserting that the form is
    // read-only overall.
    const readonlyRow = row(container, 'testid')!;
    const editableRow = row(container, 'name')!;
    expect(readonlyRow.querySelectorAll('input').length).toBe(0);
    expect(readonlyRow.textContent).toContain('42');
    expect(editableRow).toBeTruthy();
  });

  it('leaves an ordinary field editable', async () => {
    const { container } = renderForm(true);

    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    // The counterweight to the assertion above: the lock is a property of the
    // field, not of the form. A form-level readOnly would close both rows and
    // the first test would pass for the wrong reason.
    const editableRow = row(container, 'name')!;
    expect(editableRow.querySelector('.options-readfirst-lock')).toBeNull();
  });
});

// The classic (non-compact) path takes the same fix — `readonly` is folded into
// the `disabled` it passes to the control, beside `disabled` and the dependency
// predicate — but is not asserted here: it renders no row for a field until the
// field is added, so a DOM assertion would be about that model rather than about
// `readonly`. The IDE authors through the compact form above.
