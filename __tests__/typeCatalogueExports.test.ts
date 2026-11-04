// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The type catalogue's lookups are the package's public surface (qorus#646): a host such as the Qorus IDE names a
 * type, and finds what it takes, with reqraft's `qorusTypeEntry` - by its name, an optional, soft or complex form of
 * one, or its base type - rather than keeping a copy of its own that drifts from it. From the package, not from a
 * deep import of `dist/…`, which is a dependency on the file layout.
 */
import * as reqraft from '../src';
import { qorusTypeEntry as fromHook } from '../src/hooks/useQorusTypes';

describe("the package's type catalogue lookups", () => {
  it('exports the entry lookup', () => {
    expect(reqraft.qorusTypeEntry).toBeDefined();
    expect(reqraft.qorusTypeEntry(reqraft.defaultQorusTypes, '*string')?.name).toBe('string');
    expect(
      reqraft.qorusTypeEntry(reqraft.defaultQorusTypes, 'qoretechnologies/order', 'hash')?.name
    ).toBe('hash');
    expect(fromHook).toBe(reqraft.qorusTypeEntry);
  });

  it('exports what a type picker offers, and the names', () => {
    expect(
      reqraft.offeredQorusTypes(reqraft.defaultQorusTypes).map((type) => type.name)
    ).not.toContain('email');
    expect(reqraft.qorusTypeDisplayName(reqraft.defaultQorusTypes, 'blob')).toBe(
      reqraft.UNKNOWN_TYPE_NAME
    );
    expect(reqraft.getQorusTypes()).toBe(reqraft.defaultQorusTypes);
  });
});
