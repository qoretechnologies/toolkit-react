// Copyright 2026 Qore Technologies, s.r.o.
// A reference the DPQL editor draws as a chip is the one the server's DPQL tokenizer reads (qorus#646).
//
// The server writes a record field whose name is not a bare name as a quoted field, `@"create.items[*].id"`: it is
// how the expression `$record:{create.items[*].id}` comes back from dpql/serialize, so the editor drew a reference
// it had just shown as a chip as plain text after a tab switch. And a template's bracketed value ended at its
// first `}`, so `$record:{create.a\{b\}}` was a chip for `create.a\{b\` and the text `}`.
import {
  dpqlSlateConverter,
  getTagLabel,
  plainTextToSlate,
  slateToPlainText,
} from '../../src/components/dpqlEditor/dpqlHelpers';
import { makeDpqlTagRenderer } from '../../src/components/dpqlEditor/dpqlTags';
import { rechipTypedReferences } from '../../src/components/smartEditor/typedReferences';
import { ISlateElement } from '../../src/components/smartEditor/types';

/** The chips a line is drawn with: each one's value and label. */
const chipsIn = (text: string) =>
  plainTextToSlate(text).flatMap((paragraph) =>
    paragraph.children
      .filter((node): node is ISlateElement => (node as ISlateElement).type === 'tag')
      .map(({ value, label }) => ({ value, label }))
  );

/** A line as it is drawn: its text, with each chip as `[label]`. */
const drawn = (text: string) =>
  plainTextToSlate(text)
    .map((paragraph) =>
      paragraph.children
        .map((node) =>
          (node as ISlateElement).type === 'tag' ?
            `[${(node as ISlateElement).label}]`
          : (node as { text: string }).text
        )
        .join('')
    )
    .join('\n');

describe('a quoted field is drawn as its chip', () => {
  // each as dpql/serialize writes it (DpqlSerializer::serializeFieldRef): any name DPQL does not read bare is
  // quoted, a backslash doubled and a quote escaped
  const serialized: [string, string][] = [
    ['@"create.items[*].id"', 'create.items[*].id'],
    ['@"create.items[0].id"', 'create.items[0].id'],
    ['@"create.order-id"', 'create.order-id'],
    ['@"c.output[0]"', 'c.output[0]'],
    ['@"create.a\\\\.b"', 'create.a\\.b'],
    ['@"create.a\\\\{b\\\\}"', 'create.a\\{b\\}'],
    ['@"say \\"hi\\""', 'say "hi"'],
    ['@"order id"', 'order id'],
  ];

  test.each(serialized)('%s is one chip, labeled with the name it stands for', (text, name) => {
    expect(chipsIn(text)).toEqual([{ value: text, label: name }]);
    expect(drawn(text)).toBe(`[${name}]`);
  });

  test.each(serialized)('%s is written back exactly as it was', (text) => {
    expect(slateToPlainText(plainTextToSlate(text))).toBe(text);
  });

  test('in an expression, beside operators, other fields and templates', () => {
    const text = '@"create.order-id" == 5 AND @name > $local:min OR @"c.output[0]" != "x"';

    expect(drawn(text)).toBe(
      '[create.order-id] == 5 AND [name] > [local: min] OR [c.output[0]] != "x"'
    );
    expect(slateToPlainText(plainTextToSlate(text))).toBe(text);
  });

  test('as an argument, and with an accessor after it', () => {
    expect(drawn('length(@"create.items")')).toBe('length([create.items])');
    // the accessor is part of it (accessorChains.test.ts)
    expect(drawn('@"create.items"[0]')).toBe('[create.items[0]]');
  });

  test('an escaped quote does not end it', () => {
    expect(chipsIn('@"a\\"b" == 1')).toEqual([{ value: '@"a\\"b"', label: 'a"b' }]);
  });

  test('one not closed on its line is text, as the server rejects it', () => {
    expect(chipsIn('@"create.items == 1')).toEqual([]);
    expect(slateToPlainText(plainTextToSlate('@"create.items == 1'))).toBe('@"create.items == 1');
  });

  test('not inside a word', () => {
    expect(chipsIn('user@"x"')).toEqual([]);
  });

  test('its label, for a completion or a chip the server sends without one', () => {
    expect(getTagLabel('@"create.order-id"')).toBe('create.order-id');
    expect(getTagLabel('@"a\\\\b"')).toBe('a\\b');
    expect(getTagLabel('@"tab\\tname"')).toBe('tab\tname');
    expect(getTagLabel('@name')).toBe('name');
  });

  test('the chip says the name, and the field it names describes it', () => {
    const renderTag = makeDpqlTagRenderer({
      'create.order-id': { display_name: 'Order ID', type: { name: 'string' } },
    });
    const tag = (value: string): ISlateElement => ({
      type: 'tag',
      value,
      children: [{ text: '' }],
    });

    expect(renderTag(tag('@"create.order-id"'))).toMatchObject({
      label: 'Order ID',
      icon: 'Database2Line',
    });
    expect(renderTag(tag('@"create.order-id"')).tooltip).toBeTruthy();
    // a field the record does not describe is drawn with its name, unescaped, not its quoted text
    expect(renderTag(tag('@"create.items[*].id"')).label).toBe('create.items[*].id');
    expect(renderTag(tag('@"say \\"hi\\""')).label).toBe('say "hi"');
    expect(renderTag(tag('@name')).label).toBe('name');
  });

  test('typed out, it is drawn as its chip once the character after it ends it', () => {
    const text = '@"create.order-id" == 1';
    const typed: ISlateElement = { type: 'paragraph', children: [{ text }] };
    const end = '@"create.order-id"'.length;

    // still at its closing quote: left as text, the caret may go on to an accessor
    expect(rechipTypedReferences(dpqlSlateConverter, typed, 0, end)).toBeUndefined();
    // the space after it typed: drawn as its chip
    const rechipped = rechipTypedReferences(dpqlSlateConverter, typed, 0, end + 1);
    expect(rechipped?.children).toEqual(plainTextToSlate(text)[0].children);
    expect(rechipped?.children[1]).toMatchObject({ type: 'tag', label: 'create.order-id' });
  });
});

