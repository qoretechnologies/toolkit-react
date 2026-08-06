// Coverage for FormEngine's remote-fetch layer (`url` / `customUrl` /
// `onOptionsLoaded` / `operatorsUrl`), ported from the IDE's Options
// (systemOptions.tsx). The IDE has NO tests for these paths — all of its 30
// Options stories pass fixture schemas as props — so this coverage is new,
// written per the team's port-with-tests method.
//
// Server data comes from a `window.fetch` mock installed in `beforeEach`
// (the dpqlMockLsp pattern, REST flavour). Each story uses DISTINCT urls:
// `query()` caches GETs for 5 minutes, so reusing a url across stories would
// serve another story's cached schema.
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { _testsClickButton, sleep } from '../../../stories/Tests/utils';
import { StoryMeta } from '../../../types';
import { FormEngine } from './FormEngine';

// --- fetch mock --------------------------------------------------------------

type TRoutes = Record<string, { status?: number; body: unknown }>;

/** Patch `window.fetch`: serve matching routes, pass everything else through.
 *  Hits are recorded on `window.__mockFetchHits` for play-test assertions. */
const mockFetchRoutes = (routes: TRoutes): (() => void) => {
  const original = window.fetch;
  const hits: Record<string, number> = {};
  (window as any).__mockFetchHits = hits;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : input.url;
    const match = Object.keys(routes).find((key) => urlStr.includes(key));
    if (match) {
      hits[match] = (hits[match] ?? 0) + 1;
      const { status = 200, body } = routes[match];
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input as RequestInfo, init);
  };
  return () => {
    window.fetch = original;
  };
};

// --- fixtures ----------------------------------------------------------------

const BASIC_SCHEMA = {
  host: {
    type: 'string',
    display_name: 'Host',
    short_desc: 'The host to connect to',
    required: true,
    preselected: true,
    default_value: 'localhost',
  },
  port: {
    type: 'int',
    display_name: 'Port',
    short_desc: 'The port to connect to',
    preselected: true,
  },
  secure: {
    type: 'bool',
    display_name: 'Secure',
    short_desc: 'Use TLS',
    preselected: true,
    default_value: true,
  },
};

const SEARCH_SCHEMA = {
  hostname: {
    type: 'string',
    display_name: 'Hostname',
    short_desc: 'Field to search by',
    preselected: true,
  },
};

const ALT_SCHEMA = {
  token: {
    type: 'string',
    display_name: 'Token',
    short_desc: 'Auth token',
    required: true,
    preselected: true,
  },
};

const OPERATORS_SCHEMA = {
  like: { name: 'like', display_name: 'Like', desc: 'Substring match' },
  eq: { name: 'eq', display_name: 'Equals', desc: 'Exact match' },
};

const meta = {
  component: FormEngine,
  title: 'Form/Engine/FormEngineRemote',
  // Fetch-mocked and timing-sensitive — skip Chromatic snapshots.
  parameters: { chromatic: { disable: true } },
  args: {
    onChange: fn(),
    onSingleOptionsChange: fn(),
    onDependableOptionChange: fn(),
    onOptionsLoaded: fn(),
    onValidityChange: fn(),
  },
} as StoryMeta<typeof FormEngine>;

export default meta;
type Story = StoryObj<typeof meta>;

const optionCount = () => document.querySelectorAll('.system-option').length;

/**
 * The options schema is fetched from `options/{url}`; preselected defaults are
 * seeded into the value and `onOptionsLoaded` fires with the schema.
 */
export const SchemaFromUrl: Story = {
  args: {
    name: 'remoteBasic',
    url: 'sb-remote/basic',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a url — the options schema is fetched from options/{url}, three fields mount with the preselected localhost default seeded and onOptionsLoaded fires with the fetched schema.',
      },
    },
  },
  async beforeEach() {
    return mockFetchRoutes({ 'options/sb-remote/basic': { body: BASIC_SCHEMA } });
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await waitFor(() => expect(optionCount()).toBe(3), { timeout: 10000 });
    await expect(canvas.getByText('Host')).toBeInTheDocument();
    // The preselected default landed in the seeded value.
    await expect(canvas.getByDisplayValue('localhost')).toBeInTheDocument();
    // The schema callback fired with the fetched schema.
    await expect(args.onOptionsLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ host: expect.objectContaining({ display_name: 'Host' }) })
    );
  },
};

