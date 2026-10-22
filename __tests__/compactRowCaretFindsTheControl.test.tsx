import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * `autoFocusFirstRequired` opens the first question the author must answer and
 * puts the caret in it. It opened the right row and the caret never moved,
 * because the row looked for an `input`, a `textarea` or a `[contenteditable]`
 * — and "which kind?", the first required question on most forms, is a
 * pick-one whose controls are focusable icons, or a selector that is a button.
 */
const fetchContext = emptyFetchContext();

const renderForm = (options: unknown, value: unknown = {}, props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='first-question'
          value={value as never}
          options={options as never}
          autoFocusFirstRequired
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const focusedField = (): string | undefined =>
  (document.activeElement?.closest('[data-field]') as HTMLElement | null)?.dataset.field;

describe('the caret an opened row takes', () => {
  it('lands on a pick-one first question, whose controls are not inputs', async () => {
    renderForm({
      kind: {
        type: 'string',
        display_name: 'Kind',
        required: true,
        allowed_values: [
          { display_name: 'Service', value: { type: 'string', value: 'service' } },
          { display_name: 'Job', value: { type: 'string', value: 'job' } },
        ],
      },
      name: { type: 'string', display_name: 'Name', required: true },
    });

    await waitFor(() => expect(focusedField()).toBe('kind'));
    const active = document.activeElement as HTMLElement;
    // Not a text box — the point of the case. The row offers a pick-one, and
    // the caret is on the first choice.
    expect(active.tagName).not.toBe('INPUT');
    expect(active.tagName).not.toBe('TEXTAREA');
    expect(active.getAttribute('tabindex')).toBe('0');
    // …and the row it belongs to is the one the engine opened, not the next
    // focusable field further down.
    expect(focusedField()).not.toBe('name');
  });

  it('still lands in the text box of a text first question', async () => {
    renderForm({
      title: { type: 'string', display_name: 'Title', required: true },
    });

    await waitFor(() => expect(focusedField()).toBe('title'));
    // Whichever text control the string editor draws (reqore renders a growing
    // textarea for a plain string) — what matters is that typing goes into it.
    expect(['INPUT', 'TEXTAREA']).toContain((document.activeElement as HTMLElement).tagName);
  });

  it('waits for an editor that is not in the DOM on the first frame', async () => {
    // The real case: a host editor resolves a catalogue before it can draw a
    // control, so the row the engine opened is empty for the first commits.
    // Nothing is polled and no time is waited — the control appearing IS the
    // event, and it can appear arbitrarily late.
    let mount: () => void = () => undefined;
    const LateEditor = () => {
      const [ready, setReady] = React.useState(false);
      React.useEffect(() => {
        mount = () => setReady(true);
      }, []);
      return ready ? <button type='button'>Choose a connection…</button> : null;
    };

    renderForm(
      {
        connection: {
          type: 'string',
          ui_type: 'late-editor',
          display_name: 'Connection',
          required: true,
        },
      },
      {},
      { componentOverrides: { 'late-editor': LateEditor } }
    );

    // The row is open and has nothing to focus yet, so the caret has not moved.
    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeTruthy());
    expect(document.activeElement).toBe(document.body);

    mount();

    await waitFor(() => expect(focusedField()).toBe('connection'));
    expect((document.activeElement as HTMLElement).textContent).toContain('Choose a connection');
  });

  /* A code editor draws its chrome first (a fullscreen toggle) and its edit area once
     it has loaded. The caret may rest on the chrome for that moment, but the edit area
     takes it when it arrives: otherwise the next space typed presses the toggle. */
  const LateCodeEditor = ({ onMount }: { onMount: (mount: () => void) => void }) => {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => onMount(() => setReady(true)), []);
    return (
      <div>
        <button type='button'>Fullscreen</button>
        {ready ? <div role='textbox' tabIndex={0} aria-label='Editor content' /> : null}
      </div>
    );
  };
  const codeField = {
    source: { type: 'string', ui_type: 'late-code', display_name: 'Source', required: true },
  };

  it('moves from an editor\'s chrome to its text box when the text box arrives late', async () => {
    let mount: () => void = () => undefined;
    renderForm(codeField, {}, {
      componentOverrides: {
        'late-code': () => <LateCodeEditor onMount={(fn) => (mount = fn)} />,
      },
    });

    await waitFor(() => expect(focusedField()).toBe('source'));
    expect(document.activeElement?.textContent).toBe('Fullscreen');

    mount();

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Editor content')
    );
  });

  /* Monaco inserts its edit area before it can take focus, and focus() on it then does
     nothing. The caret counts as handed over only once it has actually landed. */
  it('keeps trying until the text box can actually take the caret', async () => {
    let makeFocusable: () => void = () => undefined;
    const SlowEditArea = () => {
      const [focusable, setFocusable] = React.useState(false);
      React.useEffect(() => {
        makeFocusable = () => setFocusable(true);
      }, []);
      return (
        <div>
          <button type='button'>Fullscreen</button>
          <div role='textbox' aria-label='Editor content' {...(focusable ? { tabIndex: 0 } : {})} />
        </div>
      );
    };
    renderForm(codeField, {}, { componentOverrides: { 'late-code': SlowEditArea } });

    // The text box is there but cannot take focus yet: the row waits for it rather
    // than settling on the toolbar beside it.
    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeTruthy());
    expect(document.activeElement?.textContent).not.toBe('Fullscreen');

    makeFocusable();

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Editor content')
    );
  });

  it('leaves the caret where the reader put it, even when the text box arrives later', async () => {
    let mount: () => void = () => undefined;
    const { container } = renderForm(codeField, {}, {
      componentOverrides: {
        'late-code': () => <LateCodeEditor onMount={(fn) => (mount = fn)} />,
      },
    });
    await waitFor(() => expect(focusedField()).toBe('source'));

    const elsewhere = document.createElement('input');
    container.appendChild(elsewhere);
    elsewhere.focus();
    mount();

    await waitFor(() => expect(document.querySelector('[aria-label="Editor content"]')).toBeTruthy());
    expect(document.activeElement).toBe(elsewhere);
  });

  it('leaves a caret the reader moved elsewhere alone', async () => {
    // A late editor plus a reader who did not wait: the row must not yank the
    // caret out of the control they moved into themselves.
    let mount: () => void = () => undefined;
    const LateEditor = () => {
      const [ready, setReady] = React.useState(false);
      React.useEffect(() => {
        mount = () => setReady(true);
      }, []);
      return ready ? <button type='button'>Choose a connection…</button> : null;
    };

    const { container } = renderForm(
      {
        connection: {
          type: 'string',
          ui_type: 'late-editor',
          display_name: 'Connection',
          required: true,
        },
      },
      {},
      { componentOverrides: { 'late-editor': LateEditor } }
    );

    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeTruthy());
    const elsewhere = document.createElement('input');
    container.appendChild(elsewhere);
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);

    mount();

    await waitFor(() => expect(document.querySelector('button')).toBeTruthy());
    expect(document.activeElement).toBe(elsewhere);
  });
});
