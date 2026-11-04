// Copyright 2026 Qore Technologies, s.r.o.
// A field opened and left untouched reports nothing (qorus#646).
//
// The number and binary fields compared what they show ('' for no value) with the value they were handed
// (undefined), found them different, and reported '' 100 ms after they opened: the form counted itself
// edited (a read-first row's Cancel appeared) and a field that had no value got ''. The list fields
// reported their list 300 ms after they opened, whatever it was. Found by the Qorus IDE's stories.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@qoretechnologies/reqore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ReqoreTextarea: ({ value, onChange }: { value?: string; onChange?: (e: unknown) => void }) => (
    <textarea data-testid='textarea' value={value} onChange={onChange} />
  ),
  ReqoreInput: (props: { value?: string | number; onChange?: (e: unknown) => void }) => (
    <input data-testid='input' value={String(props.value ?? '')} onChange={props.onChange} />
  ),
  ReqoreControlGroup: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ReqoreButton: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
  ReqorePanel: ({ children }: any) => <div>{children}</div>,
  ReqoreTag: ({ label }: any) => <span>{label}</span>,
  ReqoreTagGroup: ({ children }: any) => <div>{children}</div>,
  ReqoreVerticalSpacer: () => <div />,
  useReqoreProperty: () => vi.fn(),
}));

vi.mock('../src/components/form/fields/file/File', () => ({
  ReqraftFileFormField: () => null,
}));
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
import { ReqraftBinaryFormField } from '../src/components/form/fields/binary/Binary';
import { LongStringFormField } from '../src/components/form/fields/long-string/LongString';
import { NumberFormField } from '../src/components/form/fields/number/Number';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Past the longest pause a field waits before it reports (the lists' 300 ms). */
const pastThePause = () => act(() => vi.advanceTimersByTimeAsync(1000));

const textItem = ({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) => (
  <input
    data-testid='item'
    value={(value as string) ?? ''}
    onChange={(e) => onChange(e.target.value)}
  />
);

describe.each([
  {
    name: 'a number field',
    field: (onChange: (...args: unknown[]) => void, value?: unknown) => (
      <NumberFormField type='float' value={value as number} onChange={onChange} />
    ),
    testId: 'input',
    typed: '12.5',
  },
  {
    name: 'a binary field',
    field: (onChange: (...args: unknown[]) => void, value?: unknown) => (
      <ReqraftBinaryFormField value={value as string} onChange={onChange} />
    ),
    testId: 'textarea',
    typed: 'aGVsbG8=',
  },
  {
    name: 'a text field',
    field: (onChange: (...args: unknown[]) => void, value?: unknown) => (
      <LongStringFormField value={value as string} onChange={onChange} />
    ),
    testId: 'textarea',
    typed: 'ship-order',
  },
])('$name', ({ field, testId, typed }) => {
  it('opened without a value and left alone, reports nothing', async () => {
    const onChange = vi.fn();
    render(field(onChange));
    await pastThePause();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('opened with null and left alone, reports nothing', async () => {
    const onChange = vi.fn();
    render(field(onChange, null));
    await pastThePause();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('still reports what is typed into it', async () => {
    const onChange = vi.fn();
    render(field(onChange));

    fireEvent.change(screen.getByTestId(testId), { target: { value: typed } });
    await pastThePause();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('still reports being emptied', async () => {
    const onChange = vi.fn();
    render(field(onChange, typed));

    fireEvent.change(screen.getByTestId(testId), { target: { value: '' } });
    await pastThePause();

    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe.each([
  {
    name: 'a list field (ArrayAutoField)',
    field: (onChange: (...args: unknown[]) => void, value?: unknown[]) => (
      <ArrayAutoField
        name='list'
        type='string'
        value={value}
        onChange={onChange}
        renderItem={textItem}
      />
    ),
  },
  {
    name: 'a list field (ArrayAuto)',
    field: (onChange: (...args: unknown[]) => void, value?: unknown[]) => (
      <ArrayAuto name='list' type='string' value={value} onChange={onChange as never} />
    ),
  },
])('$name', ({ field }) => {
  it('opened without a value and left alone, reports nothing', async () => {
    const onChange = vi.fn();
    render(field(onChange));
    await pastThePause();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('opened with a list and left alone, reports nothing', async () => {
    const onChange = vi.fn();
    render(field(onChange, ['first']));
    await pastThePause();

    expect(onChange).not.toHaveBeenCalled();
  });
});
