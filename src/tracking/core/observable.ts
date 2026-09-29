type TListener = () => void;

/** A tiny observable value (what React's `useSyncExternalStore` wants). */
export class Observable<T> {
  private listeners = new Set<TListener>();
  constructor(private value: T) {}
  get = (): T => this.value;
  set(next: T) {
    if (Object.is(next, this.value)) return;
    this.value = next;
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {
        /* a listener never breaks the tracker */
      }
    });
  }
  subscribe = (listener: TListener) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
}
