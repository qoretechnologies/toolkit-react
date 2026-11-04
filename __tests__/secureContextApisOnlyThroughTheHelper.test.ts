// Copyright 2026 Qore Technologies, s.r.o.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * `navigator.clipboard`, `crypto.randomUUID` and `crypto.subtle` exist only in a secure context (https, or
 * localhost). On a page served over plain http they are undefined, and reqraft's copy buttons, which called
 * `navigator.clipboard.writeText` directly, threw instead of copying, one of them without a word to the user.
 *
 * Reqraft uses them only through `src/helpers/secureContextApis.ts` (`copyText`, `randomUuid`), which says what to do
 * where they do not exist. This test reads every source in `src/` - components, helpers, stories - and fails on a
 * use anywhere else. A use is code, not a mention: comments and strings are not read.
 */
const root = join(__dirname, '..');

/** Where the APIs may be used, and why. */
const ALLOWED: Record<string, string> = {
  'src/helpers/secureContextApis.ts': 'the helper itself',
  'src/tracking/core/ids.ts':
    'the UUID the helper re-exports as `randomUuid`: the tracking module imports nothing outside src/tracking/',
};

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sources(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });

/** The name an expression ends in: `navigator` for `navigator`, `window.navigator` and `globalThis.navigator`. */
const lastName = (node: ts.Expression): string | undefined => {
  const inner =
    ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) ? node.expression : node;
  if (ts.isIdentifier(inner)) {
    return inner.text;
  }
  if (ts.isPropertyAccessExpression(inner)) {
    return inner.name.text;
  }
  if (ts.isElementAccessExpression(inner) && ts.isStringLiteralLike(inner.argumentExpression)) {
    return inner.argumentExpression.text;
  }
  return undefined;
};

/** Each secure-context API, by the object it is read from and its name. */
const API: { owner: string; name: string; use: string }[] = [
  { owner: 'navigator', name: 'clipboard', use: 'copyText' },
  { owner: 'crypto', name: 'randomUUID', use: 'randomUuid' },
  { owner: 'crypto', name: 'subtle', use: 'a fallback in src/helpers/secureContextApis.ts' },
];

const apiOf = (owner: string | undefined, name: string | undefined) =>
  API.find((api) => api.name === name && api.owner === owner);

/** Every use of a secure-context API in `text`, as `line: what` with what to use instead. */
const secureContextUses = (text: string, fileName = 'source.tsx'): string[] => {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const found: string[] = [];
  const report = (node: ts.Node, api: { owner: string; name: string; use: string }) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push(`${line + 1}: ${api.owner}.${api.name} (use ${api.use})`);
  };
  const visit = (node: ts.Node) => {
    // navigator.clipboard, navigator?.clipboard, window.navigator.clipboard, crypto.randomUUID, …
    if (ts.isPropertyAccessExpression(node)) {
      const api = apiOf(lastName(node.expression), node.name.text);
      if (api) {
        report(node, api);
      }
    }
    // navigator['clipboard']
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      const api = apiOf(lastName(node.expression), node.argumentExpression.text);
      if (api) {
        report(node, api);
      }
    }
    // const { clipboard } = navigator; const { randomUUID: uuid } = crypto
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectBindingPattern(node.name)
    ) {
      const owner = lastName(node.initializer);
      for (const element of node.name.elements) {
        const key = element.propertyName ?? element.name;
        const name = ts.isIdentifier(key) || ts.isStringLiteralLike(key) ? key.text : undefined;
        const api = apiOf(owner, name);
        if (api) {
          report(element, api);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe('secure-context APIs are used only through src/helpers/secureContextApis.ts', () => {
  it('finds no use outside the helper anywhere in src/', () => {
    const files = sources(join(root, 'src'));
    expect(files.length).toBeGreaterThan(100);
    const uses = files.flatMap((file) => {
      const path = relative(root, file).split('\\').join('/');
      if (ALLOWED[path]) {
        return [];
      }
      return secureContextUses(readFileSync(file, 'utf8'), path).map((use) => `${path}:${use}`);
    });
    expect(uses).toEqual([]);
  });

  it('allows only files that exist and use the APIs', () => {
    for (const path of Object.keys(ALLOWED)) {
      expect([
        path,
        secureContextUses(readFileSync(join(root, path), 'utf8'), path).length > 0,
      ]).toEqual([path, true]);
    }
  });

  describe('what it finds', () => {
    it.each([
      ['navigator.clipboard.writeText(text);', 'navigator.clipboard'],
      ['await navigator?.clipboard?.writeText(text);', 'navigator.clipboard'],
      ['window.navigator.clipboard.writeText(text);', 'navigator.clipboard'],
      ['globalThis.navigator.clipboard.readText();', 'navigator.clipboard'],
      ["navigator['clipboard'].writeText(text);", 'navigator.clipboard'],
      ['const { clipboard } = navigator;', 'navigator.clipboard'],
      ['const { clipboard: board } = window.navigator;', 'navigator.clipboard'],
      ['const id = crypto.randomUUID();', 'crypto.randomUUID'],
      ['const id = globalThis.crypto?.randomUUID();', 'crypto.randomUUID'],
      ['const id = window.crypto.randomUUID();', 'crypto.randomUUID'],
      ['const { randomUUID } = crypto;', 'crypto.randomUUID'],
      ["const digest = await crypto.subtle.digest('SHA-256', data);", 'crypto.subtle'],
      ['const key = await window.crypto.subtle.importKey(...args);', 'crypto.subtle'],
      [
        'const Copy = () => <button onClick={() => navigator.clipboard.writeText(v)} />;',
        'navigator.clipboard',
      ],
    ])('%s', (code, api) => {
      const uses = secureContextUses(code);
      expect(uses).toHaveLength(1);
      expect(uses[0]).toContain(api);
    });

    it('reports the line of each use', () => {
      expect(secureContextUses('const a = 1;\n\nnavigator.clipboard.writeText(a);')).toEqual([
        '3: navigator.clipboard (use copyText)',
      ]);
    });

    it.each([
      ['// navigator.clipboard.writeText(text) needs a secure context'],
      ["const reason = 'navigator.clipboard is undefined over plain http';"],
      ['const images = event.clipboardData.files;'],
      ["Object.defineProperty(navigator, 'clipboard', { value: undefined });"],
      ['crypto.getRandomValues(new Uint8Array(16));'],
      ['const theme = { subtle: true }; theme.subtle;'],
      ['await copyText(text);'],
      ['const id = randomUuid();'],
    ])('not: %s', (code) => {
      expect(secureContextUses(code)).toEqual([]);
    });
  });
});
