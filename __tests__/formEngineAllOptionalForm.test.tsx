import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import {
  LABEL_AFFORDANCE_WIDTH,
  LABEL_COL_MAX,
  LABEL_COL_VAR,
} from '../src/components/form/engine/compactRowStyles';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * Two ways a compact form can render as something that looks broken, both
 * reported on an auth profile's Authorization block.
 */

/** Every field optional and unset — the whole form lives in the Optional box. */
const ALL_OPTIONAL = {
  permissions: { type: 'list', display_name: 'Require All Of These Permissions', desc: 'All of them.' },
  any_permissions: { type: 'list', display_name: 'Require Any One Of These Permissions' },
  allow_anonymous: { type: 'bool', display_name: 'Allow Anonymous Callers' },
} as never;

const renderForm = (options: never, value: never = {} as never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='auth' value={value} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const optionalBox = (container: HTMLElement) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith('Optional')
  );

describe('a form whose fields are ALL optional shows them', () => {
  it('opens the Optional box when it is the whole form', async () => {
    // Collapsed, the card has no visible content at all — the reported symptom
    // was a titled Authorization card containing one "Optional 9" strip and
    // nothing else, which reads as a form that failed to load.
    const { container } = renderForm(ALL_OPTIONAL);

    await waitFor(() => expect(optionalBox(container)).toBeTruthy());
    // ReqorePanel unmounts collapsed content, so a rendered row IS the assertion
    // that the box is open.
    await waitFor(() => expect(container.querySelector('[data-field="permissions"]')).toBeTruthy());
    expect(container.querySelector('[data-field="allow_anonymous"]')).toBeTruthy();
  });

  it('keeps the Optional box collapsed when there is something else to open on', async () => {
    // The other half: the box exists to keep a form focused on what is in use, so
    // it must still start collapsed whenever a field needs attention or is set.
    const { container } = renderForm(
      {
        ...(ALL_OPTIONAL as object),
        name: { type: 'string', display_name: 'Internal Name', required: true },
      } as never,
      { name: { type: 'string', value: 'orders' } } as never
    );

    await waitFor(() => expect(container.querySelector('[data-field="name"]')).toBeTruthy());
    expect(optionalBox(container)).toBeTruthy();
    expect(container.querySelector('[data-field="permissions"]')).toBeNull();
  });
});

describe('the label column reserves room for the trailing chrome', () => {
  /**
   * jsdom performs no layout, so the off-DOM measurer's `offsetWidth` is always 0
   * and the real measurement cannot run. Standing in a width proportional to the
   * text length lets the arithmetic under test — clamp the NAME, then add the
   * chrome — be asserted for what it is; the pixels themselves are the browser's
   * business and are covered by the story.
   */
  const withMeasuredLabels = async (displayName: string): Promise<number> => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return (this.textContent || '').length * 8;
      },
    });
    try {
      const { container } = renderForm({
        option: { type: 'string', display_name: displayName, desc: 'Has a long description.' },
      } as never);
      let wrap: HTMLElement | null = null;
      await waitFor(() => {
        wrap = container.querySelector('.options-readfirst-scroll');
        expect(wrap).toBeTruthy();
        expect(wrap!.style.getPropertyValue(LABEL_COL_VAR)).toBeTruthy();
      });
      return Number.parseInt(wrap!.style.getPropertyValue(LABEL_COL_VAR), 10);
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original);
      }
    }
  };

  it('adds the affordance on top of the clamp, not out of it', async () => {
    // The reported case: a name long enough to reach the ceiling used to consume
    // the allowance, leaving the `?` to wrap onto a line of its own beneath it.
    // 40 chars x 8px = 320px of text, well past MAX.
    const column = await withMeasuredLabels('Require Any One Of These RBAC Groupings!');

    expect(column).toBe(LABEL_COL_MAX + LABEL_AFFORDANCE_WIDTH);
  });

  it('still reserves it for a name that never reaches the ceiling', async () => {
    // 20 chars x 8px = 160px, inside [MIN, MAX] — the chrome is added there too,
    // which is what keeps a short label and its `?` on one line.
    const column = await withMeasuredLabels('Allow Anonymous Call');

    expect(column).toBe(160 + LABEL_AFFORDANCE_WIDTH);
  });
});
