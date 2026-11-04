// Copyright 2026 Qore Technologies, s.r.o.
// A list field's edit that waits for its pause is never lost when the field goes away (qorus#646): both list
// editors keep a local copy and report it 300 ms after the last change, and a read-first row's Done closed them
// inside that pause. Done sends the edit before the row closes, Cancel and Escape drop it, and any other way out
// sends it.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@qoretechnologies/reqore', () => ({
  ReqoreButton: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
  ReqoreControlGroup: ({ children, className, onKeyDown }: any) => (
    <div className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
  ReqorePanel: ({ children, className }: any) => <div className={className}>{children}</div>,
  ReqoreTag: ({ label, className }: any) => <span className={className}>{label}</span>,
  ReqoreTagGroup: ({ children }: any) => <div>{children}</div>,
  ReqoreVerticalSpacer: () => <div />,
  useReqoreProperty: () => vi.fn(),
}));

/* Each item of the panel list is a full template field; one input stands for it here. */
vi.mock('../src/components/form/fields/template/TemplateField', () => ({
  TemplateField: ({ name, value, onChange }: any) => (
    <input
      data-testid={name}
      value={value ?? ''}
      onChange={(e) => onChange(name, e.target.value)}
    />
  ),
}));
vi.mock('../src/components/form/fields/auto/AutoFormField', () => ({ AutoFormField: () => null }));

import { ArrayAuto } from '../src/components/form/fields/array/ArrayAuto';
import { ArrayAutoField } from '../src/components/form/fields/array/ArrayAutoField';
import {
  createPendingEdits,
  IPendingEdits,
  PendingEditsContext,
} from '../src/components/form/fields/pendingEdit';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A parent that keeps what it is told and hands it back down, as the form does. */
const Host = ({
  scope,
  initial,
  onChange,
  field,
}: {
  scope: IPendingEdits;
  initial: unknown[];
  onChange: (name: string, value: unknown) => void;
  field: (value: unknown[], onChange: (name: string, value: unknown) => void) => ReactNode;
}) => {
  const [value, setValue] = useState<unknown[]>(initial);
  return (
    <PendingEditsContext.Provider value={scope}>
      {field(value, (name, next) => {
        onChange(name, next);
        setValue(next as unknown[]);
      })}
    </PendingEditsContext.Provider>
  );
};

const stringItem = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) => (
  <input
    data-testid='array-input'
    value={(value as string) ?? ''}
    onChange={(e) => onChange(e.target.value)}
  />
);

/** Adds an item through the compact list's input and its confirm button. */
const addCompactItem = (text: string) => {
  fireEvent.change(screen.getByTestId('array-input'), { target: { value: text } });
  fireEvent.click(document.querySelector('.array-auto-compact-confirm')!);
};

/** Changes the first item of the panel list. */
const editPanelItem = (text: string) =>
  fireEvent.change(screen.getByTestId('list-0'), { target: { value: text } });

describe.each([
  {
    name: 'ArrayAutoField',
    field: (value: unknown[], onChange: (name: string, value: unknown) => void) => (
      <ArrayAutoField
        name='list'
        type='string'
        value={value}
        onChange={onChange}
        renderItem={stringItem}
      />
    ),
    edit: () => addCompactItem('second'),
    sent: ['first', 'second'],
  },
  {
    name: 'ArrayAuto',
    field: (value: unknown[], onChange: (name: string, value: unknown) => void) => (
      <ArrayAuto name='list' type='string' value={value} onChange={onChange as never} />
    ),
    edit: () => editPanelItem('changed'),
    sent: ['changed'],
  },
])('$name and an edit inside its pause', ({ field, edit, sent }) => {
  /** What the field reported, after its first report: the one its pause makes of the value it mounted with. */
  const settle = async () => act(() => vi.advanceTimersByTimeAsync(500));

  it('sends the edit when its scope flushes, before the pause, and once', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(<Host scope={scope} initial={['first']} onChange={onChange} field={field} />);
    await settle();
    onChange.mockClear();

    edit();
    act(() => scope.flush());
    expect(onChange).toHaveBeenCalledWith('list', sent);
    const reports = onChange.mock.calls.length;

    // the pause that follows reports the same list again at most, never anything else
    await settle();
    for (const call of onChange.mock.calls.slice(reports)) {
      expect(call).toEqual(['list', sent]);
    }
  });

  it('sends the edit when the field goes away inside the pause', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(
      <Host scope={scope} initial={['first']} onChange={onChange} field={field} />
    );
    await settle();
    onChange.mockClear();

    edit();
    unmount();

    expect(onChange).toHaveBeenCalledWith('list', sent);
  });

  it('drops the edit when its scope discards, and sends nothing as the field goes away', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(
      <Host scope={scope} initial={['first']} onChange={onChange} field={field} />
    );
    await settle();
    onChange.mockClear();

    edit();
    act(() => scope.discard());
    unmount();
    await settle();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('sends nothing where nothing was edited', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(
      <Host scope={scope} initial={['first']} onChange={onChange} field={field} />
    );
    await settle();
    onChange.mockClear();

    act(() => scope.flush());
    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});
