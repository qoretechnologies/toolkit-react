// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A value that MENTIONS a reference reads as a name, everywhere it is shown.
 *
 * The defect these cover: a test case's Skip-when predicate,
 * `$._case.mode != 'simulate'`, printed verbatim on the read-first row while
 * the list above it and the editor it opens both drew the reference as the chip
 * the author picked it by. Three renderings of one value, two of them agreeing
 * and the raw one in the middle.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { hasTemplateText, templateTextSegments } from '../src/helpers/templateText';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/** The grammar a Qorus test writes its references in — `$.step.field`, which
 *  carries no `$key:` and so matches none of reqraft's own token grammar. */
const HOST_GRAMMAR = /(\$\.[A-Za-z_][\w]*(?:(?:\.[A-Za-z_][\w]*)|(?:\[\d+\]))*)/g;

/** A case's own vocabulary, as `withPathSuggestions` hands it down. */
const CASE_TEMPLATES = {
  items: [
    {
      label: 'This case',
      items: [
        {
          value: '$._case.mode',
          label: 'mode (this case)',
          description: 'How this case runs — live, or simulated.',
        },
        { value: '$.result', label: 'everything from “call the service”' },
        { value: '$.result.status', label: 'status from “call the service”' },
      ],
    },
  ],
} as never;

describe('a string that mentions a reference is drawn as prose plus chips', () => {
  it('splits a predicate into the reference and the comparison the author wrote', () => {
    const segments = templateTextSegments(
      "$._case.mode != 'simulate'",
      CASE_TEMPLATES,
      HOST_GRAMMAR
    );

    expect(segments).toEqual([
      { kind: 'tag', value: '$._case.mode', text: 'mode (this case)' },
      { kind: 'text', text: " != 'simulate'" },
    ]);
  });

  it("names a reference from the field's own list even with no grammar declared", () => {
    // The catalogue is the fallback for a host that hands down names but never
    // says what its spelling looks like: asking the list whether it CONTAINS the
    // string settles it without reqraft guessing at anybody's syntax.
    const segments = templateTextSegments("$._case.mode != 'simulate'", CASE_TEMPLATES);

    expect(segments.filter((segment) => segment.kind === 'tag')).toEqual([
      { kind: 'tag', value: '$._case.mode', text: 'mode (this case)' },
    ]);
  });

  it('never carves a shorter catalogue name out of a longer reference', () => {
    // `$.result` is a PREFIX of `$.result.status`, and both are in the list.
    // Chipping the prefix would say the value names the whole hash when it names
    // one field of it.
    const segments = templateTextSegments('expected $.result.status here', CASE_TEMPLATES);

    expect(segments).toEqual([
      { kind: 'text', text: 'expected ' },
      { kind: 'tag', value: '$.result.status', text: 'status from “call the service”' },
      { kind: 'text', text: ' here' },
    ]);
  });

  it('leaves a path the catalogue does not name alone when no grammar is declared', () => {
    // Nothing names `$.result.missing` and no grammar says how far a reference
    // extends, so there is no honest chip to draw — and `$.result`, which the
    // catalogue does name, is only its prefix.
    expect(hasTemplateText('$.result.missing', CASE_TEMPLATES)).toBe(false);
  });

  it("chips a path the catalogue does not name once the field's grammar says where it ends", () => {
    // The grammar is what decides the EXTENT: without it there is no chip at
    // all (above), with it the whole path is one reference.
    //
    // The NAME then comes from the nearest entry that does explain part of it —
    // `$.result` — with the author's own walk spelled out after it, the same way
    // a braced `$data:{…choices[0].message.content}` is named. That keeps a path
    // written against a renamed capture visible rather than dressed up: the
    // reader sees which value it starts from and exactly which step does not
    // belong to it.
    const segments = templateTextSegments('$.result.missing', CASE_TEMPLATES, HOST_GRAMMAR);

    expect(segments).toEqual([
      {
        kind: 'tag',
        value: '$.result.missing',
        text: 'everything from \u201ccall the service\u201d \u203a missing',
      },
    ]);
  });

  it("draws reqraft's own grammar embedded in prose without any catalogue at all", () => {
    const segments = templateTextSegments('Dear $local:name, welcome');

    expect(segments).toEqual([
      { kind: 'text', text: 'Dear ' },
      { kind: 'tag', value: '$local:name', text: 'local: name' },
      { kind: 'text', text: ', welcome' },
    ]);
  });

  it('keeps every line of a multi-line value and the references on each', () => {
    const segments = templateTextSegments('a $local:one\nb $local:two', undefined);

    expect(segments.map((segment) => segment.text)).toEqual([
      'a ',
      'local: one',
      '\nb ',
      'local: two',
    ]);
  });

  it('says a value holds no reference when it holds none', () => {
    expect(hasTemplateText('order-service', CASE_TEMPLATES, HOST_GRAMMAR)).toBe(false);
    expect(hasTemplateText('', CASE_TEMPLATES, HOST_GRAMMAR)).toBe(false);
    expect(templateTextSegments('plain text')).toEqual([{ kind: 'text', text: 'plain text' }]);
  });

  it('does not mistake money or a shell variable for a reference', () => {
    expect(hasTemplateText('total is $5.00')).toBe(false);
    expect(hasTemplateText('$HOME/bin')).toBe(false);
  });
});

