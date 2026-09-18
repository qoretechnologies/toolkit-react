// Copyright 2026 Qore Technologies, s.r.o.
// A field with nothing to offer offers nothing — not an empty menu.
//
// The field handed its editor the list props even when there was no list —
// `{...undefined, ...TemplatesListProps}` is an object with no items — and an
// editor GIVEN a list draws the control that opens it. So a field whose schema
// does not allow templates, or whose templates the type filter emptied, opened
// a menu with nothing in it (reported on Auto · Via Form Engine after choosing
// a type).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Both editors a text field can render: the textarea, and the chip editor it
   uses when there are templates to offer. */
const editors = vi.hoisted(() => ({
  textarea: undefined as Record<string, any> | undefined,
  chips: undefined as Record<string, any> | undefined,
  last: undefined as 'textarea' | 'chips' | undefined,
}));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    editors.textarea = props;
    editors.last = 'textarea';
    return <textarea value={props.value ?? ''} onChange={() => undefined} />;
  },
}));

vi.mock('../src/components/form/fields/rich-text/RichText', () => ({
  RichTextFormField: (props: Record<string, any>) => {
    editors.chips = props;
    editors.last = 'chips';
    return null;
  },
}));

import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const A_STRING_TEMPLATE = { items: [{ label: 'A name', badge: 'string', value: '$local:name' }] };

const stringField = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <TemplateField
          name='subject'
          type={'string' as never}
          value={'hello' as never}
          allowCustomValues
          onChange={vi.fn()}
          {...(props as never)}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

beforeEach(() => {
  editors.textarea = undefined;
  editors.chips = undefined;
  editors.last = undefined;
});

describe('the templates a field hands its editor', () => {
  it('are none when the field may not use templates', async () => {
    // What a FormEngine option without `supports_templates` gets.
    stringField({ allowTemplates: false, templates: A_STRING_TEMPLATE });

    await waitFor(() => expect(editors.last).toBe('textarea'));
    expect(editors.textarea?.templates).toBeUndefined();
  });

  it('are none when the list it would offer is empty', async () => {
    stringField({ allowTemplates: true, templates: { items: [] } });

    await waitFor(() => expect(editors.last).toBe('textarea'));
    expect(editors.textarea?.templates).toBeUndefined();
  });

  it('are the list itself when it holds something', async () => {
    stringField({ allowTemplates: true, templates: A_STRING_TEMPLATE });

    await waitFor(() => expect(editors.last).toBe('chips'));
    expect(JSON.stringify(editors.chips?.templates)).toContain('$local:name');
  });
});
