import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import {
  _testsClickText,
  _testsWaitForText,
  _testsWaitForTextToNotExist,
  _testsWithViewport,
} from '../../../stories/Tests/utils';
import {
  FormEngine,
  IFormEngineGroup,
  IFormEngineProps,
  IOptions,
  IOptionsSchemaArg,
} from './FormEngine';
import { CALM_REQUIRED_LABEL, CALM_REQUIRED_READ_LABEL } from './formAppearance';

/*
 * The calm appearance against the default one, over the fields a workflow
 * creator actually serves (display names, groups and descriptions as the Qorus
 * server's workflow metadata gives them), so the comparison is about the look
 * and nothing else.
 */

const groups: Record<string, IFormEngineGroup> = {
  info: { label: 'Info', sort: 1 },
  resources: { label: 'Resources', sort: 2 },
  scaling: { label: 'Scaling', sort: 3 },
  business: { label: 'Business', sort: 4 },
};

// `group` is server-supplied metadata not yet in the typed schema; widen locally.
type TAppearanceField = IOptionsSchemaArg & { group?: string };

const options: Record<string, TAppearanceField> = {
  name: {
    type: 'string',
    display_name: 'Internal Name',
    short_desc: 'The internal technical name of the object',
    group: 'info',
    preselected: true,
  },
  display_name: {
    type: 'string',
    display_name: 'Name',
    short_desc: 'The display name of the object',
    required: true,
    group: 'info',
  },
  desc: {
    type: 'long-string',
    display_name: 'Description',
    short_desc: 'The markdown description of the object',
    required: true,
    group: 'info',
  },
  version: {
    type: 'string',
    display_name: 'Version',
    short_desc: 'The object’s version',
    required: true,
    group: 'info',
  },
  lang: {
    type: 'string',
    display_name: 'Language',
    required: true,
    group: 'info',
    messages: [
      {
        intent: 'info',
        content: 'Changing the language later generates a new source skeleton.',
      },
    ],
    allowed_values: [
      { value: { type: 'string', value: 'qore' }, display_name: 'Qore' },
      { value: { type: 'string', value: 'python' }, display_name: 'Python' },
      { value: { type: 'string', value: 'java' }, display_name: 'Java' },
    ],
  },
  classes: {
    type: 'string',
    display_name: 'Classes',
    short_desc: 'Any classes used by the object',
    group: 'resources',
    preselected: true,
  },
  autostart: {
    type: 'int',
    display_name: 'Autostart',
    short_desc: 'The number of execution instances started automatically for the workflow',
    group: 'scaling',
    preselected: true,
  },
  max_instances: {
    type: 'int',
    display_name: 'Maximum Instances',
    short_desc: 'The maximum number of workflow execution instances that can be started',
    group: 'scaling',
    preselected: true,
  },
  remote: {
    type: 'bool',
    display_name: 'Remote?',
    short_desc: 'Should this interface run in a dedicated process?',
    group: 'scaling',
    preselected: true,
  },
  business_category: {
    type: 'string',
    display_name: 'Business Category',
    short_desc: 'Automation intelligence category for this interface',
    group: 'business',
    preselected: true,
  },
  author: {
    type: 'string',
    display_name: 'Author',
    short_desc: 'The author of the object',
    group: 'info',
  },
  sla_threshold: {
    type: 'int',
    display_name: 'SLA Threshold',
    short_desc: 'The time in seconds before which workflow orders should get a final status',
    group: 'scaling',
  },
};

const filledValue: IOptions = {
  name: { type: 'string', value: 'supplier-payment-release' },
  display_name: { type: 'string', value: 'Supplier Payment Release' },
  desc: {
    type: 'long-string',
    value: 'Reconciles inbound orders with supplier confirmations and payment holds before release.',
  },
  version: { type: 'string', value: '1.0' },
  lang: { type: 'string', value: 'qore' },
  classes: { type: 'string', value: 'SupplyChainReconciler' },
  autostart: { type: 'int', value: 1 },
  max_instances: { type: 'int', value: 20 },
  remote: { type: 'bool', value: false },
  business_category: { type: 'string', value: 'Supply Chain' },
};

const newFormValue: IOptions = {
  lang: { type: 'string', value: 'qore' },
};

