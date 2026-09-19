// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The status-box headers, on a form long enough to scroll.
 *
 * `Needs attention`, `Set` and `Optional` are the only thing that says which
 * bucket a row is in. On a form that fits, that is a label at the top of a
 * short list. On a form that does not, it leaves the screen after the first
 * few rows and every row under it reads as an undifferentiated list — which is
 * what these stories measure: the header's `getBoundingClientRect().top` while
 * the scroller is scrolled past it, not a class name that claims it is sticky.
 */
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { FormEngine, IFormEngineProps, IOptions } from './FormEngine';

/** The scroller the form is pinned against — one element, padded like a real host. */
const SCROLLER = 'sticky-story-scroller';

/**
 * A schema long enough that a box header leaves the screen.
 *
 * Every bucket is populated: `required` with no value buckets to
 * `Needs attention`, a field with a value to `Set`, and the rest to `Optional`.
 * Enough rows per bucket that scrolling lands INSIDE a box rather than between
 * two of them — a header pinned at the boundary proves nothing.
 */
const longSchema = (): IQorusFormSchema => {
  const schema: IQorusFormSchema = {};
  for (let i = 1; i <= 4; i++) {
    schema[`attention_${i}`] = {
      type: 'string',
      ui_type: 'string',
      display_name: `Needs a value ${i}`,
      required: true,
    };
  }
  for (let i = 1; i <= 12; i++) {
    schema[`set_${i}`] = {
      type: 'string',
      ui_type: 'string',
      display_name: `Already set ${i}`,
    };
  }
  for (let i = 1; i <= 12; i++) {
    schema[`optional_${i}`] = {
      type: 'string',
      ui_type: 'string',
      display_name: `Could be set ${i}`,
    };
  }
  return schema;
};

const longValue = (): IOptions => {
  const value: IOptions = {};
  for (let i = 1; i <= 12; i++) {
    value[`set_${i}`] = { type: 'string', value: `value ${i}` } as never;
  }
  return value;
};

