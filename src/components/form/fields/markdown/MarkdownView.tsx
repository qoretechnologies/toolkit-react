import { useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import type { TMarkdownRenderer } from '../../../Description/markdownRendererContext';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

/**
 * Draws a markdown value.
 *
 * Both places a markdown field shows its content go through this: the live
 * preview beside the editor, and the read-first row's expandable inset. A host
 * that already owns a markdown renderer -- heading scale, code treatment, GFM
 * tables -- supplies one and both surfaces adopt it at once; everyone else gets
 * the built-in view below. Same seam as `codePreviewRenderer`, for the same
 * reason: the styling of rendered prose belongs to the app, not to a form
 * engine.
 *
 * @param value the markdown source
 * @param compact render for a constrained container (a read-first row inset,
 * a narrow preview column) -- tighter margins, smaller headings
 * @param name the field's name, when rendering for a field
 * @param schema the field's schema, when the form has one for it
 * @param options every field's schema in the same scope
 * @param values every field's current value in the same scope
 */

interface IStyledMarkdownViewProps {
  $compact?: boolean;
  $textColor: string;
  $mutedColor: string;
  $linkColor: string;
  $tint: string;
  $border: string;
}

/**
 * Colours come from the active Reqore theme rather than the hardcoded
 * `rgba(255, 255, 255, …)` this used to carry: a form renders on whatever
 * surface the host gives it, and on a light theme white-on-white prose is
 * simply invisible.
 */
const StyledMarkdownView = styled.div<IStyledMarkdownViewProps>`
  color: ${({ $textColor }) => $textColor};
  font-size: ${({ $compact }) => ($compact ? '12px' : '14px')};
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;

  /* Hug the container's own padding instead of adding a blank first/last line. */
  > *:first-child {
    margin-top: 0;
  }
  > *:last-child {
    margin-bottom: 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: ${({ $compact }) => ($compact ? '8px 0 4px' : '14px 0 7px')};
    line-height: 1.3;
    font-weight: 600;
  }

  /* A description authored as a document routinely opens with a heading; at
     browser defaults that outgrows the panel title above it. */
  h1 {
    font-size: ${({ $compact }) => ($compact ? '1.05em' : '1.35em')};
  }
  h2 {
    font-size: ${({ $compact }) => ($compact ? '1.02em' : '1.2em')};
  }
  h3 {
    font-size: 1.1em;
  }
  h4,
  h5,
  h6 {
    font-size: 1em;
    opacity: 0.85;
  }

  p {
    margin: ${({ $compact }) => ($compact ? '4px 0' : '8px 0')};
  }

  a {
    color: ${({ $linkColor }) => $linkColor};
    text-decoration: underline;
  }

  blockquote {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 2px solid ${({ $border }) => $border};
    color: ${({ $mutedColor }) => $mutedColor};
    font-style: italic;
  }

  ul,
  ol {
    margin: 4px 0;
    padding-left: 20px;
  }

  li {
    margin: 2px 0;
  }

  /* Long unbroken tokens in code (URLs, base64, raw payloads) must reflow
     inside the container rather than widening it: a pre does not wrap by
     default and a code span has no overflow-wrap. */
  pre {
    margin: 6px 0;
    padding: 8px 10px;
    border-radius: 4px;
    background: ${({ $tint }) => $tint};
    border: 1px solid ${({ $border }) => $border};
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: ${({ $tint }) => $tint};
    border: 1px solid ${({ $border }) => $border};
    border-radius: 3px;
    padding: 0.05em 0.35em;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* Block code owns the whole pre surface; it must not also be chipped.
     (No backticks in this comment: it sits inside a template literal.) */
  pre code {
    background: none;
    border: 0;
    padding: 0;
    font-size: 1em;
  }

  table {
    border-collapse: collapse;
    margin: 6px 0;
    max-width: 100%;
  }

  th,
  td {
    border: 1px solid ${({ $border }) => $border};
    padding: 4px 10px;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: ${({ $tint }) => $tint};
  }

  img {
    max-width: 100%;
  }

  hr {
    border: 0;
    border-top: 1px solid ${({ $border }) => $border};
    margin: 10px 0;
  }
`;

export interface IMarkdownViewProps {
  value: string;
  compact?: boolean;
  className?: string;
}

/** The built-in markdown view: plain CommonMark, styled from the active theme. */
export const MarkdownView = ({ value, compact, className }: IMarkdownViewProps) => {
  const theme = useReqoreTheme();
  const textColor = getReadableColor(theme);

  return (
    <StyledMarkdownView
      className={className}
      $compact={compact}
      $textColor={textColor}
      $mutedColor={getReadableColor(theme, undefined, undefined, true)}
      $linkColor={theme?.intents?.info ?? textColor}
      $tint={`${textColor}14`}
      $border={`${textColor}24`}
    >
      <ReactMarkdown>{value}</ReactMarkdown>
    </StyledMarkdownView>
  );
};

/**
 * The renderer used when a host has not supplied one.
 *
 * The context itself lives in `Description/markdownRendererContext` — ONE
 * context for the whole package, so a host that supplies a renderer reaches
 * every markdown surface at once. This module previously declared a second one,
 * which is the same drift in miniature: two contexts means a host can satisfy
 * one and not the other, and nothing tells it which surface it missed.
 *
 * This is only the fallback a caller reaches for when the shared context is
 * empty and the surface still has to draw something — the field's own live
 * preview, which is useless blank.
 */
export const defaultMarkdownRenderer: TMarkdownRenderer = ({ value, compact }) => (
  <MarkdownView value={value} compact={compact} />
);

export default MarkdownView;
