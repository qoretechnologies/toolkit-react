// Copyright 2026 Qore Technologies, s.r.o.
// A date is written in the application's language, not a browser's second one.
//
// Reqore's DatePicker, given no locale, takes the first NON-English entry of
// `navigator.languages`. A browser set to English with French as its second
// language therefore showed "jj / mm / aaaa" in an English application.
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const datePicker = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock('@qoretechnologies/reqore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@qoretechnologies/reqore')>()),
  DatePicker: (props: Record<string, unknown>) => {
    datePicker.props = props;
    return null;
  },
  useReqoreTheme: () => ({}),
}));

import { DateFormField } from '../src/components/form/fields/date/Date';

const setBrowserLanguages = (languages: string[]) => {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0]);
};

let pageLang: string;

beforeEach(() => {
  datePicker.props = undefined;
  pageLang = document.documentElement.lang;
});

afterEach(() => {
  document.documentElement.lang = pageLang;
  vi.restoreAllMocks();
});

describe('DateFormField locale', () => {
  it("writes dates in the page's language, not the browser's first non-English one", () => {
    document.documentElement.lang = 'en';
    setBrowserLanguages(['en-US', 'fr-FR']);

    render(<DateFormField value='2026-09-15' onChange={vi.fn()} />);

    expect(datePicker.props?.locale).toBe('en');
  });

  it('follows a page in another language', () => {
    document.documentElement.lang = 'cs';
    setBrowserLanguages(['en-US']);

    render(<DateFormField value='2026-09-15' onChange={vi.fn()} />);

    expect(datePicker.props?.locale).toBe('cs');
  });

  it("uses the browser's preferred language when the page declares none", () => {
    document.documentElement.lang = '';
    setBrowserLanguages(['de-DE', 'fr-FR']);

    render(<DateFormField value='2026-09-15' onChange={vi.fn()} />);

    expect(datePicker.props?.locale).toBe('de-DE');
  });

  it('keeps a locale the caller chose', () => {
    document.documentElement.lang = 'en';

    render(<DateFormField value='2026-09-15' onChange={vi.fn()} locale='ja-JP' />);

    expect(datePicker.props?.locale).toBe('ja-JP');
  });
});
