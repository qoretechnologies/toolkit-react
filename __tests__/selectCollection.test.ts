import { getSelectItemDescription } from '../src/components/form/fields/select/SelectCollection';

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
});
