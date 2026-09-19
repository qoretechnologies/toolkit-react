// Copyright 2026 Qore Technologies, s.r.o.
// A text field that offers templates draws the references in its value as chips.
//
// Template mode already did, but only a value that STARTS with a reference ever
// enters template mode. `Interface $local:id failed` stayed in the ordinary
// textarea, where the references read as their spelling.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Which editor drew the field LAST: before its mount effect settles the type,
   the field's first render is still untyped, so both may be called once. */
const editors = vi.hoisted(() => ({
  chips: undefined as any,
  textarea: undefined as any,
  last: undefined as 'chips' | 'textarea' | undefined,
}));

vi.mock('../src/components/form/fields/rich-text/RichText', () => ({
  RichTextFormField: (props: Record<string, any>) => {
    editors.chips = props;
    editors.last = 'chips';
    return null;
  },
}));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    editors.textarea = props;
    editors.last = 'textarea';
    return null;
  },
}));

import { AutoFormField, IAutoFieldProps } from '../src/components/form/fields/auto/AutoFormField';

const TEMPLATES = { items: [{ label: 'Interface ID', value: '$local:id' }] };
const VALUE = 'Interface $local:id failed';

const field = (props: Partial<IAutoFieldProps>) =>
  render(
    <ReqoreUIProvider>
      <AutoFormField name='message' value={VALUE} onChange={vi.fn()} {...props} />
    </ReqoreUIProvider>
  );

beforeEach(() => {
  editors.chips = undefined;
  editors.textarea = undefined;
  editors.last = undefined;
});

describe('a text field offering templates', () => {
  it('edits a string in the chip editor, as one line', () => {
    field({ defaultType: 'string', templates: TEMPLATES, allowTemplates: true });

    expect(editors.last).toBe('chips');
    expect(editors.chips).toMatchObject({ valueFormat: 'text', singleLine: true, value: VALUE });
  });

  it('edits a long string in the chip editor, as a document', () => {
    field({ defaultType: 'long-string', templates: TEMPLATES, allowTemplates: true });

    expect(editors.last).toBe('chips');
    expect(editors.chips).toMatchObject({ valueFormat: 'text', singleLine: false });
  });

  it('edits an untyped value in the chip editor', () => {
    field({ defaultType: 'auto', value: undefined, templates: TEMPLATES, allowTemplates: true });

    expect(editors.last).toBe('chips');
    expect(editors.chips).toMatchObject({ valueFormat: 'text' });
  });
});

describe('what keeps the textarea', () => {
  it('encoded content, where a chip would stand for nothing', () => {
    field({ defaultType: 'binary', templates: TEMPLATES, allowTemplates: true });

    expect(editors.last).toBe('textarea');
  });

  it('a field with no templates to offer', () => {
    field({ defaultType: 'string', templates: { items: [] }, allowTemplates: true });

    expect(editors.last).toBe('textarea');
    expect(editors.textarea).toMatchObject({ type: 'string', value: VALUE });
  });

  it('a field that does not take templates', () => {
    field({ defaultType: 'string', templates: TEMPLATES, allowTemplates: false });

    expect(editors.last).toBe('textarea');
  });
});
