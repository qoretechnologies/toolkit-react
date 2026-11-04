import { describe, expect, it } from 'vitest';
import {
  describeBlockedSave,
  isOptionValueEmpty,
} from '../src/components/form/engine/readFirst';
import { validateField, validateFieldWithResult } from '../src/helpers/validations';

/**
 * An optional list field holding an empty list is not set - and so not invalid.
 *
 * The reported case: an API schema opened for editing held `author: []` in an optional `select-array` field.
 * The form filed the field under Optional (an empty list is "not set" to its status), while validation checked
 * `[]` as a value - "At least one value is required" - so the whole form was invalid and Submit refused, with
 * nothing on screen saying why. One rule now says what is set, and both read it.
 */
describe('an optional list field holding an empty list', () => {
  const schema = {
    display_name: { type: 'string', display_name: 'Name', required: true },
    author: { type: 'select-array', display_name: 'Authors' },
  } as any;

  it('does not make the form invalid', () => {
    const options = {
      display_name: { type: 'string', value: 'Orders' },
      author: { type: 'select-array', value: [] },
    };
    expect(validateField('options', options, { optionSchema: schema })).toBe(true);
    // nor does a list type the form knows under another name
    for (const type of ['multi-select', 'array', 'file-tree', 'list']) {
      expect(
        validateField(
          'options',
          { display_name: options.display_name, tags: { type, value: [] } },
          { optionSchema: { ...schema, tags: { type } } }
        )
      ).toBe(true);
    }
  });

  it('still makes it invalid when the field is required', () => {
    const result = validateFieldWithResult(
      'options',
      {
        display_name: { type: 'string', value: 'Orders' },
        author: { type: 'select-array', value: [] },
      },
      { optionSchema: { ...schema, author: { ...schema.author, required: true } } }
    );
    expect(result.isValid).toBe(false);
  });

  it('is judged by its values once it has some', () => {
    expect(
      validateField(
        'options',
        {
          display_name: { type: 'string', value: 'Orders' },
          author: { type: 'select-array', value: ['Ann'] },
        },
        { optionSchema: schema }
      )
    ).toBe(true);
  });

  it('is what the form calls not set, as are no value, null and empty text', () => {
    expect([undefined, null, '', []].map(isOptionValueEmpty)).toEqual([true, true, true, true]);
    expect([0, false, 'x', ['x'], {}].map(isOptionValueEmpty)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('why a form cannot be saved', () => {
  const schema = { description: { display_name: 'Description' } };

  it('names the first field that blocks it by the name the form shows, and says what is wrong', () => {
    expect(
      describeBlockedSave(
        [{ fieldName: 'description', validation: { reason: 'Value is required', reasons: [] } }],
        schema
      )
    ).toBe('Before saving, fix Description: Value is required');
  });

  it('counts the others', () => {
    expect(
      describeBlockedSave(
        [
          { fieldName: 'description', validation: { reasons: ['Value is required'] } },
          { fieldName: 'port', validation: { reasons: ['Value must be a number'] } },
          { fieldName: 'host', validation: { reasons: [] } },
        ],
        schema
      )
    ).toBe('Before saving, fix Description: Value is required (and 2 more fields)');
  });

  it('falls back to the internal name, and says nothing when nothing blocks it', () => {
    expect(describeBlockedSave([{ fieldName: 'port', validation: { reasons: [] } }])).toBe(
      'Before saving, fix port'
    );
    expect(describeBlockedSave([], schema)).toBeUndefined();
  });
});
