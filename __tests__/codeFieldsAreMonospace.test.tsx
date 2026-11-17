// Copyright 2026 Qore Technologies, s.r.o.
// A text box holding code or data asks for monospace; one holding prose does not.
//
// Reqore 0.79 draws a textarea in the page's font, as prose, and leaves monospace to the
// fields that ask for it (Filip, 17 Nov: per use, not everywhere). Reqraft's own code
// boxes were left in the page's font by that: the admin portal saw a YAML field in
// proportional type (board f47). They now ask for Reqore's mono face: the YAML / JSON editor
// of a hash or a list, a binary or `data` value, and a template's example value. Reqore's
// mono stack is asserted, not "a monospace": under Reqore 0.78 a textarea still took the
// browser's generic `monospace`, which a check for "mono" would pass without the fix.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { MONO_FONT } from '@qoretechnologies/reqore/dist/constants/fonts';
import { render } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { ReqraftBinaryFormField } from '../src/components/form/fields/binary/Binary';
import { ReqraftObjectFormFieldTextarea } from '../src/components/form/fields/object/Object';
import { ReqraftTemplateExampleValueModal } from '../src/components/form/fields/template/ExampleValueModal';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/** The computed stack comes back with double quotes. */
const MONO = MONO_FONT.replace(/'/g, '"');

const mount = (node: ReactNode) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>{node}</FetchContext.Provider>
    </ReqoreUIProvider>
  );

const fontOfTheTextarea = () => {
  const textarea = document.querySelector('textarea');

  expect(textarea).not.toBeNull();
  return getComputedStyle(textarea as HTMLTextAreaElement).fontFamily;
};

describe('a text box holding code or data', () => {
  it('is monospace in the YAML editor of a hash or a list', () => {
    mount(
      <ReqraftObjectFormFieldTextarea
        value={'region: eu\nretries: 3\n'}
        onChange={vi.fn()}
        dataType='yaml'
        resultDataType='yaml'
      />
    );

    expect(fontOfTheTextarea()).toBe(MONO);
  });

  it('is monospace in the JSON editor', () => {
    mount(
      <ReqraftObjectFormFieldTextarea
        value={'{ "region": "eu" }'}
        onChange={vi.fn()}
        dataType='json'
        resultDataType='json'
      />
    );

    expect(fontOfTheTextarea()).toBe(MONO);
  });

  it('is monospace in a binary field', () => {
    mount(<ReqraftBinaryFormField value='aGVsbG8=' onChange={vi.fn()} />);

    expect(fontOfTheTextarea()).toBe(MONO);
  });

  it.each(['data', 'binary'])('is monospace in an auto field of type %s', (type) => {
    mount(<AutoFormField name='field' defaultType={type as never} value='aGVsbG8=' onChange={vi.fn()} />);

    expect(fontOfTheTextarea()).toBe(MONO);
  });

  it("is monospace in a template's example value", () => {
    mount(
      <ReqraftTemplateExampleValueModal
        isOpen
        label='Order'
        value={'{\n  "order": 48213\n}'}
      />
    );

    expect(fontOfTheTextarea()).toBe(MONO);
  });

  it('keeps a face the consumer asked for', () => {
    mount(
      <ReqraftBinaryFormField value='aGVsbG8=' onChange={vi.fn()} effect={{ fontFamily: 'serif' }} />
    );

    expect(fontOfTheTextarea()).toBe('serif');
  });
});

describe('a text box holding prose', () => {
  it('does not ask for monospace: a long string is in the page font', () => {
    mount(
      <AutoFormField
        name='notes'
        defaultType='long-string'
        value='Resend the label'
        onChange={vi.fn()}
      />
    );

    expect(fontOfTheTextarea()).not.toBe(MONO);
  });
});
