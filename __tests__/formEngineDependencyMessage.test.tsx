import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { describe, expect, it } from 'vitest';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';

/**
 * The sentence a disabled field uses to explain itself has to name the thing
 * the reader must go and fill in. It is the only route from "this is locked"
 * to "here is what unlocks it".
 *
 * It was built by looking each `depends_on` entry up as a whole field name,
 * which holds only for the bare-name form. Every comparison entry vanished, so
 * a field gated purely on a comparison — a test's Subject Interface, gated on
 * `subject_iface_kind!=type` — said "…are not fulfilled:" and then stopped.
 */
const SCHEMA = {
  kind: { type: 'string', display_name: 'Subject Interface Type' },
  other: { type: 'string', display_name: 'Other Field' },
  comparison: {
    type: 'string',
    display_name: 'Subject Interface',
    depends_on: ['kind!=type'],
  },
  equality: {
    type: 'string',
    display_name: 'Subject Type Path',
    depends_on: ['kind=type'],
  },
  anyOf: {
    type: 'string',
    display_name: 'Version',
    depends_on: [['kind=service', 'other']],
  },
  unknown: {
    type: 'string',
    display_name: 'Orphan',
    depends_on: ['no_such_field'],
  },
} as unknown as IQorusFormSchema;

/**
 * Each case supplies its own values: the evaluator treats a field that is
 * ABSENT from the value map as fulfilled, so a dependency is only unmet when
 * the field it names is present and fails.
 */
const messageFor = (name: string, allOptions: Record<string, unknown>) =>
  getOptionFieldMessages({
    schema: SCHEMA,
    option: { type: 'string', value: undefined } as never,
    name,
    allOptions: allOptions as never,
    getType: (type: string) => type,
  })
    .map((m) => m.label as string)
    .find((label) => label.includes('dependencies are not fulfilled'));

const KIND_IS_TYPE = { kind: { type: 'string', value: 'type' } };
const KIND_IS_SERVICE = { kind: { type: 'string', value: 'service' } };

describe('the unmet-dependency message', () => {
  it('names the field a `!=` comparison gates on, and what it must not be', () => {
    expect(messageFor('comparison', KIND_IS_TYPE)).toBe(
      'This field is disabled because some dependencies are not fulfilled: "Subject Interface Type" must not be "type"'
    );
  });

  it('names the field an `=` comparison gates on, and what it must be', () => {
    expect(messageFor('equality', KIND_IS_SERVICE)).toBe(
      'This field is disabled because some dependencies are not fulfilled: "Subject Interface Type" must be "type"'
    );
  });

  it('reads a nested entry as the either/or it is', () => {
    // Flattening it into the top-level list showed an OR as a set of things
    // all required.
    expect(
      messageFor('anyOf', { ...KIND_IS_TYPE, other: { type: 'string', value: undefined } })
    ).toBe(
      'This field is disabled because some dependencies are not fulfilled: ("Subject Interface Type" must be "service" or "Other Field")'
    );
  });

  it('never ends on a dangling colon when nothing can be named', () => {
    // Unmet AND unnameable: the value map carries a field the schema does not.
    const message = messageFor('unknown', {
      no_such_field: { type: 'string', value: undefined },
    });
    expect(message).toBe('This field is disabled because some dependencies are not fulfilled');
    expect(message).not.toMatch(/:\s*$/);
  });
});
