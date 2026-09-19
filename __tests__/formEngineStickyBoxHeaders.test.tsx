import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const OPTIONS = {
  name: { type: 'string', display_name: 'Name' },
  title: { type: 'string', display_name: 'Title' },
  mode: { type: 'string', display_name: 'Mode' },
} as never;

const VALUE = { name: { type: 'string', value: 'a' } } as never;

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='case'
          value={VALUE}
          options={OPTIONS}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** Every status box's header element, in the order the form draws them. */
const boxHeaders = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>('.options-readfirst-group > .reqore-panel-title')
  );

/** The form's own toolbar. */
const toolbar = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    '.options-readfirst-scroll > .reqore-panel > .reqore-panel-title'
  );

/**
 * The status-box headers pin, and they pin where the offsets put them.
 *
 * jsdom lays nothing out, so what can be asserted here is the CONTRACT — which
 * elements are sticky and what `top` each resolves to — rather than where they
 * end up on a screen. The geometry itself (a header's measured rect while the
 * container is scrolled) is asserted in a real browser by
 * `Form/Engine/Sticky Headers` and by the creator's own stories; these cover
 * the composition rule those would only catch by accident, since a wrong
 * offset in a tall enough viewport still looks pinned.
 */
describe('compact status boxes pin their headers', () => {
  it('makes every status box header sticky, not just some of them', async () => {
    const { container } = renderForm();
    await waitFor(() => expect(boxHeaders(container).length).toBeGreaterThan(1));
    /* All of them, or none — a rule that pinned only some would make the
       absence of a pinned header ambiguous between "this box has none" and
       "you are above every box". */
    for (const header of boxHeaders(container)) {
      expect(getComputedStyle(header).position).toBe('sticky');
    }
  });

  it('offsets a box header by the host offset it was given', async () => {
    const { container } = renderForm({ compactStickyOffset: 120 });
    await waitFor(() => expect(boxHeaders(container).length).toBeGreaterThan(0));
    /* The form's own toolbar measures 0 here — jsdom reports no height — so
       what reaches the header is the host's offset alone, which is exactly the
       term this test is about. The toolbar takes the same offset, so the two
       start from the same line rather than the box header landing under a
       toolbar that is itself under the host's chrome. */
    expect(getComputedStyle(toolbar(container)!).top).toBe('120px');
    for (const header of boxHeaders(container)) {
      expect(getComputedStyle(header).top).toBe('120px');
    }
  });

  it('pins nothing when the consumer turns it off', async () => {
    const { container } = renderForm({ compactStickyBoxHeaders: false });
    await waitFor(() => expect(boxHeaders(container).length).toBeGreaterThan(0));
    for (const header of boxHeaders(container)) {
      expect(getComputedStyle(header).position).not.toBe('sticky');
    }
    /* The form's own toolbar is a separate decision and is untouched by it —
       turning the box headers off is about the boxes, not about the form. */
    expect(getComputedStyle(toolbar(container)!).position).toBe('sticky');
  });

  it('never pins inside a nested sub-form, which owns no scroll context', async () => {
    const { container } = renderForm({ compactNested: true });
    await waitFor(() => expect(boxHeaders(container).length).toBeGreaterThan(0));
    for (const header of boxHeaders(container)) {
      expect(getComputedStyle(header).position).not.toBe('sticky');
    }
  });

  it('stops the panel body being a scroll container, which would swallow the pin', async () => {
    const { container } = renderForm();
    await waitFor(() => expect(boxHeaders(container).length).toBeGreaterThan(0));
    const body = container.querySelector<HTMLElement>(
      '.options-readfirst-scroll > .reqore-panel > .reqore-panel-content'
    );
    /* `overflow: auto` here is a scrollport whether or not it ever scrolls, and
       every sticky descendant resolves against it instead of the page — which
       reads exactly like sticky being ignored. `clip` on the other axis keeps
       the horizontal guard without CSS coercing this one back to `auto`. */
    expect(body!.style.overflowY).toBe('visible');
    expect(body!.style.overflowX).toBe('clip');
  });
});
