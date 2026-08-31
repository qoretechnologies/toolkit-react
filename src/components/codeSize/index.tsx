// Copyright 2026 Qore Technologies, s.r.o.
// How much code is there? — the one answer, rendered one way.
//
// A read-only view of source has to say something about the code it is not
// showing in full: how many lines, how much text. The compact form engine
// grew that chip first (a `code-editor` value's read summary); detail pages
// outside the form engine want the identical affordance. It lives here so
// there is one renderer rather than one per caller, each drifting in
// pluralisation, icon and intent.

import { ReqoreTag } from '@qoretechnologies/reqore';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { memo } from 'react';

export interface IReqraftCodeSize {
  /** Number of lines, counting a trailing newline's empty last line. */
  lines: number;
  /** Number of characters (UTF-16 code units, as `String.length` reports). */
  chars: number;
}

/**
 * Measure a block of code. Split out from the tag so the numbers can be
 * asserted without rendering, and reused by callers that want to phrase the
 * size themselves.
 *
 * An empty string is one line of zero characters, which is what an editor
 * showing it displays — not zero lines.
 */
export function describeCodeSize(code: string): IReqraftCodeSize {
  return { lines: code.split('\n').length, chars: code.length };
}

/** `4 lines` / `1 line` — the label half of the chip. */
export function formatCodeLines(lines: number): string {
  return `${lines} ${lines === 1 ? 'line' : 'lines'}`;
}

/** `92 chars` / `1 char` — the key half of the chip. */
export function formatCodeChars(chars: number): string {
  return `${chars} ${chars === 1 ? 'char' : 'chars'}`;
}

/**
 * The chip as plain `ReqoreTag` props. Needed wherever a host takes tag
 * *props* rather than an element — a `ReqorePanel` `badge`, a button badge —
 * which is most of Reqore's badge surface.
 */
export function codeSizeTagProps(code: string): IReqoreTagProps {
  const { lines, chars } = describeCodeSize(code);

  return {
    size: 'small',
    minimal: true,
    intent: 'info',
    icon: 'CodeLine',
    label: formatCodeLines(lines),
    labelKey: formatCodeChars(chars),
  };
}

export interface IReqraftCodeSizeTagProps
  extends Omit<IReqoreTagProps, 'label' | 'labelKey'> {
  /** The code being summarised. */
  code: string;
}

/**
 * `N chars | N lines` chip summarising a block of source. Every prop of
 * `ReqoreTag` passes through except the two labels, which are the point.
 */
export const ReqraftCodeSizeTag = memo(
  ({ code, ...rest }: IReqraftCodeSizeTagProps) => {
    const { label, labelKey, ...defaults } = codeSizeTagProps(code);

    return <ReqoreTag {...defaults} {...rest} label={label} labelKey={labelKey} />;
  }
);
ReqraftCodeSizeTag.displayName = 'ReqraftCodeSizeTag';
