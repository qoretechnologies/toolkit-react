import { describe, expect, it } from 'vitest';
import { cronExpressionFromValue, validateField } from '../src/helpers/validations';

describe('cronExpressionFromValue', () => {
  it('passes a cron string through', () => {
    expect(cronExpressionFromValue('0 0 1 1 *')).toBe('0 0 1 1 *');
  });

  // The shape a Qorus job's `schedule` actually arrives in.
  it('joins the plural schedule hash', () => {
    expect(
      cronExpressionFromValue({ minutes: '0', hours: '0', days: '1', months: '1', dow: '*' })
    ).toBe('0 0 1 1 *');
  });

  it('joins the singular spellings too', () => {
    expect(
      cronExpressionFromValue({ minute: '30', hour: '7', day: '*', month: '*', weekday: '1-5' })
    ).toBe('30 7 * * 1-5');
  });

  it('fills a missing or empty field with a wildcard', () => {
    expect(cronExpressionFromValue({ minutes: '15' })).toBe('15 * * * *');
    expect(cronExpressionFromValue({ minutes: '15', hours: '' })).toBe('15 * * * *');
  });

  it('coerces numeric fields', () => {
    expect(cronExpressionFromValue({ minutes: 0, hours: 3 })).toBe('0 3 * * *');
  });

  it('returns nothing for a value that is not a schedule at all', () => {
    expect(cronExpressionFromValue(undefined)).toBeUndefined();
    expect(cronExpressionFromValue(null)).toBeUndefined();
    expect(cronExpressionFromValue(42)).toBeUndefined();
    expect(cronExpressionFromValue([])).toBeUndefined();
    // an object with none of the five keys must not become "* * * * *"
    expect(cronExpressionFromValue({ something: 'else' })).toBeUndefined();
  });
});

describe('validateField("cron")', () => {
  it('accepts both representations of the same schedule', () => {
    expect(validateField('cron', '0 0 1 1 *')).toBe(true);
    expect(
      validateField('cron', { minutes: '0', hours: '0', days: '1', months: '1', dow: '*' })
    ).toBe(true);
  });

  // The regression: this threw "cron.trim is not a function" out of the
  // validator and took the whole form down through the error boundary.
  it('reports a non-schedule value as invalid instead of throwing', () => {
    expect(() => validateField('cron', { something: 'else' })).not.toThrow();
    expect(validateField('cron', { something: 'else' })).toBe(false);
    expect(() => validateField('cron', 12345)).not.toThrow();
    expect(validateField('cron', 12345)).toBe(false);
  });

  it('still rejects a malformed cron string', () => {
    expect(validateField('cron', 'nope')).toBe(false);
  });
});
