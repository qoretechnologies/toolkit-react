/**
 * An allowed-values check group draws its choices with no React key warning (qorus#646).
 *
 * Each choice was keyed by `item.value?.toString()`: a choice whose value is not resolved yet has no key, and
 * object values all key as "[object Object]". React warned for every such group (qorus-ide's Qog processor
 * stories, whose Hubspot choices had not resolved), and choices that share a key can be swapped on a re-render.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldAllowedValuesCheckGroup } from '../src/components/form/fields/allowed-values/AllowedValues';

const keyWarnings = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .map((args) => args.map(String).join(' '))
    .filter((text) => /unique "key" prop|same key/.test(text));

afterEach(() => vi.restoreAllMocks());

describe('an allowed-values check group', () => {
  it.each([
    [
      'choices whose values are not resolved',
      [{ display_name: 'Contacts' }, { display_name: 'Deals' }],
    ],
    [
      'object values',
      [
        { display_name: 'First', value: { id: 1 } },
        { display_name: 'Second', value: { id: 2 } },
      ],
    ],
  ])('draws %s with no key warning', (_name, items) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ReqoreUIProvider>
        <FieldAllowedValuesCheckGroup name='choice' items={items as never} onChange={vi.fn()} />
      </ReqoreUIProvider>
    );
    expect(screen.getAllByText(items[0].display_name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(items[1].display_name).length).toBeGreaterThan(0);
    expect(keyWarnings(errors)).toEqual([]);
  });
});
