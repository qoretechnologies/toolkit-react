/**
 * Clearing an untyped field returns it to the TEMPLATE selector.
 *
 * `TemplateField` opens an `any`-like field on the template selector when there
 * is something to pick, and falls back to the TYPE picker only when there is
 * not. That decision is a `useState` INITIALISER, so it only ever ran on mount:
 * clearing a value in place does not remount anything, so the field fell
 * through to the type picker and demanded `string`/`int`/`hash` before it would
 * let the author name a value they had already captured.
 *
 * Reported from the live IDE on a test assertion's `Expected Value`: clearing
 * it showed "Please select data type", and RELOADING the page on the same
 * now-empty field showed the template selector with 27 items. Same field, same
 * empty value, two different landings — because only the reload ran the rule.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** What the assertion's `Expected Value` is actually offered: captured values. */
const TEMPLATES = {
  items: [
    {
      label: 'Values this case captures',
      items: [{ value: '$.result', label: 'result' }],
    },
  ],
};

const renderField = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <TemplateField
          name='expected_value'
          type={'auto' as never}
          allowTemplates
          templates={TEMPLATES as never}
          // A path NAMES a value of any type, so the offered list is not
          // filtered down to the naming field's own type.
          filterTemplatesByType={false}
          onChange={vi.fn()}
          {...(props as never)}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The discriminator: the template selector vs the type picker. */
const showsTemplateSelector = (container: HTMLElement) =>
  (container.textContent || '').includes('Select Template');

describe('clearing an untyped field with templates on offer', () => {
  it('opens on the template selector when it mounts empty', async () => {
    // The behaviour that already worked, and the reason a reload "fixed" it.
    const { container } = renderField({ value: undefined });
    expect(showsTemplateSelector(container)).toBe(true);
  });

  it('shows the value, not the selector, when it mounts holding one', async () => {
    // A field already holding a literal must open showing that literal —
    // flipping to the template view would hide a value the author put there.
    const { container } = renderField({ value: 'happy-path' });
    expect(showsTemplateSelector(container)).toBe(false);
  });

  it('returns to the template selector when the value is cleared', async () => {
    // The regression: mount with a value, then clear it in place.
    const { container, rerender } = renderField({ value: 'happy-path' });
    expect(showsTemplateSelector(container)).toBe(false);

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <TemplateField
            name='expected_value'
            type={'auto' as never}
            allowTemplates
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
            value={undefined}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect(showsTemplateSelector(container)).toBe(true);
  });

  it('returns to the selector when the type settles a render AFTER the clear', async () => {
    /* The shape the live IDE actually produces, and the reason an earlier fix
       did nothing. While the field holds a value its resolved type is that
       VALUE's type — a captured reference reads as `test-reference` — and the
       clear reverts it to the schema's `auto` only on the FOLLOWING render.
       Measured at the moment of the clear: `typeIsAnyLike: false, type:
       "test-reference"`, then `typeIsAnyLike: true` one render later. Acting
       only on the value transition ran while the type was still concrete and
       did nothing at all. */
    const props = (value: unknown, type: string) => (
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <TemplateField
            name='expected_value'
            type={type as never}
            allowTemplates
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
            value={value as never}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    // holding a captured reference
    const { container, rerender } = render(props('$.result', 'test-reference'));
    expect(showsTemplateSelector(container)).toBe(false);

    // cleared — value empties, but the type has NOT reverted yet
    rerender(props(undefined, 'test-reference'));

    // the type settles back to the schema's `auto`
    rerender(props(undefined, 'auto'));

    expect(showsTemplateSelector(container)).toBe(true);
  });

  it('leaves a typed field on its own editor when cleared', async () => {
    // Only `any`-like fields have no editor of their own; a `string` field must
    // keep its text box rather than being sent to a template list.
    const { container, rerender } = renderField({ value: 'hello', type: 'string' as never });

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <TemplateField
            name='expected_value'
            type={'string' as never}
            allowTemplates
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
            value={undefined}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect(showsTemplateSelector(container)).toBe(false);
  });

  it('does not send a cleared field to an EMPTY template selector', async () => {
    // With nothing on offer the type picker is the right fallback — an empty
    // picker is a worse place to start.
    const { container, rerender } = renderField({
      value: 'happy-path',
      templates: { items: [] } as never,
    });

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <TemplateField
            name='expected_value'
            type={'auto' as never}
            allowTemplates
            templates={{ items: [] } as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
            value={undefined}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect(showsTemplateSelector(container)).toBe(false);
  });
});