const meta: Meta<typeof FormEngine> = {
  component: FormEngine,
  title: 'Form/Engine/Sticky Headers',
  args: {
    name: 'sticky',
    compact: true,
    options: longSchema(),
    value: longValue(),
    onChange: fn(),
    /* Open, so there is something to scroll through. The Optional box is
       collapsed by default and a collapsed box has no body to scroll past. */
    compactCollapsedGroups: [],
  },
  parameters: { chromatic: { viewports: [2560] } },
  render: ({ value, onChange, ...rest }: IFormEngineProps, { parameters }) => {
    const [val, setValue] = useState(value);
    return (
      /* A real host: one padded, height-capped scroller, which is the shape
         every panel, drawer and page body in the product has. The padding is
         deliberate — reqore compensates a sticky header for the scrollport's
         inset, and a story on an unpadded scroller would not exercise it. */
      <div
        id={SCROLLER}
        /* 70vh, not a fixed 420: what a pinned band COSTS is a fraction of the
           screen it is charged against, so a story that measures the cost on a
           box of its own choosing measures nothing. This is the share of a
           viewport a page body actually gets. */
        style={{
          height: '70vh',
          /* The engine's narrow breakpoint is the FORM's measured width, not
             the window's — deliberately, so a narrow panel on a wide screen
             lays out like a phone. So a story that wants the narrow layout
             sets the width here and gets it whatever the viewport does, rather
             than depending on the viewport addon having resized the iframe. */
          width: (parameters.stickyScrollerWidth as number | undefined) ?? undefined,
          overflowY: 'auto',
          padding: 16,
          background: '#0a0a0a',
        }}
      >
        <FormEngine
          {...rest}
          value={val}
          onChange={(name, next, meta) => {
            setValue(next);
            onChange?.(name, next, meta);
          }}
        />
      </div>
    );
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The scroller, by the id the render put on it. */
const scroller = () => document.getElementById(SCROLLER) as HTMLElement;

/** One box's header element, found by the label it carries. */
const boxHeader = (label: string): HTMLElement => {
  const box = Array.from(document.querySelectorAll('.options-readfirst-group')).find((el) =>
    (el.querySelector(':scope > .reqore-panel-title')?.textContent ?? '').includes(label)
  );
  if (!box) {
    throw new Error(`no status box labelled ${label}`);
  }
  return box.querySelector(':scope > .reqore-panel-title') as HTMLElement;
};

/** The form's own toolbar — the thing the box headers must never cover. */
const toolbar = () =>
  document.querySelector(
    '.options-readfirst-scroll > .reqore-panel > .reqore-panel-title'
  ) as HTMLElement;

/**
 * The line a status-box header pins at.
 *
 * Not simply the top of the body: the form's toolbar pins there first on a wide
 * form, and the box headers are offset below it. On a narrow one the toolbar
 * gives up its pin and the line IS the top. Reading it from the DOM is what
 * lets one story hold at both widths.
 */
const pinLine = () => {
  const top = scroller().getBoundingClientRect().top;
  const bar = toolbar();
  if (!bar || getComputedStyle(bar).position !== 'sticky') {
    return top;
  }
  /* A pinned toolbar whose own panel has scrolled away sits above the body's
     top edge and pins nothing; the line is the body's top again. */
  return Math.max(top, bar.getBoundingClientRect().bottom);
};

/**
 * Scrolls the host and waits for the sticky positions to settle.
 *
 * The browser CLAMPS a scrollTop past the end, so what is waited for is the
 * position the scroller actually took, not the one it was asked for — a story
 * that scrolls to `scrollHeight` and then waits to read `scrollHeight` back
 * waits forever.
 */
const scrollTo = async (top: number) => {
  const el = scroller();
  el.scrollTop = top;
  const landed = el.scrollTop;
  await waitFor(() => expect(scroller().scrollTop).toBe(landed));
  /* Reqore reads sticky positions in a rAF on scroll; one more frame after the
     scroll lands is what the measurements below are taken from. */
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
};

/**
 * Scrolls until one box's top has gone `past` pixels over the line it pins at.
 *
 * A fixed scrollTop is the wrong instrument: `position: sticky` cannot outlive
 * its containing block, so a box header pins for exactly the height of its own
 * box minus its own height — and where that window falls depends on the
 * viewport, which differs between the browser someone is looking at and the one
 * the test runner opens. Aiming at the box lands inside the window at any size.
 */
const scrollIntoBox = async (label: string, past: number) => {
  const box = boxHeader(label).parentElement as HTMLElement;
  const delta = box.getBoundingClientRect().top - pinLine() + past;
  await scrollTo(scroller().scrollTop + delta);
};

/**
 * Scrolled deep into the Set box, its header is still on screen.
 *
 * Measured, not asserted about CSS: the header's own rect has to sit inside the
 * scroller's visible band while rows that started below it have gone past.
 */
export const BoxHeaderStaysWhileItsBoxIsRead: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A form long enough to scroll, with all three status boxes open. Scrolling into the Set box leaves its header pinned inside the scroller’s visible band rather than above it, so the reader can still tell which bucket the rows under the pointer belong to.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(boxHeader('Set')).toBeInTheDocument());
    const scrollerTop = scroller().getBoundingClientRect().top;
    const restingTop = boxHeader('Set').getBoundingClientRect().top;
    expect(restingTop).toBeGreaterThan(scrollerTop);

    await scrollIntoBox('Set', 40);

    const pinnedTop = boxHeader('Set').getBoundingClientRect().top;
    /* It MOVED — a header that never moves is one the scroll never reached,
       and the story would pass on a form that simply fits. */
    expect(pinnedTop).toBeLessThan(restingTop);
    /* …and it is still visible: inside the scroller, not above its top edge. */
    expect(pinnedTop).toBeGreaterThanOrEqual(scrollerTop);
    expect(pinnedTop).toBeLessThan(scroller().getBoundingClientRect().bottom);
    /* The rows it heads have gone past it, which is the condition that makes
       the pin worth anything. */
    const firstRow = document.querySelectorAll<HTMLElement>('.readfirst-row')[0];
    expect(firstRow.getBoundingClientRect().top).toBeLessThan(pinnedTop);
  },
};

