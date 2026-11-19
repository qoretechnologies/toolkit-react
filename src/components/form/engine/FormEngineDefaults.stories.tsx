// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A default nobody set reads as a default, not as "Set".
 *
 * On a new workflow the only thing "Set" was "Language: Qore", which a person who does not write code never chose.
 * A field the person has not touched whose value is its default is said under the form, "Uses Qore · Change"; it
 * is still the form's value, and counted as filled in.
 */
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { FormEngine, IFormEngineProps, IOptions } from './FormEngine';

const NEW_WORKFLOW: IQorusFormSchema = {
  name: { type: 'string', display_name: 'Name', required: true },
  lang: {
    type: 'string',
    display_name: 'Language',
    required: true,
    default_value: 'qore',
    allowed_values: [
      { value: 'qore', display_name: 'Qore' },
      { value: 'python', display_name: 'Python' },
      { value: 'java', display_name: 'Java' },
    ],
  } as never,
  timeout: { type: 'int', display_name: 'Timeout', default_value: 30 } as never,
};

const meta: Meta<typeof FormEngine> = {
  component: FormEngine,
  title: 'Form/Engine/Defaults',
  args: {
    name: 'new-workflow',
    compact: true,
    options: NEW_WORKFLOW,
    value: { timeout: { type: 'int', value: 30 } } as unknown as IOptions,
    onChange: fn(),
  },
  render: ({ value, onChange, ...rest }: IFormEngineProps) => {
    const [val, setValue] = useState(value);
    return (
      <div style={{ maxWidth: 640, padding: 16 }}>
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

const note = (name: string) =>
  document.querySelector<HTMLElement>(`.form-default-note[data-field-default="${name}"]`);

export const ADefaultNobodySetReadsAsADefault: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A new workflow: Name still to fill in, Language holding its default (Qore) and Timeout its default (30), neither touched. Nothing is listed as "Set": under the form it says "Uses Qore · Change" and "Uses 30 for Timeout · Change".',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(note('lang')?.textContent).toContain('Uses Qore'));
    expect(note('timeout')?.textContent).toContain('Uses 30 for Timeout');
    // not a row, and no "Set" box for them
    expect(document.querySelector('.readfirst-row[data-field="lang"]')).toBeNull();
    expect(
      [...document.querySelectorAll('.options-readfirst-group > .reqore-panel-title')].some((title) =>
        /^\s*Set\b/.test(title.textContent ?? '')
      )
    ).toBe(false);
  },
};

export const ChangeOpensTheDefaultAsAField: Story = {
  parameters: {
    // Interaction-only: the opened field is the ordinary row every form draws.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          '"Change" on Language opens it as an ordinary row in "Set", to be changed; its line under the form goes.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(note('lang')).toBeTruthy());

    await userEvent.click(note('lang')!.querySelector('.form-default-change')!);

    await waitFor(() => expect(document.querySelector('[data-field="lang"]')).toBeTruthy());
    expect(note('lang')).toBeNull();
    expect(note('timeout')).toBeTruthy();
  },
};

export const ADefaultIsSaidOnAFormThatIsOnlyRead: Story = {
  args: { readOnly: true, value: { lang: { type: 'string', value: 'qore' } } as unknown as IOptions },
  parameters: {
    // Interaction-only: it draws the same line as the story above, without its button.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'The same form, only read: "Uses Qore", with nothing to change it by.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(note('lang')?.textContent).toContain('Uses Qore'));
    expect(note('lang')!.querySelector('.form-default-change')).toBeNull();
  },
};
