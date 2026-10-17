// Copyright 2026 Qore Technologies, s.r.o.
// A field offers what can be written in two lists, and only two (qorus#646, David): the completion list typing
// opens (`CompletionList`), and the list its templates are browsed in (`TemplateBrowser`, and an editor's own
// browse list built by `useTemplateTags`) - kept apart because a large catalogue needs its hierarchy. Both are
// drawn alike (`completionStyle`). Reqore's dropdown lists templates nowhere else: this test fails when one
// comes back.
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

/**
 * The one place a Reqore dropdown lists templates: the browse list, by David's decision ("some templates can be
 * large; we need to keep the hierarchical view"). It is drawn as the completion list is.
 */
const TEMPLATE_BROWSER = 'components/form/fields/template/TemplateBrowser.tsx';

/** Editors handed the browse list by a caller, and the caller that builds it with `useTemplateTags`. */
const BROWSE_LIST_PASSED_THROUGH: Record<string, string> = {
  'components/smartEditor/SmartEditor.tsx': 'components/dpqlEditor/DpqlEditor.tsx',
};

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

  it("gives a Reqore rich-text editor no template list but the browse list's own", () => {
    const offending = files.flatMap(({ path, text }) =>
      openingTags(text, 'ReqoreRichTextEditor')
        .filter((tag) => /\stags=\{/.test(tag))
        // the browse list: `tags` built by `useTemplateTags`, drawn as the completion list
        .filter(
          (tag) =>
            !(
              /\stags=\{tags\}/.test(tag) &&
              (/\buseTemplateTags\(/.test(text) || path in BROWSE_LIST_PASSED_THROUGH)
            )
        )
        .map(() => path)
    );
    expect(offending).toEqual([]);
  });

  it('passes an editor the browse list built by useTemplateTags, and no other', () => {
    for (const [editor, builtBy] of Object.entries(BROWSE_LIST_PASSED_THROUGH)) {
      const builder = files.find(({ path }) => path === builtBy)?.text ?? '';
      expect(builder, `${editor}'s browse list, built by ${builtBy}`).toMatch(/useTemplateTags\(/);
    }
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

  it('browses templates with the browse list, drawn as the completion list', () => {
    const browser = files.find(({ path }) => path === TEMPLATE_BROWSER)?.text ?? '';
    expect(openingTags(browser, 'ReqoreDropdown')).toHaveLength(1);
    expect(browser).toMatch(/styleTemplateItems\(/);
    expect(browser).toMatch(/TEMPLATE_BROWSE_LIST_PROPS/);
  });

  it('reads an opening tag to its end, past the `=>` of a prop', () => {
    const [tag] = openingTags(
      '<ReqoreDropdown onClick={() => go()} items={list} />',
      'ReqoreDropdown'
    );
    expect(tag).toContain('items={list}');
  });
});
