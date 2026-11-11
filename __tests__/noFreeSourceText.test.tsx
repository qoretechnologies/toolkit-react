// Copyright 2026 Qore Technologies, s.r.o.
/*
 * Nobody is asked to type JSON or YAML (Filip, 10 Nov: "there should NEVER be a free json text. Can you imagine a
 * supply chain Dana filling that?"). A hash or a list with no schema is edited in its structured editor - keys and
 * typed values, nested where the value is - and Reqraft offers no "Text" tab to write it as source. The one exception
 * is a host editing a source it also has a guided editor of the same thing for (the IDE's DB and API schema
 * builders), which turns the text route on itself (`textEditing`); Reqraft never does.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { ReqraftObjectFormField } from '../src/components/form/fields/object/Object';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/** What a person could type source into, or switch to typing it: a text box, or a tab named Text. */
const sourceRoutes = (container: HTMLElement) => ({
  textBoxes: container.querySelectorAll('textarea').length,
  // a tab's name is drawn more than once (a marquee for a long one): its first copy is its name
  textTabs: Array.from(container.querySelectorAll<HTMLElement>('.reqore-tabs-list-item')).filter(
    (tab) => tab.querySelector('[data-reqore-marquee="text"]')?.textContent?.trim() === 'Text'
  ).length,
});

const drawn = (element: JSX.Element) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>{element}</FetchContext.Provider>
    </ReqoreUIProvider>
  ).container;

describe('a value with no schema', () => {
  it.each([
    ['a hash', 'hash', { region: 'eu', retries: 3 }],
    ['a list', 'list', ['alpha', 'beta']],
  ])('%s is edited in its structured editor, with no source text', (_, type, value) => {
    const container = drawn(
      <AutoFormField name='field' type={type as never} value={value} onChange={vi.fn()} />
    );
    expect(container.querySelector('.reqore-tree')).toBeTruthy();
    expect(sourceRoutes(container)).toEqual({ textBoxes: 0, textTabs: 0 });
  });
});

describe('the object editor', () => {
  const yaml = 'region: eu\n';

  it('offers no source text unless its host asks for it', () => {
    const container = drawn(
      <ReqraftObjectFormField type='object' dataType='yaml' value={yaml} onChange={vi.fn()} />
    );
    expect(sourceRoutes(container)).toEqual({ textBoxes: 0, textTabs: 0 });
  });

  it('offers it as a second tab to a host that asks for it (a schema builder with a guided editor too)', () => {
    const container = drawn(
      <ReqraftObjectFormField type='object' dataType='yaml' value={yaml} onChange={vi.fn()} textEditing />
    );
    expect(sourceRoutes(container).textTabs).toBe(1);
  });
});

describe('reqraft itself', () => {
  /** Every source file under `src`, stories and fixtures included. */
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
    });

  it('never turns the source text route on, and draws its text box nowhere else', () => {
    const offenders = sources(join(__dirname, '../src')).filter((file) => {
      // the object editor, and its own stories, which show the route a host may turn on
      if (/object[\\/]Object(\.stories)?\.tsx$/.test(file)) return false;
      const text = readFileSync(file, 'utf8');
      return /\btextEditing\b/.test(text) || /ReqraftObjectFormFieldTextarea/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
