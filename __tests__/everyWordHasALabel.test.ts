// Copyright 2026 Qore Technologies, s.r.o.
/*
 * Every word Reqraft draws is one a host can give (`setReqraftLabels`). This walks the syntax tree of the sources, and
 * fails on text that reads as words and has no label: give it one in `src/helpers/reqraftLabels.ts` or `helpers/labels`,
 * or, if no user reads it, name it below with why.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../src');

/** Sources no user reads, or whose words are not this route's. */
const NOT_THESE_WORDS: [RegExp, string][] = [
  [/\.(stories|test|d)\.tsx?$/, 'stories, tests and types'],
  [/(^|\/)(stories|__fixtures__|__tests__)\//, 'stories and fixtures'],
  [/(^|[/])(mock|.*Mock)[^/]*\.tsx?$/, 'story mocks'],
  [/form\/expressions\/wildcardExpressions\.ts$/, 'used by no source, only tests'],
  [/form\/engine\/variants\//, 'imported only by their stories, and not exported'],
  [/(reqraftLabels|templateListLabels)\.ts$|helpers\/labels\/|\/labels\.ts$/, 'the defaults themselves'],
  [/^tracking\//, 'the A/B test tool: a designer’s, and qorus-ide does not use it'],
  [/helpers\/qorusTypeCatalogue\.ts$/, 'the built-in catalogue’s names and descriptions: the server’s catalogue replaces them'],
  [/schema-definition\/starterTemplate\.ts$/, 'comments written into a new schema document: data, not interface'],
  [/utils\/(lspClient|websocket|fetch)\.ts$/, 'transport errors for developers and logs'],
  [/contexts\/(FetchContext|StorageContext)\.tsx$/, 'what a developer who forgot a provider is told'],
  [/hooks\/useFetch\/useFetch\.tsx$|hooks\/useReqraftProperty\.ts$/, 'what a developer is told'],
];

/** Text in the sources that reads as words and is not: formats, CSS, code and units. */
const NOT_WORDS: RegExp[] = [
  /^ui-monospace/,
  /^to (bottom|right)/,
  /^no(opener|referrer)/,
  /^underline dotted/,
  /^1px (dashed|solid)/,
  /^textarea, input$/,
  /^\.options|^\.smart/,
  /^input\$/,
  /^%YAML/,
  /^@[a-z_]+ /, // an expression shown as an example
  /^(KiB|MiB)$/, // units
  /^Aa$/, // a glyph for "match case", whose words are its tooltip
  /^Table2$/, // an icon
  /^new_\$/, // a generated name
  /^readfirst-|^template\$/, // class names
  /^concat\(/,
  /^(\(pointer|\(max-width|\(prefers)/,
];

const LOOKS_LIKE_WORDS = (text: string): boolean => {
  const t = text.trim();
  const words = t.replace(/\$\{[^}]*\}/g, '').trim();
  return (
    // at least one word of two letters outside what is filled in, and two words or a capital
    /[A-Za-z]{2}/.test(words) &&
    (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(words) || /^[A-Z][a-z]/.test(words)) &&
    !/^(var\(|calc\(|min\(|rgba?\(|#[0-9a-f]+|[a-z-]+:|\.|\[|:scope)/.test(t) &&
    !/^[A-Z][a-z]+([A-Z][a-z0-9]+)+$/.test(t) &&
    !/^(Enter|Escape|Tab|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(t) &&
    !/Line$|Fill$/.test(t) &&
    !NOT_WORDS.some((re) => re.test(t))
  );
};

const TECHNICAL_ATTRIBUTE =
  /^(className|icon|leftIcon|rightIcon|intent|size|position|key|id|type|name|as|role|data-|href|target|effect|gapSize|verticalAlign|horizontalAlign|align|flexFlow|padded|color|style|customTheme|ref|tag|rel)/;
const TECHNICAL_PROPERTY =
  /^(icon|leftIcon|rightIcon|intent|size|position|key|id|type|kind|name|className|color|display|width|height|maxWidth|minWidth|cursor|overflow|flexFlow|flex|padding|margin|gap|align|textAlign|fontSize|whiteSpace|mode|variant|role|method|url|path|language|theme|status|source|ui_type|base_type|rightIconColor|leftIconColor|animation|background|border|interface_kind)$/;

export const wordsIn = (fileName: string, source: string): string[] => {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isTypeNode(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isTaggedTemplateExpression(node)
    ) {
      return;
    }
    if (ts.isCallExpression(node) && /^(console\.|useWhyDidYouUpdate)/.test(node.expression.getText())) {
      return;
    }
    if (ts.isBinaryExpression(node) && /^(===|!==|==|!=)$/.test(node.operatorToken.getText())) {
      visit(node.left.kind === ts.SyntaxKind.StringLiteral ? node.right : node.left);
      return;
    }
    if (ts.isCaseClause(node)) {
      node.statements.forEach(visit);
      return;
    }
    if (ts.isJsxAttribute(node) && TECHNICAL_ATTRIBUTE.test(node.name.getText())) {
      return;
    }
    if (
      ts.isPropertyAssignment(node) &&
      TECHNICAL_PROPERTY.test(node.name.getText().replace(/['"]/g, ''))
    ) {
      return;
    }
    let text: string | undefined;
    if (ts.isJsxText(node)) {
      text = node.getText();
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      text = node.text;
    } else if (ts.isTemplateExpression(node)) {
      text = node.getText().slice(1, -1);
    }
    if (text && LOOKS_LIKE_WORDS(text)) {
      found.push(text.trim().replace(/\s+/g, ' '));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path)
      : /\.tsx?$/.test(name) ? [path]
      : [];
  });

describe('every word has a label', () => {
  it('finds words where a label is missing', () => {
    expect(wordsIn('a.tsx', "const A = () => <b title='Not one of these'>Some words</b>;")).toEqual([
      'Not one of these',
      'Some words',
    ]);
    expect(wordsIn('a.ts', 'const a = `Row ${n} is empty`;')).toEqual(['Row ${n} is empty']);
    expect(wordsIn('a.ts', "const a = { label: 'Ready' };")).toEqual(['Ready']);
  });

  it('leaves what is no word: a class, an icon, a comparison', () => {
    expect(wordsIn('a.tsx', "const A = () => <b className='Not words here' icon='CheckLine' />;")).toEqual([]);
    expect(wordsIn('a.ts', "if (kind === 'Some Thing') { go(); }")).toEqual([]);
  });

  it('finds none in the sources but what is named above', () => {
    const left = sources(ROOT)
      .map((path) => relative(ROOT, path))
      .filter((path) => !NOT_THESE_WORDS.some(([re]) => re.test(path)))
      .flatMap((path) =>
        wordsIn(path, readFileSync(join(ROOT, path), 'utf8')).map((words) => `${path}: ${words}`)
      );
    expect(left).toEqual([]);
  });
});