const renderRow = (options: Record<string, unknown>, value: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='skip-when'
          value={value as never}
          options={options as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('the read-first row draws the references inside a value', () => {
  const SKIP_WHEN = {
    skip_when: {
      type: 'string',
      display_name: 'Skip when',
      supports_templates: true,
      templates: CASE_TEMPLATES,
      templateToken: HOST_GRAMMAR,
    },
  };

  it('names the reference and keeps the comparison exactly as written', async () => {
    const { container, findByText, queryByText } = renderRow(SKIP_WHEN, {
      skip_when: { type: 'string', value: "$._case.mode != 'simulate'" },
    });

    // The name the reference was CHOSEN by…
    const chipLabel = await findByText('mode (this case)');
    expect(chipLabel.closest('.reqraft-template-chip')).toBeTruthy();
    // …the author's own comparison, untouched…
    expect(await findByText("!= 'simulate'", { exact: false })).toBeTruthy();
    // …and the engine's spelling nowhere on the row.
    expect(queryByText("$._case.mode != 'simulate'")).toBeNull();
    expect(container.textContent).not.toContain('$._case.mode');
  });

  it('does not hover the raw value it just replaced with chips', async () => {
    // Two tooltips in two places otherwise: the chip's own popover and a native
    // browser title holding the very token the chip exists to hide.
    const { container, findByText } = renderRow(SKIP_WHEN, {
      skip_when: { type: 'string', value: "$._case.mode != 'simulate'" },
    });

    await findByText('mode (this case)');
    const titled = [...container.querySelectorAll('[title]')].map((node) =>
      node.getAttribute('title')
    );
    expect(titled.some((title) => title?.includes('$._case.mode'))).toBe(false);
  });

  it('leaves a value with no reference in it as plain text', async () => {
    const { container, findByText } = renderRow(SKIP_WHEN, {
      skip_when: { type: 'string', value: 'always' },
    });

    const value = await findByText('always');
    expect(value.closest('.reqraft-template-chip')).toBeNull();
    expect(container.querySelector('.reqraft-template-chip')).toBeNull();
  });

  it('keeps a sensitive value hidden rather than scanning it for references', async () => {
    const { container, findByText } = renderRow(
      {
        secret: {
          type: 'string',
          display_name: 'Secret',
          sensitive: true,
          templates: CASE_TEMPLATES,
          templateToken: HOST_GRAMMAR,
        },
      },
      { secret: { type: 'string', value: "$._case.mode != 'simulate'" } }
    );

    expect(await findByText('••••••')).toBeTruthy();
    expect(container.textContent).not.toContain('$._case.mode');
    expect(container.querySelector('.reqraft-template-chip')).toBeNull();
  });
});