describe("a template's bracketed value ends where the server's does", () => {
  test('an escaped brace is part of it', () => {
    expect(chipsIn('$record:{create.a\\{b\\}}')).toEqual([
      { value: '$record:{create.a\\{b\\}}', label: 'record: create.a\\{b\\}' },
    ]);
    expect(drawn('$record:{create.a\\{b\\}} == 1')).toBe('[record: create.a\\{b\\}] == 1');
  });

  test('a nested pair of braces is part of it', () => {
    expect(chipsIn('$local:{x{y}} == 1')).toEqual([
      { value: '$local:{x{y}}', label: 'local: x{y}' },
    ]);
  });

  test('a string inside it is read whole, a brace in it included', () => {
    expect(chipsIn('$local:{a["}"]} == 1')).toEqual([
      { value: '$local:{a["}"]}', label: 'local: a["}"]' },
    ]);
  });

  test('the ones the server reads for a record field', () => {
    for (const path of [
      'create.items[*].id',
      'create.items[0].id',
      'create.order-id',
      'create.a\\.b',
      'c.output[0]',
    ]) {
      const text = `$record:{${path}}`;
      expect(chipsIn(text)).toEqual([{ value: text, label: `record: ${path}` }]);
      expect(slateToPlainText(plainTextToSlate(text))).toBe(text);
    }
  });

  test('one not closed on its line is text', () => {
    expect(chipsIn('$record:{create.a\\}')).toEqual([]);
    expect(chipsIn('$record:{create')).toEqual([]);
  });
});

describe('a field in a string literal is text', () => {
  test('a string that is a field name keeps its quotes', () => {
    // drawn as the field's chip, it was written back as the field `@name`: a string became a reference
    expect(chipsIn('@handle == "@name"')).toEqual([{ value: '@handle', label: 'handle' }]);
    expect(slateToPlainText(plainTextToSlate('@handle == "@name"'))).toBe('@handle == "@name"');
  });

  test('in single quotes, beside other words, and over two lines', () => {
    expect(chipsIn("'@name' == @x")).toEqual([{ value: '@x', label: 'x' }]);
    expect(chipsIn('"hello @name" == @x')).toEqual([{ value: '@x', label: 'x' }]);
    expect(chipsIn('"first line\n@name" == @x')).toEqual([{ value: '@x', label: 'x' }]);
  });

  test('an escaped quote does not end the string', () => {
    expect(chipsIn('"a \\" @name" == @x')).toEqual([{ value: '@x', label: 'x' }]);
  });

  test('a template in a string is still its chip, and a string that is one keeps its quotes', () => {
    expect(drawn('"Hello $local:name" == @x')).toBe('"Hello [local: name]" == [x]');
    const quoted = plainTextToSlate('contains("$local:input", "es")')[0].children;
    expect(quoted[1]).toMatchObject({ value: '$local:input', metadata: { quoted: true } });
    expect(slateToPlainText(plainTextToSlate('contains("$local:input", "es")'))).toBe(
      'contains("$local:input", "es")'
    );
  });
});
