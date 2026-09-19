import { describe, expect, it } from 'vitest';
import { offersTypeChoices } from '../src/components/form/engine/typeChoices';

/**
 * Which options offer the per-type choices ("Integer", "Hash", …) in the row
 * menu.
 *
 * Reported from the live IDE: an assertion's Expected Value had no type
 * choices in its menu at all — only "Edit fullscreen", "Use Expression" and
 * "Use Template". They appeared ONLY in the Visual view of an expression,
 * because there the field is an expression OPERAND whose schema does say
 * `ui_type: 'any'`. The option itself is declared by the server as
 * `type: 'auto'` with no `ui_type`, which the old rule could never match.
 */
describe('offersTypeChoices', () => {
  it('offers them for the classic `ui_type: any` schema', () => {
    expect(offersTypeChoices({ ui_type: 'any' } as never)).toBe(true);
  });

  it('offers them for an option that says `type: auto` and names no ui_type', () => {
    // How the server declares an assertion's Expected Value.
    expect(offersTypeChoices({ type: 'auto' } as never)).toBe(true);
  });

  it('offers them for `type: any` with no ui_type', () => {
    expect(offersTypeChoices({ type: 'any' } as never)).toBe(true);
  });

  it('offers them for a host ui_type declared untyped', () => {
    expect(offersTypeChoices({ ui_type: 'test-reference' } as never, ['test-reference'])).toBe(
      true
    );
  });

  it('does not offer them for a host ui_type that was not declared', () => {
    expect(offersTypeChoices({ ui_type: 'test-reference' } as never)).toBe(false);
  });

  it('does not offer them for a field pinned to a concrete type', () => {
    expect(offersTypeChoices({ type: 'string' } as never)).toBe(false);
    expect(offersTypeChoices({ ui_type: 'string', type: 'string' } as never)).toBe(false);
    expect(offersTypeChoices({ ui_type: 'number', type: 'int' } as never)).toBe(false);
  });

  it('lets a concrete ui_type pin a field whose storage type is still auto', () => {
    // The schema named an editor, so the author is not being asked to choose.
    expect(offersTypeChoices({ ui_type: 'string', type: 'auto' } as never)).toBe(false);
  });

  it('reads a type the server sends as a list by its first entry', () => {
    // A data provider option that accepts several types is sent with them as a
    // list; the field renders as the first (see `getType`), so that entry is
    // the one that decides whether the author chooses.
    expect(offersTypeChoices({ type: ['auto', 'string'] } as never)).toBe(true);
    expect(offersTypeChoices({ type: ['string', 'auto'] } as never)).toBe(false);
  });

  it('answers false for a missing option rather than throwing', () => {
    expect(offersTypeChoices(undefined)).toBe(false);
  });
});
