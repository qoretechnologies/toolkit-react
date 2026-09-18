import { describe, expect, it } from 'vitest';
import { buildTemplates } from '../src/helpers/templates';

/**
 * The template picker is navigated by NAME, so it is ordered by name.
 *
 * The server assembles groups and items in its own order — step order for the
 * test vocabulary, the connector's order for an app's actions — and neither is
 * one a reader can predict. With 29 items in the list that is the difference
 * between finding a value and scanning for it.
 */
const payload = {
  zeta: {
    display_name: 'Zeta app',
    items: [
      { display_name: 'delta', value: '$zeta:delta' },
      { display_name: 'alpha', value: '$zeta:alpha' },
      { display_name: 'Charlie', value: '$zeta:charlie' },
    ],
  },
  alpha: {
    display_name: 'Alpha app',
    items: [{ display_name: 'only', value: '$alpha:only' }],
  },
  middle: {
    display_name: 'middle app',
    items: [
      { display_name: 'item10', value: '$middle:item10' },
      { display_name: 'item2', value: '$middle:item2' },
    ],
  },
} as never;

const labels = (items: readonly { label?: unknown }[] = []) => items.map((i) => String(i.label));

describe('buildTemplates ordering', () => {
  it('orders the groups by name', () => {
    const built = buildTemplates(payload)!;
    expect(labels(built.items as never)).toEqual(['Alpha app', 'middle app', 'Zeta app']);
  });

  it('orders each group’s items by name', () => {
    const built = buildTemplates(payload)!;
    const zeta = (built.items as never as { label: string; items: never[] }[]).find(
      (g) => g.label === 'Zeta app'
    )!;
    expect(labels(zeta.items)).toEqual(['alpha', 'Charlie', 'delta']);
  });

  it('is case-insensitive, so casing does not split neighbours', () => {
    const built = buildTemplates(payload)!;
    // 'Alpha app' / 'middle app' / 'Zeta app' — mixed case, still a-m-z
    expect(labels(built.items as never)).toEqual(['Alpha app', 'middle app', 'Zeta app']);
  });

  it('orders numbered items the way a reader counts', () => {
    const built = buildTemplates(payload)!;
    const middle = (built.items as never as { label: string; items: never[] }[]).find(
      (g) => g.label === 'middle app'
    )!;
    // item2 before item10 — a plain string sort puts item10 first
    expect(labels(middle.items)).toEqual(['item2', 'item10']);
  });
});
