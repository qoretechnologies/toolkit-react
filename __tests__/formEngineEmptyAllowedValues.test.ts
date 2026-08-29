/**
 * `allowed_values: []` must never erase a stored value.
 *
 * The server sends an empty array to say "I have no reference values to offer
 * for this option right now" — the app-action catalogue ships exactly that,
 * with an `option_reference_values_unavailable` message attached — not "no
 * value is permitted". An empty array is truthy, so testing the array itself
 * made `fixOptions` wipe the value of every such option.
 *
 * The bug that motivated this: an alert rule's Gmail delivery action. The
 * operator sets To:, the draft saves it, and on reload the first render uses
 * the unconfigured CATALOGUE schema, where `to.allowed_values` is `[]`. The
 * value was erased there, the emptied form autosaved over the draft, and the
 * connection-refreshed schema (which carries no `allowed_values` at all)
 * arrived to find the value already gone from the config it re-derives from.
 * The operator saw a green "Saved", refreshed, and their address was missing.
 */
import { describe, expect, it } from 'vitest';
import { fixOptions } from '../src/components/form/engine/FormEngine';

const option = (extra: Record<string, unknown> = {}) => ({
  type: 'string',
  ui_type: 'string',
  display_name: 'To',
  required: true,
  allowed_values_creatable: false,
  ...extra,
});

describe('fixOptions with an empty allowed_values', () => {
  it('keeps a string value', () => {
    const out = fixOptions({ to: 'ops@example.com' }, { to: option({ allowed_values: [] }) } as any);
    expect(out.to).toEqual({ type: 'string', value: 'ops@example.com' });
  });

  it('keeps a list value — the reported case', () => {
    const out = fixOptions(
      { to: ['ops@example.com'] },
      { to: option({ type: 'list', ui_type: 'list', allowed_values: [] }) } as any
    );
    expect(out.to).toEqual({ type: 'list', value: ['ops@example.com'] });
  });

  it('keeps an already-typed envelope, which is how the live form holds it', () => {
    const out = fixOptions(
      { to: { type: 'list', value: ['ops@example.com'] } },
      { to: option({ type: 'list', ui_type: 'list', allowed_values: [] }) } as any
    );
    expect(out.to).toEqual({ type: 'list', value: ['ops@example.com'] });
  });

  it('still drops a value that is outside a NON-empty allowed_values', () => {
    // The behaviour the empty-array case was overreaching from: a real set of
    // choices still rejects a value that is not one of them, which is how
    // changing a connection clears a channel belonging to the previous one.
    const out = fixOptions(
      { channel: 'gone' },
      {
        channel: option({
          display_name: 'Channel',
          allowed_values: [{ display_name: 'Ops', value: { type: 'string', value: 'ops' } }],
        }),
      } as any
    );
    expect((out.channel as any).value).toBeUndefined();
  });

  it('still keeps a value that IS one of a non-empty allowed_values', () => {
    const out = fixOptions(
      { channel: 'ops' },
      {
        channel: option({
          display_name: 'Channel',
          allowed_values: [{ display_name: 'Ops', value: { type: 'string', value: 'ops' } }],
        }),
      } as any
    );
    expect((out.channel as any).value).toBe('ops');
  });

  it('keeps values across a whole schema of unavailable-reference options', () => {
    // The catalogue shape: several options at once, all reporting no reference
    // values. Every one of them lost its value, not just the list.
    const schema: any = {
      to: option({ type: 'list', ui_type: 'list', allowed_values: [] }),
      subject: option({ display_name: 'Subject', allowed_values: [] }),
      sender: option({ display_name: 'Sender', required: false, allowed_values: [] }),
    };
    const out = fixOptions(
      { to: ['ops@example.com'], subject: 'Alert', sender: 'noreply@example.com' },
      schema
    );
    expect((out.to as any).value).toEqual(['ops@example.com']);
    expect((out.subject as any).value).toBe('Alert');
    expect((out.sender as any).value).toBe('noreply@example.com');
  });
});

/**
 * A field declared to open in expression mode starts as an EMPTY expression.
 *
 * `isDefaultFunction` already makes the renderer open such a field in
 * expression mode from the schema alone, so seeding the value keeps the DATA
 * agreeing with what the operator sees: without it the expression editor is
 * showing a plain default value, and the field carries no `is_expression` until
 * the first edit.
 *
 * Ported from the IDE's copy of `fixOptions` when the two were consolidated —
 * reqraft's is now the only implementation, so this behaviour has to live here
 * or it is silently lost for every form that had it.
 */
describe('fixOptions with default_view: expression', () => {
  const schema = (extra: Record<string, unknown> = {}) =>
    ({
      threshold: {
        type: 'int',
        display_name: 'Threshold',
        required: true,
        default_view: 'expression',
        ...extra,
      },
    }) as never;

  it('seeds an empty expression when the field has no value', () => {
    expect(fixOptions({}, schema()).threshold).toMatchObject({
      value: { args: [] },
      is_expression: true,
    });
  });

  it('leaves an existing value alone', () => {
    expect(fixOptions({ threshold: 5 } as never, schema()).threshold).toMatchObject({ value: 5 });
  });

  it('does not seed a field whose default_view is something else', () => {
    const out = fixOptions({}, schema({ default_view: 'template' }));
    expect((out.threshold as { is_expression?: boolean }).is_expression).toBeUndefined();
  });

  it('still prefers an is_expression default_value when the schema carries one', () => {
    // The branch above this one. Seeding must not shadow a real default.
    const withDefault = schema({
      default_value: { type: 'int', value: { args: [1] }, is_expression: true },
    });
    expect(fixOptions({}, withDefault).threshold).toMatchObject({ value: { args: [1] } });
  });
});
