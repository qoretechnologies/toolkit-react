// Copyright 2026 Qore Technologies, s.r.o.
/*
 * A list or picker opened at an editor's caret hears its keys from the moment it is on the page. They listened from a
 * passive effect, which React runs after the picker is painted: a key pressed in between reached nothing, and an
 * Escape left the picker open (DpqlEditor · An Emptied Field Opens The Picker, flaky in CI on develop - the play
 * pressed Escape as soon as the picker's rows were there, and a loaded runner had not run the effect yet).
 *
 * "As soon as it is drawn" is modelled exactly: a sibling drawn after the picker presses the key from its own layout
 * effect, which React runs in the same commit, after the picker's layout effects and before any passive one.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TemplatePicker } from '../src/components/form/fields/template/TemplatePicker';
import { useCompletionKeys } from '../src/components/smartEditor/useLspAutocomplete';
import { templateTree } from '../src/helpers/templateTree';

/** Presses `key` on the page in the commit that draws it, as a person can the instant the list appears. */
const PressedOnceDrawn = ({ keyName }: { keyName: string }) => {
  useLayoutEffect(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true })
    );
  }, [keyName]);
  return null;
};

const roots = templateTree({
  items: [
    {
      label: 'Order data',
      items: [{ label: 'order id', value: '$local:{order_id}', badge: 'int' }],
    },
  ],
});

describe('a picker opened at the caret', () => {
  it('hears an Escape pressed the moment its rows are drawn', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <TemplatePicker id='picker' roots={roots} keysFromPage onPick={vi.fn()} onClose={onClose} />
        <PressedOnceDrawn keyName='Escape' />
      </ReqoreUIProvider>
    );
    // the rows were on the page when the key came
    expect(container.querySelector('.template-picker-row')).toBeTruthy();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('a completion list at the caret', () => {
  const Keys = ({ onClose }: { onClose: () => void }) => {
    useCompletionKeys({
      isOpen: true,
      count: 2,
      setFocusedIndex: vi.fn(),
      onAccept: vi.fn(),
      onClose,
    });
    return null;
  };

  it('hears an Escape pressed the moment its rows are drawn', () => {
    const onClose = vi.fn();
    render(
      <>
        <Keys onClose={onClose} />
        <PressedOnceDrawn keyName='Escape' />
      </>
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