/**
 * The box header pins BELOW the form's own toolbar, never over it.
 *
 * Both are sticky in the same scroller, and two things asking for the same
 * `top` land on each other. The toolbar loses that fight — it renders first —
 * and it carries the search, which is the only control that forces a collapsed
 * box open.
 */
export const BoxHeaderClearsTheToolbar: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The form’s toolbar and the status-box headers are both pinned in the same scroller. The box header is offset by the toolbar’s measured height, so the two stack instead of overlapping and the search stays reachable.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(toolbar()).toBeInTheDocument());
    await scrollIntoBox('Set', 40);

    const bar = toolbar().getBoundingClientRect();
    const box = boxHeader('Set').getBoundingClientRect();
    /* No overlap, in the only terms that matter: the box header starts at or
       below the toolbar's bottom edge. */
    expect(box.top).toBeGreaterThanOrEqual(Math.floor(bar.bottom) - 1);
    /* And the toolbar is itself still pinned, not scrolled away. */
    expect(bar.top).toBeGreaterThanOrEqual(scroller().getBoundingClientRect().top - 1);
  },
};

/**
 * Only ONE box header is pinned at a time.
 *
 * Sticky is bounded by its containing block, so a header cannot outlive its own
 * box: by the time Optional's header is pinned, Set's has left with its box.
 * That is what keeps the cost of this one header's height rather than three.
 */
export const OnlyOneBoxHeaderIsEverPinned: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Scrolled to the bottom of a long form, only the box being read has its header on screen — the earlier boxes’ headers left with their boxes, so the pinned band never grows past one header however many boxes the form has.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(boxHeader('Optional')).toBeInTheDocument());
    await scrollIntoBox('Optional', 40);

    const line = pinLine();
    /* PINNED, not merely visible. A box that has not been reached yet is on
       screen too — lower down, in the flow — and counting that would make this
       a story about how tall the boxes happen to be. What is pinned is what
       sits AT the line, which is what costs the reader the top of the page. */
    const atThePinLine = ['Needs attention', 'Set', 'Optional'].filter(
      (label) => Math.abs(boxHeader(label).getBoundingClientRect().top - line) < 2
    );
    expect(atThePinLine).toEqual(['Optional']);
  },
};

/**
 * A phone, where a pinned band is charged against a much smaller screen.
 *
 * The box header still pins — a phone scrolls further than anything, so it is
 * where knowing which bucket you are in is worth most — but the form's OWN
 * toolbar gives up its pin to pay for it. Measured at this width the two are
 * 124px and 48px, which together is a third of the body before the form has
 * drawn a line, and only one of them can be afforded: the toolbar is chrome you
 * go to and the box header is chrome you read.
 */
export const StickyHeadersOnAPhone: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  parameters: {
    /* 380px, the width the phone checks use. Set on the container rather than
       left to the viewport, because the engine measures the FORM. */
    stickyScrollerWidth: 380,
    docs: {
      description: {
        story:
          'At a phone width the status-box header keeps its pin and the form’s toolbar gives up its own, so what is pinned is one row rather than a third of the screen. The toolbar is still there at the top of the form; it just scrolls with it.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(boxHeader('Set')).toBeInTheDocument());
    await scrollIntoBox('Set', 40);

    const band = scroller().getBoundingClientRect();
    const box = boxHeader('Set').getBoundingClientRect();

    /* The box header is pinned: at the top of the body, not merely visible. */
    expect(Math.round(box.top)).toBe(Math.round(band.top));
    /* ONE row — it does not stack into a block when the width runs out. */
    expect(box.height).toBeLessThanOrEqual(56);
    /* And the toolbar has given up its pin, so it is not sitting above it. */
    expect(getComputedStyle(toolbar()).position).not.toBe('sticky');
    /* The whole cost, against the screen it is charged to. */
    expect(box.bottom - band.top).toBeLessThan(band.height / 5);
  },
};
