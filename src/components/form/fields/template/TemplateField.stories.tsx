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
import { LONG_EXAMPLE_VALUE } from './__fixtures__/longExampleValue';
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

/** A template-authored Qog keys its states `'1'`, `'2'`, … while each state
 *  carries its own id, and its saved `$data:{…}` refs use that id — so the
 *  catalogue (spelled with the key) and the value (spelled with the id) never
 *  match as text. The producer supplies the alternate spelling as an alias so
 *  the chip still resolves to a name instead of printing the raw token. */
export const AliasedStateTemplateValue: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    type: 'string',
    allowTemplates: true,
    allowCustomValues: true,
    // what the Qog has saved — the state's own id
    value: '$data:{dc_ai_reply.choices}',
    templates: {
      items: [
        {
          label: 'Generate AI Reply',
          description: 'Outputs of the Groq chat-completion state',
          items: [
            {
              label: 'Choices',
              // what the server's catalogue offers — the states-hash key
              value: '$data:{3.choices}',
              badge: 'list',
              metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
            },
          ],
        },
      ],
    } as any,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField holding a state-output reference spelled with the state id ($data:{dc_ai_reply.choices}) while the catalogue offers the same item spelled with the states-hash key ($data:{3.choices}) — the chip resolves through the item alias and shows "Choices", where it used to print the raw token.',
      },
    },
  },
  play: async () => {
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-button')).find((button) =>
        button.textContent?.includes('Choices')
      );
      expect(chip, 'the aliased value resolves to the labeled picker chip').toBeTruthy();
    });
    const rawChips = Array.from(document.querySelectorAll('.reqore-button')).filter((button) =>
      button.textContent?.includes('$data:{')
    );
    expect(rawChips, 'no chip prints the raw token').toHaveLength(0);
  },
};

/** A catalogue can only offer what the action's output type declares, so it
 *  stops at a list — `choices` is offered, `choices[0].message.content` is
 *  hand-written past it. Such a value has no item of its own and used to
 *  render as its raw token; it is now named after its nearest ancestor. */
export const ExtendedPathTemplateValue: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    type: 'string',
    allowTemplates: true,
    allowCustomValues: true,
    value: '$data:{dc_ai_reply.choices[0].message.content}',
    templates: {
      items: [
        {
          label: 'Generate AI Reply',
          items: [
            {
              label: 'Choices',
              value: '$data:{3.choices}',
              badge: 'list',
              metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
            },
          ],
        },
      ],
    } as any,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders TemplateField holding a path extended past the named field it starts from ($data:{dc_ai_reply.choices[0].message.content}, where the catalogue only offers "choices") — the chip is named after its nearest ancestor as "Choices[0].message.content" instead of printing the raw token.',
      },
    },
  },
  play: async () => {
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-button')).find((button) =>
        button.textContent?.includes('Choices[0].message.content')
      );
      expect(chip, 'the extended path is named after its ancestor').toBeTruthy();
    });
    const rawChips = Array.from(document.querySelectorAll('.reqore-button')).filter((button) =>
      button.textContent?.includes('$data:{')
    );
    expect(rawChips, 'no chip prints the raw token').toHaveLength(0);
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

/* One group, four items covering every affordance combination:
   - "Attachment Body"       — leaf, LONG example  → "?" (right) only
   - "Attachment Name"       — leaf, short example → no actions at all
   - "Message Author Props"  — hash with children, LONG example (the whole
     object) → BOTH: the "+" select action (left) and the "?" (right)
   - "Delivery Flags"        — hash with children, short example → "+" only
   The sentinel at the very end proves truncation in the picker and
   completeness in the modal. */
const longExampleTemplates = {
  gmail_attachment: {
    display_name: 'New Attachment',
    short_desc: 'Data from the attachment trigger',
    app: 'Gmail',
    items: [
      {
        name: 'attachment_body',
        display_name: 'Attachment Body',
        value: '$data:{on_attachment.data}',
        type: 'data',
        example_value: LONG_EXAMPLE_VALUE,
      },
      {
        name: 'attachment_name',
        display_name: 'Attachment Name',
        value: '$data:{on_attachment.name}',
        type: 'string',
        example_value: 'invoice.pdf',
      },
      {
        name: 'author',
        display_name: 'Message Author Properties',
        value: '$data:{on_attachment.author}',
        type: 'hash',
        // A parent's example is the whole object, so it goes long almost by
        // definition — this is the "+ AND ?" case.
        example_value: {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          signature: LONG_EXAMPLE_VALUE.slice(0, 600),
        },
        items: [
          {
            name: 'author_name',
            display_name: 'Name',
            value: '$data:{on_attachment.author.name}',
            type: 'string',
            example_value: 'Ada Lovelace',
          },
          {
            name: 'author_email',
            display_name: 'Email',
            value: '$data:{on_attachment.author.email}',
            type: 'string',
            example_value: 'ada@example.com',
          },
        ],
      },
      {
        name: 'flags',
        display_name: 'Delivery Flags',
        value: '$data:{on_attachment.flags}',
        type: 'hash',
        // Small object: the serialized example stays under the preview
        // threshold, so this parent keeps ONLY the "+" select action.
        example_value: { read: true },
        items: [
          {
            name: 'flags_read',
            display_name: 'Read',
            value: '$data:{on_attachment.flags.read}',
            type: 'bool',
            example_value: true,
          },
        ],
      },
    ],
  },
};

