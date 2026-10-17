import { useRef } from 'react';

/**
 * Whether two values are the same value, as a field reads them: what an echo is recognised by.
 *
 * Nothing is the same value but what this says is: the default is `Object.is`, under which `''`, `undefined`,
 * `null` and an empty document are four different values, and a document handed back as a copy is not the
 * one that was reported. A field whose parent stores a value another way than it reported it says so here
 * (the Qorus IDE's rich text reads `''`, `undefined`, `null` and an empty document as one empty value, and a
 * reference as the document holding only it).
 */
export type TEmittedValuesEquals<T> = (a: T, b: T) => boolean;

/**
 * What a debounced field has told its parent and not yet heard back.
 *
 * A field that keeps a local copy of what is being typed reports it after a
 * short pause, and the parent hands that value back down as the `value` prop —
 * usually after its OWN debounce, so the echo of an emit arrives while the
 * person is already typing the next character. Treating every incoming value
 * as an external change copied that stale echo over the newer text: typing
 * "ship-order" with 150 ms between keys left "shp-order".
 *
 * So an incoming value is first checked against what is in flight. One that
 * matches an emit is the parent catching up, not a change, and it acknowledges
 * that emit and every one before it (a parent that debounces skips some).
 * Anything else is a genuine change from outside and replaces the local text;
 * it also drops whatever was in flight, since the parent has moved past it.
 *
 * A genuine external change that happens to equal an emit still in flight is
 * indistinguishable from its echo, and is treated as one — harmless, because it
 * sets the very value the field already reported.
 *
 * How a field uses it (`useEmittedValues` keeps one for the life of the component):
 * - `record(value)` as it reports a value to its parent;
 * - `isEcho(incoming)` once, where an incoming `value` is committed (an effect on it): `true` - the parent
 *   catching up - leaves what is being typed alone; `false` is a change from outside, to take;
 * - `includes(incoming)` where a render needs the same answer without acknowledging anything;
 * - `settled(current)` for what the parent will hold once every emit has come back: an edit is a change only
 *   when it differs from that.
 *
 * Which values are the same is the caller's to say (`TEmittedValuesEquals`); see it for the default.
 */
export class EmittedValues<T> {
  private pending: T[] = [];

  /** Bounded: a parent that never feeds its value back never acknowledges. */
  private static readonly LIMIT = 50;

  constructor(private readonly equals: TEmittedValuesEquals<T> = Object.is) {}

  /** Record a value just reported to the parent. */
  record(value: T): void {
    this.pending.push(value);
    if (this.pending.length > EmittedValues.LIMIT) {
      this.pending.shift();
    }
  }

  /**
   * What the parent will hold once every emit still in flight has come back: the latest emit, or, with none in
   * flight, `current` - the value the parent holds now. An edit is a change only when it differs from this.
   * Compared with `current` alone, an edit back to the parent's old value, made while the emit before it was in
   * flight, looked like no change and was never sent; the echo of that emit then left the parent holding the
   * edit that had been undone (qorus#646).
   */
  settled(current: T): T {
    return this.pending.length ? this.pending[this.pending.length - 1] : current;
  }

  /**
   * Whether `incoming` is one of the emits still in flight, without acknowledging anything: for a render,
   * which may run more than once for one value, while `isEcho` is called once the value is committed.
   */
  includes(incoming: T): boolean {
    return this.pending.some((value) => this.equals(value, incoming));
  }

  /**
   * Whether `incoming` is the echo of an emit still in flight. An echo
   * acknowledges that emit and every earlier one; anything else clears the
   * in-flight list, because the parent has a value of its own.
   */
  isEcho(incoming: T): boolean {
    const index = this.pending.findIndex((value) => this.equals(value, incoming));
    if (index === -1) {
      this.pending = [];
      return false;
    }
    this.pending = this.pending.slice(index + 1);
    return true;
  }
}

/**
 * One `EmittedValues` for the life of the component, comparing with `equals` (default `Object.is`; see
 * `TEmittedValuesEquals`). The `equals` of the first render is the one kept.
 */
export const useEmittedValues = <T>(equals?: TEmittedValuesEquals<T>): EmittedValues<T> => {
  const ref = useRef<EmittedValues<T>>();
  if (!ref.current) {
    ref.current = new EmittedValues<T>(equals);
  }
  return ref.current;
};
