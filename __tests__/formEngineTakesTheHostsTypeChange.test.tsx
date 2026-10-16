// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  FormEngine,
  mergeOwnEdits,
  takeHostsAttributes,
} from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A type the host changes is taken, even where the value the field holds stays the same (qorus#646).
 *
 * The Qorus IDE's sheet review: an added field is a whole number holding the record's field `pos`, and is then
 * made true or false. The host hands down the same `pos`, now typed `bool`. Since 9cd612cc the form recognises
 * its own report coming back by its values only, so it took that for its own report and kept the field an
 * `int`: opened, the field showed `pos` as text on its Value tab, where a true or false field shows the field it
 * holds on its Expression tab.
 */
const POS = '$data:pos';

const schemaFor = (type: string) =>
  ({
    value: {
      type,
      display_name: 'Value',
      preselected: true,
      supports_templates: true,
      supports_expressions: true,
    },
  }) as never;

const valueFor = (type: string) => ({ value: { type, value: POS } }) as never;

const form = (type: string, onChange = vi.fn()) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine
        compact
        name='added'
        allowTemplates
        value={valueFor(type)}
        options={schemaFor(type)}
        onChange={onChange}
      />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

const row = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-field="value"]');
const activeTab = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.value-tab[aria-pressed="true"]')?.getAttribute('data-tab');

describe('a field whose type the host changes while its value stays the same', () => {
  it('opens as the type the host gave it: a true or false field holding a field, on its Expression tab', async () => {
    const { container, rerender } = render(form('int'));
    await waitFor(() => expect(row(container)).toBeTruthy());

    rerender(form('bool'));

    fireEvent.click(row(container) as HTMLElement);
    await waitFor(() => expect(container.querySelector('.value-tab')).toBeTruthy());
    expect(activeTab(container)).toBe('expression');
    expect(container.querySelector('.value-tab-text')).toBeNull();
  });

  it('as a whole number it opened on its Value tab, the field written in its text', async () => {
    const { container } = render(form('int'));
    await waitFor(() => expect(row(container)).toBeTruthy());

    fireEvent.click(row(container) as HTMLElement);
    await waitFor(() => expect(container.querySelector('.value-tab')).toBeTruthy());
    expect(activeTab(container)).toBe('value');
    expect(container.querySelector('.value-tab-text')).toBeTruthy();
  });
});

describe('the host type change merged with an edit of the form', () => {
  it('keeps the edit and takes the type', () => {
    expect(
      mergeOwnEdits(
        { value: { type: 'bool', value: POS } } as never,
        { value: { type: 'int', value: '$data:qty' } } as never,
        { value: { type: 'int', value: POS } } as never
      )
    ).toEqual({ value: { type: 'bool', value: '$data:qty' } });
  });

  it('keeps the edit as it is where the host changed nothing', () => {
    expect(
      mergeOwnEdits(
        { value: { type: 'int', value: POS } } as never,
        { value: { type: 'int', value: '$data:qty' } } as never,
        { value: { type: 'int', value: POS } } as never
      )
    ).toEqual({ value: { type: 'int', value: '$data:qty' } });
  });
});