/**
 * `operatorsUrl` fetches the operator schema and enables the per-option
 * operator UI: the operator select plus the WHERE/IS summary tags.
 */
export const OperatorsFromUrl: Story = {
  args: {
    name: 'remoteSearch',
    url: 'sb-remote/search',
    operatorsUrl: 'sb-remote-operators',
    value: {
      hostname: { type: 'string', value: 'qore', op: ['like'] },
    } as any,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with both url and operatorsUrl — the operator select resolves the "like" op against the fetched operator schema and the WHERE/IS summary tags appear alongside the option.',
      },
    },
  },
  async beforeEach() {
    return mockFetchRoutes({
      'options/sb-remote/search': { body: SEARCH_SCHEMA },
      'sb-remote-operators': { body: OPERATORS_SCHEMA },
    });
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await waitFor(() => expect(optionCount()).toBe(1), { timeout: 10000 });
    // The operator select resolved 'like' against the fetched schema.
    await waitFor(() => expect(canvas.getByText('Like')).toBeInTheDocument(), {
      timeout: 10000,
    });
    // The WHERE/IS summary tags render for the operator-carrying value.
    await waitFor(() => expect(canvas.getByText('WHERE')).toBeInTheDocument(), {
      timeout: 10000,
    });
    await expect(canvas.getByText('hostname')).toBeInTheDocument();
  },
};

/** A failed schema fetch degrades to an empty form — no crash, no skeleton. */
export const FetchFailure: Story = {
  args: {
    name: 'remoteFail',
    url: 'sb-remote/fail',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine when the schema fetch returns 500 — the skeleton resolves into the "No options available" empty state instead of crashing.',
      },
    },
  },
  async beforeEach() {
    return mockFetchRoutes({
      'options/sb-remote/fail': { status: 500, body: { err: 'boom' } },
    });
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The skeleton resolves into the empty-schema warning (no crash).
    await waitFor(() => expect(canvas.getByText('No options available')).toBeInTheDocument(), {
      timeout: 10000,
    });
    await expect(optionCount()).toBe(0);
  },
};

/** Changing `url` clears the value and re-seeds the form from the new schema. */
export const UrlChangeResetsValue: Story = {
  args: {
    name: 'remoteSwitch',
    url: 'sb-remote/first',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine wired to url="first". Clicking the switch button re-points the engine to a different schema — the previous value (localhost) is dropped and the new Token field mounts.',
      },
    },
  },
  render(args) {
    const [url, setUrl] = useState(args.url);
    return (
      <>
        <button data-testid='switch-url' onClick={() => setUrl('sb-remote/second')}>
          switch
        </button>
        <FormEngine {...args} url={url} />
      </>
    );
  },
  async beforeEach() {
    return mockFetchRoutes({
      'options/sb-remote/first': { body: BASIC_SCHEMA },
      'options/sb-remote/second': { body: ALT_SCHEMA },
    });
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await waitFor(() => expect(optionCount()).toBe(3), { timeout: 10000 });
    await expect(canvas.getByDisplayValue('localhost')).toBeInTheDocument();

    await userEvent.click(canvas.getByTestId('switch-url'));

    // The new schema renders and the old value is gone.
    await waitFor(() => expect(canvas.getByText('Token')).toBeInTheDocument(), {
      timeout: 10000,
    });
    await waitFor(() => expect(optionCount()).toBe(1));
    await expect(canvas.queryByDisplayValue('localhost')).not.toBeInTheDocument();
  },
};

/**
 * The `optionActions` seam — per-option injected hover actions, where the IDE
 * renders its `allowAi` AI-assist button. The factory receives the option's
 * name/schema/value (the IDE's `AiAssistanceAction` context).
 */
