/**
 * A stored value that is not one of a field's fixed choices is KEPT and the
 * field is INVALID.
 *
 * `fixOptions` used to erase such a value on load. Three times the erased value
 * was a real one — a bare-declared choice, a document naming a choice, a value
 * whose choices had not loaded yet — and the emptied form was then autosaved,
 * so the value was gone for good. The decision: never erase it; flag the field
 * as invalid, say which value is not a choice, and let the form's validity
 * block submitting until the author picks one.
 *
 * `allowed_values: []` is "the server has no choices to offer right now" —
 * unknown, not invalid — and stays valid.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine, fixOptions } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { getUnlistedChoiceReason, getUnlistedChoices } from '../src/helpers/allowedValues';
import { validateField, validateFieldWithResult } from '../src/helpers/validations';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const CHANNELS = [
  { display_name: 'Ops', value: { type: 'string', value: 'ops' } },
  { display_name: 'Dev', value: { type: 'string', value: 'dev' } },
];

const channelField = (extra: Record<string, unknown> = {}) => ({
  type: 'string',
  display_name: 'Channel',
  required: true,
  allowed_values: CHANNELS,
  ...extra,
});

describe('getUnlistedChoiceReason', () => {
  it('accepts a value that is one of the choices, in all three declaration styles', () => {
    expect(getUnlistedChoiceReason('ops', channelField())).toBeUndefined();
    expect(getUnlistedChoiceReason('ops', { allowed_values: [{ value: 'ops' }] })).toBeUndefined();
    expect(getUnlistedChoiceReason('ops', { allowed_values: [{ name: 'ops' }] })).toBeUndefined();
    // the typed envelope the form engine round-trips
    expect(
      getUnlistedChoiceReason({ type: 'string', value: 'ops' }, channelField())
    ).toBeUndefined();
  });

  it('names a value that is not one of the choices', () => {
    expect(getUnlistedChoiceReason('gone', channelField())).toBe(
      '"gone" is not one of the choices'
    );
  });

  it('names a number and a rich-text document by what they read as', () => {
    expect(getUnlistedChoiceReason(7, { allowed_values: [{ value: 1 }, { value: 2 }] })).toBe(
      '"7" is not one of the choices'
    );
    expect(
      getUnlistedChoiceReason([{ type: 'paragraph', children: [{ text: 'Lead' }] }], channelField())
    ).toBe('"Lead" is not one of the choices');
  });

  it('does not judge an empty value — whether one is needed is the required check', () => {
    for (const empty of [undefined, null, '', []]) {
      expect(getUnlistedChoiceReason(empty, channelField())).toBeUndefined();
    }
  });

  it('does not judge against an EMPTY allowed_values', () => {
    expect(getUnlistedChoiceReason('anything', { allowed_values: [] })).toBeUndefined();
    expect(
      getUnlistedChoiceReason(['a', 'b'], { allowed_values: [], multiselect: true })
    ).toBeUndefined();
    expect(getUnlistedChoiceReason(['a'], { element_allowed_values: [] })).toBeUndefined();
  });

  it('does not judge a value of a field whose choices are creatable', () => {
    expect(
      getUnlistedChoiceReason('new', channelField({ allowed_values_creatable: true }))
    ).toBeUndefined();
    expect(
      getUnlistedChoiceReason(['new'], {
        element_allowed_values: CHANNELS,
        element_allowed_values_creatable: true,
      })
    ).toBeUndefined();
  });

  it('does not judge a template, a template document or an expression', () => {
    expect(getUnlistedChoiceReason('$local:channel', channelField())).toBeUndefined();
    expect(
      getUnlistedChoiceReason(
        [
          {
            type: 'paragraph',
            children: [{ type: 'tag', value: '$local:x', label: 'x', children: [{ text: '' }] }],
          },
        ],
        channelField()
      )
    ).toBeUndefined();
    expect(
      getUnlistedChoiceReason({ exp: 'CONCAT', args: [] }, channelField({ isFunction: true }))
    ).toBeUndefined();
    expect(
      getUnlistedChoiceReason({ exp: 'CONCAT', args: [] }, channelField({ is_expression: true }))
    ).toBeUndefined();
  });

  it('matches a hash-valued choice by its contents', () => {
    const field = { allowed_values: [{ value: { type: 'hash', value: { a: 1 } } }] };
    expect(getUnlistedChoiceReason({ a: 1 }, field)).toBeUndefined();
    expect(getUnlistedChoiceReason({ a: 2 }, field)).toBe('"{"a":2}" is not one of the choices');
  });

  describe('a multi-select field', () => {
    const field = channelField({ type: 'list', multiselect: true });

    it('accepts a list whose every element is a choice', () => {
      expect(getUnlistedChoiceReason(['ops', 'dev'], field)).toBeUndefined();
      expect(
        getUnlistedChoiceReason([{ type: 'string', value: 'ops' }, 'dev'], field)
      ).toBeUndefined();
    });

    it('names exactly the elements that are not choices — none is dropped', () => {
      const value = ['ops', 'gone', 'dev', 'lost'];
      expect(getUnlistedChoices(value, field)).toEqual(['gone', 'lost']);
      expect(getUnlistedChoiceReason(value, field)).toBe(
        '"gone" and "lost" are not among the choices'
      );
      expect(value).toEqual(['ops', 'gone', 'dev', 'lost']);
    });

    it('lists three or more with commas', () => {
      expect(getUnlistedChoiceReason(['a', 'b', 'c'], field)).toBe(
        '"a", "b" and "c" are not among the choices'
      );
    });

    it('does not judge a template element', () => {
      expect(getUnlistedChoiceReason(['ops', '$local:x'], field)).toBeUndefined();
    });
  });

  describe('a list constrained by element_allowed_values', () => {
    const field = { type: 'list', element_allowed_values: CHANNELS };

    it('accepts elements that are choices, bare or enveloped', () => {
      expect(getUnlistedChoiceReason(['ops'], field)).toBeUndefined();
      expect(getUnlistedChoiceReason([{ type: 'string', value: 'dev' }], field)).toBeUndefined();
    });

    it('flags an element that is not a choice', () => {
      expect(getUnlistedChoiceReason(['ops', { type: 'string', value: 'x' }], field)).toBe(
        '"x" is not one of the choices'
      );
    });

    it('does not judge a single value against element choices', () => {
      expect(getUnlistedChoiceReason('x', field)).toBeUndefined();
    });
  });
});

describe('validateField with fixed choices', () => {
  it('a value that is not a choice is invalid, with the reason', () => {
    expect(validateFieldWithResult('string', 'gone', channelField() as any)).toMatchObject({
      isValid: false,
      reason: '"gone" is not one of the choices',
    });
  });

  it('a value that is a choice is valid', () => {
    expect(validateField('string', 'ops', channelField() as any)).toBe(true);
  });

  it('a template is valid by its own rule', () => {
    expect(validateField('string', '$local:channel', channelField() as any)).toBe(true);
  });

  it('a multi-select list with an unknown element is invalid', () => {
    expect(
      validateFieldWithResult(
        'list',
        ['ops', 'gone'],
        channelField({ type: 'list', multiselect: true }) as any
      )
    ).toMatchObject({ isValid: false, reason: '"gone" is not one of the choices' });
  });

  it('an options hash holding a value that is not a choice is invalid, naming the option', () => {
    const result = validateFieldWithResult(
      'options',
      { channel: { type: 'string', value: 'gone' } },
      { optionSchema: { channel: channelField() } } as any
    );
    expect(result.isValid).toBe(false);
    expect(result.reasons.join(' | ')).toContain('"gone" is not one of the choices');
  });

  it('an options hash whose values are choices is valid', () => {
    expect(
      validateField('options', { channel: { type: 'string', value: 'ops' } }, {
        optionSchema: { channel: channelField() },
      } as any)
    ).toBe(true);
  });
});

describe('fixOptions keeps a value that is not a choice', () => {
  it('keeps a single value', () => {
    const out = fixOptions({ channel: 'gone' }, { channel: channelField() } as any);
    expect((out.channel as any).value).toBe('gone');
  });

  it('keeps every element of a multi-select', () => {
    const out = fixOptions({ channel: { type: 'list', value: ['ops', 'gone'] } }, {
      channel: channelField({ type: 'list', multiselect: true }),
    } as any);
    expect((out.channel as any).value).toEqual(['ops', 'gone']);
  });

  it('keeps every element of a list constrained by element_allowed_values', () => {
    const out = fixOptions({ channel: { type: 'list', value: ['ops', 'gone'] } }, {
      channel: { type: 'list', element_allowed_values: CHANNELS },
    } as any);
    expect((out.channel as any).value).toEqual(['ops', 'gone']);
  });

  it('still resets a READONLY field to its default (unchanged behaviour)', () => {
    const out = fixOptions({ mode: 'other' }, {
      mode: { type: 'string', readonly: true, default_value: 'fixed' },
    } as any);
    expect((out.mode as any).value).toBe('fixed');
  });
});

describe('the field message names the value', () => {
  it('reports the reason as a danger message', () => {
    const schema = { channel: channelField() } as any;
    const messages = getOptionFieldMessages({
      schema,
      option: { type: 'string', value: 'gone' },
      name: 'channel',
      allOptions: { channel: { type: 'string', value: 'gone' } },
      getType: (type: string) => type as never,
    } as any);
    expect(messages).toContainEqual(
      expect.objectContaining({ label: '"gone" is not one of the choices', intent: 'danger' })
    );
  });
});

describe('FormEngine with a value that is not a choice', () => {
  const renderForm = (options: never, value: never) => {
    const onChange = vi.fn();
    const onValidityChange = vi.fn();
    const utils = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='delivery'
            value={value}
            options={options}
            onChange={onChange}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    return { ...utils, onChange, onValidityChange };
  };

  const attentionBox = (container: HTMLElement) =>
    [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
      (group.textContent || '').startsWith('Needs attention')
    );

  const lastValidity = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1];

  it('keeps the value, lists the field under Needs attention, and reports the form invalid', async () => {
    const { container, onChange, onValidityChange } = renderForm(
      { channel: channelField() } as never,
      { channel: { type: 'string', value: 'gone' } } as never
    );

    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    const [isValid, data] = lastValidity(onValidityChange);
    expect(isValid).toBe(false);
    expect(data.invalidFields).toHaveLength(1);
    expect(data.invalidFields[0]).toMatchObject({
      fieldName: 'channel',
      value: 'gone',
      validation: { isValid: false, reason: '"gone" is not one of the choices' },
    });

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    expect(attentionBox(container)!.querySelector('[data-field="channel"]')).toBeTruthy();
    expect(container.textContent).toContain('"gone" is not one of the choices');

    // Nothing ever emitted an erased value.
    for (const [value] of onChange.mock.calls) {
      expect(value?.channel?.value).not.toBeUndefined();
    }
  });

  it('a value that is a choice leaves the form valid', async () => {
    const { container, onValidityChange } = renderForm(
      { channel: channelField() } as never,
      { channel: { type: 'string', value: 'ops' } } as never
    );

    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    expect(lastValidity(onValidityChange)[0]).toBe(true);
    expect(attentionBox(container)).toBeUndefined();
  });

  it('a value against an EMPTY allowed_values leaves the form valid', async () => {
    const { onValidityChange } = renderForm(
      { channel: channelField({ allowed_values: [] }) } as never,
      { channel: { type: 'string', value: 'anything' } } as never
    );

    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    expect(lastValidity(onValidityChange)[0]).toBe(true);
  });

  it('a template value leaves the form valid', async () => {
    const { onValidityChange } = renderForm(
      { channel: channelField() } as never,
      { channel: { type: 'string', value: '$local:channel' } } as never
    );

    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    expect(lastValidity(onValidityChange)[0]).toBe(true);
  });

  it('a multi-select with one unknown element is invalid and keeps both elements', async () => {
    const { onValidityChange } = renderForm(
      { channel: channelField({ type: 'list', multiselect: true }) } as never,
      { channel: { type: 'list', value: ['ops', 'gone'] } } as never
    );

    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    const [isValid, data] = lastValidity(onValidityChange);
    expect(isValid).toBe(false);
    expect(data.invalidFields[0].value).toEqual(['ops', 'gone']);
    expect(data.invalidFields[0].validation.reason).toBe('"gone" is not one of the choices');
  });
});

/**
 * The AI endpoint's Tools field, as the qorus-ide delivers it: `ui_type:
 * 'tool-catalog'` draws a bespoke editor that stores tool SELECTORS (`*`,
 * `system:*`, a connection, `connection/tool`), while the host hangs the tool
 * catalogue's SOURCES (fetched by the field's `get_message`) on
 * `allowed_values` for that editor to browse. The sources are not the values
 * the field may hold, so the server's own default `["*"]` must not be flagged.
 */