describe('what the host changed beside a value, as the form takes it in', () => {
  const ours = { value: { type: 'int', value: POS }, other: { type: 'string', value: 'x' } };

  it('takes a type the host changed', () => {
    expect(
      takeHostsAttributes(
        { value: { type: 'bool', value: POS } } as never,
        ours as never,
        { value: { type: 'int', value: POS } } as never
      )
    ).toEqual({ ...ours, value: { type: 'bool', value: POS } });
  });

  it('keeps its own type where the host writes the type it always writes', () => {
    // a host that stores what an `int` field reports as a `string`, as the Qorus IDE's editors do
    const same = takeHostsAttributes(
      { value: { type: 'string', value: POS } } as never,
      ours as never,
      { value: { type: 'string', value: POS } } as never
    );
    expect(same).toBe(ours);
  });

  it('takes whether the value is an expression, and an operator, the host changed', () => {
    expect(
      takeHostsAttributes(
        { value: { type: 'int', value: POS, is_expression: true, op: ['>'] } } as never,
        ours as never,
        { value: { type: 'int', value: POS } } as never
      )
    ).toEqual({ ...ours, value: { type: 'int', value: POS, is_expression: true, op: ['>'] } });
  });

  it('drops an operator the host dropped', () => {
    expect(
      takeHostsAttributes(
        { value: { type: 'int', value: POS } } as never,
        { value: { type: 'int', value: POS, op: ['>'] } } as never,
        { value: { type: 'int', value: POS, op: ['>'] } } as never
      )
    ).toEqual({ value: { type: 'int', value: POS } });
  });

  it('takes anything else the host changed beside the value, as it would a type', () => {
    expect(
      takeHostsAttributes(
        { value: { type: 'int', value: POS, kind: 'computed' } } as never,
        ours as never,
        { value: { type: 'int', value: POS, kind: 'constant' } } as never
      )
    ).toEqual({ ...ours, value: { type: 'int', value: POS, kind: 'computed' } });
  });

  it('keeps what only the form says beside a value, where the host never wrote it', () => {
    const own = { value: { type: 'int', value: POS, note: 'the form' } };
    expect(
      takeHostsAttributes(
        { value: { type: 'int', value: POS } } as never,
        own as never,
        { value: { type: 'int', value: POS } } as never
      )
    ).toBe(own);
  });

  it('leaves a bare value as it is', () => {
    const flat = { value: 5 };
    expect(takeHostsAttributes({ value: 6 } as never, flat as never, { value: 5 } as never)).toBe(
      flat
    );
  });
});

/** A field editor the test types into from outside: what it reports goes straight to the form. */
const editor: { report?: (value: string) => void } = {};
const ProbeText = ({ onChange }: { onChange: (value: string) => void }) => {
  editor.report = onChange;
  return null;
};

type TField = { type: string; value: unknown };
const host: {
  draft: Record<string, TField>;
  /** The type of `value` in every report, in order. */
  reportedTypes: (string | undefined)[];
  setDraft?: (draft: Record<string, TField>) => void;
} = { draft: {}, reportedTypes: [] };

/** Stores each field as it is reported, type and all, and hands it back down at once. */
const TypedHost = ({ initial }: { initial: Record<string, TField> }) => {
  const [draft, setDraft] = useState(initial);
  host.draft = draft;
  host.setDraft = setDraft;
  const onChange = useCallback((_name: string, next: Record<string, TField>) => {
    host.reportedTypes.push(next?.value?.type);
    setDraft((previous) =>
      JSON.stringify(next) === JSON.stringify(previous) ? previous : { ...next }
    );
  }, []);
  return (
    <FormEngine
      compact
      name='added'
      allowTemplates
      value={draft as never}
      options={
        {
          name: { type: 'string', ui_type: 'probe-text', display_name: 'Name', preselected: true },
          value: (schemaFor(draft.value.type) as Record<string, unknown>).value,
        } as never
      }
      componentOverrides={{ 'probe-text': ProbeText }}
      rendererOnlyUiTypes={['probe-text']}
      initialExpandedOptions={['name']}
      onChange={onChange as never}
    />
  );
};

describe('a host type change in the same commit as an edit in the form', () => {
  it('is never reported back as the type it was', async () => {
    host.reportedTypes = [];
    editor.report = undefined;
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <TypedHost
            initial={{
              name: { type: 'string', value: 'new_field' },
              value: { type: 'int', value: POS },
            }}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(editor.report).toBeTruthy());
    const before = host.reportedTypes.length;

    // the host makes the field true or false as the user's edit to the name reaches the form: one commit
    act(() => {
      host.setDraft!({ ...host.draft, value: { type: 'bool', value: POS } });
      editor.report!('flag');
    });

    await waitFor(() =>
      expect(host.draft).toEqual({
        name: { type: 'string', value: 'flag' },
        value: { type: 'bool', value: POS },
      })
    );
    // the form's copy, made before the host's change, was not sent over it
    expect(host.reportedTypes.slice(before)).not.toContain('int');
  });
});
