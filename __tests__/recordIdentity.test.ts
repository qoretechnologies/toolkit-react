import { describe, expect, it } from 'vitest';
import { recordIdentity } from '../src/components/form/engine/readFirst';

/**
 * The one definition of "which field says WHICH item this is".
 *
 * Two surfaces head a list of records with it — the collapsed preview
 * (`SchemaDataView`) and the editable list (`ArrayAuto`) — so it is tested here
 * rather than through either of them. A second implementation is how the same
 * method comes to be called `init` in the preview and `#1` in the editor.
 */

/** The real shape, from `ServiceMethodMetadata` in the qorus repo. */
const SERVICE_METHOD_SCHEMA = {
  name: { type: 'string', ui_type: 'string', display_name: 'Method Name', required: true },
  description: { type: 'string', ui_type: 'string', display_name: 'Description' },
  locktype: { type: 'string', ui_type: 'string', display_name: 'Lock Type' },
  body: { type: 'string', ui_type: 'code-editor', display_name: 'Method Body' },
} as never;

/** The real shape, from an auth profile's `schemes`. */
const SCHEME_SCHEMA = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    required: true,
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'permissive', display_name: 'Permissive' },
    ],
  },
} as never;

describe('recordIdentity', () => {
  it('promotes the first field the SCHEMA declares, not the first key of the value', () => {
    // The distinction that matters. A service method read back over REST carries
    // `service_methodid` first — a surrogate id — so keying off the value would
    // head the item `1168`. The form schema does not declare that field at all,
    // and declares `name` first, which is the one that says which method it is.
    const identity = recordIdentity(
      { service_methodid: 1168, description: 'The init method', name: 'init' },
      SERVICE_METHOD_SCHEMA
    );

    expect(identity?.key).toBe('name');
    expect(identity?.text).toBe('init');
  });

  it('captions the heading with the promoted field label', () => {
    // The label is not lost when the value is promoted over it — it moves to the
    // heading's tooltip, because a heading that needs a caption is not a heading.
    expect(recordIdentity({ name: 'onOrderStatus' }, SERVICE_METHOD_SCHEMA)?.label).toBe(
      'Method Name'
    );
  });

  it('shows a chosen value by its display name, as prose rather than a literal', () => {
    const identity = recordIdentity({ type: 'permissive' }, SCHEME_SCHEMA);

    expect(identity?.text).toBe('Permissive');
    // A picked option is a label, not a literal, so it does not take the mono face.
    expect(identity?.mono).toBe(false);
  });

  it('keeps a free-text value as a literal', () => {
    expect(recordIdentity({ name: 'init' }, SERVICE_METHOD_SCHEMA)?.mono).toBe(true);
  });

  it('skips a code body, which has no one-line form', () => {
    // A method whose name is unset must not be headed by the first line of its
    // source; the body belongs in the rows below where it can be read.
    const identity = recordIdentity(
      { body: 'sub init() {\n    log("started");\n}', locktype: 'none' },
      SERVICE_METHOD_SCHEMA
    );

    expect(identity?.key).toBe('locktype');
  });

  it('skips a field the record leaves unset', () => {
    // A row just added has no name yet. Falling through to the next set field is
    // what lets the caller keep `#N` only for a record with nothing to be called.
    expect(recordIdentity({ name: '', description: 'Handles orders' }, SERVICE_METHOD_SCHEMA)?.key)
      .toBe('description');
  });

  it('reports nothing when there is no schema to declare an order', () => {
    // Without a schema there is no "first declared field", so the caller keeps
    // its own fallback rather than this guessing from key order.
    expect(recordIdentity({ name: 'init' }, undefined)).toBeUndefined();
  });

  it('reports nothing when no field holds a scalar', () => {
    expect(recordIdentity({}, SERVICE_METHOD_SCHEMA)).toBeUndefined();
  });
});
