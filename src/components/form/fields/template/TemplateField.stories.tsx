// Ported from qorus-ide `src/stories/Fields/Template.stories.tsx`
// (FIELD_STACK_REPORT batch). Adaptations, per the builder-stories pattern:
// - offline fixtures: `__fixtures__/templates.json` + `multiLevelTemplates.json`
//   copied verbatim from the IDE's `stories/Data`;
// - the IDE's `_tests*` helpers are inlined with `@storybook/test` primitives;
// - the expression catalogue for the function stories is `mockExpressions`
//   plus local `substr` / `PLUS-INT` entries (the IDE relies on the live
//   server catalogue) passed via the `expressions` prop;
// - the IDE's leaf story components (`LongStringField`, `Number`, `string`)
//   are local 2-arg wrappers over reqraft's leaf fields, `auto` is the ported
//   `AutoFormField`.
import { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { buildTemplates } from '../../../../helpers/templates';
import { mockExpressions } from '../../expressions/mockExpressions';
import { IExpressionSchema } from '../../expressions/types';
import { AutoFormField as auto } from '../auto/AutoFormField';
import LongStringFormField from '../long-string/LongString';
import NumberFormField from '../number/Number';
import { StringFormField } from '../string/String';
import { TemplateField } from './TemplateField';
import multiLevelTemplates from './__fixtures__/multiLevelTemplates.json';
import templates from './__fixtures__/templates.json';

// --- IDE leaf story components (2-arg field API over reqraft leafs) ---------

/* eslint-disable @typescript-eslint/no-unused-vars */
const LongStringField = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <LongStringFormField {...rest} onChange={(value: string) => onChange?.(name, value)} />
);
const Number = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <NumberFormField {...rest} onChange={(value: number | string) => onChange?.(name, value)} />
);
const string = ({ name, onChange, type, level, allowTemplates, ...rest }: any) => (
  <StringFormField {...rest} onChange={(value: string) => onChange?.(name, value)} />
);
/* eslint-enable @typescript-eslint/no-unused-vars */

// --- expression catalogue for the function stories ---------------------------
// `substr` / `PLUS-INT` match the server schema shape used by the IDE stories.

const storyExpressions: IExpressionSchema[] = [
  ...mockExpressions,
  {
    name: 'substr',
    display_name: 'Substring',
    short_desc: 'Returns a substring of the given string',
    desc: 'Returns a substring of the given string from the start position with the given length.',
    symbol: 'substr',
    type: 1,
    subtype: 1,
    return_type: 'string',
    ui_return_type: 'string',
    varargs: false,
    groups: ['String'],
    args: [
      { name: 'softstring', display_name: 'String', ui_type: 'richtext', required: true },
      { name: 'int', display_name: 'Start', ui_type: 'int', required: true },
      { name: 'int', display_name: 'Length', ui_type: 'int', required: false },
    ],
  } as IExpressionSchema,
  {
    name: 'PLUS-INT',
    display_name: 'Plus',
    short_desc: 'Adds two integers',
    desc: 'Adds two integers.',
    symbol: '+',
    type: 1,
    subtype: 1,
    return_type: 'int',
    ui_return_type: 'int',
    varargs: false,
    groups: ['Math'],
    args: [
      { name: 'int', display_name: 'Value', ui_type: 'int', required: true },
      { name: 'int', display_name: 'Value', ui_type: 'int', required: true },
    ],
  } as IExpressionSchema,
];

// --- inlined test helpers (equivalents of the IDE `../Tests/utils`) ---------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function _testsClickButton({
  label,
  selector,
  nth = 0,
  wait = 7000,
  parent = '.reqore-button',
}: {
  label?: string;
  selector?: string;
  nth?: number;
  wait?: number;
  parent?: string;
}) {
  if (!label) {
    await waitFor(() => expect(document.querySelectorAll(selector)[nth]).toBeInTheDocument(), {
      timeout: wait,
    });
    await waitFor(() => expect(document.querySelectorAll(selector)[nth]).toBeEnabled(), {
      timeout: wait,
    });
    await userEvent.click(document.querySelectorAll(selector)[nth]);
  } else {
    await waitFor(() => expect(screen.queryAllByText(label, { selector })[nth]).toBeInTheDocument(), {
      timeout: wait,
    });
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth].closest(parent)).toBeEnabled(),
      { timeout: wait }
    );
    await userEvent.click(screen.queryAllByText(label, { selector })[nth]);
  }
}

