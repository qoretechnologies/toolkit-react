import { describe, expect, it } from 'vitest';
import {
  KNOWN_QORUS_UI_TYPES,
  OPTION_SCALAR_UI_TYPES,
  OPTION_UI_TYPES,
  isKnownQorusUiType,
  isOptionUiType,
} from '../src/helpers/optionUiTypes';
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
