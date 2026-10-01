import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A required field that is locked because its `depends_on` does not hold yet is
 * not something the author can act on: the row is disabled and says what unlocks
 * it. It used to be listed under "Needs attention" anyway — the form counted a
 * required empty field as needing attention whether or not it applied — which is
 * how a guided check in qorus-ide came to ask for its Path, Minimum, Maximum and
 * Expected value before the author had even picked what kind of check it was.
 *
 * What does need attention is the field that unlocks it, when that one is itself
 * required; and the locked field the moment its dependency holds and it is still
 * empty.
 */

/** Modelled on the guided check: the kind decides which of the rest apply. */
const CHECK = {
  kind: {
    type: 'string',
    display_name: 'Kind',
    // On the form from the start, as the guided check's kind is: a bare
    // `depends_on` naming a field the form does not hold at all is fulfilled.
    preselected: true,
    allowed_values: [{ value: 'equals' }, { value: 'between' }, { value: 'exists' }],
  },
  expected: {
    type: 'string',
    display_name: 'Expected value',
    required: true,
    depends_on: ['kind'],
  },
  min: {
    type: 'int',
    display_name: 'Minimum',
    required: true,
    depends_on: ['kind=between'],
  },
} as never;

const renderForm = (options: never, value: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='check' value={value} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const box = (container: HTMLElement, title: string) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith(title)
  );

const attentionBox = (container: HTMLElement) => box(container, 'Needs attention');

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('a required field locked by its dependency does not need attention', () => {
  it('leaves a locked required field out of Needs attention', async () => {
    const { container } = renderForm(CHECK, {} as never);

    // The required fields are materialised, so the rows exist — locked.
    await waitFor(() => expect(row(container, 'expected')).toBeTruthy());
    expect(row(container, 'expected')?.className).toContain('readfirst-row-disabled');
    expect(row(container, 'min')?.className).toContain('readfirst-row-disabled');

    // Nothing the author can act on, so there is no Needs attention box at all.
    expect(attentionBox(container)).toBeUndefined();
    expect(container.textContent).not.toContain('Needs attention');
  });

  it('still shows the locked field, among the optional ones, with what unlocks it', async () => {
    const { container } = renderForm(CHECK, {} as never);

    await waitFor(() => expect(row(container, 'expected')).toBeTruthy());
    const optional = box(container, 'Optional');
    expect(optional).toBeTruthy();
    expect(optional!.querySelector('[data-field="expected"]')).toBeTruthy();
    expect(optional!.querySelector('[data-field="min"]')).toBeTruthy();
  });

  it('needs attention once its dependency holds and it is still empty', async () => {
    const { container } = renderForm(CHECK, { kind: { type: 'string', value: 'equals' } } as never);

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    const attention = attentionBox(container)!;
    expect(attention.querySelector('[data-field="expected"]')).toBeTruthy();
    // `min` applies to `between` alone, so it is still locked and still not asked for.
    expect(attention.querySelector('[data-field="min"]')).toBeNull();
    // It is not dropped: it waits in the (collapsed) Optional box, which counts it.
    expect(box(container, 'Optional')?.textContent).toMatch(/^Optional1/);
  });

  it('asks for every field the dependency unlocks', async () => {
    const { container } = renderForm(CHECK, {
      kind: { type: 'string', value: 'between' },
    } as never);

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    const attention = attentionBox(container)!;
    expect(attention.querySelector('[data-field="expected"]')).toBeTruthy();
    expect(attention.querySelector('[data-field="min"]')).toBeTruthy();
  });

  it('moves the field into Needs attention when the dependency is set later', async () => {
    const { container, rerender } = renderForm(CHECK, {} as never);
    await waitFor(() => expect(row(container, 'expected')).toBeTruthy());
    expect(attentionBox(container)).toBeUndefined();

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='check'
            value={{ kind: { type: 'string', value: 'exists' } } as never}
            options={CHECK}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() =>
      expect(attentionBox(container)?.querySelector('[data-field="expected"]')).toBeTruthy()
    );
  });

  it('still asks for the required field that unlocks the others', async () => {
    // Negative: locking only waives the LOCKED field. A required dependency that
    // is empty is exactly what the author has to do next.
    const options = {
      ...(CHECK as object),
      kind: { ...(CHECK as Record<string, object>).kind, required: true },
    } as never;
    const { container } = renderForm(options, {} as never);

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    const attention = attentionBox(container)!;
    expect(attention.querySelector('[data-field="kind"]')).toBeTruthy();
    expect(attention.querySelector('[data-field="expected"]')).toBeNull();
    expect(attention.querySelector('[data-field="min"]')).toBeNull();
  });

  it('keeps a locked member of a one-of group out of Needs attention', async () => {
    // A one-of group whose members otherwise travel together: the member that is
    // locked cannot be the one that satisfies it, so it is not asked for; the
    // member that can still is.
    const options = {
      kind: { type: 'string', display_name: 'Kind', preselected: true },
      by_id: { type: 'string', display_name: 'By id', required_groups: ['target'] },
      by_path: {
        type: 'string',
        display_name: 'By path',
        required_groups: ['target'],
        depends_on: ['kind=path'],
      },
    } as never;
    const { container } = renderForm(options, {} as never);

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    const attention = attentionBox(container)!;
    expect(attention.querySelector('[data-field="by_id"]')).toBeTruthy();
    expect(attention.querySelector('[data-field="by_path"]')).toBeNull();
  });
});

describe("a locked required field's messages", () => {
  const messages = (value: Record<string, unknown>) =>
    getOptionFieldMessages({
      schema: CHECK as never,
      option: {} as never,
      name: 'expected',
      allOptions: value as never,
      getType: (type) => type as never,
    }).map((m) => String(m.label));

  it('says what unlocks it, not that it is required', () => {
    const labels = messages({ kind: { type: 'string' } });
    expect(labels).not.toContain('This field is required');
    expect(labels.some((l) => l.startsWith('This field is disabled because'))).toBe(true);
  });

  it('says it is required once it applies', () => {
    const labels = messages({ kind: { type: 'string', value: 'equals' } });
    expect(labels).toContain('This field is required');
    expect(labels.some((l) => l.startsWith('This field is disabled because'))).toBe(false);
  });
});