const meta: Meta<typeof FormEngine> = {
  component: FormEngine,
  title: 'Form/Engine/FormEngine Appearance',
  args: {
    name: 'workflow',
    compact: true,
    options,
    groups,
    value: filledValue,
    onChange: fn(),
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: ({ value, onChange, ...rest }: IFormEngineProps) => {
    const [val, setValue] = useState(value);

    return (
      <div
        style={{
          padding: '24px 16px',
          width: '100%',
          maxWidth: 1040,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <FormEngine
          {...rest}
          value={val}
          onChange={(name, next, info) => {
            setValue(next);
            onChange?.(name, next, info);
          }}
        />
      </div>
    );
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------------------------------------------------
 * Measurements the calm look depends on
 * ------------------------------------------------------------------------ */

const rgbOf = (color: string): number[] =>
  (color.match(/[\d.]+/g) || []).slice(0, 3).map((channel) => Number(channel));

/** Amber: red well above blue (the warning colour), as opposed to a quiet grey. */
const isAmber = (color: string): boolean => {
  const [r, , b] = rgbOf(color);
  return r - b > 60;
};

/** A grey: no channel more than a few steps from the others. */
const isGrey = (color: string): boolean => {
  const [r, g, b] = rgbOf(color);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8;
};

const box = (key: 'attention' | 'set' | 'optional'): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('.options-readfirst-group')].find((element) => {
    const heading = element.querySelector('.reqore-panel-title')?.textContent ?? '';
    // The first box is "To fill in" until something in it is a fault (a new form).
    return key === 'attention' ? /^(Needs attention|To fill in)/.test(heading)
      : heading.startsWith(key === 'set' ? 'Set' : 'Optional');
  });

const row = (field: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.readfirst-row[data-field="${field}"]`);

/** The section is a plain panel: a grey surface, a grey edge, and no tint. */
const expectCalmSection = (element: HTMLElement | undefined) => {
  expect(element).toBeTruthy();
  const style = getComputedStyle(element!);
  expect(isGrey(style.backgroundColor)).toBe(true);
  expect(style.backgroundImage).toBe('none');
  expect(isGrey(style.borderTopColor)).toBe(true);
  expect(Number.parseFloat(style.borderTopWidth)).toBe(1);
  // The count is a quiet number, not a tag.
  expect(element!.querySelector('.reqore-panel-title .reqore-tag')).toBeNull();
  expect(element!.querySelector('.options-readfirst-group-count')).toBeTruthy();
};

const expectNoUppercase = (selector: string) => {
  const elements = [...document.querySelectorAll<HTMLElement>(selector)];
  expect(elements.length).toBeGreaterThan(0);
  for (const element of elements) {
    expect(getComputedStyle(element).textTransform).not.toBe('uppercase');
  }
};

/** No status dot on a row that is filled and fine. */
const expectNoDot = (field: string) => {
  expect(row(field)).toBeTruthy();
  expect(row(field)!.querySelector('.options-readfirst-status-dot')).toBeNull();
};

/* --------------------------------------------------------------------------
 * Stories
 * ------------------------------------------------------------------------ */

export const DefaultLook: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The default appearance over a filled workflow form, for comparison with **Calm**: tinted Set box, a green Ready and meter, a green dot on every filled row, upper-case group labels and a red/green Yes/No chip.',
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Supplier Payment Release');
    // The default look is untouched: the tinted box and its count tag.
    await waitFor(() => expect(box('set')).toBeTruthy());
    expect(box('set')!.querySelector('.reqore-panel-title .reqore-tag')).toBeTruthy();
    expect(row('display_name')!.querySelector('.options-readfirst-status-dot')).toBeTruthy();
  },
};

export const Calm: Story = {
  args: {
    appearance: 'calm',
  },
  parameters: {
    docs: {
      description: {
        story:
          '`appearance="calm"` over the same filled form: the sections are plain panels on the theme’s panel surface with label/value rows split by hairlines, labels grey, group headings in sentence case, the count a quiet number, no dot on a healthy row, No as a word, and a short meter whose done part is grey.',
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Supplier Payment Release');
    await waitFor(() => expect(box('set')).toBeTruthy());

    // Sections are calm panels — no green tint, no recessed Optional box.
    expectCalmSection(box('set'));
    expectCalmSection(box('optional'));
    expect(getComputedStyle(box('optional')!).backgroundColor).toBe(
      getComputedStyle(box('set')!).backgroundColor
    );

    // Rows are split by one full-width hairline each, and there is no gap
    // between them.
    const rows = [...box('set')!.querySelectorAll<HTMLElement>('.readfirst-row')];
    expect(rows.length).toBeGreaterThan(4);
    const second = rows[2];
    expect(Number.parseFloat(getComputedStyle(second).borderTopWidth)).toBe(1);

    // Sentence case everywhere, grey labels.
    expectNoUppercase('.options-readfirst-group-label');
    expect(document.querySelector('.options-readfirst-group-label')?.textContent).toBe('Info');
    const label = row('display_name')!.querySelector<HTMLElement>('.options-readfirst-label-text')!;
    const value = row('display_name')!.querySelector<HTMLElement>('.options-readfirst-valuetext')!;
    expect(getComputedStyle(label).color).not.toBe(getComputedStyle(value).color);

    // The section's header label, its group headings and its rows' labels all
    // start on one left edge.
    const headerText = box('set')!
      .querySelector<HTMLElement>('.reqore-panel-title p')!
      .getBoundingClientRect().left;
    expect(Math.abs(headerText - label.getBoundingClientRect().left)).toBeLessThanOrEqual(1);
    const heading = document.querySelector<HTMLElement>('.options-readfirst-group-label')!;
    expect(
      Math.abs(
        heading.getBoundingClientRect().left +
          Number.parseFloat(getComputedStyle(heading).paddingLeft) -
          label.getBoundingClientRect().left
      )
    ).toBeLessThanOrEqual(1);

    // No dot on a filled row, no asterisk on a required one.
    expectNoDot('display_name');
    expectNoDot('version');
    expect(row('display_name')!.querySelectorAll('svg').length).toBe(0);

    // A note that only informs is not blue.
    const note = row('lang')!.querySelector<HTMLElement>('.options-readfirst-info-panel .reqore-message')!;
    expect(note).toBeTruthy();
    expect(isGrey(getComputedStyle(note).backgroundColor)).toBe(true);
    expect(isGrey(getComputedStyle(note).borderTopColor)).toBe(true);

    // Yes/No is a word, not a coloured chip.
    expect(row('remote')!.textContent).toContain('No');
    expect(row('remote')!.querySelector('.reqore-tag')).toBeNull();

    // The readiness line: the word in the text colour, the meter's done part grey.
    const status = document.querySelector<HTMLElement>('.options-readfirst-status')!;
    expect(status.textContent).toBe('Ready');
    expect(isGrey(getComputedStyle(status).color)).toBe(true);
    const bar = document.querySelector<HTMLElement>('.options-readfirst-completion-bar')!;
    expect(isGrey(getComputedStyle(bar, '::before').backgroundColor)).toBe(true);
    expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(361);
    expect(bar.getBoundingClientRect().height).toBe(4);
  },
};

export const CalmNeedsAttention: Story = {
  args: {
    appearance: 'calm',
    value: newFormValue,
    // After a submit attempt: every empty required field is now a fault. A form nobody
    // has been to yet reads "To fill in" instead (CalmNewForm).
    revealRequired: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A form after a submit attempt (`revealRequired`) in the calm look: the Needs attention section carries one amber dot and a word, each empty required field says **Required · add a value** in amber where its value would be (no red asterisk, no red message), and only the outstanding part of the meter is coloured. Opening a required field shows the same words under the editor as plain amber text.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(box('attention')).toBeTruthy(), { timeout: 10000 });
    expectCalmSection(box('attention'));
    expect(box('attention')!.querySelector('.options-readfirst-group-dot')).toBeTruthy();

    // The missing values are amber words in the value column.
    await waitFor(() =>
      expect(
        [...document.querySelectorAll('.options-readfirst-valuetext')].filter(
          (element) => element.textContent === CALM_REQUIRED_LABEL
        ).length
      ).toBe(3)
    );
    await _testsWaitForTextToNotExist('This field is required');
    const word = row('display_name')!.querySelector<HTMLElement>('.options-readfirst-valuetext')!;
    expect(isGrey(getComputedStyle(word).color)).toBe(false);
    expect(getComputedStyle(word).fontStyle).toBe('normal');
    // The amber word is the row's one signal: no dot beside it.
    expectNoDot('display_name');

    // Only the outstanding part of the readiness line is coloured.
    const status = document.querySelector<HTMLElement>('.options-readfirst-status')!;
    expect(status.textContent).toBe('Incomplete');
    expect(isGrey(getComputedStyle(status).color)).toBe(true);
    const link = document.querySelector<HTMLElement>('.options-readfirst-attention-link')!;
    expect(isGrey(getComputedStyle(link).color)).toBe(false);

    // Inside an open required field the requirement is plain amber text.
    await _testsClickText('Name');
    await waitFor(() =>
      expect(document.querySelector('.options-field-message')?.textContent).toBe(
        CALM_REQUIRED_LABEL
      )
    );
    expect(document.querySelector('.options-field-message')?.closest('.reqore-tag')).toBeNull();
  },
};

export const CalmChoiceHeading: Story = {
  args: {
    appearance: 'calm',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A choice field opened in the calm look: its three choices are headed by the field’s name as written (“Language:”), not an upper-case micro label.',
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Supplier Payment Release');
    await _testsClickText('Qore');
    await waitFor(() =>
      expect(document.querySelector('.reqraft-choice-group-heading')).toBeTruthy()
    );
    expectNoUppercase('.reqraft-choice-group-heading');
  },
};

export const CalmReadOnly: Story = {
  args: {
    appearance: 'calm',
    readOnly: true,
    value: { ...filledValue, version: { type: 'string', value: '' } },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The calm look in read mode: one list of label/value rows split by hairlines, flush with the host’s edge and with no card of its own (a read view usually sits in one already); an unset required value reads **Required · not set**, because a reader cannot add it.',
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Supplier Payment Release');
    expect(document.querySelector('.options-readfirst-group')).toBeNull();
    const first = document.querySelector<HTMLElement>('.readfirst-read-list > *')!;
    expect(Number.parseFloat(getComputedStyle(first).borderTopWidth)).toBe(0);
    expect(Number.parseFloat(getComputedStyle(row('display_name')!).borderTopWidth)).toBe(1);
    expect(document.querySelectorAll('.options-readfirst-status-dot').length).toBe(0);
    expect(row('version')!.textContent).toContain(CALM_REQUIRED_READ_LABEL);
    expect(row('remote')!.querySelector('.reqore-tag')).toBeNull();
  },
};

export const CalmNewForm: Story = {
  args: {
    appearance: 'calm',
    value: newFormValue,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A brand-new form in the calm look. A new form is not already wrong: its required fields are still to fill in, so the first section reads **To fill in** with no amber dot, each empty required field says **Required · add a value** in the quiet colour, and the readiness line says "3 to fill in". Opening a required field and leaving it empty makes it a fault: the section becomes **Needs attention**, with its amber dot, that field\'s words turn amber, and the readiness line says "1 need attention · 2 to fill in".',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(box('attention')).toBeTruthy(), { timeout: 10000 });
    const heading = () => box('attention')!.querySelector('.reqore-panel-title')!.textContent ?? '';
    expect(heading()).toContain('To fill in');
    expect(box('attention')!.querySelector('.options-readfirst-group-dot')).toBeNull();
    const word = () =>
      row('display_name')!.querySelector<HTMLElement>('.options-readfirst-valuetext')!;
    await waitFor(() => expect(word().textContent).toBe(CALM_REQUIRED_LABEL));
    expect(isAmber(getComputedStyle(word()).color)).toBe(false);
    const link = document.querySelector<HTMLElement>('.options-readfirst-attention-link')!;
    expect(link.textContent).toContain('to fill in');
    expect(isAmber(getComputedStyle(link).color)).toBe(false);

    // Open Name, then open another field: Name has been visited and left empty.
    await _testsClickText('Name');
    await _testsClickText('Version');
    await waitFor(() => expect(heading()).toContain('Needs attention'));
    // Only the visited field is a fault; the other two are still to fill in.
    const line = document.querySelector<HTMLElement>('.options-readfirst-completion')!.textContent;
    expect(line).toContain('1 need attention');
    expect(line).toContain('2 to fill in');
    expect(box('attention')!.querySelector('.options-readfirst-group-dot')).toBeTruthy();
    await waitFor(() => expect(isAmber(getComputedStyle(word()).color)).toBe(true));
  },
};

export const CalmOnAPhone: Story = {
  args: {
    appearance: 'calm',
    value: newFormValue,
  },
  parameters: {
    qlip: { viewport: { width: 390, height: 844 } },
    docs: {
      description: {
        story:
          'The calm look on a 390px phone: the readiness meter wraps under its words, each row stacks its value under its name inside the section, and nothing scrolls sideways.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await _testsWithViewport(390, 844, async (narrowed) => {
      await waitFor(() => expect(box('attention')).toBeTruthy(), { timeout: 10000 });
      if (!narrowed) return;
      await waitFor(() =>
        expect(document.querySelector('.readfirst-narrow')).toBeTruthy()
      );
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth
      );
      const section = box('attention')!.getBoundingClientRect();
      for (const element of canvasElement.querySelectorAll<HTMLElement>(
        '.options-readfirst-group .readfirst-row'
      )) {
        const rect = element.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(section.left - 1);
        expect(rect.right).toBeLessThanOrEqual(section.right + 1);
      }
    });
  },
};