const TOOL_SOURCES = [
  { display_name: 'Qorus system tools', value: { type: 'string', value: 'system' } },
  { display_name: 'salesforce-prod', value: { type: 'string', value: 'salesforce-prod' } },
];

const toolsField = (extra: Record<string, unknown> = {}) => ({
  type: 'list',
  display_name: 'Tools',
  ui_type: 'tool-catalog',
  element_type: 'string',
  default_value: { type: 'tool-catalog', value: ['*'] },
  preselected: true,
  required: true,
  get_message: { action: 'creator-get-objects', object_type: 'tool-catalog' },
  return_message: {
    action: 'creator-return-objects',
    object_type: 'tool-catalog',
    return_value: 'objects',
  },
  allowed_values: TOOL_SOURCES,
  ...extra,
});

describe('a field drawn by a bespoke editor is not judged against allowed_values', () => {
  it('accepts every tool selector, none of which is a catalogue source', () => {
    for (const value of [
      ['*'],
      ['system:*'],
      ['system:*', 'salesforce-prod'],
      ['system:*', 'jira-eng/create_issue'],
      { type: 'tool-catalog', value: ['*'] },
    ]) {
      expect(getUnlistedChoices(value, toolsField())).toEqual([]);
      expect(getUnlistedChoiceReason(value, toolsField())).toBeUndefined();
    }
  });

  it('accepts a consumer editor the form declares as its own', () => {
    const field = { ...toolsField({ ui_type: 'host-tool-picker' }), hasOwnEditor: true };
    expect(getUnlistedChoiceReason(['*'], field)).toBeUndefined();
  });

  it('NEGATIVE: the same choices drawn by the choice picker are still a closed set', () => {
    // no bespoke editor: a multi-select over the same entries flags `*`
    expect(
      getUnlistedChoiceReason(['*'], toolsField({ ui_type: undefined, multiselect: true }))
    ).toBe('"*" is not one of the choices');
    // and an undeclared ui_type is not taken for a bespoke editor
    expect(getUnlistedChoiceReason(['*'], toolsField({ ui_type: 'host-tool-picker' }))).toBe(
      '"*" is not one of the choices'
    );
    // a plain closed-choice field still flags its value
    expect(getUnlistedChoiceReason('gone', channelField({ hasOwnEditor: false }))).toBe(
      '"gone" is not one of the choices'
    );
  });

  it('validateField and the field message agree', () => {
    expect(validateField('list', ['*'], { has_to_have_value: true, ...toolsField() } as any)).toBe(
      true
    );
    const schema = { tools: toolsField() } as any;
    const messages = getOptionFieldMessages({
      schema,
      option: { type: 'tool-catalog', value: ['system:*'] },
      name: 'tools',
      allOptions: { tools: { type: 'tool-catalog', value: ['system:*'] } },
      getType: (type: string) => type as never,
    } as any);
    expect(messages.map((m) => m.label)).not.toContainEqual(
      expect.stringContaining('not one of the choices')
    );
  });

  it('the field message honours a consumer-declared editor', () => {
    const schema = { tools: toolsField({ ui_type: 'host-tool-picker' }) } as any;
    const args = {
      schema,
      option: { type: 'list', value: ['*'] },
      name: 'tools',
      allOptions: { tools: { type: 'list', value: ['*'] } },
      getType: (type: string) => type as never,
    } as any;
    // without the predicate the undeclared editor's value is judged...
    expect(getOptionFieldMessages(args).map((m) => m.label)).toContain(
      '"*" is not one of the choices'
    );
    // ...and with it, it is not
    expect(
      getOptionFieldMessages({
        ...args,
        isRendererOnly: (type?: string) => type === 'host-tool-picker',
      }).map((m) => m.label)
    ).not.toContain('"*" is not one of the choices');
  });
});

