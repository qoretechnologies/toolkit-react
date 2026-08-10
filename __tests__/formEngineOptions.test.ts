import { describe, expect, it } from 'vitest';
import {
  fixOptions,
  getType,
  getTypeAndCanBeNull,
} from '../src/components/form/engine/FormEngine';

describe('FormEngine option type resolution', () => {
  it('uses an untyped renderer while server-driven schema metadata is unavailable', () => {
    expect(getType(undefined)).toBe('any');
    expect(getType([])).toBe('any');
    expect(getTypeAndCanBeNull(undefined)).toEqual({
      type: 'any',
      defaultType: 'any',
      defaultInternalType: undefined,
      canBeNull: false,
    });
  });

  it('continues to normalize nullable generic types', () => {
    expect(getTypeAndCanBeNull('soft*hash<string, int>' as never)).toEqual({
      type: 'hash',
      defaultType: 'hash',
      defaultInternalType: 'hash',
      canBeNull: true,
    });
  });
});

describe('fixOptions', () => {
  it('preserves persisted values until their server-driven schema arrives', () => {
    const value = { payload: { value: 'Calendar attachment' } } as never;

    expect(fixOptions(value, undefined)).toEqual(value);
    expect(fixOptions(value, {})).toEqual(value);
  });

  it('adds the schema type without nesting an untyped form field value', () => {
    expect(
      fixOptions(
        { payload: { value: 'Calendar attachment', op: ['trim'] } } as never,
        { payload: { type: 'string', ui_type: 'string' } } as never
      )
    ).toEqual({
      payload: { type: 'string', value: 'Calendar attachment', op: ['trim'] },
    });
  });

  it('keeps every key the untyped envelope carried', () => {
    // Rebuilding the field from just {type, value} dropped these and emptied the
    // rendered card — the file option lost its content on revert.
    const fixed = fixOptions(
      {
        fileOption: {
          value: { name: 'file.txt', size: 1234 },
          is_expression: true,
          op: ['trim'],
          some_renderer_hint: 'keep-me',
        },
      } as never,
      { fileOption: { type: 'file', ui_type: 'file' } } as never
    );

    expect(fixed.fileOption).toEqual({
      type: 'file',
      value: { name: 'file.txt', size: 1234 },
      is_expression: true,
      op: ['trim'],
      some_renderer_hint: 'keep-me',
    });
  });

  it('stores a renderer-only ui_type under the schema type, not the renderer name', () => {
    // `cron` names an editor; the value is still stored as the schema's string.
    const fixed = fixOptions(
      { schedule: { value: '0 0 * * *' } } as never,
      { schedule: { type: 'string', ui_type: 'cron' } } as never
    );

    expect(fixed.schedule).toEqual({ type: 'string', value: '0 0 * * *' });
  });

  it('lets a storage-compatible ui_type win over the schema type', () => {
    const fixed = fixOptions(
      { note: { value: 'hello' } } as never,
      { note: { type: 'string', ui_type: 'long-string' } } as never
    );

    expect(fixed.note).toEqual({ type: 'long-string', value: 'hello' });
  });
});
