import { describe, expect, it } from 'vitest';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { resolveDegenerateRequiredGroups } from '../src/helpers/options';

/**
 * A one-of group is an affordance for a CHOICE. Where the schema in hand offers
 * no choice — because the alternatives are the server's API-only spellings and
 * were never sent to the form — the group has to read as what it actually is: a
 * required field.
 *
 * The shape here is the real one from a Qorus test step: `target` is declared in
 * the group on the server and hidden from the form, so the form is handed one
 * member of a two-member group.
 */
const serviceStep = (): IQorusFormSchema =>
  ({
    service: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Service',
      required_groups: ['service-selector'],
    },
    method: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Method',
      required_groups: ['service-method-selector'],
    },
    service_type: { type: 'string', ui_type: 'string', display_name: 'Service Type' },
  }) as IQorusFormSchema;

describe('a one-of group that offers no choice', () => {
  it('becomes a plain required field', () => {
    const resolved = resolveDegenerateRequiredGroups(serviceStep());

    // The constraint is unchanged — this field must be set — and it is now said
    // in the grammar that has an affordance for it. Nothing downstream needs to
    // know the rule: they all test `required_groups` for existence.
    expect(resolved.service).toEqual({
      type: 'string',
      ui_type: 'string',
      display_name: 'Service',
      required: true,
    });
    expect(resolved.method).toEqual({
      type: 'string',
      ui_type: 'string',
      display_name: 'Method',
      required: true,
    });
  });

  it('deletes the key rather than emptying it', () => {
    const resolved = resolveDegenerateRequiredGroups(serviceStep());

    // `[]` is truthy, and every consumer asks `if (option.required_groups)`.
    expect('required_groups' in resolved.service).toBe(false);
  });

  it('leaves a field that is in no group alone', () => {
    const resolved = resolveDegenerateRequiredGroups(serviceStep());

    expect(resolved.service_type).toEqual({
      type: 'string',
      ui_type: 'string',
      display_name: 'Service Type',
    });
    expect(resolved.service_type.required).toBeUndefined();
  });
});

describe('a one-of group that does offer a choice', () => {
  const authForm = (): IQorusFormSchema =>
    ({
      username: { type: 'string', ui_type: 'string', required_groups: ['auth'] },
      token: { type: 'string', ui_type: 'string', required_groups: ['auth'] },
    }) as IQorusFormSchema;

  it('is untouched', () => {
    const resolved = resolveDegenerateRequiredGroups(authForm());

    expect(resolved.username.required_groups).toEqual(['auth']);
    expect(resolved.token.required_groups).toEqual(['auth']);
    expect(resolved.username.required).toBeUndefined();
  });

  it('is returned as the very same object, so a memo on it does not churn', () => {
    const schema = authForm();

    expect(resolveDegenerateRequiredGroups(schema)).toBe(schema);
  });
});

describe('a field in two groups, one of which offers no choice', () => {
  const mixed = (): IQorusFormSchema =>
    ({
      /* Required by `only-me` on its own, and also one of two answers to
         `either-or`. */
      pinned: { type: 'string', ui_type: 'string', required_groups: ['only-me', 'either-or'] },
      other: { type: 'string', ui_type: 'string', required_groups: ['either-or'] },
    }) as IQorusFormSchema;

  it('is required, and keeps the group that still asks something', () => {
    const resolved = resolveDegenerateRequiredGroups(mixed());

    expect(resolved.pinned.required).toBe(true);
    expect(resolved.pinned.required_groups).toEqual(['either-or']);
    // The other member's group is satisfied by `pinned` either way, so its own
    // affordance is still correct and is left as it was.
    expect(resolved.other.required).toBeUndefined();
    expect(resolved.other.required_groups).toEqual(['either-or']);
  });
});

describe('nothing to resolve', () => {
  it('passes an absent schema through', () => {
    expect(resolveDegenerateRequiredGroups(undefined)).toBeUndefined();
  });

  it('passes a schema with no groups through unchanged', () => {
    const schema = { name: { type: 'string', ui_type: 'string' } } as IQorusFormSchema;

    expect(resolveDegenerateRequiredGroups(schema)).toBe(schema);
  });
});
