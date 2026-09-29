import { describe, expect, it } from 'vitest';
import { activatesRow, cardReducer, CLOSED, openCard, placeCard, type ICardState, type TCardEvent } from '../../src/tracking/ui/anchor';

const viewport = { width: 1280, height: 800 };
const handle = { width: 220, height: 28 };
const at = (top: number, height = 300, left = 100, width = 800) => ({ top, left, width, height });

describe('placeCard: anchored to the tested element', () => {
  it('puts the handle at the element’s top-left corner and the card under it, in document coordinates', () => {
    const p = placeCard({ box: at(200), viewport, scroll: { x: 0, y: 1000 }, handle, card: { height: 300 }, topInset: 76 });
    expect(p.visible).toBe(true);
    expect(p.outline).toEqual({ top: 1200, left: 100, width: 800, height: 300 });
    expect(p.handle).toEqual({ top: 1212, left: 112 });
    expect(p.card).toMatchObject({ top: 1212 + 28 + 8, left: 112, width: 440, side: 'below' });
  });

  it('moves with the element: scrolling changes the viewport box but not the document position', () => {
    const a = placeCard({ box: at(300), viewport, scroll: { x: 0, y: 0 }, handle, card: { height: 200 }, topInset: 76 });
    const b = placeCard({ box: at(100), viewport, scroll: { x: 0, y: 200 }, handle, card: { height: 200 }, topInset: 76 });
    expect(b.handle).toEqual(a.handle);
    // The same place on the page (only the room it may grow into follows the window).
    expect({ ...b.card, maxHeight: 0 }).toEqual({ ...a.card, maxHeight: 0 });
  });

  it('flips the card above the handle when it does not fit below and there is more room above', () => {
    const p = placeCard({ box: at(560, 200), viewport, scroll: { x: 0, y: 0 }, handle, card: { height: 400 }, topInset: 76 });
    expect(p.card?.side).toBe('above');
    expect(p.card!.top + Math.min(400, p.card!.maxHeight)).toBe(p.handle.top - 8);
  });

  it('keeps the card on its side while it still fits there (no jumping while scrolling)', () => {
    const base = { viewport, scroll: { x: 0, y: 0 }, handle, card: { height: 300 }, topInset: 76 };
    expect(placeCard({ ...base, box: at(420, 200), side: 'above' }).card?.side).toBe('above');
    expect(placeCard({ ...base, box: at(420, 200) }).card?.side).toBe('below');
    // No longer fits above: it moves.
    expect(placeCard({ ...base, box: at(200, 200), side: 'above' }).card?.side).toBe('below');
  });

  it('keeps the handle on the visible part of an element scrolled under the header', () => {
    const p = placeCard({ box: at(-150, 600), viewport, scroll: { x: 0, y: 500 }, handle, topInset: 76 });
    expect(p.handle.top).toBe(76 + 12 + 500);
  });

  it('caps the card to the room it has (it scrolls inside) but never below the minimum', () => {
    const tall = placeCard({ box: at(100, 200), viewport, scroll: { x: 0, y: 0 }, handle, card: { height: 1200 }, topInset: 76 });
    expect(tall.card?.side).toBe('below');
    expect(tall.card?.maxHeight).toBe(800 - 12 - (112 + 28 + 8));
  });

  it('fits a phone: the card is the window’s width minus the edges, and stays inside it', () => {
    const p = placeCard({ box: at(200, 300, 0, 390), viewport: { width: 390, height: 844 }, scroll: { x: 0, y: 0 }, handle, card: { height: 300 }, topInset: 64 });
    expect(p.card).toMatchObject({ width: 366, left: 12 });
  });

  it('flips above near the bottom of a phone, and caps the card to the room above', () => {
    const phone = { width: 390, height: 844 };
    const p = placeCard({ box: at(700, 120, 0, 390), viewport: phone, scroll: { x: 0, y: 0 }, handle, card: { height: 520 }, topInset: 0 });
    expect(p.card?.side).toBe('above');
    expect(p.card!.top).toBeGreaterThanOrEqual(12);
    expect(p.card!.top + Math.min(520, p.card!.maxHeight)).toBe(p.handle.top - 8);
  });

  it('draws nothing for an element that is off screen', () => {
    expect(placeCard({ box: at(900), viewport, scroll: { x: 0, y: 0 }, handle, topInset: 76 }).visible).toBe(false);
    expect(placeCard({ box: at(-400, 300), viewport, scroll: { x: 0, y: 0 }, handle, topInset: 76 }).visible).toBe(false);
  });
});

const run = (...events: TCardEvent[]) => events.reduce<ICardState>(cardReducer, CLOSED);

describe('which card is open', () => {
  it('opens on hover and closes when the pointer leaves', () => {
    expect(openCard(run({ type: 'hover', key: 'cta' }))).toBe('cta');
    expect(openCard(run({ type: 'hover', key: 'cta' }, { type: 'hover', key: null }))).toBeNull();
  });

  it('✕ closes a card opened by hover, and it stays closed until the pointer leaves and comes back', () => {
    const closed = run({ type: 'hover', key: 'cta' }, { type: 'close' });
    expect(openCard(closed)).toBeNull();
    expect(openCard(cardReducer(closed, { type: 'hover', key: 'cta' }))).toBeNull();
    expect(openCard(run({ type: 'hover', key: 'cta' }, { type: 'close' }, { type: 'hover', key: null }, { type: 'hover', key: 'cta' }))).toBe('cta');
  });

  it('✕ closes a card opened by keyboard focus or by a click', () => {
    expect(openCard(run({ type: 'focus', key: 'cta' }, { type: 'close' }))).toBeNull();
    expect(openCard(run({ type: 'toggle', key: 'cta' }, { type: 'close' }))).toBeNull();
    // A click on the handle of a card that hover opened pins it; the second click closes it.
    expect(openCard(run({ type: 'hover', key: 'cta' }, { type: 'toggle', key: 'cta' }, { type: 'hover', key: null }))).toBe('cta');
    expect(openCard(run({ type: 'hover', key: 'cta' }, { type: 'toggle', key: 'cta' }, { type: 'toggle', key: 'cta' }))).toBeNull();
  });

  it('a click pins the card: it stays open when the pointer leaves; a click on another test moves it', () => {
    expect(openCard(run({ type: 'toggle', key: 'cta' }, { type: 'hover', key: null }))).toBe('cta');
    expect(openCard(run({ type: 'toggle', key: 'cta' }, { type: 'toggle', key: 'pricing' }))).toBe('pricing');
  });

  it('focusing the handle again reopens a closed card', () => {
    expect(openCard(run({ type: 'focus', key: 'cta' }, { type: 'close' }, { type: 'focus', key: 'cta' }))).toBe('cta');
  });
});

describe('a version row as a button', () => {
  it('Enter and Space on the row show its version; keys on its buttons do not', () => {
    expect(activatesRow('Enter', true)).toBe(true);
    expect(activatesRow(' ', true)).toBe(true);
    expect(activatesRow('Enter', false)).toBe(false);
    expect(activatesRow('a', true)).toBe(false);
  });
});
