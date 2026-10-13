// Copyright 2026 Qore Technologies, s.r.o.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * qorus#646: the product speaks American English, and so does the server: "Color", "a color". reqraft said
 * "Colour" - the color field's labels and help ("Chosen colour", "No colour chosen yet"), ReqraftColorValue's texts
 * ("Not a colour", "No colour", "Colour #6495ED"), its stories and its README - beside the server's "Color".
 *
 * Every text reqraft shows or documents is read here: each string, template and JSX text in its source, the name of
 * each story, and the README. Code identifiers are not words a reader sees, so they are not read.
 */
const root = join(__dirname, '..');
const BRITISH = /colour/i;

/** Every TypeScript file under a directory, relative to the root. */
const filesUnder = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)]
    : []
  );

const sourceFiles = (): string[] => filesUnder('src');

/** Each text in a source file that a reader sees: strings, templates and JSX text, with its line. */
const textsOf = (file: string): { line: number; text: string }[] => {
  const text = readFileSync(join(root, file), 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push({
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        text: node.getText(source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/** The stories a story file exports: their names are the stories' titles. */
const storyNamesOf = (file: string): string[] =>
  [...readFileSync(join(root, file), 'utf8').matchAll(/^export const (\w+)/gm)].map(
    ([, name]) => name
  );

describe('reqraft speaks American English', () => {
  it('in every text its source shows a reader', () => {
    const british = sourceFiles().flatMap((file) =>
      textsOf(file)
        .filter(({ text }) => BRITISH.test(text))
        .map(({ line, text }) => `${file}:${line}: ${text.slice(0, 80)}`)
    );
    expect(british).toEqual([]);
  });

  it('in the names of its stories', () => {
    const british = sourceFiles()
      .filter((file) => file.endsWith('.stories.tsx'))
      .flatMap((file) =>
        storyNamesOf(file)
          .filter((name) => BRITISH.test(name))
          .map((name) => `${file}: ${name}`)
      );
    expect(british).toEqual([]);
  });

  it('in its README', () => {
    const british = readFileSync(join(root, 'README.md'), 'utf8')
      .split('\n')
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter(({ text }) => BRITISH.test(text))
      .map(({ line, text }) => `README.md:${line}: ${text.slice(0, 80)}`);
    expect(british).toEqual([]);
  });

  // the reader reads what it should: a text it skipped would pass the tests above for the wrong reason
  it('reads strings, templates and JSX text, and not identifiers', () => {
    const texts = textsOf('src/components/colorValue/labels.ts').map(({ text }) => text);
    expect(texts.some((text) => text.includes('Not a color'))).toBe(true);
    expect(texts.some((text) => text.includes('No color'))).toBe(true);
    expect(storyNamesOf('src/components/colorValue/ColorValue.stories.tsx')).toContain('NotAColor');
  });
});
