/**
 * The story language server answers as the real one does.
 *
 * Every expected value below is what the Qorus `/lsp` handler returned for the
 * same request, captured against a running instance. The mock these replaced
 * answered any text with `text == ""` typed as `string`: `1 + 2 ==`, which the
 * server rejects, previewed as `"1 + 2 ==" == ""`, and a bool field reported
 * "The expression returns string". Stories were asserting that artefact.
 */
import { describe, expect, it } from 'vitest';
import {
  mockParseDpql,
  mockRenderDpql,
  mockSerializeDpql,
  mockTokenizeDpql,
} from '../src/components/form/expressions/dpqlMockLanguage';

/** Decode LSP semantic tokens into `[text, typeIndex]` pairs for one line. */
const decodeTokens = (text: string) => {
  const data = mockTokenizeDpql(text);
  const out: Array<[string, number]> = [];
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    char = data[i] === 0 ? char + data[i + 1] : data[i + 1];
    out.push([text.slice(char, char + data[i + 2]), data[i + 3]]);
  }
  return out;
};

describe('dpql/parse', () => {
  it('rejects an incomplete expression instead of inventing one', () => {
    const result = mockParseDpql('1 + 2 ==', 'bool');

    expect(result.success).toBe(false);
    expect(result.expression).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      message: 'Unexpected end of input, expected value',
      code: 'DPQL-E001',
    });
  });

  it('parses arithmetic into the server AST and infers its type', () => {
    expect(mockParseDpql('1 + 2', 'int')).toEqual({
      success: true,
      expression: {
        is_expression: true,
        value: {
          exp: '+',
          args: [
            { type: 'int', value: 1 },
            { type: 'int', value: 2 },
          ],
        },
      },
      inferred_type: 'int',
      target_type: 'int',
      type_compatible: true,
      auto_coercible: true,
      coercion_may_fail: false,
      diagnostics: [],
    });
  });

  it('wraps a nested operand as an expression', () => {
    expect(mockParseDpql('1 + 2 > 3').expression?.value).toEqual({
      exp: '>',
      args: [
        {
          is_expression: true,
          value: {
            exp: '+',
            args: [
              { type: 'int', value: 1 },
              { type: 'int', value: 2 },
            ],
          },
        },
        { type: 'int', value: 3 },
      ],
    });
  });

  it('parses a template reference into the template argument shape', () => {
    const result = mockParseDpql('$local:name == "John"', 'bool');

    expect(result.expression?.value).toEqual({
      exp: '==',
      args: [
        { type: 'auto', value: { tmpl_context: 'local', tmpl_value: 'name', raw: '$local:name' } },
        { type: 'string', value: 'John' },
      ],
    });
    expect(result).toMatchObject({ inferred_type: 'bool', type_compatible: true });
  });

  it('wraps a lone word as value(), which fits any target', () => {
    expect(mockParseDpql('hello', 'bool')).toMatchObject({
      success: true,
      expression: { value: { exp: 'value', args: [{ type: 'string', value: 'hello' }] } },
      inferred_type: 'auto',
      type_compatible: true,
      coercion_may_fail: false,
    });
  });

  it('answers without analysis when no target was sent', () => {
    expect(mockParseDpql('null')).toEqual({
      success: true,
      expression: { is_expression: true, value: { exp: 'value', args: [{ type: 'any', value: null }] } },
      inferred_type: 'auto',
      diagnostics: [],
    });
  });

  it('knows what a conversion function returns', () => {
    expect(mockParseDpql('toInt("5")', 'int')).toMatchObject({
      expression: { value: { exp: 'toInt', args: [{ type: 'string', value: '5' }] } },
      inferred_type: 'int',
      type_compatible: true,
    });
  });
});

