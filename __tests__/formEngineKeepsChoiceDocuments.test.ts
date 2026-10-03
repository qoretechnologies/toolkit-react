/**
 * A stored value that IS one of a field's choices, or is resolved only when the interface runs, survives the
 * choices arriving.
 *
 * `fixOptions` drops a value that is not one of a field's fixed choices, and it judged that with `===` alone. A
 * rich-text document never equals a string, so the document an editor wrote for "Case" - drawn as free text
 * while the Salesforce table list could not be loaded - was erased the moment the list arrived, on merely
 * opening the Qog state, and the emptied state was autosaved. An expression and a document holding a template
 * tag were erased the same way, although neither can be one of the choices: both are resolved at run time.
 */
import { describe, expect, it } from 'vitest';
import { fixOptions } from '../src/components/form/engine/FormEngine';
import { findAllowedValueOption } from '../src/components/form/engine/readFirst';

const choice = (name: string) => ({ value: { type: 'richtext', value: name }, display_name: name });

const tableSchema = {
  table: {
    type: 'string',
    ui_type: 'richtext',
    display_name: 'Table',
    required: true,
    allowed_values: [choice('Account'), choice('Case'), choice('Contact'), choice('Lead')],
  },
};

const doc = (...children: unknown[]) => [{ type: 'paragraph', children }];

describe('fixOptions with fixed choices', () => {
  it('keeps a rich-text document whose text is one of the choices', () => {
    const stored = { table: { type: 'richtext', value: doc({ text: 'Case' }) } };
    const out = fixOptions(stored, tableSchema as any);

    expect(out.table.value).toEqual(doc({ text: 'Case' }));
  });

  it('keeps a document holding a template tag', () => {
    const value = doc({ type: 'tag', value: '$local:table_name', label: 'table_name', children: [{ text: '' }] });
    const out = fixOptions({ table: { type: 'richtext', value } }, tableSchema as any);

    expect(out.table.value).toEqual(value);
  });

  it('keeps an expression', () => {
    const value = { exp: 'CONCAT', args: [] };
    const out = fixOptions({ table: { type: 'string', value, is_expression: true } }, tableSchema as any);

    expect(out.table.value).toEqual(value);
    expect(out.table.is_expression).toBe(true);
  });

  it('still drops a value that names none of the choices', () => {
    const out = fixOptions({ table: { type: 'richtext', value: doc({ text: 'Opportunity' }) } }, tableSchema as any);

    expect(out.table.value).toBeUndefined();
  });
});

describe('findAllowedValueOption', () => {
  it('finds the choice a rich-text document names', () => {
    expect(findAllowedValueOption(doc({ text: 'Case' }), tableSchema.table as any)?.display_name).toBe('Case');
  });

  it('finds no choice for a document naming none', () => {
    expect(findAllowedValueOption(doc({ text: 'Opportunity' }), tableSchema.table as any)).toBeUndefined();
  });
});
