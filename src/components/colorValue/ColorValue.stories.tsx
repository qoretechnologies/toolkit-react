// Copyright 2026 Qore Technologies, s.r.o.
import { StoryObj } from '@storybook/react-vite';
import { ReqoreControlGroup, ReqoreTag } from '@qoretechnologies/reqore';
import { expect, waitFor, within } from 'storybook/test';

import { LightTheme, PHONE_VIEWPORT } from '../../stories/tracking';
import { StoryMeta } from '../../types';
import { ReqraftColorValue } from './index';

const meta = {
  component: ReqraftColorValue,
  title: 'Components/ColorValue',
} as StoryMeta<typeof ReqraftColorValue>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The values each story reads, by what they are. */
const CORNFLOWER = { r: 100, g: 149, b: 237 };
const HALF_RED = { r: 255, g: 0, b: 0, a: 0.5 };
const NOT_COLOURS: { label: string; value: unknown }[] = [
  { label: 'Letters past F', value: '#zzz' },
  { label: 'A colour name', value: 'red' },
  { label: 'A channel that is not a number', value: { r: 'a', g: 0, b: 0 } },
  { label: 'A number', value: 42 },
  {
    label: 'A long hash',
    value: { note: 'this is not a colour, and it goes on for a while longer' },
  },
];

const values = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.reqraft-color-value'));
const swatchOf = (value: HTMLElement) =>
  value.querySelector<HTMLElement>('.reqraft-color-value-swatch')!;
const textOf = (value: HTMLElement) =>
  value.querySelector<HTMLElement>('.reqraft-color-value-text')!;

/** A value shows a colour: its text, a swatch of its size named for it and painted the colour. */
const expectColour = async (value: HTMLElement, text: string, paint: string, swatchPx: number) => {
  await expect(textOf(value)).toHaveTextContent(text);
  const swatch = swatchOf(value);
  await expect(swatch).toHaveAttribute('role', 'img');
  await expect(swatch).toHaveAccessibleName(`Colour ${text}`);
  await expect(swatch.getBoundingClientRect().width).toBe(swatchPx);
  await expect(swatch.getBoundingClientRect().height).toBe(swatchPx);
  await expect(
    getComputedStyle(swatch).backgroundImage + getComputedStyle(swatch).backgroundColor
  ).toContain(paint);
};

/**
 * A value is as wide as what it shows, not as wide as the column it is in: in a flex column it stretched,
 * and its wash ran across the column.
 */
const expectAsWideAsItsContent = async (value: HTMLElement) => {
  const column = value.parentElement!.getBoundingClientRect().width;
  await expect(value.getBoundingClientRect().width).toBeLessThan(column / 2);
};

/** Nothing in the canvas reaches past its right edge. */
const expectNothingPastTheEdge = async (canvasElement: HTMLElement) => {
  const edge = canvasElement.getBoundingClientRect().right;
  for (const value of values(canvasElement)) {
    await expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(edge + 0.5);
  }
};

const Labelled = ({
  label,
  value,
  compact,
}: {
  label: string;
  value: unknown;
  compact?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
    <span style={{ fontSize: 11, opacity: 0.7 }}>{label}</span>
    <ReqraftColorValue value={value} size={compact ? 'compact' : 'normal'} />
  </div>
);

export const RgbObject: Story = {
  args: { value: CORNFLOWER },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a colour stored as { r: 100, g: 149, b: 237 }: a 20px swatch painted cornflower blue, beside its hex code #6495ED, on a wash of the colour. The swatch is an image named "Colour #6495ED"; the hex code is text.',
      },
    },
  },
  async play({ canvasElement }) {
    const [value] = values(canvasElement);
    await expectColour(value, '#6495ED', 'rgb(100, 149, 237)', 20);
    await expect(value).toHaveAttribute('data-size', 'normal');
  },
};

