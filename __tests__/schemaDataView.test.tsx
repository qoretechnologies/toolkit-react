import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SchemaDataView,
  canRenderWithSchema,
} from '../src/components/form/engine/_structuredData/SchemaDataView';

/**
 * A described value is previewed through its description, not as data.
 *
 * `StructuredDataView` has to announce what it found — "Object · 1 field", raw
 * keys, values coloured by inferred type — because inference is all an untyped
 * renderer has. A form field with an `arg_schema` is the opposite situation: the
 * shape, the names and the choices are all known before the value arrives, so
 * showing it as a data tree asks the reader to decode something the form can
 * simply say.
 */

const SCHEME_SCHEMA = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    required: true,
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'cookie', display_name: 'Cookie' },
    ],
  },
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Session Cookie Name',
  },
  enabled: { type: 'bool', ui_type: 'bool', display_name: 'Enabled' },
} as never;

const colors = { key: '#ffffff', muted: '#888888', border: '#333333' };

const renderView = (value: unknown, schema: never = SCHEME_SCHEMA, showTypes = false) =>
  render(
    <ReqoreUIProvider>
      <SchemaDataView value={value} schema={schema} colors={colors} showTypes={showTypes} />
    </ReqoreUIProvider>
  );

/** Leaf elements only: a container's textContent is every descendant joined,
 *  so asserting on it would let a raw key hide inside a longer string. */
const leaves = (container: HTMLElement) =>
  [...container.querySelectorAll('*')]
    .filter((element) => element.children.length === 0)
    .map((element) => (element.textContent ?? '').trim())
    .filter(Boolean);

