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
/** What it says without a host renderer: its words, none of its marks. */
const PLAIN = 'The customer’s full name, from customer.name.';

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
      content: PLAIN,
      maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH,
      handler: 'click',
    });
  });

  it('says the description without its marks where the host draws no markdown', () => {
    expect(descriptionTooltip(DESCRIPTION, {})).toBe(PLAIN);
    expect(descriptionTooltip(DESCRIPTION, {}, 'Customer name')).toEqual({
      title: 'Customer name',
      content: PLAIN,
      maxWidth: DESCRIPTION_TOOLTIP_MAX_WIDTH,
    });
  });

  it('keeps its paragraphs, each on its own, where it has more than one', () => {
    const tooltip = descriptionTooltip('The **name**.\n\n- `first`\n- second', {}) as IReqoreTooltip;
    const block = drawn(tooltip);
    expect(block.textContent).toBe('The name.\n\nfirst\nsecond');
    expect(block.style.whiteSpace).toBe('pre-line');
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

  /* qorus#646, David: "in such cases there should be a reason given why there is no description in the hover" */
  it('says why there is no description for a template the catalogue does not describe', () => {
    const tooltip = templateTooltip(TEMPLATES, '$local:order', { render: hostRender });
    expect(tooltip).toMatchObject({ title: 'Order id' });
    expect(drawn(tooltip).dataset.drawn).toBe('No description was given for this value.');
  });

  it("says what a host says of a reference it names, else the host's reason, else why there is none", () => {
    const described = templateTooltip(
      TEMPLATES,
      '$._case.attempt',
      { render: hostRender },
      undefined,
      {
        label: 'attempt (this case)',
        description: 'How many times this case has run.',
      }
    );
    expect(described).toMatchObject({ title: 'attempt (this case)' });
    expect(drawn(described).dataset.drawn).toBe('How many times this case has run.');
    const hostReason = templateTooltip(
      TEMPLATES,
      '$._case.attempt',
      { render: hostRender },
      undefined,
      {
        label: 'attempt (this case)',
        noDescription: 'The case does not describe its own counters.',
      }
    );
    expect(drawn(hostReason).dataset.drawn).toBe('The case does not describe its own counters.');
    // the catalogue's name and description win over the host's for a reference it lists
    const listed = templateTooltip(
      TEMPLATES,
      '$local:customer',
      { render: hostRender },
      undefined,
      {
        label: 'not this',
        description: 'nor this',
      }
    );
    expect(listed).toMatchObject({ title: 'Customer name' });
    expect(drawn(listed).dataset.drawn).toBe(DESCRIPTION);
  });

  it('lists the allowed values of a template under its description, as help shows them', () => {
    const withValues = {
      items: [
        {
          label: 'mode',
          value: '$._case.mode',
          badge: 'string',
          description: 'How this case runs.',
          allowed_values: [
            {
              display_name: 'Live',
              short_desc: 'Calls the real services',
              value: { type: 'string', value: 'live' },
            },
            { value: { type: 'string', value: 'simulate' } },
          ],
        },
      ],
    } as never;
    const tooltip = templateTooltip(withValues, '$._case.mode', { render: hostRender });
    expect(tooltip).toMatchObject({ title: 'mode' });
    const { container } = render(
      <ReqoreUIProvider>{(tooltip as IReqoreTooltip).content as ReactNode}</ReqoreUIProvider>
    );
    expect(container.querySelector('[data-drawn]')?.getAttribute('data-drawn')).toBe(
      'Text.\n\nHow this case runs.'
    );
    expect(container.querySelector('.allowed-values-heading')?.textContent).toBe('Allowed values');
    const bullets = Array.from(container.querySelectorAll('.allowed-values-help li'));
    expect(bullets.map((bullet) => bullet.querySelector('code')?.textContent)).toEqual([
      'live',
      'simulate',
    ]);
    expect(bullets[0].textContent).toBe('live Live: Calls the real services');
    // a value with no name of its own and no description is the value alone
    expect(bullets[1].textContent).toBe('simulate');
  });

  /* qorus#646, David on Form Engine · Value Tab Pick Replaces A Referenced Field: the hover of a field should say
     the field's type. The catalogue gives it (the entry's badge) and no hover said it. */
  it('says what kind of value a template is, in words, over its description', () => {
    const typed = {
      items: [
        { label: 'pos', value: '$record:{pos}', badge: 'int' },
        {
          label: 'Customer name',
          value: '$local:customer',
          badge: 'string',
          description: DESCRIPTION,
        },
      ],
    } as IReqoreFormTemplates;
    const pos = templateTooltip(typed, '$record:{pos}', { render: hostRender });
    expect(pos).toMatchObject({ title: 'pos' });
    expect(drawn(pos).dataset.drawn).toBe(
      'A whole number.\n\nNo description was given for this value.'
    );
    const customer = templateTooltip(typed, '$local:customer', { render: hostRender });
    expect(customer).toMatchObject({ title: 'Customer name' });
    expect(drawn(customer).dataset.drawn).toBe(`Text.\n\n${DESCRIPTION}`);
    // in the words the server's catalogue gives the type in, where the surface has it
    const said = templateTooltip(typed, '$record:{pos}', { render: hostRender }, (type) =>
      type === 'int' ? 'eine ganze Zahl' : undefined
    );
    expect(drawn(said).dataset.drawn).toBe(
      'Eine ganze Zahl.\n\nNo description was given for this value.'
    );
  });
});

describe('makeDpqlTagRenderer', () => {
  it("draws a field reference's type, in words, and its description under its name", () => {
    const props = makeDpqlTagRenderer(
      { name: { display_name: 'Name', type: { name: 'string' }, short_desc: DESCRIPTION } },
      { descriptions: { render: hostRender } }
    )({ type: 'tag', value: '@name', children: [{ text: '' }] } as never);
    // its type was said raw, "Name (string)" (qorus#646)
    expect(props.tooltip).toMatchObject({ title: 'Name' });
    expect(drawn(props.tooltip).dataset.drawn).toBe(`Text.\n\n${DESCRIPTION}`);
  });

  it("says a field's type, and why nothing else, where the record does not describe it", () => {
    const props = makeDpqlTagRenderer(
      { total: { display_name: 'Total', type: { name: 'number' } } },
      { descriptions: { render: hostRender } }
    )({ type: 'tag', value: '@total', children: [{ text: '' }] } as never);
    expect(props.tooltip).toMatchObject({ title: 'Total' });
    // and why nothing else: the record gives no description (qorus#646)
    expect(drawn(props.tooltip).dataset.drawn).toBe(
      'An exact number.\n\nNo description was given for this field.'
    );
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
