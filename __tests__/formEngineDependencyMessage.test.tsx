import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

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
  // a value named by its display name, and one that has none
  check: {
    type: 'string',
    display_name: 'Check',
    allowed_values: [
      { display_name: 'Equals', value: { type: 'string', value: 'equals' } },
      { display_name: 'Other', value: { type: 'string', value: '__other__' } },
    ],
  },
  raw: { type: 'string', display_name: 'Raw' },
  byDisplayName: {
    type: 'string',
    display_name: 'Expected Text',
    depends_on: ['check=__other__'],
  },
  byValue: {
    type: 'string',
    display_name: 'Pattern',
    depends_on: ['raw=__other__'],
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

  it('names an allowed value by its display name, not by the value it stands for', () => {
    expect(messageFor('byDisplayName', { check: { type: 'string', value: 'equals' } })).toBe(
      'This field is disabled because some dependencies are not fulfilled: "Check" must be "Other"'
    );
  });

  it('quotes a value with no display name as it is', () => {
    expect(messageFor('byValue', { raw: { type: 'string', value: 'x' } })).toBe(
      'This field is disabled because some dependencies are not fulfilled: "Raw" must be "__other__"'
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

/*
 * The form says reqraft's own sentence as it is (qorus#646): a dependency on the value `__other__` read as
 * markdown, its underscores taken for bold, and the row said the field must be "other". A field whose dependency
 * does not hold is hidden now, and one that holds a value is said in the form's note, which quotes it the same way.
 */
describe('the unmet-dependency reason for a hidden field that holds a value', () => {
  it('quotes a value as it is, never as markdown', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            readOnly
            name='dependencies'
            value={{
              raw: { type: 'string', value: 'x' },
              // a field that holds a value is hidden when its dependency stops holding, and said in the note
              byValue: { type: 'string', value: 'abc' },
            }}
            options={
              {
                raw: { type: 'string', display_name: 'Raw' },
                byValue: { type: 'string', display_name: 'Pattern', depends_on: ['raw=__other__'] },
              } as never
            }
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    const note = await waitFor(() => {
      const found = container.querySelector('[data-field-hidden="byValue"]');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(note.textContent).toContain('"Raw" must be "__other__"');
    expect(container.querySelector('[data-field="byValue"]')).toBeNull();
  });
});
