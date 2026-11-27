// Copyright 2026 Qore Technologies, s.r.o.
/*
 * The template picker at an editor's caret is drawn some commits after it is asked for: its popover opens once it is
 * mounted (`openOnMount`), and the picker after that. A key pressed in between reached nothing - the completion keys
 * are not the picker's, and the picker was not listening yet - so an Escape left the picker open when it came
 * (DpqlEditor · An Emptied Field Opens The Picker, flaky in CI: a list of only "Browse all templates" became the
 * picker as the play pressed Escape). Until the picker listens, the opener hears its keys: Escape puts it away, and
 * the others are handed to the picker, in order, once it listens.
 *
 * Both halves are modelled exactly: the picker is drawn in a commit after the one that asks for it (as the popover
 * draws it), and the key is pressed at the first moment after the commit that asks for it - from a layout effect
 * declared after the editor's, which React runs once every other one of that commit has run, and before the
 * picker is drawn.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render } from '@testing-library/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ReactEditor } from 'slate-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplatePicker } from '../src/components/form/fields/template/TemplatePicker';
import { defaultSlateConverter } from '../src/components/smartEditor/helpers';
import {
  IUseLspAutocompleteResult,
  useLspAutocomplete,
} from '../src/components/smartEditor/useLspAutocomplete';
import { templateTree } from '../src/helpers/templateTree';

const roots = templateTree({
  items: [
    { label: 'Order data', items: [{ label: 'order id', value: '$local:{order_id}', badge: 'int' }] },
    { label: 'Record fields', items: [{ label: 'name', value: '$record:name', badge: 'string' }] },
  ],
});

/** The editor's text on the page: where the keys are pressed, the caret staying in it. */
const text = document.createElement('div');
text.setAttribute('contenteditable', 'true');
document.body.appendChild(text);

const editor = {
  children: defaultSlateConverter.toSlateNodes(''),
  selection: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } },
  operations: [],
} as never;

afterEach(() => vi.restoreAllMocks());

/** Presses `keys` at the text once the commit that first asks for the picker has run its layout effects. */
const usePressedWhenAsked = (asked: boolean, keys: string[]) =>
  useLayoutEffect(() => {
    if (!asked) return;
    keys.forEach((key) =>
      text.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    );
  }, [asked]);

/** The picker as the popover draws it: in a commit after the one that asks for it. */
const DrawnLater = ({ autocomplete }: { autocomplete: IUseLspAutocompleteResult }) => {
  const [drawn, setDrawn] = useState<number | null>(null);
  useEffect(() => {
    setDrawn(autocomplete.browse ? autocomplete.popoverKey : null);
  }, [autocomplete.browse, autocomplete.popoverKey]);
  return drawn !== null && autocomplete.browse ?
      <TemplatePicker
        id='picker'
        roots={roots}
        keysFromPage
        arrowsFromPage={autocomplete.browse.arrows}
        onPick={vi.fn()}
        onClose={autocomplete.close}
        onKeysHeard={() => autocomplete.pickerHears(drawn)}
      />
    : null;
};

const opened = (keys: string[]) => {
  vi.spyOn(ReactEditor, 'toDOMNode').mockReturnValue(text);
  let autocomplete!: IUseLspAutocompleteResult;
  const Editor = () => {
    autocomplete = useLspAutocomplete({
      getCompletions: vi.fn().mockResolvedValue([]),
      isReady: true,
      triggerCharacters: new Set(['$']),
      converter: defaultSlateConverter,
      inserter: vi.fn(),
    } as never);
    usePressedWhenAsked(!!autocomplete.browse, keys);
    return <DrawnLater autocomplete={autocomplete} />;
  };
  render(
    <ReqoreUIProvider>
      <Editor />
    </ReqoreUIProvider>
  );
  act(() =>
    autocomplete.openBrowse(editor, { rect: { left: 0, bottom: 0 }, anchor: text, arrows: true } as never)
  );
  return () => autocomplete;
};

const focusedRow = () =>
  document.querySelector('.template-picker-row[aria-selected="true"]')?.getAttribute('data-label');

describe('a key pressed before the picker at the caret is drawn', () => {
  it('is not needed for the picker to come', () => {
    const autocomplete = opened([]);
    expect(autocomplete().isOpen).toBe(true);
    expect(document.querySelector('.template-picker')).toBeTruthy();
    expect(focusedRow()).toBe('Order data');
  });

  it('Escape puts the picker away', () => {
    const autocomplete = opened(['Escape']);
    expect(autocomplete().isOpen).toBe(false);
    expect(document.querySelector('.template-picker')).toBeNull();
  });

  it('the arrows are handed to the picker once it listens, in order', () => {
    opened(['ArrowDown']);
    expect(document.querySelector('.template-picker')).toBeTruthy();
    // the arrow moved the keyboard's row from the first to the second
    expect(focusedRow()).toBe('Record fields');
  });
});
