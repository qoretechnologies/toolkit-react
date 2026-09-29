/**
 * Storage that never throws: private windows, blocked site data and sandboxed
 * iframes make `localStorage` throw on access. The tracker then keeps its state in
 * memory for the page's lifetime and the site behaves exactly as without consent.
 */
export interface IStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const memoryStorage = (): IStorage => {
  const data = new Map<string, string>();
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

export const safeStorage = (pick: () => Storage | undefined): IStorage => {
  const fallback = memoryStorage();
  const store = (): Storage | undefined => {
    try {
      return pick();
    } catch {
      return undefined;
    }
  };
  return {
    get: (k) => {
      try {
        const s = store();
        return s ? s.getItem(k) : fallback.get(k);
      } catch {
        return fallback.get(k);
      }
    },
    set: (k, v) => {
      try {
        const s = store();
        if (s) s.setItem(k, v);
        else fallback.set(k, v);
      } catch {
        fallback.set(k, v);
      }
    },
    remove: (k) => {
      fallback.remove(k);
      try {
        store()?.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
};

export const readJson = <T>(storage: IStorage, key: string): T | null => {
  const raw = storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJson = (storage: IStorage, key: string, value: unknown) => storage.set(key, JSON.stringify(value));
