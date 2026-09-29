import { memoryStorage, type IStorage } from './core/storage';
import { Tracker, type IPageInfo } from './core/tracker';
import { resolveConfig, storageKeys, type IBatch, type IExperimentDefinition, type ITrackingConfig, type TStorageKeys } from './core/types';

/**
 * A tracker with no browser behind it: memory storage, a fake clock and timers you
 * drive, a transport that records batches. For unit tests and Storybook stories.
 * Defaults: property `test`, the default storage prefix (`qa.`), page `https://example.com/`.
 */
export interface IMemoryTracker {
  tracker: Tracker;
  /** Batches handed to the transport, parsed. */
  sent: { batch: IBatch; mode: 'fetch' | 'beacon' }[];
  local: IStorage;
  session: IStorage;
  /** The storage keys under the config's prefix. */
  keys: TStorageKeys;
  page: IPageInfo;
  /** Moves the clock forward and runs every timer that is due. */
  advance: (ms: number) => Promise<void>;
  now: () => number;
  /** Makes the next transport calls fail (network down). */
  setOffline: (offline: boolean) => void;
}

export interface IMemoryTrackerOptions {
  /** Any config field; `property`, `endpoint` and `experimentsEndpoint` have test defaults. */
  config?: Partial<ITrackingConfig>;
  consent?: 'granted' | 'denied';
  /** The running-experiments answer: a list, a function (read on every load), or 'fail' (no endpoint). */
  experiments?: IExperimentDefinition[] | (() => unknown[]) | 'fail';
  page?: Partial<IPageInfo>;
  vid?: string;
  start?: number;
  /** localStorage contents before the tracker starts (applied last). */
  seed?: Record<string, string>;
}

export const createMemoryTracker = (options: IMemoryTrackerOptions = {}): IMemoryTracker => {
  let clock = options.start ?? Date.UTC(2026, 8, 29, 10, 0, 0);
  let offline = false;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextTimer = 1;
  const local = memoryStorage();
  const session = memoryStorage();
  const config = resolveConfig({
    property: 'test',
    endpoint: '/collect',
    experimentsEndpoint: '/experiments',
    ...options.config,
  });
  const keys = storageKeys(config.storagePrefix);
  if (options.consent) {
    local.set(keys.consent, options.consent);
    local.set(keys.consentVersion, String(config.consentVersion));
  }
  if (options.vid) local.set(keys.vid, options.vid);
  Object.entries(options.seed ?? {}).forEach(([k, v]) => local.set(k, v));
  const page: IPageInfo = {
    origin: 'https://example.com',
    path: '/',
    search: '',
    title: 'Example',
    referrer: '',
    lang: 'en-US',
    viewport: [1440, 900],
    device: 'desktop',
    ...options.page,
  };
  const sent: IMemoryTracker['sent'] = [];
  const tracker = new Tracker(config, {
    local,
    session,
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    page: () => page,
    transport: {
      send: async (body, mode) => {
        if (offline) return false;
        sent.push({ batch: JSON.parse(body) as IBatch, mode });
        return true;
      },
    },
    fetchJson: async () => {
      if (!options.experiments || options.experiments === 'fail') throw new Error('no experiments endpoint');
      return { experiments: typeof options.experiments === 'function' ? options.experiments() : options.experiments };
    },
  });
  const advance = async (ms: number) => {
    const until = clock + ms;
    for (;;) {
      const due = Array.from(timers.entries()).filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = Math.max(clock, due[1].at);
      due[1].fn();
      await Promise.resolve();
    }
    clock = until;
    await new Promise((r) => setTimeout(r, 0));
  };
  return { tracker, sent, local, session, keys, page, advance, now: () => clock, setOffline: (o) => (offline = o) };
};
