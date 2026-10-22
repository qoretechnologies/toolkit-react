// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A reference its catalogue does not list says so, and one its host knows wears the host's name (qorus#646, David
 * on FormEngine · A Host Grammar Survives The Editor The Row Opens: "has a chip with a display name and one with
 * the technical form ("$._case.attempt"); the chips / templates / etc were meant to abstract the technical format
 * from our users").
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadOnlyTemplateTag } from '../src/components/form/fields/template/ReadOnlyTemplateTag';
import {
  DEFAULT_UNLISTED_REFERENCE_HINT,
  referenceStanding,
  TemplateReferenceNamesProvider,
  UNLISTED_REFERENCE_CLASS,
  unlistedReferenceChipProps,
} from '../src/components/form/fields/template/referenceNames';
import { TemplateText } from '../src/components/form/fields/template/TemplateText';
import { templateTextSegments } from '../src/helpers/templateText';

const CASE_VALUES = {
  items: [
    {
      label: 'Values this case captures',
      items: [{ value: '$._case.mode', label: 'mode (this case)', badge: 'string' }],
    },
  ],
};
const GRAMMAR = /\$\.[A-Za-z_][\w.]*/;

describe('what names a reference', () => {
  it('is the catalogue, for one it lists', () => {
    expect(referenceStanding(CASE_VALUES, '$._case.mode')).toEqual({ unlisted: false });
  });

  it('is the host, for one it knows and does not list', () => {
    const names = {
      label: (reference: string) =>
        reference === '$._case.attempt' ? 'attempt (this case)' : undefined,
    };
    expect(referenceStanding(CASE_VALUES, '$._case.attempt', names)).toEqual({
      label: 'attempt (this case)',
      unlisted: false,
    });
  });

  it('is nothing for one neither knows, which is then said to be unlisted', () => {
    expect(referenceStanding(CASE_VALUES, '$._case.attempt')).toEqual({ unlisted: true });
  });

  it('cannot be told against a catalogue with nothing in it, so nothing is said to be unlisted', () => {
    expect(referenceStanding(undefined, '$._case.attempt')).toEqual({ unlisted: false });
    expect(referenceStanding({ items: [] }, '$._case.attempt')).toEqual({ unlisted: false });
  });

  it("says so in the host's words, or in its own", () => {
    expect(unlistedReferenceChipProps({}).tooltip).toBe(DEFAULT_UNLISTED_REFERENCE_HINT);
    expect(unlistedReferenceChipProps({ unlistedHint: 'Not a value this case captures' })).toEqual({
      intent: 'warning',
      tooltip: 'Not a value this case captures',
      className: UNLISTED_REFERENCE_CLASS,
    });
  });
});

describe('the chips of a value read', () => {
  const text = "$._case.mode != 'simulate' && $._case.attempt == 1";

  it('mark the reference nothing names, and only it', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <TemplateText
          segments={templateTextSegments(text, CASE_VALUES, GRAMMAR)}
          templates={CASE_VALUES}
        />
      </ReqoreUIProvider>
    );
    expect(
      Array.from(container.querySelectorAll(`.${UNLISTED_REFERENCE_CLASS}`)).map((chip) =>
        chip.textContent?.trim()
      )
    ).toEqual(['$._case.attempt']);
  });

  it("wear the host's name for one it knows, and mark none", () => {
    const { container } = render(
      <ReqoreUIProvider>
        <TemplateReferenceNamesProvider
          value={{
            label: (reference) =>
              reference === '$._case.attempt' ? 'attempt (this case)' : undefined,
          }}
        >
          <TemplateText
            segments={templateTextSegments(text, CASE_VALUES, GRAMMAR)}
            templates={CASE_VALUES}
          />
          <ReadOnlyTemplateTag value='$._case.attempt' templates={CASE_VALUES} />
        </TemplateReferenceNamesProvider>
      </ReqoreUIProvider>
    );
    expect(container.querySelectorAll(`.${UNLISTED_REFERENCE_CLASS}`)).toHaveLength(0);
    expect(container.textContent).toContain('attempt (this case)');
    expect(container.textContent).not.toContain('$._case.attempt');
  });

  it('mark a lone reference nothing names, drawn on its own', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <ReadOnlyTemplateTag value='$._case.attempt' templates={CASE_VALUES} />
        <ReadOnlyTemplateTag value='$._case.mode' templates={CASE_VALUES} />
      </ReqoreUIProvider>
    );
    expect(container.querySelectorAll(`.${UNLISTED_REFERENCE_CLASS}`)).toHaveLength(1);
  });
});
