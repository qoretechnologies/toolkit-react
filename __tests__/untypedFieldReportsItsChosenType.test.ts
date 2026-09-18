// Copyright 2026 Qore Technologies, s.r.o.
// An untyped option is validated as the type its VALUE carries.
//
// `auto`/`any` declare no type: the author picks one — Binary, Date — and it is
// recorded beside the value. The field's messages read the schema first, so a
// binary value was validated as `auto`, which auto-detects from the value and
// accepts whatever is there. The form's own check prefers the stored type, so
// the two disagreed: the form said "a field is not valid and requires
// attention" while the field it meant gave no reason at all.
import { describe, expect, it } from 'vitest';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';

const UNTYPED_SCHEMA = {
  myAutoField: { type: 'auto', ui_type: 'auto', display_name: 'My Auto Field' },
} as never;

const messagesFor = (option: Record<string, unknown>, schema = UNTYPED_SCHEMA) =>
  getOptionFieldMessages({
    schema,
    option: option as never,
    name: 'myAutoField',
    allOptions: { myAutoField: option } as never,
    getType: ((type: string) => type) as never,
  }).map((message) => String(message.label));

describe('an option whose schema is untyped', () => {
  it('says why a binary value is wrong, in the words that fix it', () => {
    const reasons = messagesFor({ type: 'binary', value: 'not valid !!! binary' });

    expect(reasons).toHaveLength(1);
    // Base64 is what the server decodes with unless told otherwise, so it is
    // what the reader has to be told (Qorus `lib/misc.ql`).
    expect(reasons[0]).toContain('base64');
  });

  it('accepts the spellings the server accepts', () => {
    expect(messagesFor({ type: 'binary', value: 'aGVsbG8=' })).toEqual([]);
    expect(messagesFor({ type: 'binary', value: '0x48656c6c6f' })).toEqual([]);
    expect(messagesFor({ type: 'binary', value: 'data:image/png;base64,aGVsbG8=' })).toEqual([]);
  });

  it('still says nothing about a value that is simply text', () => {
    expect(messagesFor({ type: 'string', value: 'not valid !!! binary' })).toEqual([]);
  });
});

describe('an option whose schema names a type', () => {
  it('keeps using it — the schema is what the field accepts', () => {
    const reasons = messagesFor({ type: 'string', value: 'not binary at all' }, {
      myAutoField: { type: 'binary', ui_type: 'binary', display_name: 'A blob' },
    } as never);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('base64');
  });
});
