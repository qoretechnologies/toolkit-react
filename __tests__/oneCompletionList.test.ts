// Copyright 2026 Qore Technologies, s.r.o.
// A field offers what can be written in one popover (qorus#646, David's decisions): the rows typing opens at the
// caret (`CompletionList`), and the template picker (`TemplatePicker`) that browses a field's templates as they
// nest - opened in the same popover by a click in an empty text, a chip, a group's row, and from a template control
// (`TemplateBrowser`, whose dropdown is only the picker's popover). Reqore's own lists list templates nowhere: no
// rich-text editor is given a template list (`tags`), and no dropdown templates as its items. This test fails when
// one comes back.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');

/** Every source file, without the stories and tests. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\.tsx?$/.test(name) ? [path] : [];
  });

/** The props of each `<Name ...>` in a file: its opening tag, read to the `>` outside any `{...}`. */
const openingTags = (text: string, name: string): string[] => {
  const tags: string[] = [];
  const pattern = new RegExp(`<${name}\\b`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    let depth = 0;
    let at = match.index + match[0].length;
    for (; at < text.length; at++) {
      const char = text[at];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === '>' && depth === 0) break;
    }
    tags.push(text.slice(match.index, at + 1));
  }
  return tags;
};

/** The template control: a Reqore dropdown whose popover is the template picker, and lists no items of its own. */
const TEMPLATE_BROWSER = 'components/form/fields/template/TemplateBrowser.tsx';

/** The editor that passes a caller's `tags` on, for a host that is not a template list (Qonsole's input). */
const TAGS_PASSED_THROUGH = new Set(['components/smartEditor/SmartEditor.tsx']);

/** The Reqore dropdowns that list something else than templates, and what. */
const DROPDOWNS_THAT_ARE_NOT_TEMPLATE_LISTS: Record<string, string> = {
  'components/ticketReferences/TicketReferences.tsx': "a screenshot's actions",
  'components/searchFilterBar/SearchFilterBar.tsx': "a filter's values",
  'components/form/expressions/builder/moveToPositionStrip.tsx': "an operand's positions",
  'components/form/expressions/builder/argumentWrapper.tsx': "an operand's positions",
  'components/form/fields/select/Select.tsx': "a select's allowed values",
  'components/form/engine/CompactToolbar.tsx': "the form's fields to show",
  'components/form/engine/CompactRow.tsx': "a row's actions, and a required group's choices",
  'components/composer/Composer.tsx': "the composer's attachments and send actions",
};

describe('a field offers its templates in the completion list or the browse list', () => {
  const files = sources(SRC).map((path) => ({
    path: relative(SRC, path),
    text: readFileSync(path, 'utf8'),
  }));

  it('gives a Reqore rich-text editor no template list: the picker offers them', () => {
    const offending = files.flatMap(({ path, text }) =>
      openingTags(text, 'ReqoreRichTextEditor')
        .filter((tag) => /\stags=\{/.test(tag) && !TAGS_PASSED_THROUGH.has(path))
        .map(() => path)
    );
    expect(offending).toEqual([]);
  });

  it('builds no Reqore template list for an editor', () => {
    const builders = files
      .filter(
        ({ path, text }) => /\buseTemplateTags\(/.test(text) && !path.endsWith('useTemplateTags.ts')
      )
      .map(({ path }) => path);
    expect(builders).toEqual([]);
  });

  it('never gives a Reqore textarea, input or dropdown templates to list', () => {
    const offending = files.flatMap(({ path, text }) =>
      ['ReqoreTextarea', 'ReqoreInput', 'ReqoreDropdown'].flatMap((name) =>
        openingTags(text, name)
          .filter((tag) => /\stemplates=\{/.test(tag))
          .map(() => `${path}: ${name}`)
      )
    );
    expect(offending).toEqual([]);
  });

  it('has no Reqore dropdown but the browse list and those known to list something else', () => {
    const unknown = files
      .filter(({ text }) => openingTags(text, 'ReqoreDropdown').length)
      .map(({ path }) => path)
      .filter(
        (path) => path !== TEMPLATE_BROWSER && !(path in DROPDOWNS_THAT_ARE_NOT_TEMPLATE_LISTS)
      );
    expect(unknown).toEqual([]);
  });

  it("browses templates in the template picker, the template control's dropdown listing no items of its own", () => {
    const browser = files.find(({ path }) => path === TEMPLATE_BROWSER)?.text ?? '';
    const [dropdown, ...others] = openingTags(browser, 'ReqoreDropdown');
    expect(others).toHaveLength(0);
    expect(dropdown).toMatch(/\sitems=\{\[\]\}/);
    expect(browser).toMatch(/<TemplatePicker\b/);
  });

  it('opens the template picker in the popover the rows are drawn in', () => {
    const menu =
      files.find(({ path }) => path === 'components/smartEditor/CompletionMenu.tsx')?.text ?? '';
    expect(menu).toMatch(/<TemplatePicker\b/);
  });

  it('reads an opening tag to its end, past the `=>` of a prop', () => {
    const [tag] = openingTags(
      '<ReqoreDropdown onClick={() => go()} items={list} />',
      'ReqoreDropdown'
    );
    expect(tag).toContain('items={list}');
  });
});