export const RgbaObject: Story = {
  args: { value: HALF_RED },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a see-through colour stored as { r: 255, g: 0, b: 0, a: 0.5 }: it is written rgba(255, 0, 0, 0.5), since a hex code would drop its opacity, and its swatch is painted over a checkerboard, so the transparency shows.',
      },
    },
  },
  async play({ canvasElement }) {
    const [value] = values(canvasElement);
    await expectColour(value, 'rgba(255, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.5)', 20);
    // the checkerboard under the colour
    await expect(getComputedStyle(swatchOf(value)).backgroundImage).toContain('url(');
  },
};

export const HexCode: Story = {
  args: { value: '#6495ed' },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a colour stored as the hex code #6495ed: written #6495ED, its swatch cornflower blue.',
      },
    },
  },
  async play({ canvasElement }) {
    await expectColour(values(canvasElement)[0], '#6495ED', 'rgb(100, 149, 237)', 20);
  },
};

export const HexCodeWithoutItsHash: Story = {
  args: { value: 'f80' },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a colour stored as the three-digit hex code f80, with no # (a value written by hand): it is the colour #FF8800, written #F80 as it was stored, its swatch orange.',
      },
    },
  },
  async play({ canvasElement }) {
    await expectColour(values(canvasElement)[0], '#F80', 'rgb(255, 136, 0)', 20);
  },
};

export const HexObject: Story = {
  args: { value: { hex: '#2e7d32' } },
  parameters: {
    docs: {
      description: {
        story:
          "Renders a colour stored as { hex: '#2e7d32' }: written #2E7D32, its swatch dark green.",
      },
    },
  },
  async play({ canvasElement }) {
    await expectColour(values(canvasElement)[0], '#2E7D32', 'rgb(46, 125, 50)', 20);
  },
};

export const NotAColour: Story = {
  args: { value: undefined },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {NOT_COLOURS.map(({ label, value }) => (
        <Labelled key={label} label={label} value={value} />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Renders five values that are not colours: #zzz (letters past F), red (a colour name), a channel that is not a number, the number 42 and a long hash. None draws a swatch or a wash: each says what it is - Not a colour: “#zzz”, … - the hash cut short with an ellipsis.',
      },
    },
  },
  async play({ canvasElement }) {
    const shown = values(canvasElement);
    await expect(shown).toHaveLength(NOT_COLOURS.length);
    await expect(within(canvasElement).queryByRole('img')).toBeNull();
    await expect(shown[0]).toHaveTextContent('Not a colour: “#zzz”');
    await expect(shown[1]).toHaveTextContent('Not a colour: “red”');
    await expect(shown[2]).toHaveTextContent('Not a colour: {"r":"a","g":0,"b":0}');
    await expect(shown[3]).toHaveTextContent('Not a colour: 42');
    await expect(textOf(shown[4]).textContent!.endsWith('…')).toBe(true);
    for (const value of shown) {
      await expect(value).toHaveAttribute('data-invalid', 'true');
      await expect(getComputedStyle(value).backgroundImage).toBe('none');
    }
  },
};

export const NoColour: Story = {
  args: { value: null },
  parameters: {
    docs: {
      description: {
        story: 'Renders a colour that holds nothing: it says No colour, with no swatch.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(values(canvasElement)[0]).toHaveTextContent('No colour');
    await expect(within(canvasElement).queryByRole('img')).toBeNull();
  },
};

export const Compact: Story = {
  args: { value: HALF_RED },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Labelled label='Compact' value={CORNFLOWER} compact />
      <Labelled label='Normal' value={CORNFLOWER} />
      <div className='narrow-summary' style={{ width: 120, border: '1px dashed #888', padding: 4 }}>
        <ReqraftColorValue value={HALF_RED} size='compact' />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact size, for a one-line summary (a form row, a table cell), above the normal size: a 12px swatch closer to its text. In a 120px box, the compact rgba(255, 0, 0, 0.5) keeps to one line and ends in an ellipsis, inside the box.',
      },
    },
  },
  async play({ canvasElement }) {
    const [compact, normal, narrow] = values(canvasElement);
    await expectColour(compact, '#6495ED', 'rgb(100, 149, 237)', 12);
    await expectColour(normal, '#6495ED', 'rgb(100, 149, 237)', 20);
    await expect(compact).toHaveAttribute('data-size', 'compact');
    await expectAsWideAsItsContent(compact);
    await expectAsWideAsItsContent(normal);
    const box = canvasElement
      .querySelector<HTMLElement>('.narrow-summary')!
      .getBoundingClientRect();
    const text = textOf(narrow);
    // one line, cut with an ellipsis, inside its box
    await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    await expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
    await expect(narrow.getBoundingClientRect().height).toBeLessThan(24);
    await expect(narrow.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
  },
};

