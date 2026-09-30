/**
 * Deterministic bucketing: GrowthBook's hash v2 (MIT), so assignments match what
 * GrowthBook-compatible tooling (and the server, if it ever recomputes) gets.
 *
 *   n = (fnv1a32(String(fnv1a32(seed + value))) % 10000) / 10000
 *
 * The inner hash is turned into its *decimal string* before it is hashed again —
 * that is GrowthBook's definition (`hashFnv32a(hashFnv32a(seed + value) + "")`).
 * Characters are hashed as UTF-16 code units (`charCodeAt`), like GrowthBook; for
 * the ASCII ids and keys we use that equals FNV-1a over the bytes.
 */

/** FNV-1a, 32 bit. `fnv1a32('a') === 0xe40c292c` (the reference test vector). */
export const fnv1a32 = (input: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619 (the FNV prime) in 32-bit arithmetic, as shifts and adds.
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
};

/** A number in [0, 1) with 4 decimals; the same inputs always give the same number. */
export const hashV2 = (seed: string, value: string): number =>
  (fnv1a32(String(fnv1a32(seed + value))) % 10000) / 10000;
