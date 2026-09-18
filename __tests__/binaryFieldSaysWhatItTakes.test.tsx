// Copyright 2026 Qore Technologies, s.r.o.
// A binary field says what it takes before it is typed into.
//
// Picking "Binary" gave a bare textarea: nothing said whether the value should
// be hex or base64. The server decodes it as base64 unless it is told
// otherwise (Qorus `lib/misc.ql` `_priv_parse_ui_hash_value_intern`, symmetric
// with the `toBase64()` it encodes with), and bare hex is the trap — it is not
// rejected, it is read as base64 and corrupts.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';

const field = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <AutoFormField name='blob' value={'' as never} onChange={vi.fn()} {...(props as never)} />
    </ReqoreUIProvider>
  );

beforeEach(() => {
  editor.props = undefined;
});

describe('a binary field', () => {
  it('names the encodings it accepts, base64 first', () => {
    field({ defaultType: 'binary' });

    const placeholder = String(editor.props?.placeholder ?? '');
    expect(placeholder).toMatch(/base64/i);
    expect(placeholder).toMatch(/0x/);
  });

  it('defers to a placeholder the caller wrote', () => {
    field({ defaultType: 'binary', placeholder: 'The attachment body' });

    expect(editor.props?.placeholder).toBe('The attachment body');
  });
});

describe('the field beside it', () => {
  it('leaves `data` alone — it is not base64', () => {
    field({ defaultType: 'data' });

    expect(editor.props?.placeholder).toBeUndefined();
  });
});
