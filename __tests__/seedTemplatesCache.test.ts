import { describe, expect, it, beforeEach } from 'vitest';
import { TemplatesCache, seedTemplatesCache } from '../src/hooks/useTemplates';

/**
 * A host that has already fetched `getContextData` can hand the answer over.
 *
 * Two caches over one API is the same defect already fixed for the type
 * catalogue: the page pays twice AND waits, because a form will not render a
 * field before its templates exist.
 */
describe('seeding the templates cache', () => {
  beforeEach(() => {
    TemplatesCache.clear();
  });

  const PAYLOAD = { 'my-context': { some: 'value' } } as never;

  it('makes the context available without a fetch', () => {
    expect(TemplatesCache.has('generic')).toBe(false);

    seedTemplatesCache('generic', PAYLOAD);

    expect(TemplatesCache.has('generic')).toBe(true);
    expect(TemplatesCache.get('generic')).toBeDefined();
  });

  it('does not overwrite an answer that is already there', () => {
    const already = { items: [{ label: 'Real' }] } as never;
    TemplatesCache.set('generic', already);

    seedTemplatesCache('generic', PAYLOAD);

    // First write wins: a real fetch that has already answered outranks a seed.
    expect(TemplatesCache.get('generic')).toBe(already);
  });

  it('ignores an empty context rather than caching under a blank key', () => {
    seedTemplatesCache('', PAYLOAD);

    expect(TemplatesCache.size).toBe(0);
  });
});