describe('FormEngine with a tool-catalog field', () => {
  const renderForm = (options: never, value: never, extra: Record<string, unknown> = {}) => {
    const onValidityChange = vi.fn();
    const utils = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='endpoint'
            value={value}
            options={options}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
            {...extra}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    return { ...utils, onValidityChange };
  };

  const lastValidity = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1];

  it('the default ["*"] leaves the form valid and nothing needs attention', async () => {
    const { container, onValidityChange } = renderForm(
      { tools: toolsField() } as never,
      { tools: { type: 'tool-catalog', value: ['*'] } } as never
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    expect(lastValidity(onValidityChange)[0]).toBe(true);
    expect(container.textContent).not.toContain('not one of the choices');
  });

  it('a consumer editor declared in rendererOnlyUiTypes is not judged either', async () => {
    const { onValidityChange } = renderForm(
      { tools: toolsField({ ui_type: 'host-tool-picker' }) } as never,
      { tools: { type: 'list', value: ['system:*'] } } as never,
      { rendererOnlyUiTypes: ['host-tool-picker'] }
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    expect(lastValidity(onValidityChange)[0]).toBe(true);
  });

  it('NEGATIVE: an undeclared editor over the same choices is still judged', async () => {
    const { onValidityChange } = renderForm(
      { tools: toolsField({ ui_type: 'host-tool-picker' }) } as never,
      { tools: { type: 'list', value: ['system:*'] } } as never
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenCalled());
    const [isValid, data] = lastValidity(onValidityChange);
    expect(isValid).toBe(false);
    expect(data.invalidFields[0].validation.reason).toBe('"system:*" is not one of the choices');
  });
});
