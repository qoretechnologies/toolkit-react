/**
 * A moved or opened row is scrolled to only when it is not already fully in
 * view below the pinned chrome above it, and it lands clear of that chrome.
 *
 * `block: 'center'` scrolled a row that was in plain sight and centred it
 * against the whole scrollport, so the status-box header pinned at the top was
 * drawn over it (qorus-ide schema editor: header 375-423, row at 405).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findScrollContainer,
  getPinnedChromeHeight,
  getRevealClearance,
  isRowInView,
  revealRow,
} from '../src/components/form/engine/revealRow';

const rect = (top: number, height: number): DOMRect =>
  ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const setRect = (element: HTMLElement, top: number, height: number) => {
  element.getBoundingClientRect = () => rect(top, height);
};

/**
 * A scroller (viewport-relative 100-600) holding a form whose toolbar pins at
 * 0 (60px tall) and whose status box header pins at 60 (48px tall): the
 * pinned chrome reaches 108px below the scroller's top, i.e. y = 208.
 */
const buildForm = () => {
  document.body.innerHTML = `
    <div id="scroller" style="overflow-y: auto">
      <div class="options-readfirst-scroll">
        <div class="reqore-panel" id="form-panel">
          <div class="reqore-panel-title" id="toolbar" style="position: sticky; top: 0px"></div>
          <div class="options-readfirst-group" id="box">
            <div class="reqore-panel-title" id="box-header" style="position: sticky; top: 60px"></div>
            <div class="readfirst-row" id="row"></div>
          </div>
        </div>
      </div>
    </div>`;
  const scroller = document.getElementById('scroller')!;
  // jsdom has no layout: give the scroller something to scroll.
  Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(scroller, 'clientHeight', { value: 500, configurable: true });
  setRect(scroller, 100, 500);
  setRect(document.getElementById('toolbar')!, 100, 60);
  setRect(document.getElementById('box-header')!, 160, 48);
  const row = document.getElementById('row')!;
  return { scroller, row };
};

describe('revealRow', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    document.body.innerHTML = '';
  });

  it('finds the scroller and measures the pinned chrome above the row', () => {
    const { scroller, row } = buildForm();
    expect(findScrollContainer(row)).toBe(scroller);
    // the box header pins at 60 and is 48 tall: the deepest pinned edge
    expect(getPinnedChromeHeight(row)).toBe(108);
  });

  it('does not scroll a row that is fully in view below the pinned headers', () => {
    const { row } = buildForm();
    setRect(row, 300, 30);
    expect(isRowInView(row, getPinnedChromeHeight(row))).toBe(true);
    expect(revealRow(row)).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls a row the pinned box header covers, the least distance, clear of the header', () => {
    const { row } = buildForm();
    // the reported shape: inside the scrollport, but under the pinned header
    setRect(row, 190, 30);
    expect(revealRow(row)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'nearest' });
    // `nearest` aligns the margin box, so the row stops just below the header
    expect(row.style.scrollMarginTop).toBe('108px');
  });

  it('scrolls a row below the scrollport', () => {
    const { row } = buildForm();
    setRect(row, 590, 30);
    expect(revealRow(row, 'auto')).toBe(true);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'nearest', behavior: 'auto' });
  });

  it("counts the scroller's top padding, which a sticky top is measured from", () => {
    const { scroller, row } = buildForm();
    scroller.style.paddingTop = '16px';
    expect(getRevealClearance(row)).toBe(124);
    // clear of the scrollport edge + 108, but still under the header pinned at
    // the padded edge + 108
    setRect(row, 215, 30);
    expect(revealRow(row)).toBe(true);
    expect(row.style.scrollMarginTop).toBe('124px');
  });

  it('ignores headers that are not pinned', () => {
    const { row } = buildForm();
    document.getElementById('toolbar')!.style.position = 'static';
    document.getElementById('box-header')!.style.position = 'static';
    expect(getPinnedChromeHeight(row)).toBe(0);
    // the same row the pinned header covered is now plainly visible
    setRect(row, 190, 30);
    expect(revealRow(row)).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('uses the viewport when nothing scrolls', () => {
    document.body.innerHTML = '<div class="readfirst-row" id="row"></div>';
    const row = document.getElementById('row')!;
    expect(findScrollContainer(row)).toBeUndefined();
    setRect(row, 10, 30);
    expect(revealRow(row)).toBe(false);
    setRect(row, window.innerHeight + 10, 30);
    expect(revealRow(row)).toBe(true);
  });

  it('does nothing where scrollIntoView is not implemented', () => {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    const { row } = buildForm();
    setRect(row, 900, 30);
    expect(revealRow(row)).toBe(false);
  });
});