describe('dpql/parse type analysis', () => {
  it('offers a certain conversion when a number is used as text', () => {
    expect(mockParseDpql('1 + 2', 'string')).toMatchObject({
      type_compatible: false,
      auto_coercible: true,
      coercion_may_fail: false,
      suggested_fix: { text: 'toString(1 + 2)', description: 'Convert int to string using toString()' },
    });
  });

  it('warns that text used as a number may not convert', () => {
    const result = mockParseDpql('toString(1 + 2)', 'int');

    expect(result).toMatchObject({
      inferred_type: 'string',
      type_compatible: false,
      auto_coercible: true,
      coercion_may_fail: true,
      suggested_fix: {
        text: 'toInt(toString(1 + 2))',
        description: 'Convert string to int using toInt()',
      },
    });
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'warning',
      message: "Expression returns 'string' but target expects 'int' (auto-coercion available)",
      code: 'TYPE_MISMATCH',
    });
  });

  it('refuses a conversion that does not exist, with no fix', () => {
    const result = mockParseDpql('1 + 2', 'bool');

    expect(result).toMatchObject({ type_compatible: false, auto_coercible: false, coercion_may_fail: false });
    expect(result.suggested_fix).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      message: "Expression returns 'int' but target expects 'bool'",
    });
  });

  it('says nothing when text is used as text', () => {
    expect(mockParseDpql('toString(1 + 2)', 'string')).toMatchObject({
      type_compatible: true,
      coercion_may_fail: false,
      diagnostics: [],
    });
    expect(mockParseDpql('"a" + "b"', 'string')).toMatchObject({
      inferred_type: 'string',
      type_compatible: true,
      diagnostics: [],
    });
  });

  it('types a concatenation with text as text', () => {
    expect(mockParseDpql('"a" + 1', 'int')).toMatchObject({
      expression: {
        value: {
          exp: '+',
          args: [
            { type: 'string', value: 'a' },
            { type: 'int', value: 1 },
          ],
        },
      },
      inferred_type: 'string',
      coercion_may_fail: true,
      suggested_fix: { text: 'toInt("a" + 1)' },
    });
  });
});

describe('dpql/serialize and dpql/renderExpression', () => {
  /** How the builder stores a template: a string holding the reference. */
  const STORED = {
    exp: '==',
    args: [
      { type: 'string', value: '$local:name' },
      { type: 'string', value: 'John' },
    ],
  };
  const chip = {
    type: 'tag',
    value: '$local:name',
    label: 'name',
    children: [{ text: '' }],
    metadata: { displayName: 'Local Context' },
  };

  it('serializes a stored string as a string, the reference a chip inside it', () => {
    expect(mockSerializeDpql(STORED)).toEqual({
      dpql: '"$local:name" == "John"',
      richtext: {
        type: 'richtext',
        value: [{ type: 'paragraph', children: [{ text: '"' }, chip, { text: '" == "John"' }] }],
      },
    });
  });

  it('renders the same expression readably, the reference as itself', () => {
    expect(mockRenderDpql(STORED)).toEqual({
      rendered: '$local:name == "John"',
      richtext: {
        type: 'richtext',
        value: [{ type: 'paragraph', children: [chip, { text: ' == "John"' }] }],
      },
    });
  });

  it('serializes a parsed template argument bare, so it parses back the same', () => {
    const parsed = mockParseDpql('$local:name == "John"').expression!;

    expect(mockSerializeDpql(parsed).dpql).toBe('$local:name == "John"');
    expect(mockParseDpql(mockSerializeDpql(parsed).dpql).expression).toEqual(parsed);
  });

  it('joins an AND/OR group the builder stores as one node', () => {
    const group = {
      exp: '||',
      args: [
        { is_expression: true, value: { exp: '==', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] } },
        { is_expression: true, value: { exp: '&&', args: [{ type: 'bool', value: true }, { type: 'bool', value: false }, { type: 'bool', value: true }] } },
        { type: 'bool', value: false },
      ],
    };

    expect(mockRenderDpql(group).rendered).toBe('1 == 2 || true && false && true || false');
  });

  it('parenthesises only where precedence needs it', () => {
    expect(mockSerializeDpql(mockParseDpql('1 + 2 > 3').expression).dpql).toBe('1 + 2 > 3');
    expect(mockSerializeDpql(mockParseDpql('(1 + 2) * 3').expression).dpql).toBe('(1 + 2) * 3');
    expect(mockSerializeDpql(mockParseDpql('1 - (2 - 3)').expression).dpql).toBe('1 - (2 - 3)');
  });
});

