// Copyright 2026 Qore Technologies, s.r.o.
// An edit a debounced field has not reported yet is never lost when the field goes away (qorus#646).
//
// A field keeps a local copy of what is typed and reports it after a pause. The pause's timer dies with the
// field, and a read-first row's Done closes the row - and the field - at once: a value typed and Done pressed
// inside the pause never reached the form. The field now holds that edit for whoever closes it: the row's Done
// sends it (`flush`), Cancel and Escape drop it (`discard`), and any other way out sends it.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@qoretechnologies/reqore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ReqoreTextarea: ({
    value,
    onChange,
    onClearClick,
  }: {
    value?: string;
    onChange?: (e: unknown) => void;
    onClearClick?: () => void;
  }) => (
    <>
      <textarea data-testid='textarea' value={value} onChange={onChange} />
      <button data-testid='clear' onClick={onClearClick} />
    </>
  ),
  ReqoreInput: (props: { value?: string | number; onChange?: (e: unknown) => void }) => (
    <input data-testid='input' value={String(props.value ?? '')} onChange={props.onChange} />
  ),
  ReqoreControlGroup: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/form/fields/file/File', () => ({
  ReqraftFileFormField: () => null,
}));

import { ReqraftBinaryFormField } from '../src/components/form/fields/binary/Binary';
import { LongStringFormField } from '../src/components/form/fields/long-string/LongString';
import { NumberFormField } from '../src/components/form/fields/number/Number';
import {
  createPendingEdits,
  IPendingEdits,
  PendingEditsContext,
  usePendingEdit,
} from '../src/components/form/fields/pendingEdit';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a scope of pending edits', () => {
  it('flushes and discards every field that joined it, and none that left', () => {
    const scope = createPendingEdits();
    const a = { flush: vi.fn(), discard: vi.fn() };
    const b = { flush: vi.fn(), discard: vi.fn() };
    scope.join(a);
    const leaveB = scope.join(b);

    scope.flush();
    expect(a.flush).toHaveBeenCalledTimes(1);
    expect(b.flush).toHaveBeenCalledTimes(1);

    leaveB();
    scope.discard();
    expect(a.discard).toHaveBeenCalledTimes(1);
    expect(b.discard).not.toHaveBeenCalled();
  });
});

/** A field made of the hook alone: what it holds is set from outside. */
let probe: { hold: (value: string) => void; release: () => void } | undefined;
const Probe = ({ send }: { send: (value: string) => void }) => {
  probe = usePendingEdit<string>(send);
  return null;
};

const inScope = (scope: IPendingEdits, children: ReactNode) => (
  <PendingEditsContext.Provider value={scope}>{children}</PendingEditsContext.Provider>
);

describe('usePendingEdit', () => {
  it('sends what it holds when its scope flushes, once', () => {
    const scope = createPendingEdits();
    const send = vi.fn();
    render(inScope(scope, <Probe send={send} />));

    act(() => probe!.hold('typed'));
    scope.flush();
    scope.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('typed');
  });

  it('sends only the latest of what it held', () => {
    const scope = createPendingEdits();
    const send = vi.fn();
    render(inScope(scope, <Probe send={send} />));

    act(() => {
      probe!.hold('t');
      probe!.hold('typed');
    });
    scope.flush();

    expect(send.mock.calls).toEqual([['typed']]);
  });

  it('sends nothing once released, or when nothing was held', () => {
    const scope = createPendingEdits();
    const send = vi.fn();
    const { unmount } = render(inScope(scope, <Probe send={send} />));

    scope.flush();
    act(() => {
      probe!.hold('typed');
      probe!.release();
    });
    scope.flush();
    unmount();

    expect(send).not.toHaveBeenCalled();
  });

  it('sends what it holds when it goes away without a word from its scope', () => {
    const send = vi.fn();
    const { unmount } = render(<Probe send={send} />);

    act(() => probe!.hold('typed'));
    unmount();

    expect(send).toHaveBeenCalledWith('typed');
  });

  it('drops what it holds when its scope discards, and sends nothing on the way out', () => {
    const scope = createPendingEdits();
    const send = vi.fn();
    const { unmount } = render(inScope(scope, <Probe send={send} />));

    act(() => probe!.hold('typed'));
    scope.discard();
    unmount();

    expect(send).not.toHaveBeenCalled();
  });

  it('leaves its scope when it goes away', () => {
    const scope = createPendingEdits();
    const send = vi.fn();
    const { unmount } = render(inScope(scope, <Probe send={send} />));

    act(() => probe!.hold('typed'));
    unmount();
    expect(send).toHaveBeenCalledTimes(1);

    // the field is gone: a flush of its old scope reaches nothing
    scope.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends with the send of the latest render', () => {
    const scope = createPendingEdits();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(inScope(scope, <Probe send={first} />));

    act(() => probe!.hold('typed'));
    rerender(inScope(scope, <Probe send={second} />));
    scope.flush();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('typed');
  });
});

