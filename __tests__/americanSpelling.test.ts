// Copyright 2026 Qore Technologies, s.r.o.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

/** The title of each story a story file exports: its `name`, or its export name in words, as Storybook says it. */
const storyTitlesOf = (file: string): string[] => {
  const titles: string[] = [];
  for (const statement of parse(file).statements) {
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
      const name =
        declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer) ?
          declaration.initializer.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === 'name' &&
              ts.isStringLiteral(property.initializer)
          )
        : undefined;
      titles.push(
        name ?
          (name.initializer as ts.StringLiteral).text
        : declaration.name.text
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      );
    }
  }
  return titles;
};

describe('reqraft writes American English', () => {
  it('in the prose of its sources, its stories and their data', () => {
    const offences = sourcesUnder('src').flatMap((file) =>
      proseOf(file)
        .filter(({ text }) => britishIn(text).length)
        .map(({ line, text }) => `${file}:${line}: ${britishIn(text).join(', ')}`)
    );
    expect(offences).toEqual([]);
  });

  it('in the titles of its stories', () => {
    const offences = sourcesUnder('src')
      .filter((file) => file.endsWith('.stories.tsx'))
      .flatMap((file) =>
        storyTitlesOf(file)
          .filter((title) => britishIn(title).length)
          .map((title) => `${file}: ${title}`)
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
    expect(storyTitlesOf('src/components/colorValue/ColorValue.stories.tsx')).toContain(
      'Not A Color'
    );
    expect(storyTitlesOf('src/components/form/engine/FormEngine.stories.tsx')).toContain(
      'Compact Expression Without Catalog'
    );
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
