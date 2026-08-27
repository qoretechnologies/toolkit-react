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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField wrapping a LongString component with a plain string value — the field shows the literal string in a textarea, no template selected.',
      },
    },
  },
};

export const BooleanComponent: StoryObj<typeof meta> = {
  args: {
    value: true,
    type: 'boolean',
    allowTemplates: true,
    componentFromType: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a boolean value with templates allowed — the boolean toggle is shown with the template toggle available on the side.',
      },
    },
  },
};

export const NumberComponent: StoryObj<typeof meta> = {
  args: {
    value: 25,
    type: 'int',
    allowTemplates: true,
    componentFromType: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for an int value of 25 with templates allowed — the numeric input is shown alongside the template toggle.',
      },
    },
  },
};

export const AutoComponent: StoryObj<typeof meta> = {
  args: {
    defaultType: 'auto',
    allowTemplates: true,
    component: auto,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField wrapping the AutoFormField dispatcher — the operator can pick a type from the auto picker or switch to a template value.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField restricted to a single allowed value ("Test") but with templates also allowed — the operator can pick the allowed value or switch to a template.',
      },
    },
  },
};

export const TemplateValue: StoryObj<typeof meta> = {
  args: {
    component: Number,
    type: 'int',
    value: '$local:id',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for an int wrapped over the Number component with a template value ($local:id) — the template selector replaces the number input.',
      },
    },
  },
};

/** REGRESSION — a rehydrated whole-token template value (the FSM state-output
 *  `$data:{…}` form above all) must render as the picker CHIP, not as its raw
 *  token text in a string editor. */
export const BracedTemplateValue: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    type: 'string',
    allowTemplates: true,
    allowCustomValues: true,
    value: '$data:{W2n_BuSHbaNrbvV1MkfPF.filename}',
    templates: buildTemplates({
      state_outputs: {
        display_name: 'Context Data',
        short_desc: 'Outputs of previous states',
        app: 'GoogleDrive',
        items: [
          {
            name: 'filename',
            display_name: 'Filename',
            short_desc: 'The uploaded file name',
            desc: 'The uploaded file name',
            value: '$data:{W2n_BuSHbaNrbvV1MkfPF.filename}',
            type: 'string',
          },
        ],
      },
    } as any),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a string field whose saved value is a braced state-output reference ($data:{id.filename}) — the field shows the resolved picker chip ("Filename"), never the raw token in a textarea, which is what rehydrated drafts degraded to before the token grammar learned braces.',
      },
    },
  },
  play: async () => {
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-button')).find((button) =>
        button.textContent?.includes('Filename')
      );
      expect(chip, 'the braced value renders as the labeled picker chip').toBeTruthy();
    });
    const rawTextareas = Array.from(document.querySelectorAll('textarea')).filter((textarea) =>
      textarea.value.includes('$data:{')
    );
    expect(rawTextareas, 'no textarea holds the raw token').toHaveLength(0);
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField in list mode with three number items. Adding a new item and opening the templates popover shows the templates that resolve to the number element type.',
      },
    },
  },
  play: async () => {
    await _testsClickButton({ label: 'Add new item for "Test"' });
    await _testsOpenTemplates();
    await _testsWaitForText('Interface ID');
  },
};

export const ShowsTemplatesList: StoryObj<typeof meta> = {
  ...TemplateValue,
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField with the $local:id template value, then opens the templates popover — the operator sees the available templates that resolve to an int.',
      },
    },
  },
  play: async () => {
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForString: StoryObj<typeof meta> = {
  ...StringComponent,
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField over a LongString component with a plain string value, then opens the templates popover — the templates list is shown for a string target type.',
      },
    },
  },
  play: async () => {
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForBoolean: StoryObj<typeof meta> = {
  ...BooleanComponent,
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a boolean value, switches to template mode and opens the templates popover — the templates list is shown for a boolean target type.',
      },
    },
  },
  play: async () => {
    await _testsSetTemplate();
    await _testsOpenTemplates();
  },
};

export const ShowsTemplatesListForNumber: StoryObj<typeof meta> = {
  ...NumberComponent,
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for an int value, then opens the templates popover — the templates list is shown for an int target type.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField holding a $config:boolean template value. Clicking the template-remove action clears the template and the underlying boolean checkbox is shown instead.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField with allowFunctions enabled — the template menu now exposes a "Use Expression" entry alongside the plain templates.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField holding a substr function value with three arguments — the expression builder shows the function name and each argument slot.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField holding a substr function whose second argument is itself a PLUS-INT expression — the expression builder shows the nested function inline within the outer call.',
      },
    },
  },
};

export const TemplateCanBeSelected: StoryObj<typeof meta> = {
  args: {
    type: 'string',
    defaultType: 'string',
    defaultInternalType: 'string',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a string, opens the templates popover and clicks the Interface ID template — the field switches to the $local:id template value inside the template-offering input (plain word tokens stay typeable; only braced context refs chip).',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField over a number type holding a $config:something template value. Clicking template-remove resets the value to undefined and fires onChange with the cleared value.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a string with a hierarchical template catalogue. Drilling into "Testing Hash" narrows the list to templates that resolve to a string (Testing Int Item is filtered out).',
      },
    },
  },
  play: async () => {
    await _testsOpenTemplates();
    await _testsClickButton({ label: 'Testing Hash' });
    await _testsWaitForText('Testing String Item');
    await _testsWaitForTextToNotExist('Testing Int Item');
  },
};

export const TemplatesWithMultipleLevelsAndHashField: StoryObj<typeof meta> = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a hash type with a hierarchical template catalogue — switching to template mode and opening the popover exposes the nested template groups.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField for a hash type with a hierarchical catalogue. Selecting an item from a nested group updates the template value to the picked entry (Testing Hash).',
      },
    },
  },
  play: async (args) => {
    await TemplatesWithMultipleLevelsAndHashField.play(args);
    await _testsClickButton({ selector: '.reqore-menu-item-left-action' });
    await _testsWaitForText('Testing Hash');
  },
};