/** A parent that keeps what it is told and hands it back down, as the form does. */
const Host = <T,>({
  scope,
  initial,
  onChange,
  field,
}: {
  scope: IPendingEdits;
  initial?: T;
  onChange: (value: T) => void;
  field: (value: T | undefined, onChange: (value: T) => void) => ReactNode;
}) => {
  const [value, setValue] = useState<T | undefined>(initial);
  return inScope(
    scope,
    field(value, (next) => {
      onChange(next);
      setValue(next);
    })
  );
};

const typeInto = (testId: string, text: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value: text } });

describe.each([
  {
    name: 'LongStringFormField',
    testId: 'textarea',
    typed: 'ship-order',
    sent: 'ship-order',
    field: (value: unknown, onChange: (value: unknown) => void) => (
      <LongStringFormField value={value as string} onChange={(next) => onChange(next)} />
    ),
  },
  {
    name: 'NumberFormField',
    testId: 'input',
    typed: '12.5',
    sent: 12.5,
    field: (value: unknown, onChange: (value: unknown) => void) => (
      <NumberFormField type='float' value={value as number} onChange={(next) => onChange(next)} />
    ),
  },
  {
    name: 'ReqraftBinaryFormField',
    testId: 'textarea',
    typed: 'aGVsbG8=',
    sent: 'aGVsbG8=',
    field: (value: unknown, onChange: (value: unknown) => void) => (
      <ReqraftBinaryFormField value={value as string} onChange={(next) => onChange(next)} />
    ),
  },
])('$name and an edit inside its pause', ({ testId, typed, sent, field }) => {
  it('sends the edit when its scope flushes, before the pause', () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(<Host scope={scope} onChange={onChange} field={field} />);

    typeInto(testId, typed);
    act(() => scope.flush());

    expect(onChange).toHaveBeenCalledWith(sent);
  });

  it('does not send it a second time when the pause comes after the flush', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(<Host scope={scope} onChange={onChange} field={field} />);

    typeInto(testId, typed);
    act(() => scope.flush());
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on a flush after the pause has sent it', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(<Host scope={scope} onChange={onChange} field={field} />);

    typeInto(testId, typed);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => scope.flush());

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sends the edit when the field goes away inside the pause', () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(<Host scope={scope} onChange={onChange} field={field} />);

    typeInto(testId, typed);
    unmount();

    expect(onChange).toHaveBeenCalledWith(sent);
  });

  it('drops the edit when its scope discards, and sends nothing then or later', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(<Host scope={scope} onChange={onChange} field={field} />);

    typeInto(testId, typed);
    act(() => scope.discard());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('sends nothing where nothing was edited', () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(<Host scope={scope} onChange={onChange} field={field} />);

    act(() => scope.flush());
    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('an edit and a value from outside', () => {
  it('is dropped when the parent hands down a value of its own', () => {
    // The parent has moved past what was typed: sending it on the way out would put it back over the
    // parent's own value.
    const scope = createPendingEdits();
    const onChange = vi.fn();
    let setOutside: (value: string) => void = () => undefined;
    const Parent = () => {
      const [value, setValue] = useState<string>('first');
      setOutside = setValue;
      return inScope(scope, <LongStringFormField value={value} onChange={onChange} />);
    };
    const { unmount } = render(<Parent />);

    typeInto('textarea', 'typed');
    act(() => setOutside('from outside'));
    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('from outside');
    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});
