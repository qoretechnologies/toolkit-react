import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SchemaDataView } from '../src/components/form/engine/_structuredData/SchemaDataView';

/**
 * A schema-declared field the form materialised but never filled in arrives as
 * `{type: 'int'}` — `fixOptions` omits the key entirely when the value is
 * undefined. That is an EMPTY ENVELOPE, and both renderers of a hash have to
 * read it the same way.
 *
 * They did not. `getHashEntries` learned it; `SchemaDataView`, which draws the
 * preview under the row, did not — `isUiEncodedValue` requires a `value`, so
 * `unwrap` returned the envelope unchanged and it was wrapped as the field's
 * VALUE, whose own `type` key then counted as one field. An untouched Runtime
 * Defaults read "Timeout (Seconds) 1 field" three times over while the sub-form
 * it previews correctly said 0/3 set.
 *
 * The value below is the one taken off a real stored draft.
 */
const VALUE = {
  timeout_s: { type: 'int' },
  fixture: { type: 'string' },
  input: { type: 'hash' },
};

const SCHEMA = {
  timeout_s: { type: 'int', display_name: 'Timeout (Seconds)' },
  fixture: { type: 'string', display_name: 'Fixture' },
  input: { type: 'hash', display_name: 'Initial Input' },
} as never;

const renderPreview = (value: unknown) =>
  render(
    <ReqoreUIProvider>
      <SchemaDataView
        value={value as never}
        schema={SCHEMA}
        colors={{ key: '#fff', border: '#333', value: '#fff' } as never}
      />
    </ReqoreUIProvider>
  );

describe('the schema preview of a hash', () => {
  it('does not report an unset field as content', () => {
    const { container } = renderPreview(VALUE);
    expect(container.textContent).not.toContain('1 field');
  });

  it('still names every declared field', () => {
    const { container } = renderPreview(VALUE);
    expect(container.textContent).toContain('Timeout (Seconds)');
    expect(container.textContent).toContain('Fixture');
    expect(container.textContent).toContain('Initial Input');
  });

  it('does not mistake a described level for an empty envelope', () => {
    // The discriminator. A field declaring its OWN arg_schema describes what is
    // inside it, so `{type: 'default'}` there is content — that level's `type`
    // field, reading through its allowed values — not a materialised-but-unset
    // envelope. Reading it as one silently swallowed the whole nested level.
    const { container } = render(
      <ReqoreUIProvider>
        <SchemaDataView
          value={{ scheme: { type: 'basic' } } as never}
          schema={
            {
              scheme: {
                type: 'hash',
                display_name: 'Scheme',
                arg_schema: { type: { type: 'string', display_name: 'Scheme Type' } },
              },
            } as never
          }
          colors={{ key: '#fff', border: '#333', value: '#fff' } as never}
        />
      </ReqoreUIProvider>
    );
    expect(container.textContent).toContain('Scheme Type');
    expect(container.textContent).toContain('basic');
  });

  it('still shows a field that IS set', () => {
    const { container } = renderPreview({
      ...VALUE,
      timeout_s: { type: 'int', value: 30 },
    });
    expect(container.textContent).toContain('30');
    expect(container.textContent).not.toContain('1 field');
  });
});
