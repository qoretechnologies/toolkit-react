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
import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';
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