describe('expressions the catalogue spells', () => {
  /* The server renders and serializes by the expression catalogue: a function
     by name, a `render_template` where there is one, and a two-argument word
     comparison infix. Every string below is what it returned for the AST. */
  const s = (value: unknown) => ({ type: 'string', value });
  const e = (exp: string, ...args: unknown[]) => ({ is_expression: true, value: { exp, args } });
  /** ExpressionBuilder's "Shows Explanation" expression. */
  const BUILDER_STORY = {
    exp: '&&',
    args: [
      e(
        '||',
        e('contains', s('$local:input'), s('es')),
        e('&&', e('starts-with', s('test'), s('t')), e('starts-with', s('test'), s('t'))),
        e('>=', { type: 'int', value: 23 }, s('$local:id'))
      ),
      e('ends-with', s('$local:str'), s('$local:p')),
      e('<', { type: 'int', value: '$local:input' }, s('$local:p')),
    ],
  };

  it('renders the builder story the way its Explain shows it', () => {
    expect(mockRenderDpql(BUILDER_STORY).rendered).toBe(
      '($local:input contains "es" (ignore case) || "test".startsWith("t", true) && ' +
        '"test".startsWith("t", true) || 23 >= $local:id) && $local:str.endsWith($local:p, true) && ' +
        '$local:input < $local:p'
    );
  });

  it('serializes the same expression as DPQL', () => {
    expect(mockSerializeDpql(BUILDER_STORY).dpql).toBe(
      '("$local:input" contains "es" || "test" startsWith "t" && "test" startsWith "t" || 23 >= "$local:id") && ' +
        '"$local:str" endsWith "$local:p" && "$local:input" < "$local:p"'
    );
  });

  it('fills a template argument that was not given from its default', () => {
    expect(mockRenderDpql(e('starts-with', s('test'), s('t')).value).rendered).toBe(
      '"test".startsWith("t", true)'
    );
    expect(
      mockRenderDpql(e('starts-with', s('test'), s('t'), { type: 'bool', value: false }).value).rendered
    ).toBe('"test".startsWith("t", false)');
  });

  it('reads a conditional template part from the argument, and its default only when omitted', () => {
    const contains = (...extra: unknown[]) => e('contains', s('$local:input'), s('es'), ...extra).value;

    expect(mockRenderDpql(contains()).rendered).toBe('$local:input contains "es" (ignore case)');
    expect(mockRenderDpql(contains({ type: 'bool', value: true })).rendered).toBe(
      '$local:input contains "es" (ignore case)'
    );
    // An explicit false compares case-sensitively, and says so (Qore `5f3d9b491`).
    expect(mockRenderDpql(contains({ type: 'bool', value: false })).rendered).toBe(
      '$local:input contains "es"'
    );
  });

  it('parenthesises an operator substituted into a template', () => {
    const nested = e('contains', e('+', s('a'), s('b')), s('es')).value;

    expect(mockRenderDpql(nested).rendered).toBe('("a" + "b") contains "es" (ignore case)');
    expect(mockSerializeDpql(nested).dpql).toBe('("a" + "b") contains "es"');
  });

  it('calls a comparison by its symbol when it has other than two arguments', () => {
    expect(mockSerializeDpql(e('contains', s('$local:input'), s('es'), { type: 'bool', value: true }).value).dpql).toBe(
      'contains("$local:input", "es", true)'
    );
    expect(mockSerializeDpql(e('starts-with', s('test'), s('t'), { type: 'bool', value: false }).value).dpql).toBe(
      'startsWith("test", "t", false)'
    );
  });

  it('calls a function by name in both', () => {
    const concat = e('concat', s('a'), s('$local:x')).value;

    expect(mockRenderDpql(concat).rendered).toBe('concat("a", $local:x)');
    expect(mockSerializeDpql(concat).dpql).toBe('concat("a", "$local:x")');
  });

  it('parses a word comparison and a call by symbol back to the catalogue name', () => {
    expect(mockParseDpql('"test" startsWith "t" || startsWith("test", "t", false)').expression?.value).toEqual({
      exp: '||',
      args: [
        { is_expression: true, value: { exp: 'starts-with', args: [s('test'), s('t')] } },
        {
          is_expression: true,
          value: { exp: 'starts-with', args: [s('test'), s('t'), { type: 'bool', value: false }] },
        },
      ],
    });
    expect(mockParseDpql('concat("a", $local:x)').expression?.value).toEqual({
      exp: 'concat',
      args: [s('a'), { type: 'auto', value: { tmpl_context: 'local', tmpl_value: 'x', raw: '$local:x' } }],
    });
  });
});

describe('semantic tokens', () => {
  // Legend indices: 6 function, 11 string, 12 number, 14 operator.
  it('colours an expression', () => {
    expect(decodeTokens('1 + 2 == "John"')).toEqual([
      ['1', 12],
      ['+', 14],
      ['2', 12],
      ['==', 14],
      ['"John"', 11],
    ]);
  });

  it('colours a readable rendering too, as the server does', () => {
    const tokens = decodeTokens('$local:input contains "es" (ignore case)');

    expect(tokens).toContainEqual(['contains', 6]);
    expect(tokens).toContainEqual(['"es"', 11]);
    expect(tokens).toContainEqual(['ignore', 6]);
    expect(tokens).toContainEqual(['case', 6]);
  });

  it('colours a word comparison and leaves punctuation alone', () => {
    expect(decodeTokens('"test" startsWith "t" || startsWith("test", "t", false)')).toEqual([
      ['"test"', 11],
      ['startsWith', 6],
      ['"t"', 11],
      ['||', 14],
      ['startsWith', 6],
      ['"test"', 11],
      ['"t"', 11],
      ['false', 8],
    ]);
  });
});
