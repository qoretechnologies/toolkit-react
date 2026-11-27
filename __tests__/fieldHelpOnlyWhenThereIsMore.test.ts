import { describe, expect, it } from 'vitest';
import { fieldHasLongDescription } from '../src/helpers/fieldDescription';

/**
 * A field offers help only when its help says more than the line under it.
 *
 * The server copies `short_desc` into `desc` for any field with no `desc` of its
 * own, so every field had a `desc` and every field offered a help dialog that
 * mostly repeated the summary.
 */
describe('a field with more to read', () => {
  it('has a description that adds to its summary', () => {
    expect(
      fieldHasLongDescription({
        short_desc: 'Any webhooks supported by the service',
        desc: 'A **webhook** is an HTTP endpoint that Qorus publishes.',
      })
    ).toBe(true);
    // A description with no summary is all there is to read.
    expect(fieldHasLongDescription({ desc: 'Only a description.' })).toBe(true);
  });

  it('is not the server copying the summary into the description', () => {
    const line = 'An option with nothing more to say';
    expect(fieldHasLongDescription({ short_desc: line, desc: line })).toBe(false);
    // Spacing, case, a closing full stop and emphasis do not make it new.
    expect(
      fieldHasLongDescription({ short_desc: line, desc: `  an option  with **nothing** more to say.` })
    ).toBe(false);
  });

  it('is not a field without a description', () => {
    expect(fieldHasLongDescription({ short_desc: 'Summary' })).toBe(false);
    expect(fieldHasLongDescription({ desc: '   ' })).toBe(false);
    expect(fieldHasLongDescription(undefined)).toBe(false);
  });
});
