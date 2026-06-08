// Copyright 2026 Qore Technologies, s.r.o.
// Shared renderer for LSP documentation (completion-item doc tooltips,
// hover popovers, signature-help parameter docs). Wraps `react-markdown`
// in a styled container so the markdown elements (code blocks, inline
// code, headings, lists) render densely and legibly on the editor's dark
// frosted surfaces — instead of raw browser defaults that overflow the
// popover (unstyled code blocks) and waste vertical space (default
// heading / paragraph margins).
//
// One component, three call sites — keeps the doc styling consistent and
// in one place.

import { useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

export interface IMarkdownDocProps {
  /** The documentation text. */
  content: string;
  /**
   * When `true`, render `content` as Markdown. When `false`, render it
   * verbatim in a wrapping `<pre>` (the LSP `plaintext` kind) — still
   * inside the styled container so it shares the font / colour / wrap.
   */
  markdown: boolean;
  /** Max width of the doc body (px). Default 360. */
  maxWidth?: number;
  /** Max height before the body scrolls (px). Default 240. */
  maxHeight?: number;
}

interface IStyledMarkdownProps {
  $maxWidth: number;
  $maxHeight: number;
  $textColor: string;
  $linkColor: string;
}

const StyledMarkdown = styled.div<IStyledMarkdownProps>`
  max-width: ${({ $maxWidth }) => $maxWidth}px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  /* Text colour is derived from the active Reqore theme (readable on
     whatever surface the host app uses) — not a hardcoded hex. */
  color: ${({ $textColor }) => $textColor};
  word-break: break-word;

  /* Collapse the leading/trailing margins so the body hugs the popover
     padding instead of adding a blank first/last line. */
  > *:first-child {
    margin-top: 0;
  }
  > *:last-child {
    margin-bottom: 0;
  }

  p {
    margin: 0 0 6px;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 8px 0 4px;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 {
    font-size: 14px;
  }
  h2 {
    font-size: 13px;
  }
  h3,
  h4,
  h5,
  h6 {
    font-size: 12px;
  }

  /* Inline code → subtle chip. */
  code {
    font-family: monospace;
    font-size: 11px;
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
  }

  /* Fenced code block → dark inset surface with horizontal scroll so
     long lines don't overflow the popover (the bug this fixes). */
  pre {
    margin: 6px 0;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 4px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
    white-space: pre;
  }

  ul,
  ol {
    margin: 4px 0;
    padding-left: 18px;
  }
  li {
    margin: 2px 0;
  }

  a {
    /* Links use the theme's info intent (falls back to the readable
       text colour if the theme doesn't define one). */
    color: ${({ $linkColor }) => $linkColor};
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }

  strong {
    font-weight: 600;
  }

  blockquote {
    margin: 6px 0;
    padding-left: 8px;
    border-left: 2px solid rgba(255, 255, 255, 0.15);
    opacity: 0.85;
  }

  hr {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin: 8px 0;
  }

  table {
    border-collapse: collapse;
    margin: 6px 0;
  }
  th,
  td {
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 2px 6px;
    text-align: left;
  }
`;

const StyledPlaintext = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  font-family: monospace;
`;

export const MarkdownDoc = ({
  content,
  markdown,
  maxWidth = 360,
  maxHeight = 240,
}: IMarkdownDocProps) => {
  const theme = useReqoreTheme();
  // Readable foreground for the active theme (light text on dark hosts,
  // dark text on light hosts). Links use the theme's `info` intent.
  const textColor = getReadableColor(theme);
  const linkColor = theme.intents?.info ?? textColor;
  return (
    <StyledMarkdown
      $maxWidth={maxWidth}
      $maxHeight={maxHeight}
      $textColor={textColor}
      $linkColor={linkColor}
    >
      {markdown ? (
        <ReactMarkdown>{content}</ReactMarkdown>
      ) : (
        <StyledPlaintext>{content}</StyledPlaintext>
      )}
    </StyledMarkdown>
  );
};
