/**
 * Regression coverage for the "cookie-consent banner never closes" bug.
 *
 * A user with no storage yet has `currentUser.storage === undefined | null`.
 * `set(cloneDeep(undefined), path, value)` returns `undefined` (lodash won't set
 * on a nullish target), so the FIRST write for such a user — accepting the
 * cookie-consent banner, the first onboarding flag, etc. — persisted an empty
 * body and silently dropped the value, leaving the flag unset forever (the banner
 * reappeared on every load). `applyStorageWrite` seeds a fresh `{}` so the first
 * write builds real storage.
 */
import { applyStorageWrite } from '../src/providers/StorageProvider';

describe('applyStorageWrite', () => {
  test('seeds a fresh object when storage is undefined (the first-ever write)', () => {
    expect(applyStorageWrite(undefined, 'ide.cookie-consent', true)).toEqual({
      ide: { 'cookie-consent': true },
    });
  });

  test('seeds a fresh object when storage is null', () => {
    expect(applyStorageWrite(null as unknown as undefined, 'ide.onboarded', true)).toEqual({
      ide: { onboarded: true },
    });
  });

  test('merges onto existing storage without dropping other keys', () => {
    expect(applyStorageWrite({ a: 1, ide: { x: 1 } }, 'ide.y', 2)).toEqual({
      a: 1,
      ide: { x: 1, y: 2 },
    });
  });

  test('clones — never mutates the input blob', () => {
    const input = { ide: { x: 1 } };
    applyStorageWrite(input, 'ide.y', 2);
    expect(input).toEqual({ ide: { x: 1 } });
  });

  test('supports removal writes (value = null) on nullish storage too', () => {
    expect(applyStorageWrite(undefined, 'ide.gone', null)).toEqual({ ide: { gone: null } });
  });
});
