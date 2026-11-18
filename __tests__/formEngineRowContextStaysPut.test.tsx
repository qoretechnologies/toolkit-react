/**
 * A render of the page around a form does not ask every row of the form again.
 *
 * The rows read the form's context through use-context-selector, which notifies every selector of every row each time
 * the context is a new value. It was a new value on every render of the form: the templates (`useTemplates` answered
 * with a new object each render, and so did its default for no local templates) and the fields built on them, and
 * whatever a host wrote as a literal in its render (`cardEditorTypes={[...]}`, `readSummaries={{ ... }}`). One late
 * render of the Qorus IDE's API schema page asked every row of its form again, each ask an update React reported as
 * not wrapped in act: thousands a story, and the IDE fails a story on any React warning (board t-96, f70).
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { useEqualValue } from '../src/hooks/useEqualValue';
import { useTemplates } from '../src/hooks/useTemplates';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const schema: IOptionsSchema = {
  url: { type: 'string', ui_type: 'string', display_name: 'URL', required: true },
  description: { type: 'string', ui_type: 'string', display_name: 'Description' },
  title: { type: 'string', ui_type: 'string', display_name: 'Title' },
};
const value = { url: { type: 'string', value: 'https://docs.example.com' } };
const Summary = () => null;

/**
 * A page that renders again on its own (a request answering, say), with the props a host writes as literals. The app's
 * providers sit above it, as they do in an app.
 */
const Page = () => {
  const [, setRenders] = useState(0);
  useEffect(() => {
    const again = () => setRenders((renders) => renders + 1);
    window.addEventListener('page-renders-again', again);
    return () => window.removeEventListener('page-renders-again', again);
  }, []);

  return (
    <FormEngine
      compact
      name='docs'
      options={schema}
      value={value as never}
      onChange={() => undefined}
      cardEditorTypes={['sheet-contract']}
      readSummaries={{ 'sheet-contract': Summary }}
      componentOverrides={{}}
      optionActions={[]}
    />
  );
};

describe("the form's rows when the page around it renders again", () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  const rowsAskedAgain = () =>
    errors.mock.calls.filter(
      (call) => String(call[0]).includes('not wrapped in act') && call[1] === 'CompactRow'
    ).length;

  it('are not asked again', async () => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <Page />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(document.querySelector('[data-field="url"]')).toBeTruthy());
    // what the form does as it settles is not what this is about
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    errors.mockClear();

    // Three late renders of the page, from no event, as a request's answer comes.
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.dispatchEvent(new Event('page-renders-again'));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(rowsAskedAgain()).toBe(0);
  });
});

describe('the props and answers a form is built on', () => {
  it('useEqualValue keeps the reference while the value says the same', () => {
    const { result, rerender } = renderHook(({ value }) => useEqualValue(value), {
      initialProps: { value: ['sheet-contract'] },
    });
    const first = result.current;

    rerender({ value: ['sheet-contract'] });
    expect(result.current).toBe(first);

    rerender({ value: ['sheet-contract', 'cron'] });
    expect(result.current).toEqual(['sheet-contract', 'cron']);
  });

  it('useTemplates answers with the same object while nothing in it changes', () => {
    const { result, rerender } = renderHook(() => useTemplates(true));
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
    expect(result.current.value).toBe(first.value);
  });
});