async function _testsWaitForText(
  text: string | number | RegExp,
  selector?: string,
  nth: number = 1,
  exist: boolean = true
) {
  await waitFor(
    () => {
      const element = screen.queryAllByText(text, { selector })[nth - 1];

      if (!exist && !element) {
        return Promise.resolve();
      }

      return expect(element).toBeInTheDocument();
    },
    { timeout: 10000 }
  );
}

async function _testsWaitForTextToNotExist(text: string, selector?: string, nth: number = 1) {
  await _testsWaitForText(text, selector, nth, false);
}

async function _testsOpenTemplateMenu(nth: number = 1) {
  await _testsClickButton({ selector: '.template-more', nth: nth - 1 });
}

async function _testsSetTemplate(nth: number = 1) {
  await _testsOpenTemplateMenu(nth);
  await _testsClickButton({ selector: '.template-toggle' });
}

async function _testsOpenTemplates(nth: number = 1) {
  await waitFor(
    async () => {
      await expect(
        document.querySelectorAll('.template-selector.reqore-control')[nth - 1]
      ).toBeInTheDocument();
    },
    { timeout: 10000 }
  );

  // IDE-verbatim settle (stories/Tests/utils.ts): ReQore's textarea focus
  // handler needs a beat before the selector click lands — no deterministic
  // DOM signal to waitFor on.
  await sleep(1500);

  await _testsClickButton({
    selector: '.template-selector.reqore-control',
    wait: 15000,
    nth: nth - 1,
  });

  await waitFor(
    () => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(),
    { timeout: 10000 }
  );
}

// -----------------------------------------------------------------------------

const meta = {
  component: TemplateField,
  title: 'Components/Form/Template',
  args: {
    templates: buildTemplates(templates as any),
    onChange: fn(),
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <TemplateField
        {...args}
        value={value}
        onChange={(name, value) => {
          args.onChange(name, value);
          setValue(value);
        }}
      />
    );
  },
} as Meta<typeof TemplateField>;

export default meta;

export const StringComponent: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    value: 'Some string',
    type: 'string',
  },
};

export const BooleanComponent: StoryObj<typeof meta> = {
  args: {
    value: true,
    type: 'boolean',
    allowTemplates: true,
    componentFromType: true,
  },
};

export const NumberComponent: StoryObj<typeof meta> = {
  args: {
    value: 25,
    type: 'int',
    allowTemplates: true,
    componentFromType: true,
  },
};

export const AutoComponent: StoryObj<typeof meta> = {
  args: {
    defaultType: 'auto',
    allowTemplates: true,
    component: auto,
  },
};

export const AllowedValuesWithTemplate: StoryObj<typeof meta> = {
  args: {
    defaultType: 'string',
    allowTemplates: true,
    allowed_values: [
      {
        value: { type: 'string', value: 'Test' },
        display_name: 'Test',
      },
    ],
    component: auto,
  },
};

export const TemplateValue: StoryObj<typeof meta> = {
  args: {
    component: Number,
    type: 'int',
    value: '$local:id',
  },
};

export const ElementTypeInListShowsCorrectTemplates: StoryObj<typeof meta> = {
  args: {
    component: auto,
    defaultType: 'list',
    ui_element_type: 'number',
    display_name: 'Test',
    value: [
      { type: 'number', value: 1 },
      { type: 'number', value: 2 },
      { type: 'number', value: 3 },
    ],
  },
  play: async () => {
    await _testsClickButton({ label: 'Add new item for "Test"' });
    await _testsOpenTemplates();
    await _testsWaitForText('Interface ID');
  },
};

