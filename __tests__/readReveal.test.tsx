// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The props each reveal hands to Reqore's `ReqoreCollapsibleContent`, the last one first. */
const handed: Record<string, unknown>[] = [];

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const reqore = await importOriginal<typeof import('@qoretechnologies/reqore')>();
  return {
    ...reqore,
    ReqoreCollapsibleContent: (props: Record<string, unknown> & { children?: ReactNode }) => {
      handed.unshift(props);
      return <div>{props.children}</div>;
    },
  };
});

const { ReadReveal, ReadRevealPlacementProvider } = await import(
  '../src/components/form/engine/ReadReveal'
);

/**
 * A value a read row clips is revealed by words that say what it shows ("Show the whole source"), never a bare
 * "Show more", and where the form puts the reveal (`readRevealPlacement`). The placement is handed to Reqore only
 * when the form sets one: a Reqore before 0.79 has no `buttonPlacement`.
 */
describe('a read reveal', () => {
  beforeEach(() => {
    handed.length = 0;
  });

  it('says what it shows, by what it holds', () => {
    render(
      <ReqoreUIProvider>
        <ReadReveal holds='source' maxCollapsedHeight={96}>
          code
        </ReadReveal>
        <ReadReveal holds='value'>value</ReadReveal>
        <ReadReveal holds='text'>text</ReadReveal>
      </ReqoreUIProvider>
    );

    const [text, value, source] = handed;
    expect([source.showMoreLabel, source.showLessLabel]).toEqual([
      'Show the whole source',
      'Show less of the source',
    ]);
    expect([value.showMoreLabel, value.showLessLabel]).toEqual([
      'Show the whole value',
      'Show less of the value',
    ]);
    expect([text.showMoreLabel, text.showLessLabel]).toEqual([
      'Show the whole text',
      'Show less of the text',
    ]);
    expect(source.maxCollapsedHeight).toBe(96);
  });

  it('hands Reqore no placement where the form sets none', () => {
    render(
      <ReqoreUIProvider>
        <ReadReveal holds='source'>code</ReadReveal>
      </ReqoreUIProvider>
    );

    expect('buttonPlacement' in handed[0]).toBe(false);
  });

  it("hands Reqore the form's placement where it sets one", () => {
    render(
      <ReqoreUIProvider>
        <ReadRevealPlacementProvider value='below'>
          <ReadReveal holds='value'>value</ReadReveal>
        </ReadRevealPlacementProvider>
      </ReqoreUIProvider>
    );

    expect(handed[0].buttonPlacement).toBe('below');
  });
});
