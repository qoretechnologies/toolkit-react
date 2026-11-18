/**
 * An open field's card pins its heading only while it is clearly taller than its scroll area (more than one and a
 * half times, decision 028), and then under whatever the form already pins above it: its toolbar and the header of
 * the status box it sits in. A row inside a pinned card is revealed clear of the card's heading too.
 *
 * The story gate is `Form/Engine/Sticky Headers · A Long Card Keeps Its Heading While Its Body Is Read` (board t-87
 * B-9: the Qorus IDE's Cases card lost its pinned heading when it became a read-first card).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  CARD_HEADER_TALL_SCREENS,
  getStickyScrollport,
  measureCardHeaderPin,
} from '../src/components/form/engine/cardHeaderPin';
import { getPinnedChromeHeight } from '../src/components/form/engine/revealRow';

const setHeight = (element: HTMLElement, height: number) => {
  element.getBoundingClientRect = () =>
    ({ top: 0, bottom: height, height, left: 0, right: 100, width: 100, x: 0, y: 0 }) as DOMRect;
};

/**
 * A 500px scroller, padded 20px at the top, holding a form whose toolbar pins at 0 (60px) and whose Set box header
 * pins at 60 (48px), with an open card in the box. Reqore reports a sticky `top` less the scroller's padding.
 */
const buildForm = ({ boxPins = true } = {}) => {
  document.body.innerHTML = `
    <div id="scroller" style="overflow-y: auto; padding-top: 20px">
      <div class="options-readfirst-scroll">
        <div class="reqore-panel">
          <div class="reqore-panel-title" id="toolbar" style="position: sticky; top: -20px"></div>
          <div class="options-readfirst-group">
            <div class="reqore-panel-title" id="box-header"
              style="position: ${boxPins ? 'sticky' : 'relative'}; top: 40px"></div>
            <div class="options-readfirst-card" id="card">
              <div class="options-readfirst-card-header" id="card-header"></div>
              <div class="readfirst-row" id="row"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  const scroller = document.getElementById('scroller')!;
  Object.defineProperty(scroller, 'clientHeight', { value: 500, configurable: true });
  setHeight(document.getElementById('toolbar')!, 60);
  setHeight(document.getElementById('box-header')!, 48);
  setHeight(document.getElementById('card-header')!, 40);
  return { scroller, card: document.getElementById('card')! };
};

describe('a card heading pins while its long body is read', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pins against the scroller the heading would stick to', () => {
    const { scroller, card } = buildForm();
    expect(getStickyScrollport(card)).toBe(scroller);
  });

  it('does not pin a card that is not clearly taller than its scroll area', () => {
    const { card } = buildForm();
    // the visible height is 480 (500 less the 20px padding); one and a half of it is 720
    setHeight(card, 480 * CARD_HEADER_TALL_SCREENS);
    expect(measureCardHeaderPin(card)).toEqual({ pins: false, top: 0 });
  });

  it('pins a taller card under the toolbar and the box header', () => {
    const { card } = buildForm();
    setHeight(card, 480 * CARD_HEADER_TALL_SCREENS + 1);
    // the box header pins at 40 (60 less the padding) and is 48 tall
    expect(measureCardHeaderPin(card)).toEqual({ pins: true, top: 88 });
  });

  it('pins under the toolbar alone when the box header does not pin', () => {
    const { card } = buildForm({ boxPins: false });
    setHeight(card, 2000);
    expect(measureCardHeaderPin(card)).toEqual({ pins: true, top: 40 });
  });

  it("pins at the host's own offset when nothing of the form's is pinned", () => {
    const { card } = buildForm({ boxPins: false });
    document.getElementById('toolbar')!.style.position = 'relative';
    setHeight(card, 2000);
    expect(measureCardHeaderPin(card, 30)).toEqual({ pins: true, top: 10 });
  });

  it("counts a pinned card heading as chrome above the card's own rows", () => {
    buildForm();
    const heading = document.getElementById('card-header')!;
    heading.style.position = 'sticky';
    heading.style.top = '88px';
    expect(getPinnedChromeHeight(document.getElementById('row')!)).toBe(128);
  });
});
