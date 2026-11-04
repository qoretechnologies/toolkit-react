// Copyright 2026 Qore Technologies, s.r.o.

/*
 * The record field a `$record:{…}` template names: pure, with no dependencies, so the template tree
 * (`templateTree`) can read it without importing `templates.ts`, which imports the tree.
 */

/** Where a braced segment that opens at `from` (its `{`) ends: the index after the `}` that closes it, or -1. */
export const endOfBracedSegment = (text: string, from: number): number => {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\\' && ['{', '}', '\\'].includes(text[i + 1])) {
      i += 1;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return -1;
};

/** The record field a template names - `$record:{orders[*].id}` is `orders[*].id` - when it is that template alone
 *  (one braced segment, nothing after it); otherwise undefined. */
export const recordFieldOfTemplate = (token: string): string | undefined => {
  const prefix = '$record:';
  return (
      token.startsWith(`${prefix}{`) && endOfBracedSegment(token, prefix.length) === token.length
    ) ?
      token.slice(prefix.length + 1, -1)
    : undefined;
};
