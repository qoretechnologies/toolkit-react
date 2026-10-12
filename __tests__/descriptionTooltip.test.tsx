// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A description from the server is markdown. Its hover - a template chip's, a choice's, a schema section's -
 * printed it raw (`**`, backticks) beside a template list that draws the same string through the host's
 * renderer, and a finger could not open it: a hover card opens on `mouseenter` and closes on any click, and
 * a tap is both. `descriptionTooltip` draws it with the host's renderer, and `useDescriptionTooltips` opens
 * it on a tap where the pointer cannot hover.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MarkdownRendererContext,
  TMarkdownRenderer,
} from '../src/components/Description/markdownRendererContext';
import { makeDpqlTagRenderer } from '../src/components/dpqlEditor/dpqlTags';
import { ReadOnlyTemplateTag } from '../src/components/form/fields/template/ReadOnlyTemplateTag';
import {
  DESCRIPTION_TOOLTIP_MAX_WIDTH,
  descriptionTooltip,
  useDescriptionTooltips,
} from '../src/helpers/descriptionTooltip';
import { templateTooltip } from '../src/helpers/templates';
import { COARSE_POINTER_QUERY } from '../src/hooks/useCoarsePointer';

const DESCRIPTION = 'The **customer’s** full name, from `customer.name`.';

/** A host renderer, as the IDE supplies one: it says what it was asked to draw. */
const hostRender = vi.fn<TMarkdownRenderer>(({ value, compact }) => (
  <div data-drawn={value} data-compact={String(!!compact)} />
));

const TEMPLATES = {
  items: [
    {
      label: 'Local values',
      items: [
        { label: 'Customer name', value: '$local:customer', description: DESCRIPTION },
        { label: 'Order id', value: '$local:order' },
      ],
    },
  ],
} as IReqoreFormTemplates;

/** The element a card's content drew, mounted, so it can be read. */
const drawn = (tooltip: unknown) => {
  const content = (tooltip as IReqoreTooltip).content as ReactNode;
  return render(<>{content}</>).container.firstElementChild as HTMLElement;
};

/** The pointer is a finger, or a mouse. */
const pointer = (coarse: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === COARSE_POINTER_QUERY ? coarse : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

afterEach(() => {
  vi.unstubAllGlobals();
  hostRender.mockClear();
});

describe('descriptionTooltip', () => {
  it('draws the description with the host renderer, compact, under its title', () => {
    const tooltip = descriptionTooltip(DESCRIPTION, { render: hostRender }, 'Customer name');
    expect(tooltip).toMatchObject({ title: 'Customer name', maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH });
    expect(hostRender).toHaveBeenCalledWith({ value: DESCRIPTION, compact: true });
    expect(drawn(tooltip).dataset).toMatchObject({ drawn: DESCRIPTION, compact: 'true' });
    // a mouse hovers: the card keeps the hover it always opened on
    expect((tooltip as IReqoreTooltip).handler).toBeUndefined();
  });

  it('opens on a tap where the pointer cannot hover', () => {
    expect(descriptionTooltip(DESCRIPTION, { render: hostRender, tapToOpen: true })).toMatchObject({
      handler: 'click',
    });
    // drawn or not: what it says is out of a finger's reach on a hover either way
    expect(descriptionTooltip(DESCRIPTION, { tapToOpen: true })).toEqual({
      content: DESCRIPTION,
      maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH,
      handler: 'click',
    });
  });

  it('keeps the description as written where the host draws no markdown', () => {
    expect(descriptionTooltip(DESCRIPTION, {})).toBe(DESCRIPTION);
    expect(descriptionTooltip(DESCRIPTION, {}, 'Customer name')).toEqual({
      title: 'Customer name',
      content: DESCRIPTION,
      maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH,
    });
  });

  it('is the title alone without a description, and nothing without either', () => {
    for (const none of [undefined, null, '', '   ', 42]) {
      expect(descriptionTooltip(none, { render: hostRender, tapToOpen: true }, 'Order id')).toBe(
        'Order id'
      );
      expect(descriptionTooltip(none, { render: hostRender })).toBeUndefined();
    }
    expect(hostRender).not.toHaveBeenCalled();
  });
});

describe('templateTooltip', () => {
  it("draws a template's description under its name, and opens on a tap on touch", () => {
    const tooltip = templateTooltip(TEMPLATES, '$local:customer', {
      render: hostRender,
      tapToOpen: true,
    });
    expect(tooltip).toMatchObject({ title: 'Customer name', handler: 'click' });
    expect(drawn(tooltip).dataset.drawn).toBe(DESCRIPTION);
  });

  it('is the name alone for a template the catalogue does not describe', () => {
    expect(templateTooltip(TEMPLATES, '$local:order', { render: hostRender })).toBe('Order id');
  });
});

describe('makeDpqlTagRenderer', () => {
  it("draws a field reference's description under its name and type", () => {
    const props = makeDpqlTagRenderer(
      { name: { display_name: 'Name', type: { name: 'string' }, short_desc: DESCRIPTION } },
      { descriptions: { render: hostRender } }
    )({ type: 'tag', value: '@name', children: [{ text: '' }] } as never);
    expect(props.tooltip).toMatchObject({ title: 'Name (string)' });
    expect(drawn(props.tooltip).dataset.drawn).toBe(DESCRIPTION);
  });
});

describe('useDescriptionTooltips', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReqoreUIProvider>
      <MarkdownRendererContext.Provider value={hostRender}>{children}</MarkdownRendererContext.Provider>
    </ReqoreUIProvider>
  );

  it("takes the host's renderer, and hovers with a mouse", () => {
    pointer(false);
    const { result } = renderHook(() => useDescriptionTooltips(), { wrapper });
    expect(result.current).toEqual({ render: hostRender, tapToOpen: false });
  });

  it('opens on a tap with a finger', () => {
    pointer(true);
    const { result } = renderHook(() => useDescriptionTooltips(), { wrapper });
    expect(result.current.tapToOpen).toBe(true);
  });
});

describe('a template chip on a touch screen', () => {
  it('opens its drawn card on a tap, and puts it away on the next', async () => {
    pointer(true);
    render(
      <ReqoreUIProvider>
        <MarkdownRendererContext.Provider value={hostRender}>
          <ReadOnlyTemplateTag value='$local:customer' templates={TEMPLATES} />
        </MarkdownRendererContext.Provider>
      </ReqoreUIProvider>
    );
    const chip = screen.getByText('Customer name');
    expect(document.querySelector(`[data-drawn]`)).toBeNull();
    fireEvent.click(chip);
    expect((await screen.findByText('Customer name', { selector: '.reqore-popover-content *' })).textContent).toBe(
      'Customer name'
    );
    expect(document.querySelector('.reqore-popover-content [data-drawn]')).not.toBeNull();
    fireEvent.click(chip);
    expect(document.querySelector('.reqore-popover-content')).toBeNull();
  });
});
