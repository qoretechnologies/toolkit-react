import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

/**
 * Every package the published build imports must be one a consumer installs.
 *
 * A package that is only a devDependency, or not declared at all, still
 * resolves here — and in a consumer too, as long as something else happens to
 * hoist a copy. `StorageContext.d.ts` imports `Get` from `type-fest`, which was
 * only a devDependency: the IDE resolved the `type-fest@0.20.2` another package
 * hoisted, which has no `Get`. The editors import `slate`, `slate-react` and
 * `slate-history`, which were not declared at all and resolved only through
 * reqore's own dependencies.
 *
 * The files checked are the ones `tsconfig.prod.json` builds into `dist` —
 * its roots and everything they import, since `exclude` does not stop tsc
 * compiling an excluded file that an included one imports. That is how the
 * story LSP harness (`__fixtures__/mockLspServer.ts`, which imports the
 * dev-only `mock-socket`) and `src/stories/storyNetwork.ts` were published.
 */
const root = path.resolve(__dirname, '..');

/** Every source file the production build compiles, relative to the root. */
const publishedFiles = (): string[] => {
  const configPath = path.join(root, 'tsconfig.prod.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
  return ts
    .createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
    .getSourceFiles()
    .filter((file) => !file.isDeclarationFile && !file.fileName.includes('/node_modules/'))
    .map((file) => path.relative(root, file.fileName));
};

/** `@scope/name/deep/path` → `@scope/name`; `name/deep` → `name`. */
const packageOf = (specifier: string): string => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const isBare = (specifier: string): boolean =>
  !specifier.startsWith('.') && !specifier.startsWith('/');

const isBuiltin = (specifier: string): boolean =>
  specifier.startsWith('node:') || builtinModules.includes(packageOf(specifier));

/** The packages a published file imports, statically or dynamically. */
const importsOf = (file: string): string[] =>
  ts
    .preProcessFile(readFileSync(path.join(root, file), 'utf8'), true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => isBare(specifier) && !isBuiltin(specifier))
    .map(packageOf);

describe('the published build', () => {
  it('builds at least the entry point', () => {
    // Guards the check below against passing because it read no files.
    expect(publishedFiles()).toContain('src/index.tsx');
  });

  it('ships no story or test support', () => {
    const support = publishedFiles().filter((file) =>
      /(^|\/)(__fixtures__|__tests__|stories)\/|\.(stories|test)\.tsx?$|Mock(Lsp|Language)\.ts$/.test(
        file
      )
    );

    expect(support).toEqual([]);
  });

  it('imports only packages a consumer installs with reqraft', () => {
    const installed = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
    const undeclared: Record<string, string[]> = {};
    for (const file of publishedFiles()) {
      for (const name of importsOf(file)) {
        if (!installed.has(name)) {
          (undeclared[name] ??= []).push(file);
        }
      }
    }

    expect(undeclared).toEqual({});
  });

  it('declares a shared editor package with the range reqore installs', () => {
    /* slate keeps per-editor state in module-level WeakMaps, so reqraft's
       editors and reqore's must load one copy; the same range lets the
       package manager install it once. */
    const reqore = JSON.parse(
      readFileSync(path.join(root, 'node_modules/@qoretechnologies/reqore/package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    const deps = pkg.dependencies as Record<string, string>;

    for (const name of ['slate', 'slate-history', 'slate-react']) {
      expect({ name, range: deps[name] }).toEqual({
        name,
        range: reqore.dependencies?.[name],
      });
    }
  });
});
