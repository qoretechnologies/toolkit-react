// Copyright 2026 Qore Technologies, s.r.o.
/**
 * qorus#646 (React's warning, found by the story run's warning gate): a menu given no `defaultQuery` drew its
 * filter with no value, and the first key typed gave it one - React warned "A component is changing an
 * uncontrolled input to be controlled". The filter holds text from the start, empty when there is no query.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReqraftMenu, TReqraftMenu } from '../src/components/menu/Menu';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';

const storage: Record<string, unknown> = {};
const withProviders = (ui: JSX.Element) => (
  <ReqoreUIProvider>
    <ReqraftStorageContext.Provider
      value={{
        getStorage: (path: string, defaultValue?: unknown) =>
          path in storage ? storage[path] : defaultValue,
        updateStorage: (path: string, value: unknown) => {
          storage[path] = value;
        },
        removeStorageValue: (path: string) => {
          delete storage[path];
        },
      }}
    >
      {ui}
    </ReqraftStorageContext.Provider>
  </ReqoreUIProvider>
);

// jsdom has no ResizeObserver; the menu watches its list with one to show its scroll shadow.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

afterEach(() => vi.restoreAllMocks());

const MENU: TReqraftMenu = [
  { label: 'Workflows', icon: 'FlowChart' },
  { label: 'Services', icon: 'ServiceLine' },
];

const filterOf = (container: HTMLElement) =>
  container.querySelector('input[placeholder^="Filter menu"]') as HTMLInputElement;

describe("a menu's filter", () => {
  it('is a controlled input from the start, with no query given', () => {
    const errors = vi.spyOn(console, 'error');
    const { container } = render(withProviders(<ReqraftMenu menu={MENU} />));
    const filter = filterOf(container);
    expect(filter.value).toBe('');
    fireEvent.change(filter, { target: { value: 'serv' } });
    const warnings = errors.mock.calls
      .map((call) => call.map(String).join(' '))
      .filter((text) => /uncontrolled input to be controlled/.test(text));
    expect(warnings).toEqual([]);
    expect(filterOf(container).value).toBe('serv');
    expect(container.textContent).toContain('Services');
    expect(container.textContent).not.toContain('Workflows');
  });

  it('starts with the query it is given', () => {
    const { container } = render(withProviders(<ReqraftMenu menu={MENU} defaultQuery='work' />));
    expect(filterOf(container).value).toBe('work');
  });
});
