// Copyright 2026 Qore Technologies, s.r.o.
// A host that has its own words for what is wrong with a field says them in the field, once.
//
// qorus#646 (David): the sheet-contract review says what is wrong with a value in its own words, in the
// user's language ("Enter a value or an expression", "A whole number can't have text around a field"), and
// the field said its generic reason as well ("This field is required", "…around a template"): two
// messages for one problem, one of them in English. A field's `invalid_reason` is now said in place of the
// field's own validation and required messages, and the field is invalid while it is set.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const messagesFor = (option: Record<string, unknown>, field: Record<string, unknown>) =>
  getOptionFieldMessages({
    schema: { value: { type: 'int', display_name: 'Value', required: true, ...field } } as never,
    option: option as never,
    name: 'value',
    allOptions: { value: option } as never,
    getType: ((type: string) => type) as never,
  }).map((message) => String(message.label));

describe("a field's own reason from its host", () => {
  it('is said in place of "This field is required"', () => {
    expect(messagesFor({ type: 'int' }, { invalid_reason: 'Enter a value or an expression' })).toEqual([
      'Enter a value or an expression',
    ]);
  });

  it("is said in place of the field's own validation reason", () => {
    expect(
      messagesFor(
        { type: 'int', value: '$record:{pos} Stk.' },
        { invalid_reason: "A whole number can't have text around a field" }
      )
    ).toEqual(["A whole number can't have text around a field"]);
  });

  it('is said on a value the field itself finds valid', () => {
    expect(messagesFor({ type: 'int', value: 12 }, { invalid_reason: 'There is no field qty before this one' })).toEqual([
      'There is no field qty before this one',
    ]);
  });

  it("leaves the field's own messages when it is not given", () => {
    expect(messagesFor({ type: 'int' }, {})).toEqual(['This field is required']);
    expect(messagesFor({ type: 'int', value: '$record:{pos} Stk.' }, {})).toEqual([
      "A whole number can't have text around a template",
    ]);
  });
});

describe('a form whose field has a reason from its host', () => {
  const show = (field: Record<string, unknown>, value: unknown) => {
    const onValidityChange = vi.fn();
    const utils = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='host'
            value={{ value: { type: 'int', value } } as never}
            options={{ value: { type: 'int', display_name: 'Value', required: true, preselected: true, ...field } } as never}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    return { ...utils, onValidityChange };
  };
  const lastValidity = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0];

  it('is invalid while the reason is given, and says it once', async () => {
    const { container, onValidityChange } = show({ invalid_reason: 'There is no field qty before this one' }, 12);
    await waitFor(() => expect(lastValidity(onValidityChange)).toBe(false));
    await waitFor(() => expect(container.textContent).toContain('There is no field qty before this one'));
    expect(container.textContent?.split('There is no field qty before this one').length).toBe(2);
  });

  it('is valid without it', async () => {
    const { onValidityChange } = show({}, 12);
    await waitFor(() => expect(lastValidity(onValidityChange)).toBe(true));
  });

  it('says the reason in place of "This field is required" on an empty field', async () => {
    const { container } = show({ invalid_reason: 'Enter a value or an expression' }, undefined);
    await waitFor(() => expect(container.textContent).toContain('Enter a value or an expression'));
    expect(container.textContent).not.toContain('This field is required');
  });
});