describe('the preview speaks the form’s language', () => {
  it('labels fields by display_name and values by their allowed value', () => {
    // Two fields: the first heads the item (see the promotion tests below), so a
    // labelled row only exists from the second onwards.
    const { container } = renderView([
      { type: 'hash', value: { type: 'default', cookie_name: 'qorus-session' } },
    ]);
    const text = leaves(container);
    expect(text).toContain('Session Cookie Name');
    expect(text).toContain('Default RBAC');
    // The stored spellings are strings the author never saw. Whole-leaf
    // comparison is what makes this bite — "Scheme Type" contains "Type" and
    // "Default RBAC" contains "Default", so substring checks cannot say it.
    expect(text).not.toContain('type');
    expect(text).not.toContain('default');
  });

  it('does not announce the container the way an untyped tree must', () => {
    const { container } = renderView([{ type: 'hash', value: { type: 'cookie' } }]);
    const text = leaves(container).join(' ');
    expect(text).not.toMatch(/Object\b/);
    expect(text).not.toMatch(/\d+ fields?\b/);
  });

  it('numbers its items and gives each one a rule owning its fields', () => {
    const { container } = renderView([
      { type: 'hash', value: { type: 'default' } },
      { type: 'hash', value: { type: 'cookie', cookie_name: 'qorus-session' } },
    ]);
    const text = leaves(container);
    expect(text).toContain('1.');
    expect(text).toContain('2.');

    // The number is furniture in a margin; the rule beside it is what says which
    // fields belong to which item. With more than one field per item, counting
    // lines is not an answer — so the grouping has to be structural, and each
    // item's fields have to live inside that item's own element.
    const items = container.querySelectorAll('.schema-view-item');
    expect(items).toHaveLength(2);
    expect(items[0].querySelectorAll('.schema-view-fields')).toHaveLength(1);
    expect(items[1].textContent).toContain('qorus-session');
    expect(items[0].textContent).not.toContain('qorus-session');
  });

  it('dresses names and values in the form’s own label and value styles', () => {
    // Reusing `StyledRowLabel` / `StyledRowValue` is the point: the preview must
    // not invent a second idea of what a field name looks like. The value class
    // is the one the rows above carry, which is how the two stay identical.
    const { container } = renderView([
      { type: 'hash', value: { type: 'default', cookie_name: 'qorus-session' } },
    ]);
    const value = container.querySelector('.options-readfirst-valuetext');
    expect(value?.textContent).toBe('qorus-session');
  });

  it('heads each item with its first value, so a list can be scanned by name', () => {
    // The identifying value was reading as just another row — same size, same
    // weight, behind its own label — so finding seven method names meant reading
    // fourteen lines. The VALUE is promoted, not the label: `init` is what the
    // reader is looking for, "Method Name" is not.
    const { container } = renderView([
      { type: 'hash', value: { type: 'default', cookie_name: 'a' } },
      { type: 'hash', value: { type: 'cookie', cookie_name: 'b' } },
    ]);
    const titles = [...container.querySelectorAll('.schema-view-item-title')].map(
      (element) => (element.textContent ?? '').trim()
    );
    expect(titles).toEqual(['Default RBAC', 'Cookie']);
  });

  it('does not also repeat the promoted field as a row', () => {
    // One definition decides which field is promoted; if the heading and the rows
    // disagreed, the item would show its name twice.
    const { container } = renderView([
      { type: 'hash', value: { type: 'default', cookie_name: 'qorus-session' } },
    ]);
    const text = leaves(container);
    expect(text.filter((t) => t === 'Default RBAC')).toHaveLength(1);
    expect(text).not.toContain('Scheme Type');
  });

  it('keeps the label reachable as the heading’s tooltip', () => {
    // A heading that needs a caption is not a heading, but the field's name should
    // not be unrecoverable either.
    const { container } = renderView([{ type: 'hash', value: { type: 'default' } }]);
    expect(container.querySelector('.schema-view-item-title')?.getAttribute('title')).toBe(
      'Scheme Type'
    );
  });

  it('does not promote a value that has no one-line form', () => {
    // A code body is skipped as a heading — it belongs in the rows below where it
    // renders as code and can actually be read.
    const codeFirst = {
      body: { type: 'string', ui_type: 'code-editor', display_name: 'Body' },
      label: { type: 'string', display_name: 'Label' },
    } as never;
    const { container } = renderView(
      [{ type: 'hash', value: { body: 'sub x() {}', label: 'the label' } }],
      codeFirst
    );
    expect(container.querySelector('.schema-view-item-title')?.textContent).toBe('the label');
  });

  it('renders fields in SCHEMA order, not the order they happen to be stored', () => {
    // Two equal items must not read differently because their keys were written
    // in a different order.
    const { container } = renderView([
      { type: 'hash', value: { cookie_name: 'qorus-session', type: 'cookie' } },
    ]);
    const text = leaves(container);
    expect(text.indexOf('Scheme Type')).toBeLessThan(text.indexOf('Session Cookie Name'));
  });

  it('shows a stored key the schema does not describe, rather than dropping it', () => {
    // A preview that quietly lost data would be worse than a raw tree, not
    // better. Undescribed keys keep their raw name and come last.
    const { container } = renderView([
      { type: 'hash', value: { type: 'cookie', legacy_flag: 'kept' } },
    ]);
    const text = leaves(container);
    expect(text).toContain('legacy_flag');
    expect(text).toContain('kept');
    expect(text.indexOf('Scheme Type')).toBeLessThan(text.indexOf('legacy_flag'));
  });

  it('omits fields that are not set', () => {
    const { container } = renderView([{ type: 'hash', value: { type: 'cookie' } }]);
    expect(leaves(container)).not.toContain('Session Cookie Name');
  });

  it('keeps `false` — it is a value, not an absence', () => {
    const { container } = renderView([
      { type: 'hash', value: { type: 'cookie', enabled: false } },
    ]);
    const text = leaves(container);
    expect(text).toContain('Enabled');
    // Rendered as the same Yes/No tag the read-first row uses, not as "false".
    expect(text.some((t) => /^(No|false)$/i.test(t))).toBe(true);
  });

  it('reads an enveloped value the same as a plain one', () => {
    const enveloped = renderView([
      { type: 'hash', value: { type: { type: 'string', value: 'default' } } },
    ]);
    expect(leaves(enveloped.container)).toContain('Default RBAC');
  });

  it('recurses into a field that describes its own level', () => {
    const nested = {
      scheme: { type: 'hash', display_name: 'Scheme', arg_schema: SCHEME_SCHEMA },
    } as never;
    const { container } = renderView({ scheme: { type: 'default' } }, nested);
    const text = leaves(container);
    expect(text).toContain('Scheme');
    expect(text).toContain('Scheme Type');
    expect(text).toContain('Default RBAC');
  });
});

describe('undescribed data keeps the renderer built for undescribed data', () => {
  it('declines a value with no schema', () => {
    expect(canRenderWithSchema({ a: 1 }, undefined)).toBe(false);
    expect(canRenderWithSchema({ a: 1 }, {})).toBe(false);
  });

  it('declines a list of scalars — there are no field names to use', () => {
    expect(canRenderWithSchema(['a', 'b'], SCHEME_SCHEMA)).toBe(false);
  });

  it('accepts a described hash and a described list of hashes', () => {
    expect(canRenderWithSchema({ type: 'default' }, SCHEME_SCHEMA)).toBe(true);
    expect(canRenderWithSchema([{ type: 'hash', value: { type: 'default' } }], SCHEME_SCHEMA)).toBe(
      true
    );
  });
});
