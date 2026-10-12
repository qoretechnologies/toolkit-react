// Copyright 2026 Qore Technologies, s.r.o.
import { createElement, ReactNode } from 'react';

/**
 * Markdown as the text it renders to: the words, without the marks.
 *
 * A description from the server is markdown. Where the host supplies a renderer, it draws it; where none is
 * supplied, reqraft does not draw it in a dialect of its own, but it does not print its punctuation either: a
 * card that read "The **customer's** full name, from `customer.name`" showed the reader the marks the list beside
 * it did not. This is what such a place shows instead.
 *
 * Deliberately not a markdown parser. The inline rules are CommonMark-shaped on purpose, because the naive
 * versions corrupt exactly the text these descriptions are full of: `(\*|_)(.*?)\1` turns "2 * 3 * 4 items" into
 * "2 3 4 items" and `retry_count_max` into `retrycountmax`. Emphasis delimiters have to hug the text they wrap,
 * and an underscore must not be intraword, or an option key loses its underscores.
 */
const stripInline = (text: string): string =>
  text
    // images before links - an image's `!` prefix would otherwise survive
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // autolinks: <https://example.com> -> https://example.com
    .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
    .replace(/(\*\*\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(___)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/(\*\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(__)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/(\*)(?=\S)([\s\S]+?)(?<=\S)\1/g, '$2')
    .replace(/(?<![A-Za-z0-9])(_)(?=\S)([\s\S]+?)(?<=\S)\1(?![A-Za-z0-9])/g, '$2')
    .replace(/~~(?=\S)([\s\S]+?)(?<=\S)~~/g, '$1')
    // inline code spans
    .replace(/`+([^`]+)`+/g, '$1');

/** A line's block marker: a heading's hashes, a quote's caret, a list item's bullet or number. */
const BLOCK_MARKER = /^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/;
/** A list item's own marker, which keeps it on a line of its own. */
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+/;
/** A setext underline or a thematic break: no words. */
const RULE = /^\s{0,3}(?:={2,}|-{2,}|\*{3,}|_{3,})\s*$/;

/**
 * Markdown as plain text: its words, with no marks, a blank line between its paragraphs and a line of its own for
 * each list item. A fenced code block keeps its lines. Empty for anything but a string.
 */
export const markdownToPlainText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const paragraphs: string[] = [];
  for (const block of value.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const fenced = /^\s{0,3}```[^\n]*\n([\s\S]*?)\n?\s{0,3}```\s*$/.exec(block);
    if (fenced) {
      paragraphs.push(fenced[1]);
      continue;
    }
    const lines: string[] = [];
    for (const line of block.split('\n')) {
      if (RULE.test(line)) {
        continue;
      }
      const text = stripInline(line.replace(BLOCK_MARKER, '')).replace(/\s+/g, ' ').trim();
      if (!text) {
        continue;
      }
      // a list item starts a line; any other line continues the one before, as markdown joins them
      if (LIST_ITEM.test(line) || !lines.length) {
        lines.push(text);
      } else {
        lines[lines.length - 1] += ` ${text}`;
      }
    }
    if (lines.length) {
      paragraphs.push(lines.join('\n'));
    }
  }
  return paragraphs.join('\n\n');
};

/** Markdown as prose on one line: `markdownToPlainText` with its breaks run together. */
export const markdownToProse = (value: unknown): string =>
  markdownToPlainText(value).replace(/\s+/g, ' ').trim();

/**
 * Markdown as plain text to show: the text alone when it is one line, or a block that keeps its paragraph and
 * line breaks (`white-space: pre-line`) when it has more.
 */
export const plainTextNode = (value: unknown): ReactNode => {
  const text = markdownToPlainText(value);
  return text.includes('\n') ?
      createElement(
        'div',
        { className: 'reqraft-plain-description', style: { whiteSpace: 'pre-line' } },
        text
      )
    : text;
};
