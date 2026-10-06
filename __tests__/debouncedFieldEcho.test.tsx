// Copyright 2026 Qore Technologies, s.r.o.
// A debounced field must not lose what was typed to the echo of its own emit.
//
// Each field keeps a local copy of what is typed and reports it after a pause;
// the parent hands the value back down, usually after a debounce of its own.
// Every incoming value used to be copied over the local text, so the echo of an
// earlier emit landed on top of keys typed since: "ship-order" typed with 150 ms
// between keys came out as "shp-order".
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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
  ReqoreInput: (props: { value?: string | number; onChange?: (e: unknown) => void; type?: string; inputMode?: string }) => {
    numberInputProps = props;
    return <input data-testid='input' value={String(props.value ?? '')} onChange={props.onChange} />;
  },
  ReqoreControlGroup: ({ children }: { children?: unknown }) => <>{children}</>,
}));

vi.mock('../src/components/form/fields/file/File', () => ({
  ReqraftFileFormField: () => null,
}));

import { ReqraftBinaryFormField } from '../src/components/form/fields/binary/Binary';
import { EmittedValues } from '../src/components/form/fields/emittedValues';
import { LongStringFormField } from '../src/components/form/fields/long-string/LongString';
import { NumberFormField } from '../src/components/form/fields/number/Number';

/** What the number field last gave its input. */
let numberInputProps: { type?: string; inputMode?: string } = {};

/** The parent's own debounce: it echoes each value back this long after it heard it. */
const PARENT_ECHO_MS = 120;
let setExternal: (value: string | undefined) => void = () => undefined;
let lastReported: string | undefined;

/** A parent that stores what it hears and hands it back down after its own delay. */
const EchoingParent = ({ initial }: { initial?: string }) => {
  const [value, setValue] = useState<string | undefined>(initial);
  setExternal = setValue;
  return (
    <LongStringFormField
      value={value}
      onChange={(next) => {
        lastReported = next;
        setTimeout(() => setValue(next), PARENT_ECHO_MS);
      }}
    />
  );
};

/** Type like a person: each key goes on the end of whatever the field shows NOW,
 *  so a key the field threw away stays lost. */
