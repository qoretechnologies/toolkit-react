/**
 * A field whose own editor renders templates keeps its editor.
 *
 * `TemplateField` takes a template-capable field over with a template SELECTOR
 * — a dropdown you pick from, with nowhere to type. For a field whose editor
 * already turns a reference into a chip as the author types, that is not merely
 * redundant: it swaps a typable control for a pick-only one.
 *
 * Reported on a Qorus test assertion's `Value`. The IDE's own `auto.tsx`
 * renders that field (`test-reference`) as template rich text — type freely,
 * references become chips — and a Qog action option gets exactly that. The same
 * field reached through this form engine offered a dropdown and no way to type.
 * Same field, two engines, two behaviours.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  BuiltInTemplateAwareUiTypes,
  isTemplateAwareUiType,
  TemplateField,
} from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const TEMPLATES = {
  items: [
    { label: 'Values this case captures', items: [{ value: '$.result', label: 'result' }] },
  ],
};

/** Stands in for the host's own editor (the IDE's `TestReferenceField`). */
const HostEditor = (props: any) => (
  <div data-testid='host-editor' data-allow-templates={String(!!props.allowTemplates)} />
);

const renderField = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <TemplateField
          name='value'
          allowTemplates
          templates={TEMPLATES as never}
          filterTemplatesByType={false}
          onChange={vi.fn()}
          component={HostEditor as never}
          {...(props as never)}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const showsSelector = (c: HTMLElement) => (c.textContent || '').includes('Select Template');

describe('isTemplateAwareUiType', () => {
  it('knows reqraft’s own rich text', () => {
    expect(isTemplateAwareUiType('richtext')).toBe(true);
    expect(BuiltInTemplateAwareUiTypes).toContain('richtext');
  });

  it('accepts a consumer’s declared type', () => {
    expect(isTemplateAwareUiType('test-reference', ['test-reference'])).toBe(true);
  });

  it('does not accept an undeclared type', () => {
    expect(isTemplateAwareUiType('test-reference')).toBe(false);
    expect(isTemplateAwareUiType(undefined)).toBe(false);
  });
});

describe('a template-aware editor is not taken over by the selector', () => {
  it('renders the host editor instead of the selector', () => {
    // `isDefaultTemplate` puts the field in TEMPLATE mode, which is the state
    // the reported field was in: once a reference is chosen the field's type is
    // `test-reference`, so `templateSupportsCustomValues` (which insists on a
    // literal `string`) is false and the selector wins. Mounting with an
    // any-like type and no value instead would leave the field out of template
    // mode entirely, and the test would pass without the fix.
    const { container, getByTestId } = renderField({
      ui_type: 'test-reference',
      templateAwareUiTypes: ['test-reference'],
      isDefaultTemplate: true,
      value: undefined,
    });

    expect(getByTestId('host-editor')).toBeTruthy();
    expect(showsSelector(container)).toBe(false);
  });

  it('still hands the editor the templates, so it can chip them inline', () => {
    // Suppressing the selector is only right BECAUSE the editor gets the list.
    const { getByTestId } = renderField({
      ui_type: 'test-reference',
      templateAwareUiTypes: ['test-reference'],
      isDefaultTemplate: true,
      value: undefined,
    });

    expect(getByTestId('host-editor').getAttribute('data-allow-templates')).toBe('true');
  });

  it('keeps the editor even when the value already holds a reference', () => {
    const { container, getByTestId } = renderField({
      ui_type: 'test-reference',
      templateAwareUiTypes: ['test-reference'],
      isDefaultTemplate: true,
      value: '$.result',
    });

    expect(getByTestId('host-editor')).toBeTruthy();
    expect(showsSelector(container)).toBe(false);
  });

  it('still uses the selector for a type whose editor does NOT do templates', () => {
    // The control: the selector is right for an ordinary any-like field, so the
    // fix must not suppress it everywhere.
    const { container } = renderField({ type: 'auto', isDefaultTemplate: true, value: undefined });

    expect(showsSelector(container)).toBe(true);
  });
});
