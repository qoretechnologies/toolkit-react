import type { IStorage } from './storage';
import { Observable } from './observable';
import { KEYS, type TConsentState, type TStorageKeys } from './types';

/**
 * The visitor's answer (§3 of the contract): `localStorage["<prefix>consent"]` is
 * `granted` | `denied`, `<prefix>consent.v` the version of the text they answered
 * (prefix `qa.` by default). An answer to an older version counts as no answer, so
 * the consent prompt asks again.
 */
export class ConsentStore {
  readonly state: Observable<TConsentState>;

  constructor(
    private readonly storage: IStorage,
    private readonly version: number,
    private readonly keys: TStorageKeys = KEYS,
  ) {
    this.state = new Observable<TConsentState>(this.read());
  }

  private read(): TConsentState {
    const answer = this.storage.get(this.keys.consent);
    const version = Number(this.storage.get(this.keys.consentVersion) ?? 0);
    if ((answer === 'granted' || answer === 'denied') && version >= this.version) return answer;
    return 'unknown';
  }

  get = (): TConsentState => this.state.get();
  granted = (): boolean => this.state.get() === 'granted';

  answer(state: 'granted' | 'denied') {
    this.storage.set(this.keys.consent, state);
    this.storage.set(this.keys.consentVersion, String(this.version));
    this.state.set(state);
  }
}
