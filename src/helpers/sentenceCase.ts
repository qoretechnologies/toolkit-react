// Copyright 2026 Qore Technologies, s.r.o.

/** A word in Title Case: a capital and the rest small letters, with any punctuation after it ("Value", "Case?"). */
const TITLE_CASE_WORD = /^[A-Z][a-z]+[^A-Za-z0-9]*$/;

/**
 * A name as a calm label says it: in sentence case. The server's function catalogue names an operation's arguments
 * in Title Case ("String Value", "Regex Options"), which reads as shouting beside a calm form's labels. The first
 * word keeps its capital; each later word in Title Case loses it; any other word is kept as it is, so an acronym
 * ("URL", "JSON"), a mixed-case name ("iPhone") or a number is never rewritten. A display concern only: the name
 * itself, and anything that looks it up, is unchanged. A missing name stays missing (an operand drawn with no name).
 */
export const toSentenceCase = <T extends string | undefined>(name: T): T =>
  (typeof name !== 'string' ? name : (
    name
      .split(/(\s+)/)
      .map((word, index) => (index > 0 && TITLE_CASE_WORD.test(word) ? word.toLowerCase() : word))
      .join('')
      .replace(/^[a-z]/, (first) => first.toUpperCase())
  )) as T;
