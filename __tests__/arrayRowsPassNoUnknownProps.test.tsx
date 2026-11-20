// Copyright 2026 Qore Technologies, s.r.o.
// A list's rows put nothing on the DOM that is not an attribute.
//
// ArrayAuto gives each row's TemplateField two props for the row's AutoFormField only:
// `onSubFormAttentionChange` (the row reports its own sub-form's attention) and
// `expandFirstRequired` (a row added just now opens what it needs). TemplateField spread its rest
// onto its own text editor and its wrapper too, so for a list of plain strings React warned
// "Unknown event handler property `onSubFormAttentionChange`" - which failed qorus-ide's React
// warning gate on an OAuth2 client's redirect URIs (17 Nov). TemplateField now passes them to the
// caller's field component only.
import { ReqoreContent, ReqoreLayoutContent, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrayAuto } from '../src/components/form/fields/array/ArrayAuto';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const UNKNOWN_PROP = /Unknown event handler property|does not recognize the|non-boolean attribute/;

let errors: string[] = [];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mount = (value: string[]) =>
  render(
    <ReqoreUIProvider>
      <ReqoreLayoutContent>
        <ReqoreContent>
          <FetchContext.Provider value={emptyFetchContext()}>
            <ArrayAuto name='redirect_uris' type='string' value={value} onChange={vi.fn()} />
          </FetchContext.Provider>
        </ReqoreContent>
      </ReqoreLayoutContent>
    </ReqoreUIProvider>
  );

describe('a list of strings', () => {
  it('passes its rows no prop React does not know', async () => {
    mount(['https://app.example.com/callback', 'https://staging.example.com/callback']);
    await act(async () => undefined);

    expect(errors.filter((error) => UNKNOWN_PROP.test(error))).toEqual([]);
  });

  it('passes none to a row added just now either', async () => {
    mount(['https://app.example.com/callback']);
    await act(async () => undefined);

    const add = screen.queryAllByRole('button').find((button) =>
      /add/i.test(button.getAttribute('aria-label') ?? button.textContent ?? '')
    );

    if (add) {
      await act(async () => {
        fireEvent.click(add);
      });
    }

    expect(errors.filter((error) => UNKNOWN_PROP.test(error))).toEqual([]);
  });
});
