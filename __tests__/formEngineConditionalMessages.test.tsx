import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { isConditionalMessageShown } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * A schema message that appears only for certain values of its siblings.
 *
 * The motivating case is an auth profile: requiring permissions AND exempting
 * anonymous callers from them is a combination worth warning about, while each
 * half on its own is ordinary. A static warning cannot say that — it would sit
 * over every valid profile until people stopped reading it.
 */

const WARNING = 'Anonymous callers skip these requirements entirely.';

/** `permissions` warns only while the anonymous exemption is also on. */
const SCHEMA = {
  permissions: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Require All Of These Permissions',
    messages: [
      {
        intent: 'warning',
        content: WARNING,
        when: ['allow_anonymous=true'],
      },
    ],
  },
  allow_anonymous: {
    type: 'bool',
    ui_type: 'bool',
    display_name: 'Exempt Anonymous Callers',
  },
} as never;

const renderForm = (value: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='auth' value={value} options={SCHEMA} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const withExemption = (on: boolean) =>
  ({
    permissions: { type: 'string', value: 'READ-ORDER' },
    allow_anonymous: { type: 'bool', value: on },
  }) as never;


const DANGER = 'This combination rejects every anonymous caller.';

/** Same shape, but at the intent that actually re-buckets a field. */
const DANGER_SCHEMA = {
  permissions: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Require All Of These Permissions',
    messages: [{ intent: 'danger', content: DANGER, when: ['allow_anonymous=true'] }],
  },
  allow_anonymous: { type: 'bool', ui_type: 'bool', display_name: 'Exempt Anonymous Callers' },
} as never;

const renderDangerForm = (on: boolean) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='auth'
          value={withExemption(on)}
          options={DANGER_SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const attentionBox = (container: HTMLElement) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith('Needs attention')
  );

describe('isConditionalMessageShown', () => {
  const values = { flag: { type: 'bool', value: true }, other: { type: 'string', value: 'x' } };

  it('shows a message with no condition at all', () => {
    // Every message that exists today has no condition and must keep working.
    expect(isConditionalMessageShown({ content: 'note' }, values as never)).toBe(true);
  });

  it('honours `when`', () => {
    expect(isConditionalMessageShown({ content: 'n', when: ['flag=true'] }, values as never)).toBe(
      true
    );
    expect(isConditionalMessageShown({ content: 'n', when: ['flag=false'] }, values as never)).toBe(
      false
    );
  });

  it('honours `unless` as the negative of the same grammar', () => {
    expect(isConditionalMessageShown({ content: 'n', unless: ['flag=true'] }, values as never)).toBe(
      false
    );
    expect(
      isConditionalMessageShown({ content: 'n', unless: ['flag=false'] }, values as never)
    ).toBe(true);
  });

  it('requires both when they are used together', () => {
    expect(
      isConditionalMessageShown(
        { content: 'n', when: ['flag=true'], unless: ['other=x'] },
        values as never
      )
    ).toBe(false);
  });
});

describe('a conditional message in a rendered form', () => {
  it('is absent while its condition does not hold', async () => {
    const { container } = renderForm(withExemption(false));

    await waitFor(() => expect(container.querySelector('[data-field="permissions"]')).toBeTruthy());
    expect(container.textContent).not.toContain(WARNING);
  });

  it('appears once it holds', async () => {
    const { container } = renderForm(withExemption(true));

    await waitFor(() => expect(container.textContent).toContain(WARNING));
  });

  it('does not push the field into Needs attention while it is hidden', async () => {
    // The trap this closes: the read-first bucket reads the same `messages` array
    // to decide a row's status, so a filtered-out message would still count — an
    // alert you cannot see but can count. Asserted with `danger`, because that is
    // the intent that actually moves a field into attention (`getOptionStatus`
    // folds only `danger` into `invalid`; a warning colours the row and leaves
    // its bucket alone).
    const { container } = renderDangerForm(false);

    await waitFor(() => expect(container.querySelector('[data-field="permissions"]')).toBeTruthy());
    expect(container.textContent).not.toContain(DANGER);
    expect(attentionBox(container)).toBeFalsy();
  });

  it('does push it there once the message applies', async () => {
    // The other half — the status and the message agree in both directions.
    const { container } = renderDangerForm(true);

    await waitFor(() => expect(container.textContent).toContain(DANGER));
    expect(attentionBox(container)).toBeTruthy();
  });
});