export const OnAPhone: Story = {
  tags: ['touch'],
  args: { value: CORNFLOWER },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <Labelled label='A colour' value={CORNFLOWER} />
      <Labelled label='See-through' value={HALF_RED} />
      <Labelled label='Compact' value={HALF_RED} compact />
      <Labelled label='Not a colour' value={NOT_COLOURS[4].value} />
    </div>
  ),
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders colours on a phone (390 px, touch): cornflower blue, a see-through red, the same red compact, and a long value that is not a colour. Each fits the screen: nothing reaches past its edge, the long value wraps, and each swatch is named for the colour it shows.',
      },
    },
  },
  async play({ canvasElement }) {
    const [colour, seeThrough, compact, invalid] = values(canvasElement);
    await expectColour(colour, '#6495ED', 'rgb(100, 149, 237)', 20);
    await expectColour(seeThrough, 'rgba(255, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.5)', 20);
    await expectColour(compact, 'rgba(255, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.5)', 12);
    await expect(invalid).toHaveAttribute('data-invalid', 'true');
    await expectAsWideAsItsContent(colour);
    await expectNothingPastTheEdge(canvasElement);
  },
};

export const OnALightTheme: Story = {
  args: { value: CORNFLOWER },
  decorators: [
    (Story) => (
      <LightTheme>
        <Story />
      </LightTheme>
    ),
  ],
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Labelled label='A colour' value={CORNFLOWER} />
      <Labelled label='White' value={{ r: 255, g: 255, b: 255 }} />
      <Labelled label='Not a colour' value='#zzz' />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Renders cornflower blue, white and a value that is not a colour on a light theme: the swatch's edge is drawn in the theme's text colour, so a white swatch still shows on a light page, and the text is the theme's.",
      },
    },
  },
  async play({ canvasElement }) {
    const [colour, white, invalid] = values(canvasElement);
    await waitFor(() => expectColour(white, '#FFFFFF', 'rgb(255, 255, 255)', 20));
    await expectAsWideAsItsContent(colour);
    // the edge is not white: it is a tint of the theme's dark text
    await expect(getComputedStyle(swatchOf(white)).borderTopColor).not.toBe('rgb(255, 255, 255)');
    await expect(getComputedStyle(invalid).color).not.toBe('rgb(255, 255, 255)');
  },
};

export const InAControlGroup: Story = {
  args: { value: CORNFLOWER },
  render: () => (
    <ReqoreControlGroup fluid spaceBetween size='small' className='colour-group'>
      <ReqoreTag label='Brand colour' />
      <ReqraftColorValue value={CORNFLOWER} />
      <ReqraftColorValue value={HALF_RED} size='compact' />
    </ReqoreControlGroup>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Renders two colours in a control group beside a tag, as a page's table of options shows them: the group hands each its layout props (fluid, spaceBetween, its small size), and the colours take none of them onto the DOM - React gives no warning - and draw at their own sizes, normal (the group's small is not one of theirs) and compact.",
      },
    },
  },
  async play({ canvasElement }) {
    const [normal, compact] = values(canvasElement);
    await expectColour(normal, '#6495ED', 'rgb(100, 149, 237)', 20);
    await expectColour(compact, 'rgba(255, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.5)', 12);
    for (const value of [normal, compact]) {
      for (const name of ['fluid', 'spacebetween', 'size', 'intent', 'customtheme']) {
        await expect(value).not.toHaveAttribute(name);
      }
    }
  },
};
