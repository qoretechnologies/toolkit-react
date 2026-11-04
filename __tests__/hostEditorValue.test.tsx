// Copyright 2026 Qore Technologies, s.r.o.
// A host editor (`componentOverrides`) is never handed its own report back as a change.
//
// The Qorus IDE's rich text keeps what is typed, reports it after a pause and takes any other value it is
// handed for a change from outside. An emptied test-case Value reported "" and came back as "" and then, once
// the form had stored it, as undefined - after a 1 was typed and before it was reported - and the 1 was
// wiped, Slate's caret left past the end of the emptied text (qorus#646).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import {
  sameHostEditorValue,
  useHostEditorValue,
} from '../src/components/form/fields/auto/hostEditorValue';

const hook = (initial: unknown) =>
  renderHook(({ value }) => useHostEditorValue(value), { initialProps: { value: initial } });

describe('sameHostEditorValue', () => {
  it('reads "" and undefined as one empty value, and null as a value of its own', () => {
    expect(sameHostEditorValue('', undefined)).toBe(true);
    expect(sameHostEditorValue(undefined, '')).toBe(true);
    expect(sameHostEditorValue(null, undefined)).toBe(false);
    expect(sameHostEditorValue(null, '')).toBe(false);
  });

  it('reads equal values as the same, whatever object each is', () => {
    expect(sameHostEditorValue([{ text: 'a' }], [{ text: 'a' }])).toBe(true);
    expect(sameHostEditorValue('a', 'b')).toBe(false);
  });
});

describe('useHostEditorValue', () => {
  it('hands the value down as it is while the editor has reported nothing', () => {
    const { result, rerender } = hook('$local:pos');
    expect(result.current.value).toBe('$local:pos');
    rerender({ value: 'changed from outside' });
    expect(result.current.value).toBe('changed from outside');
  });

  it('hands an emptied value back as the editor reported it, however the form stores it', () => {
    const { result, rerender } = hook('$local:pos');
    result.current.record('');
    rerender({ value: '' });
    expect(result.current.value).toBe('');
    // stored a second way: the same empty value
    rerender({ value: undefined });
    expect(result.current.value).toBe('');
  });

  it('hands an older report coming back late as the latest report', () => {
    const first = [{ text: '1' }];
    const second = [{ text: '12' }];
    const { result, rerender } = hook(undefined);
    result.current.record(first);
    result.current.record(second);
    rerender({ value: [{ text: '1' }] });
    expect(result.current.value).toBe(second);
  });

  it('hands its own report back as the same object, though the form hands down a copy', () => {
    const report = [{ type: 'paragraph', children: [{ text: '1' }] }];
    const { result, rerender } = hook(undefined);
    result.current.record(report);
    rerender({ value: JSON.parse(JSON.stringify(report)) });
    expect(result.current.value).toBe(report);
  });

  it('hands a change from outside down as it is, and holds nothing back after it', () => {
    const { result, rerender } = hook('');
    result.current.record('1');
    rerender({ value: '1' });
    rerender({ value: 'from outside' });
    expect(result.current.value).toBe('from outside');
    // the report from before the change is no report of the editor's any more
    rerender({ value: '1' });
    expect(result.current.value).toBe('1');
  });

  it('hands null down as null: it is a value, not an empty one', () => {
    const { result, rerender } = hook(undefined);
    result.current.record('');
    rerender({ value: '' });
    rerender({ value: null });
    expect(result.current.value).toBeNull();
  });
});

describe("a host editor's onChange", () => {
  it('is one function for the life of the field, so a render of the form does not restart its pause', () => {
    const seen: unknown[] = [];
    const HostEditor = ({ onChange }: { onChange: unknown }) => {
      seen.push(onChange);
      return null;
    };
    const field = (value: string) => (
      <ReqoreUIProvider>
        <AutoFormField
          name='checked_value'
          type={'host' as any}
          defaultType={'host' as any}
          value={value}
          componentOverrides={{ host: HostEditor }}
          onChange={vi.fn()}
        />
      </ReqoreUIProvider>
    );
    const { rerender } = render(field('a'));
    rerender(field('b'));

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('reports on to the form with the type the field is drawn as', () => {
    const onChange = vi.fn();
    let report: ((value: unknown) => void) | undefined;
    const HostEditor = ({ onChange: hostOnChange }: { onChange: (value: unknown) => void }) => {
      report = hostOnChange;
      return null;
    };
    render(
      <ReqoreUIProvider>
        <AutoFormField
          name='checked_value'
          type={'host' as any}
          defaultType={'host' as any}
          value=''
          componentOverrides={{ host: HostEditor }}
          onChange={onChange}
        />
      </ReqoreUIProvider>
    );
    report?.('1');

    expect(onChange).toHaveBeenCalledWith('checked_value', '1', 'host', undefined);
  });
});
