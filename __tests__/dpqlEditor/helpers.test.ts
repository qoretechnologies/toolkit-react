// Lifted from qorus-ide __tests__/helpers/dpqlRichtextHelpers.test.ts on the
// feature/dpql-editor branch. Differences: vitest → jest globals, imports
// split across DPQL-specific (`dpqlHelpers`) and generic-SmartEditor
// (`smartEditor/helpers`) helpers after the SmartEditor refactor.

import {
  getTagLabel,
  isTagCompletion,
  plainTextToSlate,
  slateSelectionToOffset,
  slateToPlainText,
} from '../../src/components/dpqlEditor/dpqlHelpers';

describe('dpqlEditor helpers', () => {
  describe('plainTextToSlate', () => {
    it('returns empty paragraph for empty string', () => {
      const result = plainTextToSlate('');
      expect(result).toEqual([{ type: 'paragraph', children: [{ text: '' }] }]);
    });

    it('converts plain text to a paragraph with text node', () => {
      const result = plainTextToSlate('hello world');
      expect(result).toEqual([
        { type: 'paragraph', children: [{ text: 'hello world' }] },
      ]);
    });

    it('converts @field to a tag element', () => {
      const result = plainTextToSlate('@name == "Alice"');
      expect(result).toHaveLength(1);
      const children = result[0].children;
      expect(children).toHaveLength(2);
      expect(children[0]).toMatchObject({
        type: 'tag',
        value: '@name',
        label: 'name',
      });
      expect(children[1]).toMatchObject({ text: ' == "Alice"' });
    });

    it('converts $prefix:{value} to a tag element', () => {
      const result = plainTextToSlate('$data:{1.field}');
      expect(result).toHaveLength(1);
      const children = result[0].children;
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({
        type: 'tag',
        value: '$data:{1.field}',
        label: 'data: 1.field',
      });
    });

    it('converts $prefix:value (no braces) to a tag element', () => {
      const result = plainTextToSlate('$local:input');
      expect(result).toHaveLength(1);
      expect(result[0].children[0]).toMatchObject({
        type: 'tag',
        value: '$local:input',
        label: 'local: input',
      });
    });

    it('handles mixed content with tags and text', () => {
      const result = plainTextToSlate('@name == $config:min AND @age > 18');
      const children = result[0].children;

      expect(children.length).toBeGreaterThanOrEqual(5);

      expect(children[0]).toMatchObject({ type: 'tag', value: '@name' });
      expect(children[1]).toMatchObject({ text: ' == ' });
      expect(children[2]).toMatchObject({
        type: 'tag',
        value: '$config:min',
      });
      expect(children[3]).toMatchObject({ text: ' AND ' });
      expect(children[4]).toMatchObject({ type: 'tag', value: '@age' });
    });

    it('consumes surrounding quotes into the tag metadata', () => {
      const result = plainTextToSlate('contains("$local:input", "es")');
      const children = result[0].children;
      expect(children[0]).toMatchObject({ text: 'contains(' });
      expect(children[1]).toMatchObject({
        type: 'tag',
        value: '$local:input',
        label: 'local: input',
        metadata: { quoted: true },
      });
      expect(children[2]).toMatchObject({ text: ', "es")' });
    });

    it('handles multiline text', () => {
      const result = plainTextToSlate('@name\n@age');
      expect(result).toHaveLength(2);
      expect(result[0].children[0]).toMatchObject({
        type: 'tag',
        value: '@name',
      });
      expect(result[1].children[0]).toMatchObject({
        type: 'tag',
        value: '@age',
      });
    });
  });

  describe('slateToPlainText', () => {
    it('converts text-only paragraph back to string', () => {
      const result = slateToPlainText([
        { type: 'paragraph', children: [{ text: 'hello world' }] },
      ]);
      expect(result).toBe('hello world');
    });

    it('converts tag element to its value string', () => {
      const result = slateToPlainText([
        {
          type: 'paragraph',
          children: [
            {
              type: 'tag',
              value: '@name',
              label: 'name',
              children: [{ text: '' }],
            },
            { text: ' == "Alice"' },
          ],
        },
      ]);
      expect(result).toBe('@name == "Alice"');
    });

    it('converts template tag to its value string', () => {
      const result = slateToPlainText([
        {
          type: 'paragraph',
          children: [
            {
              type: 'tag',
              value: '$data:{1.field}',
              label: 'data: 1.field',
              children: [{ text: '' }],
            },
          ],
        },
      ]);
      expect(result).toBe('$data:{1.field}');
    });

    it('handles multiline', () => {
      const result = slateToPlainText([
        { type: 'paragraph', children: [{ text: 'line1' }] },
        { type: 'paragraph', children: [{ text: 'line2' }] },
      ]);
      expect(result).toBe('line1\nline2');
    });
  });

  describe('roundtrip: plainText -> slate -> plainText', () => {
    const cases = [
      '',
      'hello world',
      '@name == "Alice"',
      '$data:{1.field}',
      '$local:input',
      '@name == $config:min AND @age > 18',
      'contains("$local:input", "es")',
    ];

    for (const text of cases) {
      it(`roundtrips: "${text}"`, () => {
        const slate = plainTextToSlate(text);
        const result = slateToPlainText(slate);
        expect(result).toBe(text);
      });
    }
  });

  describe('isTagCompletion', () => {
    it('returns true for field references', () => {
      expect(isTagCompletion('@field_name')).toBe(true);
    });

    it('returns true for template variables', () => {
      expect(isTagCompletion('$local:input')).toBe(true);
    });

    it('returns false for keywords', () => {
      expect(isTagCompletion('SELECT')).toBe(false);
    });

    it('returns false for operators', () => {
      expect(isTagCompletion('==')).toBe(false);
    });
  });

  describe('getTagLabel', () => {
    it('strips @ from field references', () => {
      expect(getTagLabel('@field_name')).toBe('field_name');
    });

    it('formats template variables with prefix', () => {
      expect(getTagLabel('$local:input')).toBe('local: input');
    });

    it('formats template variables with braces', () => {
      expect(getTagLabel('$data:{1.field}')).toBe('data: 1.field');
    });

    it('handles $ without colon', () => {
      expect(getTagLabel('$var')).toBe('var');
    });

    it('returns plain text as-is', () => {
      expect(getTagLabel('SELECT')).toBe('SELECT');
    });
  });

  describe('slateSelectionToOffset', () => {
    it('returns correct offset for text node', () => {
      const elements = plainTextToSlate('hello world');
      expect(slateSelectionToOffset(elements, [0, 0], 5)).toBe(5);
    });

    it('returns correct offset after a tag', () => {
      const elements = plainTextToSlate('@name == "Alice"');
      // @name = 5 chars (child 0 tag), then offset 3 into the text (child 1)
      expect(slateSelectionToOffset(elements, [0, 1], 3)).toBe(8);
    });

    it('returns correct offset in second paragraph', () => {
      const elements = plainTextToSlate('line1\nline2');
      // "line1" + "\n" + 3 chars = 9
      expect(slateSelectionToOffset(elements, [1, 0], 3)).toBe(9);
    });

    it('accounts for quoted tags', () => {
      const elements = plainTextToSlate('contains("$local:input", "es")');
      // contains( = 9, "$local:input" with quotes = 14, then 2 into final text
      expect(slateSelectionToOffset(elements, [0, 2], 2)).toBe(25);
    });
  });
});
