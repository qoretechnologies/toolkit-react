import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { buildTheme } from '@qoretechnologies/reqore/dist/helpers/colors';
import { ANCHORED_LIST_MAIN } from '../src/components/form/fields/select/Select';
import { getUnavailableLabelOpacity } from '../src/components/form/fields/select/unavailableRow';
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import {
  FormAppearanceProvider,
  type TFormEngineAppearance,
} from '../src/components/form/engine/formAppearance';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* A refused value's name is dimmed, as far as it still reads on the list, drawn in its own color (0.55
   was 4.1:1). Only the name: the reason under it stays as reqore draws a row's description (dimming the whole row
   took it to 3.1:1).
   In the calm look the list is drawn on the app's own surface; the classic look draws it navy (ANCHORED_LIST_MAIN). */
const DIMMED = getUnavailableLabelOpacity(buildTheme(DEFAULT_THEME as never), undefined, undefined);
const DIMMED_CLASSIC = getUnavailableLabelOpacity(
  buildTheme(DEFAULT_THEME as never),
  undefined,
  ANCHORED_LIST_MAIN
);

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
const itemsFor = async (items: unknown[], appearance?: TFormEngineAppearance) => {
  seen = undefined;
  const field = <SelectFormField forceDropdown items={items as never} onChange={vi.fn()} />;
  render(
    <ReqoreUIProvider>
      {appearance ? <FormAppearanceProvider value={appearance}>{field}</FormAppearanceProvider> : field}
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
    expect(refused.labelEffect).toEqual({ opacity: DIMMED });
    /* no `effect`: reqore 0.77.2 fills a row that has one (a refused row with an intent turned solid, its reason
       unreadable on it), where the rows beside it are drawn on the list */
    expect(refused.effect).toBeUndefined();
    expect(refused.icon).toBe('LockLine');

    const offered = items.find((item) => item.label === 'Database');
    expect(offered.onClick).toBeTypeOf('function');
    expect(offered.effect).toBeUndefined();
    expect(offered.description).toBe('Stores objects in the system schema.');
  });

  it('dims a refused name for the surface its list is drawn on: the app\'s in calm, the navy in classic', async () => {
    const refusedItem = {
      value: 'file',
      display_name: 'Local Filesystem',
      disabled: true,
      messages: [{ intent: 'danger', content: 'This sandbox denies the FILESYSTEM domain.' }],
    };
    expect(DIMMED).not.toBe(DIMMED_CLASSIC);

    const calm = await itemsFor([refusedItem]);
    expect(seen.listCustomTheme).toBeUndefined();
    expect(calm.find((item) => item.label === 'Local Filesystem').labelEffect).toEqual({ opacity: DIMMED });

    const classic = await itemsFor([refusedItem], 'classic');
    expect(seen.listCustomTheme).toEqual({ main: ANCHORED_LIST_MAIN });
    expect(classic.find((item) => item.label === 'Local Filesystem').labelEffect).toEqual({
      opacity: DIMMED_CLASSIC,
    });
  });
});
