import {
  getSelectItemDescription,
  getSelectItemDescriptionProps,
  getSelectItemShortDescription,
} from '../src/components/form/fields/select/SelectCollection';

describe('SelectFieldCollection descriptions', () => {
  it('uses the long description instead of rendering short and long descriptions together', () => {
    expect(
      getSelectItemDescription({
        short_desc: 'Discord guild "Qore Technologies"',
        desc: 'Discord guild "Qore Technologies"',
      })
    ).toBe('Discord guild "Qore Technologies"');
  });

  it('falls back to the short description when no long description is present', () => {
    expect(
      getSelectItemDescription({
        short_desc: 'Discord guild "Qore Technologies"',
      })
    ).toBe('Discord guild "Qore Technologies"');
  });

  it('ignores blank descriptions', () => {
    expect(
      getSelectItemDescription({
        short_desc: '  ',
        desc: '',
      })
    ).toBeUndefined();
  });

  it('uses only the plain short description in dropdowns', () => {
    const item = {
      short_desc: 'Short Discord server summary',
      desc: '**Full** Discord server description',
    };

    expect(getSelectItemShortDescription(item, 'Fallback')).toBe('Short Discord server summary');
  });

  it('uses the caller fallback only when the item has no description', () => {
    expect(getSelectItemShortDescription(undefined, 'Pick a server')).toBe('Pick a server');
    expect(getSelectItemShortDescription({ short_desc: '', desc: '  ' }, 'Pick a server')).toBe(
      'Pick a server'
    );
  });

  it('deduplicates repeated lines inside the effective description', () => {
    expect(
      getSelectItemDescription({
        desc: 'Discord guild "Qore Technologies"\nDiscord guild "Qore Technologies"',
      })
    ).toBe('Discord guild "Qore Technologies"');
  });

  it('exposes only the markdown long description to collection views', () => {
    expect(
      getSelectItemDescriptionProps({
        short_desc: 'Short Discord server summary',
        desc: '**Full** Discord server description',
      })
    ).toEqual({ longDescription: '**Full** Discord server description' });
  });

  it('falls back to one plain short description in collection views', () => {
    expect(
      getSelectItemDescriptionProps({
        short_desc: 'Short Discord server summary',
      })
    ).toEqual({ shortDescription: 'Short Discord server summary' });
  });
});
