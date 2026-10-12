import { StoryObj } from '@storybook/react-vite';
import { rgbaToHsva } from '@uiw/color-convert';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { _testsWithViewport } from '../../../../stories/Tests/utils';
import { withTouchScreen } from '../../../../stories/touchScreen';
import { LightTheme, PHONE_VIEWPORT } from '../../../../stories/tracking';
import { StoryMeta } from '../../../../types';
import { ColorFormField, IColorFormFieldValue, TAP_TARGET_PX } from './Color';

const meta = {
  component: ColorFormField,
  title: 'Components/Form/Color',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ColorFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ColorFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

type TField = 'hex' | 'r' | 'g' | 'b' | 'a';

const field = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field')!;
const input = (canvasElement: HTMLElement, name: TField) =>
  canvasElement.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)!;
const swatch = (canvasElement: HTMLElement, color: string) =>
  canvasElement.querySelector<HTMLElement>(`.reqraft-color-field-swatch[data-color="${color}"]`)!;
const preview = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field-preview')!;
const problem = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field-problem')!;
const square = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.w-color-saturation')!;
const hueBar = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field-hue')!;
const alphaBar = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field-alpha')!;
const helpToggle = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field-help-toggle')!;

/** The colour the preview paints, over its checkerboard. */
const previewPaint = (canvasElement: HTMLElement) =>
  getComputedStyle(preview(canvasElement), '::after').backgroundColor;

/** The colour the field last stored. */
const lastStored = (onChange: unknown) =>
  (onChange as ReturnType<typeof fn>).mock.lastCall?.[0] as Required<IColorFormFieldValue>;

/** Every colour the field stored is one: whole channels from 0 to 255, alpha from 0 to 1. */
const expectOnlyColorsStored = (onChange: unknown) => {
  for (const [color] of (onChange as ReturnType<typeof fn>).mock.calls as [IColorFormFieldValue][]) {
    for (const channel of [color.r, color.g, color.b]) {
      expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true);
    }
    expect(color.a! >= 0 && color.a! <= 1).toBe(true);
  }
};

const CORNFLOWER = { r: 100, g: 149, b: 237, a: 1 };

export const WithValue: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue chosen: the colour square, a preview of the colour beside the colour bar, the labelled Hex code, Red, Green and Blue inputs (6495ED; 100, 149, 237), "What do these mean?" and the swatches.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(square(canvasElement)).toBeInTheDocument();
    await expect(canvas.getByLabelText('Hex code')).toHaveValue('6495ED');
    await expect(canvas.getByLabelText('Red')).toHaveValue('100');
    await expect(canvas.getByLabelText('Green')).toHaveValue('149');
    await expect(canvas.getByLabelText('Blue')).toHaveValue('237');
    // no transparency offered, so no opacity
    await expect(canvas.queryByLabelText('Opacity %')).toBeNull();
    await expect(canvas.getByRole('img', { name: 'Chosen colour: #6495ED' })).toBe(preview(canvasElement));
    await expect(previewPaint(canvasElement)).toBe('rgb(100, 149, 237)');
    await expect(canvas.getByRole('button', { name: /What do these mean/ })).toBeVisible();
  },
};

export const Red: Story = {
  args: {
    value: { r: 220, g: 53, b: 69, a: 1 },
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the Color field with red chosen (DC3545): the preview is red.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(input(canvasElement, 'hex').value).toBe('DC3545');
    await expect(previewPaint(canvasElement)).toBe('rgb(220, 53, 69)');
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with no colour stored: the picker opens on its starting colour, the preview is struck through (no colour chosen yet), and nothing is stored until a colour is chosen.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'No colour chosen yet' })).toBe(preview(canvasElement));
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const WrittenAsHex: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue. When DC3545 is written into Hex code, the field stores red as { r: 220, g: 53, b: 69, a: 1 }, and the picker and the preview move to it.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const hex = input(canvasElement, 'hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, 'DC3545');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 })
    );
    await waitFor(() => expect(previewPaint(canvasElement)).toBe('rgb(220, 53, 69)'));
  },
};

export const ChosenFromASwatch: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue. When the dark green swatch (#417505) is clicked, the field stores it as { r: 65, g: 117, b: 5, a: 1 } and the swatch shows it is the chosen one.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await userEvent.click(swatch(canvasElement, '#417505'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 65, g: 117, b: 5, a: 1 })
    );
    await expect(input(canvasElement, 'hex').value).toBe('417505');
    await expect(swatch(canvasElement, '#417505')).toHaveAttribute('aria-pressed', 'true');
  },
};

