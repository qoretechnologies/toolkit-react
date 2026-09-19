import { describe, expect, it } from 'vitest';
import {
  KNOWN_QORUS_UI_TYPES,
  OPTION_SCALAR_UI_TYPES,
  OPTION_UI_TYPES,
  firstDeclaredType,
  isKnownQorusUiType,
  isOptionUiType,
} from '../src/helpers/optionUiTypes';
import { createRendererOnlyUiTypeCheck } from '../src/components/form/engine/rendererTypes';
import { validateField } from '../src/helpers/validations';

describe('option ui_type registry', () => {
  it('keeps the derived lists unique', () => {
    expect(new Set(OPTION_UI_TYPES).size).toBe(OPTION_UI_TYPES.length);
    expect(new Set(KNOWN_QORUS_UI_TYPES).size).toBe(KNOWN_QORUS_UI_TYPES.length);
  });

  // `validateField` carries a dedicated `case 'timeout'`, and a type the
  // validator has a branch for must be in the vocabulary the same switch is
  // keyed on — consumers ask `isOptionUiType` before they ever reach the
  // validator, and an unlisted type reads as unknown. qorus-ide's timeout
  // field regressed exactly this way when its local registry copy was
  // consolidated onto this file without the entry.
  it("lists 'timeout', which the validator has a dedicated branch for", () => {
    expect(OPTION_SCALAR_UI_TYPES).toContain('timeout');
    expect(isOptionUiType('timeout')).toBe(true);
    expect(isKnownQorusUiType('timeout')).toBe(true);
  });

  it('agrees with the validator about what a timeout value is', () => {
    // an integer count of milliseconds — the unit selector is display-only
    expect(validateField('timeout', 45000)).toBe(true);
    expect(validateField('timeout', 'not-a-number')).toBe(false);
  });
});

describe('a declaration that names several types', () => {
  /* A data provider option that accepts more than one type is served with them
     as a list, and the form renders it as the first. Every reader of a declared
     type has to answer from that same entry; the renderer-only predicate used
     to answer "not a string, so no" and quietly treated every multi-type
     option as an ordinary one. */
  it('is read by its first entry, and an absent or malformed one has no type', () => {
    expect(firstDeclaredType(['string', 'hash'])).toBe('string');
    expect(firstDeclaredType('string')).toBe('string');
    expect(firstDeclaredType(undefined)).toBeUndefined();
    expect(firstDeclaredType([])).toBeUndefined();
    expect(firstDeclaredType([{ nested: true }])).toBeUndefined();
  });

  it('answers the renderer-only question from that entry too', () => {
    const isRendererOnly = createRendererOnlyUiTypeCheck(['test-reference']);

    expect(isRendererOnly(['test-reference', 'string'])).toBe(true);
    expect(isRendererOnly(['string', 'test-reference'])).toBe(false);
    expect(isRendererOnly('test-reference')).toBe(true);
    expect(isRendererOnly(undefined)).toBe(false);
  });
});
