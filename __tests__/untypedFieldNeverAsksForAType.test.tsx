// Copyright 2026 Qore Technologies, s.r.o.
// An empty untyped field never asks "Please select data type".
//
// It opens on something to type into, whether or not templates are on offer,
// and whether or not they have arrived yet; a value of an explicit type is set
// from the ⋮ menu. The type picker was kept for fields with nothing to pick, and
// the rule that chose the typable editor instead read the template list once, at
// mount — so on a cold load, before the type-filtered list existed, every such
// field landed on the picker and stayed there. Storybook's own "Empty Any Opens
// On Templates" settled on the picker its description says it must not show.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** What the typable editor was last handed — the list it offers is a prop. */
const longString = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('../src/components/form/fields/long-string/LongString', () => ({
  default: (props: Record<string, any>) => {
    longString.props = props;
    return (
      <textarea
        value={props.value ?? ''}
        onChange={(e) => props.onChange?.((e.target as HTMLTextAreaElement).value)}
      />
    );
  },
}));
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const TEMPLATES = {
  items: [{ label: 'Values this case captures', items: [{ value: '$.result', label: 'result' }] }],
};

const wrap = (node: React.ReactNode) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext as never}>{node}</FetchContext.Provider>
  </ReqoreUIProvider>
);

const untyped = (props: Record<string, unknown>) =>
  wrap(
    <TemplateField
      name='expected'
      type={'any' as never}
      value={undefined as never}
      allowCustomValues
      filterTemplatesByType={false}
      onChange={vi.fn()}
      {...(props as never)}
    />
  );

const asksForDataType = (container: HTMLElement) =>
  (container.textContent || '').includes('Please select data type');
const typableControl = (container: HTMLElement) =>
  container.querySelector('textarea, input:not([type="checkbox"])');

describe('an empty untyped field', () => {
  it('opens on a typable editor offering templates that arrive after it mounted', async () => {
    // The cold load: the field mounts before its template list exists.
    const { container, rerender } = render(untyped({ allowTemplates: true, templates: undefined }));
    rerender(untyped({ allowTemplates: true, templates: TEMPLATES }));

    await waitFor(() => expect(typableControl(container)).toBeTruthy());
    expect(asksForDataType(container)).toBe(false);
    /* ...and the typable editor is handed the templates that arrived, which is
       what it offers. A class would not show it: TemplateField puts
       `.template-selector` on every control it draws. */
    await waitFor(() => expect(JSON.stringify(longString.props?.templates)).toContain('$.result'));
  });

  it('keeps the same editor, and its focus, when the author deletes what they typed', async () => {
    /* Template mode IS the editor an untyped field is typed into. Emptying it
       used to switch the field to custom mode — a different editor, mounted in
       place of the one the author was typing in — so the last backspace lost
       the cursor. */
    const { container } = render(untyped({ allowTemplates: true, templates: TEMPLATES }));
    const editor = (await waitFor(() => {
      const el = typableControl(container);
      expect(el).toBeTruthy();
      return el;
    })) as HTMLTextAreaElement;

    fireEvent.change(editor, { target: { value: 'a' } });
    fireEvent.change(typableControl(container)!, { target: { value: '' } });

    expect(typableControl(container)).toBe(editor);
    expect(JSON.stringify(longString.props?.templates)).toContain('$.result');
    expect(asksForDataType(container)).toBe(false);
  });

  it('opens on a typable editor when no templates are on offer at all', async () => {
    const { container } = render(untyped({ allowTemplates: true, templates: { items: [] } }));

    await waitFor(() => expect(typableControl(container)).toBeTruthy());
    expect(asksForDataType(container)).toBe(false);
    expect(container.textContent).not.toContain('Select Template');
  });

  it('opens on a typable editor when it does not take templates', async () => {
    const { container } = render(untyped({ allowTemplates: false }));

    await waitFor(() => expect(typableControl(container)).toBeTruthy());
    expect(asksForDataType(container)).toBe(false);
  });
});

describe('the untyped editor on its own', () => {
  it.each(['auto', 'any'])('gives an empty %s field a typable editor and no type picker', async (type) => {
    const { container } = render(
      wrap(<AutoFormField name='value' defaultType={type as never} value={undefined} onChange={vi.fn()} />)
    );

    await waitFor(() => expect(typableControl(container)).toBeTruthy());
    expect(asksForDataType(container)).toBe(false);
    // The picker's current-type label is the other half of that control.
    expect(container.querySelector('.auto-field-group .reqore-button')?.textContent ?? '').not.toMatch(
      /^auto|^any/
    );
  });

  it('stores what is typed as untyped, the way template mode does', async () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<AutoFormField name='value' defaultType={'auto' as never} value={undefined} onChange={onChange} />)
    );

    const editor = (await waitFor(() => {
      const el = typableControl(container);
      expect(el).toBeTruthy();
      return el;
    })) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '42' } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.slice(0, 3)).toEqual(['value', '42', 'auto']);
  });

  it('keeps the editor of a type the field already holds', async () => {
    // A value that arrived with a type is not "untyped": it opens on its own editor.
    const { container } = render(
      wrap(<AutoFormField name='value' defaultType={'int' as never} value={42} onChange={vi.fn()} />)
    );

    await waitFor(() => expect(container.querySelector('input')).toBeTruthy());
    expect(asksForDataType(container)).toBe(false);
    expect(container.querySelector('textarea')).toBeNull();
  });
});