export const InjectedOptionActions: Story = {
  args: {
    name: 'optionActionsSeam',
    options: BASIC_SCHEMA as any,
    optionActions: ({ name }) => [
      {
        icon: 'MagicLine',
        className: 'option-ai-assist',
        tooltip: `AI assistance for ${name}`,
        show: 'hover',
        size: 'tiny',
        fixed: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with an optionActions factory that injects a per-option AI-assist button. Hovering an option reveals the injected action next to it.',
      },
    },
  },
  async play() {
    await waitFor(() => expect(optionCount()).toBe(3), { timeout: 10000 });

    await userEvent.hover(document.querySelectorAll('.system-option')[0]);
    await waitFor(
      () => expect(document.querySelector('.option-ai-assist')).toBeInTheDocument(),
      { timeout: 10000 }
    );
  },
};

/**
 * The same injected actions seam must also work in compact/read-first mode. The
 * IDE uses this path for option-based forms and relies on the action slot for
 * small per-field Qonsole controls.
 */
export const InjectedCompactOptionActions: Story = {
  args: {
    name: 'compactOptionActionsSeam',
    compact: true,
    options: BASIC_SCHEMA as any,
    optionActions: ({ name }) => [
      {
        icon: 'MagicLine',
        className: 'option-compact-ai-assist',
        tooltip: `AI assistance for ${name}`,
        // The shape the IDE passes on the classic path — hover-gated here too.
        show: 'hover',
        size: 'tiny',
        fixed: true,
      },
      {
        icon: 'InformationLine',
        className: 'option-compact-always',
        tooltip: `Details for ${name}`,
        size: 'tiny',
        fixed: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders compact FormEngine rows with two injected per-option actions: one always visible, one declared `show: "hover"` that stays transparent until its row is hovered or focused.',
      },
    },
  },
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('.readfirst-row').length).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    const rowCount = document.querySelectorAll('.readfirst-row').length;

    await waitFor(() => {
      expect(document.querySelectorAll('.option-compact-always').length).toBe(rowCount);
      expect(document.querySelectorAll('.option-compact-ai-assist').length).toBe(rowCount);
    });

    // The hover-only action carries the CSS gate; the always-on one does not.
    const hoverAction = document.querySelector(
      '.option-compact-ai-assist.options-injected-action-hover'
    ) as HTMLElement;
    expect(hoverAction).toBeTruthy();
    expect(
      document.querySelectorAll('.option-compact-always.options-injected-action-hover').length
    ).toBe(0);

    // Actually exercise the reveal condition rather than just asserting the
    // class is present: gated the action is transparent and not hit-testable.
    expect(getComputedStyle(hoverAction).opacity).toBe('0');
    expect(getComputedStyle(hoverAction).pointerEvents).toBe('none');

    // Focus is the reveal path a test can drive: the gate keys on
    // `:hover, :focus-within`, and a synthetic mouse event does NOT put a real
    // browser into `:hover`. Focusing the action is also the keyboard route a
    // user takes, so this covers the accessibility path at the same time.
    hoverAction.focus();
    await waitFor(() => {
      expect(getComputedStyle(hoverAction).opacity).toBe('1');
      expect(getComputedStyle(hoverAction).pointerEvents).toBe('auto');
    });

    // Left revealed so the captured frame shows the action rather than an
    // empty slot — the whole point of the story.
    await sleep(200);
  },
};

/**
 * The no-hover case. A touch device never fires `:hover`, so a hover-gated
 * action would be permanently unreachable; instead every injected action moves
 * into the row's own overflow menu. `optionActionsCollapse='always'` forces the
 * branch that `(hover: none)`/`(pointer: coarse)` picks on a real phone, which a
 * desktop browser cannot emulate.
 */
