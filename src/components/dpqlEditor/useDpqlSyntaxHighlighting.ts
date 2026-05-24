// Copyright 2026 Qore Technologies, s.r.o.
// Slate `decorate` function for DPQL syntax highlighting. Returns ranges
// with token-type properties that `customRenderLeaf` colors.

import { useCallback } from 'react';
import { NodeEntry, Range, Text } from 'slate';

// DPQL keywords (case-insensitive).
const KEYWORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'in', 'like',
  'is', 'null', 'order', 'by', 'asc', 'desc', 'limit', 'offset',
  'group', 'having', 'as', 'join', 'on', 'left', 'right', 'inner',
  'outer', 'cross', 'insert', 'into', 'values', 'update', 'set',
  'delete', 'create', 'drop', 'alter', 'table', 'index',
  'between', 'exists', 'distinct', 'case', 'when', 'then',
  'else', 'end', 'union', 'all',
]);

// DPQL built-in functions.
const FUNCTIONS = new Set([
  'count', 'sum', 'avg', 'min', 'max',
  'contains', 'substr', 'upper', 'lower', 'trim', 'length',
  'coalesce', 'cast', 'abs', 'round', 'floor', 'ceil',
  'now', 'date', 'year', 'month', 'day',
  'concat', 'replace', 'substring', 'position',
]);

// Booleans.
const BOOLEANS = new Set(['true', 'false']);

// Single combined regex for performance — each alternation produces a
// decoration type via match[1]..[7].
const TOKEN_REGEX = new RegExp(
  [
    `(--[^\\n]*)`,                       // line comment
    `(/\\*[\\s\\S]*?\\*/)`,              // block comment
    `("(?:[^"\\\\]|\\\\.)*")`,           // double-quoted string
    `('(?:[^'\\\\]|\\\\.)*')`,           // single-quoted string
    `(\\b\\d+(?:\\.\\d+)?\\b)`,          // number
    `(!=|<>|<=|>=|\\|\\||[=<>+\\-*/%])`, // operator
    `(\\b[a-zA-Z_]\\w*\\b)`,            // identifier (keyword/function/boolean check)
  ].join('|'),
  'g'
);

interface IDecoration extends Range {
  keyword?: boolean;
  string?: boolean;
  number?: boolean;
  operator?: boolean;
  comment?: boolean;
  function?: boolean;
  boolean?: boolean;
}

/**
 * Returns a Slate `decorate` function for DPQL syntax highlighting. The
 * returned function is stable across renders (`useCallback` with no deps).
 */
export function useDpqlSyntaxHighlighting() {
  const decorate = useCallback(([node, path]: NodeEntry): IDecoration[] => {
    if (!Text.isText(node)) {
      return [];
    }

    const { text } = node;
    if (!text) {
      return [];
    }

    const ranges: IDecoration[] = [];
    TOKEN_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = TOKEN_REGEX.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      const range: IDecoration = {
        anchor: { path, offset: start },
        focus: { path, offset: end },
      };

      if (match[1] || match[2]) {
        // Line comment or block comment
        range.comment = true;
      } else if (match[3] || match[4]) {
        // Double or single quoted string
        range.string = true;
      } else if (match[5]) {
        // Number
        range.number = true;
      } else if (match[6]) {
        // Operator
        range.operator = true;
      } else if (match[7]) {
        // Identifier — check if keyword, function, or boolean
        const word = match[7].toLowerCase();
        if (BOOLEANS.has(word)) {
          range.boolean = true;
        } else if (FUNCTIONS.has(word)) {
          range.function = true;
        } else if (KEYWORDS.has(word)) {
          range.keyword = true;
        } else {
          // Plain identifier — no decoration
          continue;
        }
      }

      ranges.push(range);
    }

    return ranges;
  }, []);

  return decorate;
}
