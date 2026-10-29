// Copyright 2026 Qore Technologies, s.r.o.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startCase } from 'lodash';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * qorus#646: reqraft is written in American English, as Qorus and the IDE are. The server's type catalogue says
 * "Color", and reqraft said "Colour" beside it; its texts said "centred", "labelled", "summarises", "catalogue" too.
 *
 * What is read is every text reqraft shows or documents: the prose of its sources - string literals, template
 * literals and JSX text with words in them, or one capitalized word (a label) - in its components, its stories and
 * their data (a story's description is read by people, and mock data is shown); the title of each story; and the
 * README. Code spans (`` `cancelled` ``), placeholders (`{count}`, `${value}`), URLs and words in capitals (a status
 * such as CANCELLED) are not prose, and identifiers, import paths and keys have no spaces, so they are not read.
 * Comments are not read, and nor are tests.
 *
 * The list of British spellings and these rules are the IDE's (qorus-ide __tests__/conventions/americanEnglish.test.ts),
 * so the two check the same words the same way: a word joined to a name - `x-`, `x_`, `x/`, `x.` or `x:` before it,
 * `_x`, `/x`, `.x` or `:x` after it - is part of the name, not prose. A spelling or a rule added to one is added to
 * the other.
 */
const root = join(__dirname, '..');

/** British spellings, each with its American one, with or without a prefix (unfavourited, reauthorise). */
const BRITISH: [RegExp, string][] = [
  [/\b(?:un|re|de|pre|dis)?colour(s|ed|ing|ful|less)?\b/i, 'color'],
  [/\b(?:un|re|de|pre|dis)?behaviour(s|al)?\b/i, 'behavior'],
  [/\b(?:un|re|de|pre|dis)?organis(e|es|ed|ing|er|ers|ation|ations)\b/i, 'organiz…'],
  [/\b(?:un|re|de|pre|dis)?centre(s|d)?\b|\bcentring\b/i, 'center'],
  [/\b(?:un|re|de|pre|dis)?licences?\b/i, 'license (the noun too)'],
  [/\b(?:un|re|de|pre|dis)?favour(s|ed|ing|ite|ites|ited|iting|able)?\b/i, 'favor'],
  [/\b(?:un|re|de|pre|dis)?honour(s|ed|ing)?\b/i, 'honor'],
  [/\b(?:un|re|de|pre|dis)?catalogue(s|d)?\b/i, 'catalog'],
  [/\b(?:un|re|de|pre|dis)?cancell(ed|ing)\b/i, 'canceled, canceling'],
  [/\b(?:un|re|de|pre|dis)?(labour|neighbour|flavour|humour|harbour)(s|ed|ing|hood)?\b/i, '-or'],
  [/\b(?:un|re|de|pre|dis)?analys(e|ed|ing)\b/i, 'analyz…'],
  [
    /\b(?:un|re|de|pre|dis)?(normal|summar|recogn|priorit|initial|final|custom|optim|serial|author|util|visual|synchron|categor|standard|local|real|emphas|minim|maxim|capital|character|special|memor|sanit|token|parameter|material|apolog)is(e|es|ed|ing|ation|ations|able|er|ers)\b/i,
    '-ize, -ization',
  ],
  [/\b(?:un|re|de|pre|dis)?grey(s|ed|ing)?\b/i, 'gray'],
  [/\b(?:un|re|de|pre|dis)?(defence|offence)\b/i, 'defense, offense'],
  [
    /\b(?:un|re|de|pre|dis)?(travell|modell|labell|signall|levell|totall|fuell|marshall|channell)(ed|ing|er|ers)\b/i,
    'one l',
  ],
  [/\b(?:un|re|de|pre|dis)?enrolment\b|\bfulfil(s|ment)?\b/i, 'enrollment, fulfill'],
  [/\b(?:un|re|de|pre|dis)?(learnt|spelt)\b/i, 'learned, spelled'],
  [/\b(?:un|re|de|pre|dis)?(metre|litre|fibre)s?\b/i, '-er'],
  [/\b(?:un|re|de|pre|dis)?artefacts?\b/i, 'artifact'],
  [/\b(?:un|re|de|pre|dis)?focuss(ed|ing)\b/i, 'focused'],
  [/\b(?:un|re|de|pre|dis)?enquir(y|ies)\b/i, 'inquiry'],
  [
    /\b(?:un|re|de|pre|dis)?(skilful|manoeuvr\w*|sceptic\w*|whilst|programmes?)\b/i,
    'skillful, maneuver, skeptic, while, program',
  ],
];

/** Code spans, placeholders, interpolations and URLs: not prose. */
const prose = (text: string): string =>
  text
    .replace(/\\?`[^`]*\\?`/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');

/** The British spellings in `text`, as written. */
const britishIn = (text: string): string[] => {
  const words = prose(text);
  return BRITISH.flatMap(([pattern]) =>
    [...words.matchAll(new RegExp(pattern.source, 'gi'))]
      // a word in capitals is a name Qorus gives (a status such as CANCELLED), not prose
      .filter(([word]) => word !== word.toUpperCase())
      // a word joined to the one before it, or to a path or key after it, is part of a name:
      // `order-fulfilment:1.3`, `$sysinfo:licence.routing`, `catalogue.ts`
      .filter((match) => {
        const before = words.slice(Math.max(0, match.index - 2), match.index);
        const after = words.slice(match.index + match[0].length, match.index + match[0].length + 2);
        return !/[\w$][-_/.:]$/.test(before) && !/^[_/.:][\w$]/.test(after);
      })
      .map(([word]) => word)
  );
};

/** Words with a space between them, or one capitalized word - a label; a key is neither. */
const isProse = (text: string): boolean => {
  const trimmed = text.trim();
  return (/\s/.test(trimmed) && /[a-z]/.test(trimmed)) || /^[A-Z][a-z]+$/.test(trimmed);
};

/** Every TypeScript source under a directory, relative to the root, tests left out. */
const sourcesUnder = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourcesUnder(join(dir, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)]
    : []
  );

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

/** Each prose text of a source - string, template and JSX text - with its line. */
const proseOf = (file: string): { line: number; text: string }[] => {
  const source = parse(file);
  const found: { line: number; text: string }[] = [];
  const add = (text: string, node: ts.Node) => {
    if (isProse(text)) {
      found.push({
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        text,
      });
    }
  };
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      add(node.text, node);
    } else if (ts.isTemplateExpression(node)) {
      add(
        [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ${} '),
        node
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/**
 * The words Storybook shows for each story a stories file exports: the export's name split into its words, as
 * Storybook's `storyNameFromExport` does (lodash's `startCase`). A story that gives its own `name` is shown by it
 * instead - a string, which the prose check reads - so it is left out here (`{ ... } as Story` and
 * `{ ... } satisfies Story` are the story object too). Read as the IDE reads its own (qorus-ide bb11c267c).
 */
const storyNamesIn = (code: string): string[] => {
  const names: string[] = [];
  const source = ts.createSourceFile(
    'story.tsx',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }
      let init = declaration.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) {
        init = init.expression;
      }
      const named =
        !!init &&
        ts.isObjectLiteralExpression(init) &&
        init.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'name'
        );
      if (!named) {
        names.push(storyNameFromExport(declaration.name.text));
      }
    }
  }
  return names;
};

const storyNamesOf = (file: string): string[] =>
  storyNamesIn(readFileSync(join(root, file), 'utf8'));

/** A story export's name as Storybook shows it (`storyNameFromExport` is lodash's `startCase`):
 *  `UnlabeledServiceOnAPhone` is "Unlabeled Service On A Phone". */
const storyNameFromExport = (exported: string): string => startCase(exported);

describe('reqraft writes American English', () => {
  it('in the prose of its sources, its stories and their data', () => {
    const offences = sourcesUnder('src').flatMap((file) =>
      proseOf(file)
        .filter(({ text }) => britishIn(text).length)
        .map(({ line, text }) => `${file}:${line}: ${britishIn(text).join(', ')}`)
    );
    expect(offences).toEqual([]);
  });

  it('in the names Storybook shows for its stories', () => {
    const offences = sourcesUnder('src')
      .filter((file) => /\.stories\.tsx?$/.test(file))
      .flatMap((file) =>
        storyNamesOf(file)
          .filter((name) => britishIn(name).length)
          .map((name) => `${file}: "${name}": ${britishIn(name).join(', ')}`)
      );
    expect(offences).toEqual([]);
  });

  it('in its README', () => {
    const offences = readFileSync(join(root, 'README.md'), 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        britishIn(line).length ? [`README.md:${index + 1}: ${britishIn(line).join(', ')}`] : []
      );
    expect(offences).toEqual([]);
  });

  // the reader reads what it should: a text it skipped would pass the tests above for the wrong reason
  it('reads strings, templates, JSX text and story titles', () => {
    expect(proseOf('src/components/colorValue/labels.ts').map(({ text }) => text)).toContain(
      'No color'
    );
    expect(storyNamesOf('src/components/colorValue/ColorValue.stories.tsx')).toContain(
      'Not A Color'
    );
    // a story that gives its own name is shown by it: a string the prose check reads, not its export
    expect(storyNamesOf('src/components/form/engine/FormEngine.stories.tsx')).not.toContain(
      'Compact Expression Without Catalogue'
    );
    expect(
      proseOf('src/components/form/engine/FormEngine.stories.tsx').map(({ text }) => text)
    ).toContain('Compact Expression Without Catalog');
  });

  it('reads a story export as the words Storybook shows for it', () => {
    expect(storyNameFromExport('UnlabelledServiceOnAPhone')).toBe('Unlabelled Service On A Phone');
    expect(storyNameFromExport('FxModeRail')).toBe('Fx Mode Rail');
    expect(storyNameFromExport('Oauth2Tab')).toBe('Oauth 2 Tab');
    expect(storyNameFromExport('CsvUtf16Only')).toBe('Csv Utf 16 Only');
    expect(
      storyNamesIn(
        [
          'export const LargeFileCheckCancelled: Story = { args: {} };',
          'export const AllLabelled = { args: {} } as Story;',
          "export const Shown = { name: 'Shown by its name', args: {} } satisfies Story;",
          'const NotAStory = {};',
        ].join('\n')
      )
    ).toEqual(['Large File Check Cancelled', 'All Labelled']);
    expect(britishIn(storyNameFromExport('AppNotInCatalogue'))).toEqual(['Catalogue']);
    expect(britishIn(storyNameFromExport('TerminalCancelled'))).toEqual(['Cancelled']);
  });

  it('catches each spelling, and leaves code, placeholders and identifiers alone', () => {
    expect(britishIn('Pick a colour, then save the favourite one')).toEqual([
      'colour',
      'favourite',
    ]);
    expect(britishIn('Reauthorise it, or leave it unfavourited and unlabelled')).toEqual([
      'unfavourited',
      'Reauthorise',
      'unlabelled',
    ]);
    expect(britishIn('The run was cancelled and its behaviour normalised')).toEqual([
      'behaviour',
      'cancelled',
      'normalised',
    ]);
    expect(britishIn('Centred on a grey row, the catalogue summarises it')).toEqual([
      'Centred',
      'catalogue',
      'summarises',
      'grey',
    ]);
    expect(
      britishIn(
        'The status `cancelled` is {cancelled}, or CANCELLED: see https://example.com/catalogue'
      )
    ).toEqual([]);
    // a word joined into a name, a key or a path
    expect(
      britishIn(
        'the workflow order-fulfilment:1.3, key $sysinfo:licence.routing, file catalogue.ts'
      )
    ).toEqual([]);
    // joined after a name, or before a key or a path: x-, x_, x/, x., x: before it, _x, /x, .x, :x after it
    expect(
      britishIn(
        'data-colour, my_colour, a/colour, a.colour, ns:colour, colour_x, colour/x, colour.x, colour:x'
      )
    ).toEqual([]);
    // a word that ends a sentence, or has a dash after it, is still prose
    expect(britishIn('Pick a colour. A colour-blind reader')).toEqual(['colour', 'colour']);
    // words that only look British
    expect(
      britishIn('characteristics of an organism, a specialist realist, the cancellation')
    ).toEqual([]);
    expect(isProse('catalogue')).toBe(false);
    expect(isProse('Catalogue')).toBe(true);
  });
});