export const InjectedCompactOptionActionsMobile: Story = {
  args: {
    name: 'compactOptionActionsMobile',
    compact: true,
    options: BASIC_SCHEMA as any,
    optionActionsCollapse: 'always',
    optionActions: ({ name }) => [
      {
        icon: 'MagicLine',
        className: 'option-compact-ai-assist',
        tooltip: `AI assistance for ${name}`,
        show: 'hover',
        size: 'tiny',
        fixed: true,
      },
      {
        icon: 'InformationLine',
        className: 'option-compact-always',
        tooltip: `Details for ${name}`,
        size: 'tiny',
        fixed: true,
      },
    ],
  },
  parameters: {
    qlip: { viewport: { width: 420, height: 900 } },
    docs: {
      description: {
        story:
          'Renders the compact rows at phone width with injected actions collapsed into each row\'s overflow menu — the no-hover path, where a hover-gated button would otherwise be unreachable. The menu is opened so the actions are visible.',
      },
    },
  },
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('.readfirst-row').length).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    // Collapsed: no inline injected buttons at all, one overflow menu per row.
    const rowCount = document.querySelectorAll('.readfirst-row').length;
    await waitFor(() => {
      expect(document.querySelectorAll('.options-injected-actions-menu').length).toBe(rowCount);
    });
    expect(document.querySelectorAll('.option-compact-ai-assist').length).toBe(0);
    expect(document.querySelectorAll('.option-compact-always').length).toBe(0);

    // Both actions are reachable from the menu — the reason the collapse exists.
    await _testsClickButton({ selector: '.options-injected-actions-menu', nth: 0 });
    await waitFor(
      () => {
        const labels = Array.from(document.querySelectorAll('.reqore-menu-item')).map(
          (item) => item.textContent ?? ''
        );
        expect(labels.some((label) => label.includes('AI assistance for'))).toBe(true);
        expect(labels.some((label) => label.includes('Details for'))).toBe(true);
      },
      { timeout: 10000 }
    );
  },
};

/**
 * Many injected actions. Beyond the inline cap the extras overflow into the
 * row's menu instead of squeezing the value out of the row, so a consumer can
 * inject any number without breaking the layout.
 */
export const InjectedCompactOptionActionsMany: Story = {
  args: {
    name: 'compactOptionActionsMany',
    compact: true,
    options: BASIC_SCHEMA as any,
    optionActions: ({ name }) =>
      ['MagicLine', 'InformationLine', 'FileCopyLine', 'DeleteBinLine', 'ShareLine'].map(
        (icon, index) => ({
          icon: icon as any,
          className: `option-compact-many-${index}`,
          tooltip: `${icon} for ${name}`,
          size: 'tiny',
          fixed: true,
        })
      ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact rows with five injected actions per option — the first two stay inline and the remaining three collapse into the row\'s overflow menu, which is opened here to show them.',
      },
    },
  },
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('.readfirst-row').length).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    const rowCount = document.querySelectorAll('.readfirst-row').length;

    // Only the first two render inline; the rest are in the menu.
    await waitFor(() => {
      expect(document.querySelectorAll('.option-compact-many-0').length).toBe(rowCount);
      expect(document.querySelectorAll('.option-compact-many-1').length).toBe(rowCount);
    });
    expect(document.querySelectorAll('.option-compact-many-2').length).toBe(0);
    expect(document.querySelectorAll('.option-compact-many-4').length).toBe(0);
    expect(document.querySelectorAll('.options-injected-actions-menu').length).toBe(rowCount);

    await _testsClickButton({ selector: '.options-injected-actions-menu', nth: 0 });
    await waitFor(
      () => {
        const labels = Array.from(document.querySelectorAll('.reqore-menu-item')).map(
          (item) => item.textContent ?? ''
        );
        expect(labels.some((label) => label.includes('DeleteBinLine for'))).toBe(true);
        expect(labels.some((label) => label.includes('ShareLine for'))).toBe(true);
      },
      { timeout: 10000 }
    );
  },
};

/**
 * Opt-in template fetching: `interfaceContext` makes `useTemplates` fetch
 * `system/getContextData` (the IDE's behavior); without it, no request is
 * made (the original reqraft stub behavior).
 */
export const TemplatesFromContext: Story = {
  args: {
    name: 'ctxTemplates',
    options: BASIC_SCHEMA as any,
    interfaceContext: 'sb-ctx',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with an interfaceContext — useTemplates hits system/getContextData so template values are available in the schema fields.',
      },
    },
  },
  async beforeEach() {
    return mockFetchRoutes({
      'system/getContextData': {
        body: {
          TestApp: {
            display_name: 'Test App',
            app: 'TestApp',
            items: [{ display_name: 'Test Item', value: '$data:item', type: 'string' }],
          },
        },
      },
    });
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The templates loading gate resolves only after the context fetch.
    await waitFor(() => expect(optionCount()).toBe(3), { timeout: 10000 });
    await expect(canvas.getByText('Host')).toBeInTheDocument();
    // The context-data endpoint was actually hit (with the context param).
    await expect((window as any).__mockFetchHits['system/getContextData']).toBeGreaterThan(0);
  },
};
