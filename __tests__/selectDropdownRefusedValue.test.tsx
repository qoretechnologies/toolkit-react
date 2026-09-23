import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The list is read where it is HANDED OVER, not out of an open popover: reqore
   positions its dropdown through a portal that jsdom never opens, so a test
   that clicked to open it would assert nothing at all. What matters here is
   the descriptor that crosses the boundary. */
let seen: any;
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => {
      seen = props;
      return <div data-testid='dropdown' />;
    },
  };
});

const { SelectFormField } = await import('../src/components/form/fields/select/Select');

/**
 * A value the dropdown will not take, and the reason it used to swallow.
 *
 * This branch built its items from five keys and `messages` was not one of
 * them, so a value refused WITH an explanation arrived here as a row that
 * simply would not respond. It also passed the item's `disabled` straight to
 * reqore, which applies `DisabledElement` — `pointer-events: none` — and would
 * have taken the tooltip with it even once there was something to put in one.
 */
const itemsFor = async (items: unknown[]) => {
  render(
    <ReqoreUIProvider>
      <SelectFormField forceDropdown items={items as never} onChange={vi.fn()} />
    </ReqoreUIProvider>
  );
  await waitFor(() => expect(seen?.items).toBeTruthy());
  return seen.items as any[];
};

describe('the dropdown the picker falls back to', () => {
  it('hands reqore a refused item that says why, keeps the pointer and takes no click', async () => {
    const items = await itemsFor([
      {
        value: 'file',
        display_name: 'Local Filesystem',
        short_desc: 'Stores objects under /var/opt/qorus.',
        disabled: true,
        messages: [{ intent: 'danger', content: 'This sandbox denies the FILESYSTEM domain.' }],
      },
      { value: 'db', display_name: 'Database', short_desc: 'Stores objects in the system schema.' },
    ]);

    const refused = items.find((item) => item.label === 'Local Filesystem');
    expect(refused.description).toContain('This sandbox denies the FILESYSTEM domain.');
    // The reason LEADS: a reader who has just been refused a choice is looking
    // for why, not for what the value would have done.
    expect(refused.description.indexOf('sandbox')).toBeLessThan(
      refused.description.indexOf('/var/opt/qorus')
    );
    expect(refused.tooltip).toBe('This sandbox denies the FILESYSTEM domain.');
    expect(refused.onClick).toBeUndefined();
    expect(refused.disabled).toBeUndefined();
    expect(refused.effect).toEqual({ opacity: 0.55 });
    expect(refused.icon).toBe('LockLine');

    const offered = items.find((item) => item.label === 'Database');
    expect(offered.onClick).toBeTypeOf('function');
    expect(offered.effect).toBeUndefined();
    expect(offered.description).toBe('Stores objects in the system schema.');
  });
});