export const WithTransparency: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 0.5 },
    disableAlpha: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with transparency offered: cornflower blue at 50%, the opacity bar under the colour bar, an Opacity % input after Red, Green and Blue, and the preview showing its checkerboard through the colour.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(alphaBar(canvasElement)).toBeInTheDocument();
    await expect(canvas.getByLabelText('Opacity %')).toHaveValue('50');
    await expect(
      canvas.getByRole('img', { name: 'Chosen colour: #6495ED, 50% opaque' })
    ).toBeInTheDocument();
    await expect(previewPaint(canvasElement)).toBe('rgba(100, 149, 237, 0.5)');
    // the checkerboard under it
    await expect(getComputedStyle(preview(canvasElement)).backgroundImage).toContain('url(');
  },
};

export const HelpExplainsTheControls: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 0.5 },
    disableAlpha: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with transparency and its help open. "What do these mean?" says in plain words what the square and the colour bar do, what a hex code is, what Red, Green and Blue are (0 to 255), and what Opacity is (0% to 100%); clicked again it hides the help, and clicked a third time it shows it again.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: /What do these mean/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const help = canvasElement.querySelector<HTMLElement>('.reqraft-color-field-help')!;
    await expect(help).toBeVisible();
    await expect(help).toHaveTextContent('six characters, each 0–9 or A–F');
    await expect(help).toHaveTextContent('each from 0 (none) to 255 (all)');
    await expect(help).toHaveTextContent('from 0% (you see through it) to 100% (solid)');
    await expect(help).toHaveTextContent('the rainbow bar under it sets the colour itself');
    await expect(toggle).toHaveAttribute('aria-controls', help.id);
    await userEvent.click(toggle);
    await expect(canvasElement.querySelector('.reqraft-color-field-help')).toBeNull();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // open again, so the capture shows the help
    await userEvent.click(toggle);
    await expect(canvasElement.querySelector('.reqraft-color-field-help')).toBeVisible();
  },
};

export const HexTakesOnlyAHexCode: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue. A character that cannot be in a hex code ("G") is not typed, and the field says why; DC3545 is stored as red. A code too short ("64") is not stored: on leaving the field it says why and shows the colour again. Three characters are short for six: F80 is stored as FF8800.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const hex = input(canvasElement, 'hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, 'DC3');
    await userEvent.type(hex, 'G');
    await expect(hex.value).toBe('DC3');
    await waitFor(() =>
      expect(problem(canvasElement)).toHaveTextContent(
        '“G” cannot be in a hex code: use the digits 0–9 and the letters A–F.'
      )
    );
    await userEvent.type(hex, '545');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 })
    );
    await expect(problem(canvasElement)).toHaveTextContent('');

    await userEvent.clear(hex);
    await userEvent.type(hex, '64');
    await userEvent.tab();
    await waitFor(() =>
      expect(problem(canvasElement)).toHaveTextContent(
        '“64” is not a colour: a hex code has six characters (or three, short for six).'
      )
    );
    await expect(hex.value).toBe('DC3545');
    await expect(args.onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 });

    await userEvent.clear(hex);
    await userEvent.type(hex, '#f80');
    await userEvent.tab();
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 255, g: 136, b: 0, a: 1 })
    );
    await expect(hex.value).toBe('FF8800');
    expectOnlyColorsStored(args.onChange);
  },
};

