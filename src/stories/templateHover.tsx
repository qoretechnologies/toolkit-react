// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Story support for a template chip's hover: a catalogue whose description is markdown, a host that draws
 * markdown, and the plays that check the hover draws it - on a mouse, and tapped on a phone.
 */
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { expect, userEvent, waitFor } from 'storybook/test';
import { MarkdownRendererContext } from '../components/Description/markdownRendererContext';
import { defaultMarkdownRenderer } from '../components/form/fields/markdown/MarkdownView';
import { expectChipFits } from './chips';
import { _testsWithViewport } from './Tests/utils';
import { withTouchScreen } from './touchScreen';

/** The reference the stories' values hold. */
export const MARKDOWN_TEMPLATE_VALUE = '$local:customer';

/** The chip's name, from the catalogue. */
export const MARKDOWN_TEMPLATE_LABEL = 'Customer name';

/** A catalogue whose one value is described in markdown, as the server's catalogue describes values. */
export const MARKDOWN_TEMPLATES = {
  items: [
    {
      label: 'Local values',
      items: [
        {
          label: MARKDOWN_TEMPLATE_LABEL,
          value: MARKDOWN_TEMPLATE_VALUE,
          badge: 'string',
          description: 'The **customer’s** full name, as the order gives it in `customer.name`.',
        },
      ],
    },
  ],
} as IReqoreFormTemplates;

/** A host that draws markdown, as the IDE does: its renderer on the context (`MarkdownRendererContext`). */
export const withHostMarkdown = (Story: () => JSX.Element) => (
  <MarkdownRendererContext.Provider value={defaultMarkdownRenderer}>
    <Story />
  </MarkdownRendererContext.Provider>
);

/** The chip named from the catalogue. */
export const findTemplateChip = (canvasElement: HTMLElement): Promise<HTMLElement> =>
  waitFor(() => {
    const chip = Array.from(canvasElement.querySelectorAll<HTMLElement>('.reqore-tag')).find((tag) =>
      tag.textContent?.includes(MARKDOWN_TEMPLATE_LABEL)
    );
    expect(chip).toBeTruthy();
    return chip!;
  });

/** The open hover card that describes the value. */
const findHoverCard = (): HTMLElement | undefined =>
  Array.from(document.querySelectorAll<HTMLElement>('.reqore-popover-content')).find((card) =>
    card.textContent?.includes('full name')
  );

/** The chip's hover card is open and draws its description: bold and code, and none of the marks. */
export const expectDrawnHover = (): Promise<HTMLElement> =>
  waitFor(() => {
    // said once: nothing else open beside the card (an editor's template list) repeats the description
    expect(
      Array.from(document.querySelectorAll('.reqore-popover-content')).filter((popover) =>
        popover.textContent?.includes('full name')
      )
    ).toHaveLength(1);
    const card = findHoverCard();
    expect(card).toBeTruthy();
    expect(card!).toHaveTextContent(MARKDOWN_TEMPLATE_LABEL);
    expect(card!.querySelector('strong')).toHaveTextContent('customer’s');
    expect(card!.querySelector('code')).toHaveTextContent('customer.name');
    expect(card!.textContent).not.toContain('**');
    expect(card!.textContent).not.toContain('`');
    return card!;
  });

/**
 * The card is as wide as what it says, up to its readable maximum: a sentence that fits that width takes one line,
 * not two. Measured without touching the page - `waitFor` runs again on every change to it - as the text's height
 * against its line height.
 */
const expectOnOneLine = (card: HTMLElement) => {
  const text = Array.from(card.querySelectorAll<HTMLElement>('p, div')).find(
    (element) => element.textContent?.includes('full name') && !element.querySelector('p, div')
  );
  expect(text).toBeTruthy();
  const style = getComputedStyle(text!);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
  expect(text!.getBoundingClientRect().height).toBeLessThan(lineHeight * 1.8);
};

/** Hovered with a mouse on a wide screen, the chip's card draws its description, on one line. */
export const playHoverIsDrawn = async ({ canvasElement }: { canvasElement: HTMLElement }) =>
  _testsWithViewport(1280, 800, async () => {
    const chip = await findTemplateChip(canvasElement);
    expectChipFits(chip);
    await userEvent.hover(chip);
    const card = await expectDrawnHover();
    await waitFor(() => expectOnOneLine(card));
  });

/**
 * Tapped by a finger on a phone, the chip's card opens, draws its description, and stays on the screen.
 * The tap is a real touch (`withTouchScreen`), so this is what a phone does with a hover.
 */
export const playTapIsDrawnOnAPhone = async ({ canvasElement }: { canvasElement: HTMLElement }) =>
  withTouchScreen(async (touch) => {
    const chip = await findTemplateChip(canvasElement);
    // a chip a finger presses: small or bigger, its label inside it
    expectChipFits(chip);
    await touch.tap(chip);
    const card = await expectDrawnHover();
    if (touch.narrowed) {
      await waitFor(() => {
        const box = card.getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      });
    }
  });

/**
 * With no host renderer the card says the description as plain text: its words, none of its marks, and nothing
 * drawn in a dialect the host never chose.
 */
export const playHoverIsPlainWithoutAHost = async ({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) => {
  const chip = await findTemplateChip(canvasElement);
  expectChipFits(chip);
  await userEvent.hover(chip);
  await waitFor(() => {
    const card = findHoverCard();
    expect(card).toBeTruthy();
    expect(card!).toHaveTextContent('The customer’s full name, as the order gives it in customer.name.');
    expect(card!.textContent).not.toMatch(/[`*]/);
    expect(card!.querySelector('strong, code')).toBeNull();
  });
};