const typeSlowly = async (testId: string, text: string, gapMs: number) => {
  for (const key of text) {
    const element = screen.getByTestId(testId) as HTMLInputElement;
    fireEvent.change(element, { target: { value: element.value + key } });
    await act(() => vi.advanceTimersByTimeAsync(gapMs));
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  lastReported = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LongStringFormField and the echo of its own emit', () => {
  it.each([110, 150, 230, 400])(
    'loses nothing typed %i ms apart against a parent that echoes late',
    async (gap) => {
      render(<EchoingParent />);
      await typeSlowly('textarea', 'ship-order', gap);
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('ship-order');
      expect(lastReported).toBe('ship-order');
    }
  );

  it('applies a genuine change from outside', async () => {
    render(<EchoingParent initial='abc' />);
    await typeSlowly('textarea', 'd', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    act(() => setExternal('reset by the host'));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('reset by the host');
  });

  it('applies an outside change back to a value it emitted earlier', async () => {
    // "abc" was emitted and echoed long ago; the host now restores it while the
    // field shows "abcd". It is no longer in flight, so it is a real change.
    render(<EchoingParent initial='' />);
    await typeSlowly('textarea', 'abc', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await typeSlowly('textarea', 'd', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('abcd');

    act(() => setExternal('abc'));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('abc');
  });

  it('clears, reports the clear once, and keeps it when the echo arrives', async () => {
    const onChange = vi.fn();
    const Parent = () => {
      const [value, setValue] = useState<string | undefined>('abc');
      return (
        <LongStringFormField
          value={value}
          onChange={(next) => {
            onChange(next);
            setTimeout(() => setValue(next), PARENT_ECHO_MS);
          }}
        />
      );
    };
    render(<Parent />);

    fireEvent.click(screen.getByTestId('clear'));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('keeps typing done after a clear whose echo is still in flight', async () => {
    render(<EchoingParent initial='abc' />);
    fireEvent.click(screen.getByTestId('clear'));
    await typeSlowly('textarea', 'xy', 60);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('xy');
    expect(lastReported).toBe('xy');
  });
});

describe('NumberFormField and the echo of its own emit', () => {
  let setNumber: (value: number | string | undefined) => void = () => undefined;
  let lastNumber: number | string | undefined;
  const Parent = ({ initial }: { initial?: number }) => {
    const [value, setValue] = useState<number | string | undefined>(initial);
    setNumber = setValue;
    return (
      <NumberFormField
        value={value}
        onChange={(next) => {
          lastNumber = next;
          setTimeout(() => setValue(next), PARENT_ECHO_MS);
        }}
      />
    );
  };

  it('loses no digit typed 150 ms apart', async () => {
    render(<Parent />);
    await typeSlowly('input', '1234567', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('1234567');
    expect(lastNumber).toBe(1234567);
  });

  it('applies a genuine change from outside', async () => {
    render(<Parent initial={5} />);
    await typeSlowly('input', '0', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(lastNumber).toBe(50);

    act(() => setNumber(5));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('5');
  });
});

describe('NumberFormField takes whatever is typed', () => {
  // A typed field is typed freely (David's review of qorus#646): a `number` input dropped every character that
  // is not part of a number, so a template (`$local:x`) or an expression (`@qty * 2`) could not be typed into a
  // whole-number field, and parseInt quietly cut `12abc` to 12.
  const emitted: unknown[] = [];
  const Parent = ({ type = 'int' as 'int' | 'float' }) => {
    const [value, setValue] = useState<number | string | undefined>(undefined);
    return (
      <NumberFormField
        type={type}
        value={value}
        onChange={(next) => {
          emitted.push(next);
          setTimeout(() => setValue(next), PARENT_ECHO_MS);
        }}
      />
    );
  };
  const typeAll = async (text: string) => {
    fireEvent.change(screen.getByTestId('input'), { target: { value: text } });
    await act(() => vi.advanceTimersByTimeAsync(1000));
  };

  beforeEach(() => {
    emitted.length = 0;
  });

  it('is a text field with a numeric keyboard, not a number input that drops characters', () => {
    render(<Parent />);
    // the stand-in renders the props the field passes to the input
    expect(numberInputProps.type).toBe('text');
    expect(numberInputProps.inputMode).toBe('numeric');
  });

  it('emits a whole number as a number, and what is not one as typed, to be flagged', async () => {
    render(<Parent />);
    await typeAll('42');
    expect(emitted.at(-1)).toBe(42);
    await typeAll('12abc');
    // kept as typed, not cut to 12: the form says it is not a whole number
    expect(emitted.at(-1)).toBe('12abc');
    expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('12abc');
    await typeAll('1.5');
    expect(emitted.at(-1)).toBe('1.5');
  });

  it('passes a template or an expression on as typed, for the field to take it as one', async () => {
    render(<Parent />);
    await typeAll('$local:quantity');
    expect(emitted.at(-1)).toBe('$local:quantity');
    await typeAll('@qty * 2');
    expect(emitted.at(-1)).toBe('@qty * 2');
  });

  it('keeps a decimal point typed before its digits', async () => {
    // `10.` is the number 10: showing the number instead of the text dropped the point, and `10.9` typed key
    // by key came out as `109`
    render(<Parent type='float' />);
    await typeSlowly('input', '10.9', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect((screen.getByTestId('input') as HTMLInputElement).value).toBe('10.9');
    expect(emitted.at(-1)).toBe(10.9);
  });

  it('reads a decimal number, a sign and an exponent in a float field', async () => {
    render(<Parent type='float' />);
    await typeAll('-1.25');
    expect(emitted.at(-1)).toBe(-1.25);
    await typeAll('2e3');
    expect(emitted.at(-1)).toBe(2000);
    await typeAll('1,5');
    expect(emitted.at(-1)).toBe('1,5');
  });
});

describe('ReqraftBinaryFormField and the echo of its own emit', () => {
  let lastBinary: string | undefined;
  let setBinary: (value: string | undefined) => void = () => undefined;
  const Parent = ({ initial }: { initial?: string }) => {
    const [value, setValue] = useState<string | undefined>(initial);
    setBinary = setValue;
    return (
      <ReqraftBinaryFormField
        value={value}
        onChange={(next) => {
          lastBinary = next;
          setTimeout(() => setValue(next), PARENT_ECHO_MS);
        }}
      />
    );
  };

  it('loses nothing typed 150 ms apart', async () => {
    render(<Parent />);
    await typeSlowly('textarea', 'aGVsbG8=', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('aGVsbG8=');
    expect(lastBinary).toBe('aGVsbG8=');
  });

  it('applies a genuine change from outside, and clears', async () => {
    render(<Parent initial='AAAA' />);
    act(() => setBinary('BBBB'));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('BBBB');

    fireEvent.click(screen.getByTestId('clear'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect((screen.getByTestId('textarea') as HTMLTextAreaElement).value).toBe('');
    expect(lastBinary).toBe('');
  });
});

describe('EmittedValues', () => {
  it('treats an emit in flight as an echo, and acknowledges the ones before it', () => {
    const emitted = new EmittedValues<string>();
    emitted.record('s');
    emitted.record('sh');
    emitted.record('shi');
    // A debouncing parent skipped "s"; its echo of "sh" covers it.
    expect(emitted.isEcho('sh')).toBe(true);
    expect(emitted.isEcho('s')).toBe(false);
  });

  it('treats anything not in flight as a change, and forgets what was in flight', () => {
    const emitted = new EmittedValues<string>();
    emitted.record('a');
    expect(emitted.isEcho('b')).toBe(false);
    // The parent moved past "a", so a later "a" is a change of its own.
    expect(emitted.isEcho('a')).toBe(false);
  });

  it('acknowledges each emit once, so the same value coming back again is a change', () => {
    const emitted = new EmittedValues<string>();
    emitted.record('x');
    expect(emitted.isEcho('x')).toBe(true);
    expect(emitted.isEcho('x')).toBe(false);
  });

  it('compares structured values with the equality it is given', () => {
    const emitted = new EmittedValues<unknown>((a, b) => JSON.stringify(a) === JSON.stringify(b));
    emitted.record([1, 2]);
    expect(emitted.isEcho([1, 2])).toBe(true);
  });
});
