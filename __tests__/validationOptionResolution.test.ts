/**
 * Which required options a set of values actually resolves, and what a list
 * element looks like when it gets here.
 *
 * Moved from qorus-ide, which owned `getUnresolvedRequiredOptions` and its own
 * copy of the validator until the two were consolidated into this file's
 * subject. The last two of these tests are the regression that forced the
 * consolidation: they were written against the IDE's copy on the same day the
 * identical defect was fixed in this one, and neither suite could see the
 * other.
 */
import { IQorusFormSchema, TQorusForm } from '@qoretechnologies/ts-toolkit';
import { describe, expect, it } from 'vitest';
import { fixOptions } from '../src/components/form/engine/FormEngine';
import { getUnresolvedRequiredOptions, validateFieldWithResult } from '../src/helpers/validations';

const emptyRichTextValue = [{ type: 'paragraph', children: [{ text: '' }] }];

describe('validateFieldWithResult options', () => {
  it('does not require empty optional preselected richtext options', () => {
    const options = {
      match_description: {
        type: 'richtext',
        value: emptyRichTextValue,
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      match_description: {
        type: 'richtext',
        ui_type: 'richtext',
        preselected: true,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result).toEqual({ isValid: true, reasons: [] });
  });

  it('does not validate empty optional non-preselected options', () => {
    const options = {
      display_name: {
        type: 'string',
        value: undefined,
      },
      input_data: {
        type: 'hash',
        value: '',
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      display_name: {
        type: 'string',
        required: false,
        preselected: false,
      },
      input_data: {
        type: 'hash',
        required: false,
        preselected: false,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result).toEqual({ isValid: true, reasons: [] });
  });

  it('still validates optional options when a value is provided', () => {
    const options = {
      input_data: {
        type: 'hash',
        value: 'not: [valid',
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      input_data: {
        type: 'hash',
        required: false,
        preselected: false,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Option input_data is invalid: Hash value must be an object');
  });

  it('does not block forms on empty optional options with unmet dependencies', () => {
    const options = {
      server: {
        type: 'string',
        value: undefined,
      },
      channel: {
        type: 'string',
        value: undefined,
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      server: {
        type: 'string',
        required: false,
      },
      channel: {
        type: 'string',
        required: false,
        depends_on: ['server'],
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result).toEqual({ isValid: true, reasons: [] });
  });

  /* Changed 2026-09-21. This used to assert the opposite — a POPULATED optional
     option with unmet dependencies failed the form — as a guard that the fix
     for the EMPTY case above had not over-reached. It had under-reached
     instead: the form HIDES an option whose dependencies are unmet, so a value
     left behind by an earlier choice became a reason to refuse the save that
     named a field nowhere on screen, and that no control could clear (a `null`
     is still a value this loop reaches; only deleting the key helped).

     An option that is not part of the object cannot make the object invalid,
     whether or not it still holds something. Reported against a Qorus test
     whose subject moved from a versioned kind to a service. */
  it('ignores populated optional options when dependencies are unmet', () => {
    const options = {
      server: {
        type: 'string',
        value: undefined,
      },
      channel: {
        type: 'string',
        value: 'api',
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      server: {
        type: 'string',
        required: false,
      },
      channel: {
        type: 'string',
        required: false,
        depends_on: ['server'],
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result).toEqual({ isValid: true, reasons: [] });
  });

  it('still requires required richtext options to contain text', () => {
    const options = {
      action_description: {
        type: 'richtext',
        value: emptyRichTextValue,
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      action_description: {
        type: 'richtext',
        ui_type: 'richtext',
        preselected: true,
        required: true,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Option action_description is required');
  });

  it('treats falsy but explicit required option values as present', () => {
    const options = {
      retry_count: {
        type: 'int',
        value: 0,
      },
      enabled: {
        type: 'bool',
        value: false,
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      retry_count: {
        type: 'int',
        required: true,
      },
      enabled: {
        type: 'bool',
        required: true,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result).toEqual({ isValid: true, reasons: [] });
  });

  it('reports required empty string option values without clearing sibling values', () => {
    const options = {
      server: {
        type: 'string',
        value: 'Qore Technologies',
      },
      channel: {
        type: 'string',
        value: '',
      },
    } as unknown as TQorusForm;
    const optionSchema = {
      server: {
        type: 'string',
        required: true,
      },
      channel: {
        type: 'string',
        required: true,
      },
    } as unknown as IQorusFormSchema;

    const result = validateFieldWithResult('options', options, { optionSchema });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Option channel is required');
    expect(options.server.value).toBe('Qore Technologies');
  });
});

/**
 * The values a caller hands to `getUnresolvedRequiredOptions` are the effective
 * ones — the same resolution the form engine performs when it mounts — so the
 * tests below run the schema through `fixOptions` exactly like the connection
 * modal does, instead of hand-writing what a default "should" become.
 */
const resolve = (optionSchema: IQorusFormSchema, values: TQorusForm = {}) =>
  getUnresolvedRequiredOptions(optionSchema, fixOptions(values, optionSchema));

describe('getUnresolvedRequiredOptions', () => {
  it('reports a required option that has neither a value nor a default', () => {
    const optionSchema = {
      hostname: { type: 'string', required: true },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([{ name: 'hostname', reason: 'missing' }]);
  });

  it('treats a required option with a scalar default as resolved', () => {
    const optionSchema = {
      port: { type: 'int', required: true, default_value: 443 },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([]);
  });

  it('treats a required option with a rich-text default as resolved once normalized', () => {
    // The shape the server sends for a `ui_type: richtext` option — the default
    // arrives wrapped in a typed envelope rather than as a bare string.
    const optionSchema = {
      hostname: {
        type: 'string',
        ui_type: 'richtext',
        required: true,
        preselected: true,
        default_value: { type: 'richtext', value: 'https://gitlab.com' },
      },
    } as unknown as IQorusFormSchema;

    expect(fixOptions({}, optionSchema).hostname.value).toBe('https://gitlab.com');
    expect(resolve(optionSchema)).toEqual([]);
  });

  it('treats a required option preselected to an allowed value as resolved', () => {
    const optionSchema = {
      oauth2_grant_type: {
        type: 'string',
        required: true,
        preselected: true,
        default_value: { type: 'richtext', value: 'authorization_code' },
        allowed_values: [
          { value: { type: 'richtext', value: 'authorization_code' } },
          { value: { type: 'richtext', value: 'client_credentials' } },
        ],
      },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([]);
  });

  it('keeps a required dependent option unresolved while its dependency is empty', () => {
    const optionSchema = {
      region: { type: 'string' },
      zone: { type: 'string', required: true, depends_on: ['region'] },
    } as unknown as IQorusFormSchema;
    const values = {
      region: { type: 'string', value: undefined },
      zone: { type: 'string', value: 'zone-1' },
    } as unknown as TQorusForm;

    expect(resolve(optionSchema, values)).toEqual([{ name: 'zone', reason: 'dependency' }]);

    const withDependency = {
      ...values,
      region: { type: 'string', value: 'eu-central-1' },
    } as unknown as TQorusForm;

    expect(resolve(optionSchema, withDependency)).toEqual([]);
  });

  it('reports a required option whose default does not validate', () => {
    const optionSchema = {
      contact: { type: 'email', required: true, default_value: 'not-an-email' },
    } as unknown as IQorusFormSchema;

    const [unresolved, ...rest] = resolve(optionSchema);

    expect(rest).toEqual([]);
    expect(unresolved.name).toBe('contact');
    expect(unresolved.reason).toBe('invalid');
    expect(unresolved.validation?.isValid).toBe(false);
  });

  it('ignores optional options that are left empty', () => {
    const optionSchema = {
      hostname: {
        type: 'string',
        required: true,
        default_value: { type: 'richtext', value: 'https://gitlab.com' },
      },
      token: { type: 'string' },
      allow_any_response: { type: 'bool' },
      desc: { type: 'string', ui_type: 'richtext' },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([]);
  });

  it('resolves a required group as soon as any of its options carries a value', () => {
    const optionSchema = {
      token: { type: 'string', required_groups: ['auth'] },
      username: { type: 'string', required_groups: ['auth'] },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([
      { name: 'token', reason: 'missing' },
      { name: 'username', reason: 'missing' },
    ]);

    expect(
      resolve(optionSchema, {
        username: { type: 'string', value: 'admin' },
      } as unknown as TQorusForm)
    ).toEqual([]);
  });

  it('resolves the live GitLab app connection schema without any user input', () => {
    // Trimmed copy of PUT /dataprovider/apps/Gitlab/getCreateConnectionOptions
    // — `hostname` is required by the OAuth2 client profile, and satisfied by
    // its preselected default.
    const optionSchema = {
      hostname: {
        type: 'string',
        ui_type: 'richtext',
        required: true,
        preselected: true,
        default_value: { type: 'richtext', value: 'https://gitlab.com' },
      },
      display_name: {
        type: 'string',
        ui_type: 'richtext',
        preselected: true,
        default_value: { type: 'richtext', value: 'Gitlab 1' },
      },
      token: { type: 'string', ui_type: 'richtext', required: false, sensitive: true },
      allow_any_response: { type: 'bool', ui_type: 'bool', required: false },
      connect_timeout: {
        type: 'timeout',
        ui_type: 'timeout',
        required: false,
        default_value: { type: 'number', value: 45000 },
      },
    } as unknown as IQorusFormSchema;

    expect(resolve(optionSchema)).toEqual([]);
  });
});

/**
 * A reloaded delivery action must not report itself invalid.
 *
 * A list element arrives bare OR in a `{value, type}` envelope: the envelope is
 * what the editor writes while the form is open, the bare form is what storage
 * holds. Reaching straight for `.value` failed every stored element as empty,
 * so an alert rule reloaded from its draft reported its delivery action invalid
 * — blocking submit and bucketing the field under "Needs attention" — while the
 * form beside it counted all six options as set, because the completion meter
 * asks a different question.
 *
 * That disagreement between the meter and the validator is the signature of a
 * per-element reader; the whole-value readers were already right.
 */
describe('validateFieldWithResult list elements', () => {
  const field = { element_type: 'string', has_to_have_value: true };

  it('accepts bare string elements — the shape a saved draft holds', () => {
    expect(validateFieldWithResult('list', ['ops@example.com'], field).isValid).toBe(true);
  });

  it('accepts enveloped elements — the shape the open editor holds', () => {
    expect(
      validateFieldWithResult('list', [{ value: 'ops@example.com', type: 'string' }], field).isValid
    ).toBe(true);
  });

  it('still rejects a genuinely empty element, in either shape', () => {
    expect(validateFieldWithResult('list', [''], field).isValid).toBe(false);
    expect(validateFieldWithResult('list', [{ value: '', type: 'string' }], field).isValid).toBe(
      false
    );
  });

  it('does not throw on a null element', () => {
    // `parsedValue[i].value` threw here rather than failing that one element,
    // taking the whole form's validation pass with it.
    expect(() => validateFieldWithResult('list', [null], field)).not.toThrow();
    expect(validateFieldWithResult('list', [null], field).isValid).toBe(false);
  });

  it('validates a whole delivery form whose list came back from storage', () => {
    // The reported shape, end to end: the reloaded value must satisfy the same
    // predicate the alert rule uses to decide `deliveryValid`.
    const optionSchema = {
      to: { type: 'list', element_type: 'string', display_name: 'To', required: true },
    } as unknown as IQorusFormSchema;
    const value = { to: { type: 'list', value: ['ops@example.com'] } } as unknown as TQorusForm;

    expect(validateFieldWithResult('options', value, { optionSchema }).isValid).toBe(true);
  });
});

/**
 * An option the form hides cannot be the reason a form will not save.
 *
 * Reported against a Qorus test whose subject had moved from a versioned kind
 * to a service. `subject_iface_version` only applies to the versioned kinds,
 * so the form stopped showing it — but the value it had been given stayed in
 * the data, its dependencies were no longer fulfilled, and the whole options
 * object was judged invalid. Submit went dead naming an option that was
 * nowhere on screen, and clearing it was not possible: a `null` is still a
 * value this loop reaches, so only deleting the key helped, which no control
 * offered.
 */
describe('validateFieldWithResult options with unfulfilled dependencies', () => {
  const schema = {
    subject_iface_kind: { type: 'string', required: true },
    subject_iface_version: {
      type: 'string',
      required: false,
      depends_on: [['subject_iface_kind=workflow', 'subject_iface_kind=step']],
    },
  } as unknown as IQorusFormSchema;

  it('ignores a hidden option whose dependencies are not fulfilled', () => {
    const options = {
      subject_iface_kind: { type: 'string', value: 'service' },
      // Left behind by the earlier, versioned subject.
      subject_iface_version: { type: 'string', value: '1.0' },
    } as unknown as TQorusForm;

    expect(validateFieldWithResult('options', options, { optionSchema: schema } as any)).toMatchObject({
      isValid: true,
    });
  });

  /* The relaxation is scoped to "not applicable", not to "optional": an option
     whose dependencies ARE fulfilled is judged exactly as before. Asserted with
     a value that is malformed rather than merely empty, because an empty
     OPTIONAL option is legitimately fine and would prove nothing. */
  it('still validates that option once its dependencies ARE fulfilled', () => {
    const hashSchema = {
      subject_iface_kind: { type: 'string', required: true },
      subject_iface_version: {
        type: 'hash',
        required: false,
        depends_on: [['subject_iface_kind=workflow']],
      },
    } as unknown as IQorusFormSchema;
    const options = {
      subject_iface_kind: { type: 'string', value: 'workflow' },
      subject_iface_version: { type: 'hash', value: 'not: [valid' },
    } as unknown as TQorusForm;

    const result = validateFieldWithResult('options', options, { optionSchema: hashSchema } as any);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('subject_iface_version');
  });

  it('a REQUIRED option with unfulfilled dependencies is still unresolved', () => {
    const requiredSchema = {
      subject_iface_kind: { type: 'string', required: true },
      subject_iface_version: {
        type: 'string',
        required: true,
        depends_on: [['subject_iface_kind=workflow']],
      },
    } as unknown as IQorusFormSchema;

    expect(
      getUnresolvedRequiredOptions(requiredSchema, {
        subject_iface_kind: { type: 'string', value: 'service' },
      } as unknown as TQorusForm)
    ).toMatchObject([{ name: 'subject_iface_version', reason: 'dependency' }]);
  });
});