export const LongExampleValueTruncatedWithModal: StoryObj<typeof meta> = {
  args: {
    component: LongStringField,
    value: 'Some string',
    type: 'string',
    templates: buildTemplates(longExampleTemplates as any),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every item-affordance combination in one picker: a leaf with a whole-base64-file example gets a single-line ellipsized preview (cut at the popover\'s actual width — no breakpoints) and the "?" action (right) opening the full value in a modal; a hash parent whose own example object is long gets BOTH the "+" select action (left) and the "?"; a small hash parent keeps only the "+"; and a short leaf keeps its full wrapped preview with no actions. Neither previewing nor copying ever selects an item.',
      },
    },
  },
  play: async ({ args }) => {
    await _testsOpenTemplates();
    await _testsWaitForText('Attachment Body');

    // The picker shows TRUNCATED previews — the long value's tail sentinel
    // must not be in the popover…
    const popover = document.querySelector('.reqore-popover-content');
    await expect(popover.textContent).toContain('Example value: "JVBERi0x');
    await expect(popover.textContent).not.toContain('THE_VERY_END');

    // …and the affordances land exactly by shape: "?" on the long leaf AND
    // the long-example hash parent (2), "+" on both hash parents (2) — the
    // long-example parent carries both at once. The short leaf and the small
    // parent's example stay modal-free.
    await expect(popover.querySelectorAll('.reqore-menu-item-right-action').length).toBe(2);
    await expect(popover.querySelectorAll('.reqore-menu-item-left-action').length).toBe(2);

    // Long previews are single-line ellipsized at the RENDERED width
    // (container-intrinsic — the same item adapts to any popover width);
    // short previews keep normal wrapping.
    const descriptions = popover.querySelectorAll('.reqore-button-description');
    const longDescription = Array.from(descriptions).find((el) =>
      el.textContent?.includes('JVBERi0x')
    ) as HTMLElement;
    const shortDescription = Array.from(descriptions).find((el) =>
      el.textContent?.includes('invoice.pdf')
    ) as HTMLElement;
    await expect(getComputedStyle(longDescription).whiteSpace).toBe('nowrap');
    await expect(longDescription.scrollWidth).toBeGreaterThan(longDescription.clientWidth);
    await expect(getComputedStyle(shortDescription).whiteSpace).not.toBe('nowrap');

    await _testsClickButton({ selector: '.reqore-menu-item-right-action' });

    const modal = await waitFor(
      () => {
        const el = document.querySelector('.reqraft-template-example-value-modal');
        if (!el) throw new Error('modal not open yet');
        return el;
      },
      { timeout: 10000 }
    );

    // The modal holds the WHOLE value, down to the sentinel.
    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    await expect(textarea.value.endsWith('THE_VERY_END"')).toBe(true);

    // Close it; opening/previewing must never have selected the item.
    fireEvent.click(modal.querySelector('.reqore-drawer-close-button'));
    await waitFor(
      () => {
        if (document.querySelector('.reqraft-template-example-value-modal')) {
          throw new Error('modal still open');
        }
      },
      { timeout: 10000 }
    );
    await expect(args.onChange).not.toHaveBeenCalled();

    // End on the informative frame for the visual snapshot: the popover with
    // the truncated preview and its "?" action visible (the assertions above
    // close everything, which would leave the capture showing an empty field).
    await _testsOpenTemplates();
    await _testsWaitForText('Attachment Body');
  },
};

/**
 * An EMPTY `any` field opens on the template selector, not the type picker.
 *
 * An `any` field has no editor of its own until a concrete type is chosen, so it
 * used to open on the type picker — making the author answer a question about
 * storage ("Text or Number?") before they could say what they meant, and often a
 * question they cannot answer, because the value they want is a reference to
 * something else whose type is not theirs to pick.
 *
 * The literal is still one menu item away: "Set Custom Value" in the ⋮ menu.
 * That is the right way round — picking a template is choosing from a list,
 * picking a literal is a decision.
 */
export const EmptyAnyOpensOnTemplates: StoryObj<typeof meta> = {
  args: {
    component: auto,
    type: 'any',
    allowTemplates: true,
    allowCustomValues: true,
    value: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'An untyped, empty field that accepts templates opens showing the template selector rather than a data-type picker.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('.template-selector')).toBeTruthy()
    );
  },
};

/**
 * An `any` field that ALREADY HOLDS A LITERAL opens on that literal.
 *
 * The other half of the same choice, and the one that keeps it safe: defaulting
 * to the template view unconditionally would hide a value the author had already
 * typed, which reads as the value having been lost.
 */
export const AnyWithLiteralOpensOnTheValue: StoryObj<typeof meta> = {
  args: {
    component: auto,
    type: 'any',
    allowTemplates: true,
    allowCustomValues: true,
    value: 'already-typed',
  },
  parameters: {
    docs: {
      description: {
        story:
          'An untyped field holding a literal keeps showing that literal — only an empty one defaults to the template selector.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The property that matters is that the VALUE is still on screen. Asserting
    // the absence of `.template-selector` would be wrong: that class is also on
    // a control that renders either way, so it says nothing about which view is
    // active.
    await waitFor(() => {
      const held = [
        ...canvasElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input, textarea'
        ),
      ].some((el) => el.value === 'already-typed');
      expect(held).toBe(true);
    });
  },
};
