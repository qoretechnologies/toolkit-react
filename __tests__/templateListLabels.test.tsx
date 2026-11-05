// Copyright 2026 Qore Technologies, s.r.o.
import { modalStore, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { TReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { isValidElement, ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IReqraftTemplateExampleValueModalProps,
  ReqraftTemplateExampleValueModal,
} from '../src/components/form/fields/template/ExampleValueModal';
import {
  buildTemplates,
  DEFAULT_TEMPLATE_LIST_LABELS,
  IReqraftTemplateListLabels,
  ITemplatesPayload,
} from '../src/helpers/templates';
import * as reqraft from '../src/index';
import { IStoryClipboard, stubClipboard } from '../src/stories/clipboard';

/**
 * A host that translates its interface passes the words a list of templates is read with to `buildTemplates`: the
 * example values, the tooltips of its actions and the window that shows a whole example value. A host that passes
 * none gets the English it always had.
 */

const LONG = `"${'x'.repeat(200)}"`;
const payload: ITemplatesPayload = {
  ctx: {
    display_name: 'Context Data',
    items: [
      { display_name: 'Body', value: '$local:body', type: 'data', example_value: 'x'.repeat(200) },
      { display_name: 'Name', value: '$local:name', type: 'string', example_value: 'invoice.pdf' },
      {
        display_name: 'Author',
        value: '$local:author',
        type: 'hash',
        example_value: { name: 'Ada' },
        items: [{ display_name: 'Name', value: '$local:author.name', type: 'string' }],
      },
      // a template without a name: the window is headed with the words for an example value
      { value: '$local:unnamed', type: 'data', example_value: 'y'.repeat(200) },
    ],
  },
};

const PSEUDO: IReqraftTemplateListLabels = {
  exampleValue: (value) => `[Ëxämplé → ${value}]`,
  showFullExampleValue: '[Šhöw ît äll]',
  selectItem: '[Pîçk thîs]',
  exampleValueTitle: '[Ëxämplé]',
  copy: '[Çöpy]',
  copied: '[Çöpîéd]',
  copyFailed: '[Nöt çöpîéd]',
};

const items = (labels?: Partial<IReqraftTemplateListLabels>) =>
  (buildTemplates(payload, labels)?.items?.[0].items ?? []) as TReqoreDropdownItem[];
const named = (list: TReqoreDropdownItem[], label: string | undefined) => {
  const item = list.find((entry) => entry.label === label);
  expect(item).toBeTruthy();
  return item as TReqoreDropdownItem;
};

/** The window the "?" action of `item` opens: what it hands reqore's modal queue. */
const windowOf = (item: TReqoreDropdownItem) => {
  const addModal = vi.spyOn(modalStore.getState(), 'addModal').mockImplementation(() => 'id');
  try {
    (item.rightAction?.onClick as unknown as () => void)();
    expect(addModal).toHaveBeenCalledTimes(1);
    const element = addModal.mock.calls[0][0];
    expect(isValidElement(element)).toBe(true);
    const window = element as ReactElement<IReqraftTemplateExampleValueModalProps>;
    expect(window.type).toBe(ReqraftTemplateExampleValueModal);
    return window.props;
  } finally {
    addModal.mockRestore();
  }
};

/** What a list says, as text: its handlers left out. */
const shown = (list: unknown) =>
  JSON.stringify(list, (_key, value) => (typeof value === 'function' ? undefined : value));

let clipboard: IStoryClipboard | undefined;
afterEach(() => {
  clipboard?.restore();
  clipboard = undefined;
});

describe('the words of a list of templates', () => {
  it('are English when the host passes none, as they always were', () => {
    const list = items();
    expect(named(list, 'Name').description).toBe('Example value: "invoice.pdf"');
    expect(named(list, 'Body').description).toBe(`Example value: ${LONG.slice(0, 150)}…`);
    expect(named(list, 'Body').rightAction?.tooltip).toBe('Show the full example value');
    expect(named(list, 'Author').leftAction?.tooltip).toBe('Select this item');

    expect(windowOf(named(list, 'Body'))).toEqual({
      label: 'Body',
      value: JSON.stringify('x'.repeat(200)),
      copyLabel: 'Copy',
      copyNotificationContent: 'Example value copied to clipboard',
      copyFailedNotificationContent:
        'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.',
    });
    expect(windowOf(named(list, undefined)).label).toBe('Example value');
  });

  it('are the defaults the package exports, and the same with an empty set of words', () => {
    expect(reqraft.DEFAULT_TEMPLATE_LIST_LABELS).toBe(DEFAULT_TEMPLATE_LIST_LABELS);
    expect(DEFAULT_TEMPLATE_LIST_LABELS.exampleValue('42')).toBe('Example value: 42');
    // the same list, the actions' handlers aside (each build makes its own)
    expect(shown(buildTemplates(payload, {}))).toBe(shown(buildTemplates(payload)));
  });

  it("are the host's in every place the list and its window show them", () => {
    const list = items(PSEUDO);
    expect(named(list, 'Name').description).toBe('[Ëxämplé → "invoice.pdf"]');
    // the value is cut before the host's words are put round it
    expect(named(list, 'Body').description).toBe(`[Ëxämplé → ${LONG.slice(0, 150)}…]`);
    expect(named(list, 'Body').rightAction?.tooltip).toBe('[Šhöw ît äll]');
    expect(named(list, 'Author').leftAction?.tooltip).toBe('[Pîçk thîs]');

    expect(windowOf(named(list, 'Body'))).toEqual({
      label: 'Body',
      value: JSON.stringify('x'.repeat(200)),
      copyLabel: '[Çöpy]',
      copyNotificationContent: '[Çöpîéd]',
      copyFailedNotificationContent: '[Nöt çöpîéd]',
    });
    expect(windowOf(named(list, undefined)).label).toBe('[Ëxämplé]');

    expect(shown(buildTemplates(payload, PSEUDO))).not.toMatch(
      /Example value|Show the full|Select this item/
    );
  });

  it('keep the English for each word the host leaves out', () => {
    const list = items({ selectItem: '[Pîçk thîs]', copyFailed: '[Nöt çöpîéd]' });
    expect(named(list, 'Author').leftAction?.tooltip).toBe('[Pîçk thîs]');
    expect(named(list, 'Name').description).toBe('Example value: "invoice.pdf"');
    expect(named(list, 'Body').rightAction?.tooltip).toBe('Show the full example value');
    const window = windowOf(named(list, 'Body'));
    expect(window.copyLabel).toBe('Copy');
    expect(window.copyNotificationContent).toBe('Example value copied to clipboard');
    expect(window.copyFailedNotificationContent).toBe('[Nöt çöpîéd]');
  });

  it("shows the host's notice when the browser refuses the copy and the copy command fails", async () => {
    clipboard = stubClipboard('refused');
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const window = windowOf(named(items(PSEUDO), 'Body'));
    render(
      <ReqoreUIProvider>
        <ReqraftTemplateExampleValueModal isOpen {...window} />
      </ReqoreUIProvider>
    );

    const copy = await screen.findByRole('button', { name: /^\[Çöpy\]$/ });
    await act(async () => {
      fireEvent.click(copy);
    });

    const notices = () =>
      Array.from(document.querySelectorAll('.reqore-notification')).map((n) => n.textContent || '');
    await waitFor(() => expect(notices()).toEqual([expect.stringContaining('[Nöt çöpîéd]')]));
    // the Clipboard API was asked first, and refused
    expect(writeText).toHaveBeenCalledWith(JSON.stringify('x'.repeat(200)));
    await expect(writeText.mock.results[0].value).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(notices().join()).not.toMatch(/\[Çöpîéd\]|Could not copy|copied to clipboard/);
    expect(clipboard.copied).toEqual([]);
  });
});