export const NumbersStayInTheirRange: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 0.5 },
    disableAlpha: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with transparency. Red takes 30 but not 300 ("Red goes from 0 to 255."): the field is marked and nothing is stored, and on leaving it shows 30 again. A letter is not typed into Green. Opacity goes from 0 to 100, left empty it shows its value again, and the arrow keys step it. No colour stored is ever outside its range.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const red = input(canvasElement, 'r');
    await userEvent.clear(red);
    await userEvent.type(red, '30');
    await waitFor(() => expect(lastStored(args.onChange)).toMatchObject({ r: 30 }));
    await userEvent.type(red, '0');
    await waitFor(() => expect(problem(canvasElement)).toHaveTextContent('Red goes from 0 to 255.'));
    await expect(red).toHaveAttribute('aria-invalid', 'true');
    await expect(red.getAttribute('aria-describedby')).toBe(problem(canvasElement).id);
    await expect(lastStored(args.onChange)).toMatchObject({ r: 30 });
    await userEvent.tab();
    await waitFor(() => expect(red.value).toBe('30'));
    await expect(red).not.toHaveAttribute('aria-invalid');

    const green = input(canvasElement, 'g');
    await userEvent.type(green, 'x');
    await expect(green.value).toBe('149');
    await waitFor(() =>
      expect(problem(canvasElement)).toHaveTextContent('“x” cannot be in Green: type a whole number.')
    );

    const opacity = input(canvasElement, 'a');
    await userEvent.clear(opacity);
    await userEvent.type(opacity, '150');
    await waitFor(() =>
      expect(problem(canvasElement)).toHaveTextContent('Opacity goes from 0 to 100.')
    );
    await userEvent.clear(opacity);
    await userEvent.tab();
    await waitFor(() =>
      expect(problem(canvasElement)).toHaveTextContent(
        'Opacity needs a whole number from 0 to 100.'
      )
    );
    await expect(opacity.value).toBe('15');
    await expect(lastStored(args.onChange)).toMatchObject({ r: 30, a: 0.15 });

    await userEvent.click(opacity);
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(lastStored(args.onChange)).toMatchObject({ a: 0.16 }));
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await waitFor(() => expect(lastStored(args.onChange)).toMatchObject({ a: 0.06 }));
    expectOnlyColorsStored(args.onChange);
  },
};

