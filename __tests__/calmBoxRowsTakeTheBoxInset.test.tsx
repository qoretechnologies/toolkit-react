// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A calm status box's rows reach its edges and no further: its body takes back the inset Reqore says
 * it padded the box's content by (`--reqore-panel-inset-x`, reqore#715) and its rows start on it. A
 * fixed 16px ran them 3px past both sides of a small box padded 13px to clear a 14px corner (admin
 * portal, the OAuth2 client drawer's Set and Optional boxes). A Reqore that does not say keeps 16px.
 * jsdom resolves no custom property, so this pins the CSS the browser story measures
 * (`Form/Engine/FormEngine Appearance → Calm Under A Round Corner`).
 */
const cssText = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('\n')
    // styled-components minifies: no space after a comma
    .replace(/,\s+/g, ',');

describe("a calm status box's rows", () => {
  it('bleed and inset by the inset Reqore says, falling back to 16px', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            appearance='calm'
            name='inset'
            options={{ name: { type: 'string', display_name: 'Name' } } as never}
            value={{ name: { type: 'string', value: 'a' } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.querySelector('.readfirst-row')).toBeTruthy());

    const css = cssText();
    expect(css).toContain('--readfirst-inset:var(--reqore-panel-inset-x,16px)');
    expect(css).toContain('margin-left:calc(-1 * var(--readfirst-inset))');
    expect(css).toContain('margin-right:calc(-1 * var(--readfirst-inset))');
    expect(css).toMatch(/\.readfirst-row\{[^}]*padding:10px var\(--readfirst-inset,16px\)/);
  });
});