export const ShowsTemplatesList: StoryObj<typeof meta> = {
  ...TemplateValue,
  play: async () => {
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForString: StoryObj<typeof meta> = {
  ...StringComponent,
  play: async () => {
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForBoolean: StoryObj<typeof meta> = {
  ...BooleanComponent,
  play: async () => {
    await _testsSetTemplate();
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForNumber: StoryObj<typeof meta> = {
  ...NumberComponent,
  play: async () => {
    await _testsOpenTemplates();
  },
};

export const TemplateValueCanBeRemoved: StoryObj<typeof meta> = {
  args: {
    value: '$config:boolean',
    type: 'boolean',
    allowTemplates: true,
    componentFromType: true,
  },
  play: async () => {
    await expect(document.querySelector('.template-selector')).toBeInTheDocument();

    await fireEvent.click(document.querySelector('.template-remove'));

    await expect(document.querySelector('.reqore-checkbox')).toBeInTheDocument();
  },
};

export const TemplateWithFunctions: StoryObj<typeof meta> = {
  args: {
    allowFunctions: true,
    type: 'string',
    defaultType: 'string',
    component: auto,
    fixed: true,
    fluid: false,
    expressions: storyExpressions as any,
  },
  play: async () => {
    await _testsOpenTemplateMenu();
    await _testsWaitForText('Use Expression');
  },
};

export const TemplateWithFunctionValue: StoryObj<typeof meta> = {
  args: {
    allowFunctions: true,
    isFunction: true,
    value: {
      exp: 'substr',
      args: [
        { type: 'string', value: '$local:name' },
        { type: 'int', value: '$local:start' },
        { type: 'int', value: 10 },
      ],
    },
    type: 'string',
    defaultType: 'string',
    component: auto,
    fixed: true,
    fluid: false,
    expressions: storyExpressions as any,
  },
};

export const TemplateWithNestedFunctionValue: StoryObj<typeof meta> = {
  args: {
    allowFunctions: true,
    isFunction: true,
    value: {
      exp: 'substr',
      args: [
        { type: 'string', value: '$local:name' },
        {
          type: 'int',
          value: {
            exp: 'PLUS-INT',
            args: [
              { type: 'int', value: '$local:start' },
              { type: 'int', value: '5' },
            ],
          },
          is_expression: true,
        },
        { type: 'int', value: 10 },
      ],
    },
    type: 'string',
    defaultType: 'string',
    component: auto,
    fixed: true,
    fluid: false,
    expressions: storyExpressions as any,
  },
};

export const TemplateCanBeSelected: StoryObj<typeof meta> = {
  args: {
    type: 'string',
    defaultType: 'string',
    defaultInternalType: 'string',
  },
  play: async ({ canvasElement, ...rest }) => {
    const canvas = within(canvasElement);

    await ShowsTemplatesListForString.play({ canvasElement, ...rest });
    await _testsClickButton({ label: 'Interface ID' });

    await sleep(100);

    await expect(canvas.getByDisplayValue('$local:id')).toBeInTheDocument();
  },
};

export const ValueIsResetWhenChangingToCustom: StoryObj<typeof meta> = {
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <TemplateField
        {...args}
        value={value}
        onChange={(name, value) => {
          args.onChange(name, value);
          setValue(value);
        }}
      />
    );
  },
  args: {
    component: string,
    type: 'number',
    value: '$config:something',
    name: 'Test Field',
  },
  play: async ({ args }) => {
    await waitFor(
      async () => {
        await expect(document.querySelector('.template-selector')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    await fireEvent.click(document.querySelectorAll('.template-remove')[0]);
    await expect(args.onChange).toHaveBeenLastCalledWith('Test Field', undefined);
  },
};

export const TemplatesWithMultipleLevels: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    type: 'string',
    templates: buildTemplates(multiLevelTemplates as any),
  },
  play: async () => {
    await _testsOpenTemplates();
    await _testsClickButton({ label: 'Testing Hash' });
    await _testsWaitForText('Testing String Item');
    await _testsWaitForTextToNotExist('Testing Int Item');
  },
};

export const TemplatesWithMultipleLevelsAndHashField: StoryObj<typeof meta> = {
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <TemplateField
        {...args}
        value={value}
        onChange={(name, value) => {
          args.onChange(name, value);
          setValue(value);
        }}
      />
    );
  },
  args: {
    component: auto,
    type: 'hash',
    defaultType: 'hash',
    templates: buildTemplates(multiLevelTemplates as any),
  },
  play: async () => {
    await _testsSetTemplate();
    await _testsOpenTemplates();
  },
};

export const TemplateWithItemsCanBeSelected: StoryObj<typeof meta> = {
  ...TemplatesWithMultipleLevelsAndHashField,
  play: async (args) => {
    await TemplatesWithMultipleLevelsAndHashField.play(args);
    await _testsClickButton({ selector: '.reqore-menu-item-left-action' });
    await _testsWaitForText('Testing Hash');
  },
};
