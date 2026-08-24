import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MarkdownRendererContext,
  TMarkdownRenderer,
} from '../src/components/Description/markdownRendererContext';
import MarkdownFormField from '../src/components/form/fields/markdown/Markdown';

/**
 * Viewport width. Reqore hard-codes `isMobile` / `isTablet` to `false` under
 * NODE_ENV=test (there is no real viewport to measure), so the only way to
 * exercise the narrow-screen branch is to answer that one property here.
 */
let narrowViewport = false;

vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@qoretechnologies/reqore')>();

  return {
    ...actual,
    // Unconditionally delegates first, so the hook call order never depends on
    // which property is being asked for.
    useReqoreProperty: ((property: string) => {
      const value = (actual.useReqoreProperty as (p: string) => unknown)(property);

      return property === 'isMobileOrTablet' ? narrowViewport : value;
    }) as typeof actual.useReqoreProperty,
  };
});

const VALUE = '## Heading\n\nSome **bold** prose.';

const renderField = (props: Record<string, unknown> = {}, renderer?: TMarkdownRenderer) => {
  const field = (
    <MarkdownFormField value={VALUE} onChange={vi.fn()} aria-label='Markdown' {...props} />
  );

  return render(
    <ReqoreUIProvider>
      {renderer ?
        <MarkdownRendererContext.Provider value={renderer}>
          {field}
        </MarkdownRendererContext.Provider>
      : field}
    </ReqoreUIProvider>
  );
};

describe('MarkdownFormField', () => {
  it('previews the rendered document beside the editor when there is room', () => {
    narrowViewport = false;
    const { container } = renderField();

    expect(container.querySelector('textarea')).toBeTruthy();
    // rendered, not echoed: the source stays in the editor, the preview shows
    // what the value actually says
    expect(container.querySelector('h2')?.textContent).toBe('Heading');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('drops the preview on a narrow screen', () => {
    narrowViewport = true;
    const { container } = renderField();

    // stacking the preview under the editor would mean scrolling past a second
    // copy of the text you are still typing
    expect(container.querySelector('textarea')).toBeTruthy();
    expect(container.querySelector('h2')).toBeNull();

    narrowViewport = false;
  });

  it('lets a host that knows its container is narrow force the preview off', () => {
    narrowViewport = false;
    const { container } = renderField({ hidePreview: true });

    expect(container.querySelector('textarea')).toBeTruthy();
    expect(container.querySelector('h2')).toBeNull();
  });

  it('draws the preview with the renderer in scope', () => {
    narrowViewport = false;
    const renderer = vi.fn(({ value, compact }) => (
      <div data-testid='host-preview' data-compact={String(compact)}>
        {value}
      </div>
    ));

    const { getByTestId } = renderField({}, renderer as TMarkdownRenderer);

    // the preview column is a constrained container, so the host is told to
    // render densely rather than at document scale
    expect(getByTestId('host-preview').getAttribute('data-compact')).toBe('true');
    expect(getByTestId('host-preview').textContent).toContain('## Heading');
  });
});
