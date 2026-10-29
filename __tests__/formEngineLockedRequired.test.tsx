import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A required field whose `depends_on` does not hold yet is not something the author can act on. It used to be
 * listed under "Needs attention" anyway — the form counted a required empty field as needing attention whether or
 * not it applied — which is how a guided check in qorus-ide came to ask for its Path, Minimum, Maximum and
 * Expected value before the author had even picked what kind of check it was. Then it was shown locked, waiting,
 * with what unlocks it; now (qorus#646, David) it is not shown at all until it applies.
 *
 * What does need attention is the field that unlocks it, when that one is itself
 * required; and the field the moment its dependency holds and it is still empty.
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
  it('leaves a required field whose dependency does not hold out of the form, and of Needs attention', async () => {
    const { container } = renderForm(CHECK, {} as never);

    // The form is drawn - its kind - and the fields that do not apply yet are not in it, waiting or otherwise.
    await waitFor(() => expect(row(container, 'kind')).toBeTruthy());
    expect(row(container, 'expected')).toBeNull();
    expect(row(container, 'min')).toBeNull();
    expect(container.querySelector('.readfirst-row-disabled')).toBeNull();

    // Nothing the author can act on, so there is no Needs attention box at all.
    expect(attentionBox(container)).toBeUndefined();
    expect(container.textContent).not.toContain('Needs attention');
  });

  it('shows it nowhere, not among the optional ones either, and says nothing of it while it holds nothing', async () => {
    const { container } = renderForm(CHECK, {} as never);

    await waitFor(() => expect(row(container, 'kind')).toBeTruthy());
    expect(box(container, 'Optional')?.querySelector('[data-field="expected"]') ?? null).toBeNull();
    expect(box(container, 'Optional')?.querySelector('[data-field="min"]') ?? null).toBeNull();
    // empty, so there is no value to account for
    expect(container.querySelector('.form-hidden-field-notes')).toBeNull();
  });

  it('needs attention once its dependency holds and it is still empty', async () => {
    const { container } = renderForm(CHECK, { kind: { type: 'string', value: 'equals' } } as never);

    await waitFor(() => expect(attentionBox(container)).toBeTruthy());
    const attention = attentionBox(container)!;
    expect(attention.querySelector('[data-field="expected"]')).toBeTruthy();
    // `min` applies to `between` alone, so it still does not apply: not asked for, and not in the form.
    expect(attention.querySelector('[data-field="min"]')).toBeNull();
    expect(row(container, 'min')).toBeNull();
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

  it('shows the field, in Needs attention, when the dependency is set later', async () => {
    const { container, rerender } = renderForm(CHECK, {} as never);
    await waitFor(() => expect(row(container, 'kind')).toBeTruthy());
    expect(row(container, 'expected')).toBeNull();
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

describe('a locked required field and the completeness status', () => {
  const header = async (container: HTMLElement) => {
    await waitFor(() =>
      expect(container.querySelector('.options-readfirst-completion')).toBeTruthy()
    );
    return container.querySelector('.options-readfirst-completion')!.textContent || '';
  };

  it('reads Ready, and reports the form valid, when only locked fields are empty', async () => {
    // The kind is optional and unset, so nothing the author can fill in is
    // missing: the locked fields do not apply. Incomplete with nothing under
    // "Needs attention" would ask for something the form does not let them do.
    const onValidityChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='check'
            value={{} as never}
            options={CHECK}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    const text = await header(container);
    expect(text).toContain('Ready');
    expect(text).not.toContain('Incomplete');
    expect(text).not.toContain('need attention');
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true, expect.anything()));
  });

  it('can be complete while a field for another kind is locked and empty', async () => {
    // Equals with its expected value: Minimum applies to Between alone, so it
    // must not hold the form back.
    const onValidityChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='check'
            value={
              {
                kind: { type: 'string', value: 'equals' },
                expected: { type: 'string', value: '42' },
              } as never
            }
            options={CHECK}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    expect(await header(container)).toContain('Ready');
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true, expect.anything()));
  });

  it('reads Incomplete once the dependency unlocks an empty required field', async () => {
    const onValidityChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='check'
            value={{ kind: { type: 'string', value: 'between' } } as never}
            options={CHECK}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    const text = await header(container);
    expect(text).toContain('Incomplete');
    expect(text).not.toContain('Ready');
    expect(text).not.toContain('Draft');
    await waitFor(() =>
      expect(onValidityChange).toHaveBeenLastCalledWith(false, expect.anything())
    );
  });

  it('keeps a value a hidden field holds, does not let it hold the form back, and says it is not valid', async () => {
    // The field does not apply, and is not in the form, so nothing in it can be fixed there: it does not make
    // the form invalid. Its value is kept, and the form's note says it is not valid (qorus#646).
    const onValidityChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='check'
            value={{ min: { type: 'int', value: 'not a number' } } as never}
            options={CHECK}
            onChange={vi.fn()}
            onValidityChange={onValidityChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenLastCalledWith(true, expect.anything()));
    const note = await waitFor(() => {
      const found = container.querySelector('[data-field-hidden="min"]');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(note.textContent).toMatch(
      /^"Minimum" is hidden until it applies \("Kind" must be "between"\)\. Its value is kept, but it is not valid: .+\.$/
    );
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