export const Disabled: Story = {
  args: {
    value: CORNFLOWER,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field disabled: the picker is dimmed, and nothing in it can be reached by pointer or keyboard, so writing a colour into Hex code stores nothing.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await expect(field(canvasElement).inert).toBe(true);
    await expect(field(canvasElement)).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(input(canvasElement, 'hex'), 'DC3545');
    await expect(input(canvasElement, 'hex').value).toBe('6495ED');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  args: {
    value: CORNFLOWER,
    readOnly: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field read-only: the colour and its preview are shown at full strength, and nothing in the picker can be reached, so writing a colour into Hex code stores nothing.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await expect(field(canvasElement).inert).toBe(true);
    await userEvent.type(input(canvasElement, 'hex'), 'DC3545');
    await expect(input(canvasElement, 'hex').value).toBe('6495ED');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const OnALightTheme: Story = {
  args: {
    value: CORNFLOWER,
  },
  decorators: [
    (Story) => (
      <LightTheme>
        <Story />
      </LightTheme>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue on a light theme: the labels and the input text are dark, as the theme reads.',
      },
    },
  },
  async play({ canvasElement }) {
    // the theme's dark text, not the light text of the dark preview
    await waitFor(() =>
      expect(getComputedStyle(input(canvasElement, 'hex')).color).not.toBe('rgb(255, 255, 255)')
    );
    await expect(
      getComputedStyle(canvasElement.querySelector('label[for]')!).color
    ).not.toMatch(/^rgba?\(255, 255, 255/);
  },
};

/** Every target a finger needs is a finger's size, and nothing reaches past the field's edge. */
const expectFingerSized = (canvasElement: HTMLElement, narrowed: boolean) => {
  const root = field(canvasElement).getBoundingClientRect();
  const targets = [
    hueBar(canvasElement),
    ...(alphaBar(canvasElement) ? [alphaBar(canvasElement)] : []),
    helpToggle(canvasElement),
    ...canvasElement.querySelectorAll<HTMLElement>('.reqraft-color-field input'),
  ];
  for (const target of targets) {
    expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(TAP_TARGET_PX);
  }
  expect(preview(canvasElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(TAP_TARGET_PX);
  const swatches = canvasElement.querySelectorAll<HTMLElement>('.reqraft-color-field-swatch');
  expect(swatches.length).toBeGreaterThan(0);
  for (const control of [...targets, ...swatches]) {
    const box = control.getBoundingClientRect();
    if (control.classList.contains('reqraft-color-field-swatch')) {
      expect(box.width).toBeGreaterThanOrEqual(TAP_TARGET_PX);
      expect(box.height).toBeGreaterThanOrEqual(TAP_TARGET_PX);
    }
    if (narrowed) {
      expect(box.right).toBeLessThanOrEqual(root.right + 0.5);
    }
  }
};

export const OnATouchScreen: Story = {
  args: {
    value: CORNFLOWER,
  },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          "Renders the Color field on a phone (390 px, touch): the colour bar, the inputs, the help and the swatches are a finger's size and stay inside the field. A finger dragged across the colour square and along the colour bar picks the colour, a tapped swatch is stored, and a tap on \"What do these mean?\" shows the help.",
      },
    },
  },
  async play({ canvasElement, args }) {
    await withTouchScreen(async (touch) => {
      if (touch.real) {
        // the browser is a touch screen, not one that only says so
        await waitFor(() => expect(window.matchMedia('(hover: none)').matches).toBe(true));
      }
      await waitFor(() => expectFingerSized(canvasElement, touch.narrowed));

      // across the colour square, to a quarter of its strength and three quarters of its brightness
      const area = square(canvasElement);
      await touch.drag(touch.pointIn(area, 0.8, 0.2), touch.pointIn(area, 0.25, 0.25));
      await waitFor(() => {
        const hsv = rgbaToHsva(lastStored(args.onChange));
        expect(Math.abs(hsv.s - 25)).toBeLessThan(4);
        expect(Math.abs(hsv.v - 75)).toBeLessThan(4);
        expect(Math.abs(hsv.h - 219)).toBeLessThan(4);
      });

      // along the colour bar, to its middle: cyan's hue
      const bar = hueBar(canvasElement);
      await touch.drag(touch.pointIn(bar, 0.6), touch.pointIn(bar, 0.5));
      await waitFor(() => expect(Math.abs(rgbaToHsva(lastStored(args.onChange)).h - 180)).toBeLessThan(4));

      await touch.tap(swatch(canvasElement, '#417505'));
      await waitFor(() =>
        expect(args.onChange).toHaveBeenLastCalledWith({ r: 65, g: 117, b: 5, a: 1 })
      );

      await touch.tap(helpToggle(canvasElement));
      await waitFor(() =>
        expect(canvasElement.querySelector('.reqraft-color-field-help')).toBeVisible()
      );
      if (touch.narrowed) {
        await waitFor(() =>
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
        );
      }
      expectOnlyColorsStored(args.onChange);
    });
  },
};

export const WithTransparencyOnATouchScreen: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 0.5 },
    disableAlpha: false,
  },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          "Renders the Color field with transparency on a phone (390 px, touch): the opacity bar is a finger's height, and a finger dragged along it to a quarter stores the colour about 25% opaque, as the Opacity % input then says.",
      },
    },
  },
  async play({ canvasElement, args }) {
    await withTouchScreen(async (touch) => {
      await waitFor(() => expectFingerSized(canvasElement, touch.narrowed));
      const bar = alphaBar(canvasElement);
      await touch.drag(touch.pointIn(bar, 0.5), touch.pointIn(bar, 0.25));
      await waitFor(() => expect(Math.abs(lastStored(args.onChange).a - 0.25)).toBeLessThan(0.04));
      await waitFor(() =>
        expect(input(canvasElement, 'a').value).toBe(String(Math.round(lastStored(args.onChange).a * 100)))
      );
      expectOnlyColorsStored(args.onChange);
    });
  },
};

export const InvalidEntryOnAPhone: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the Color field on a phone (390 px) after 999 is typed into Red: Red is marked, "Red goes from 0 to 255." is shown under the inputs, inside the field, and nothing is stored.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await _testsWithViewport(PHONE_VIEWPORT.width, PHONE_VIEWPORT.height, async (narrowed) => {
      const red = input(canvasElement, 'r');
      await userEvent.clear(red);
      await userEvent.type(red, '999');
      await waitFor(() => expect(problem(canvasElement)).toHaveTextContent('Red goes from 0 to 255.'));
      await expect(red).toHaveAttribute('aria-invalid', 'true');
      if (narrowed) {
        const box = problem(canvasElement).getBoundingClientRect();
        await expect(box.right).toBeLessThanOrEqual(field(canvasElement).getBoundingClientRect().right + 0.5);
        await waitFor(() =>
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
        );
      }
      expectOnlyColorsStored(args.onChange);
      await expect(args.onChange).not.toHaveBeenCalledWith(expect.objectContaining({ r: 999 }));
    });
  },
};
