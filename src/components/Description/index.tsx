import { ReqoreSpan, ReqoreTextEffect, ReqoreVerticalSpacer } from '@qoretechnologies/reqore';
import { IReqoreParagraphProps, ReqoreP } from '@qoretechnologies/reqore/dist/components/Paragraph';
import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { memo, useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import { useMarkdownRenderer } from './markdownRendererContext';

export interface IDescriptionProps extends IReqoreParagraphProps {
  shortDescription?: string;
  longDescription: string;
  longDescriptionOnly?: boolean;
  longDescriptionShownByDefault?: boolean;
  maxShortDescriptionLength?: number;
  margin?: 'top' | 'bottom' | 'both' | 'none';
  type?: TQorusType;
  /**
   * Render for a constrained container — a row inset, a callout, a hover card.
   *
   * Forwarded to the host's markdown renderer and applied to the built-in
   * heading scale.
   */
  compact?: boolean;
}

/**
 * System monospace, spelled out rather than imported from
 * `@qoretechnologies/reqore`'s font shorthands: that export postdates the
 * `>=0.71.16` peer range this package supports, and a description must not be
 * the reason a consumer has to move its Reqore version.
 */
const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

/**
 * The built-in markdown surface, used when no host renderer is supplied.
 *
 * `react-markdown` 9 dropped its `className` prop, so the styles cannot hang off
 * `styled(ReactMarkdown)` — hence a wrapper element rather than a styled
 * component around the renderer itself.
 */
const StyledDescriptionMarkdown = styled.div<{ $compact?: boolean }>`
  /*
   * Inline code. A backtick span marks an identifier — an option key, a header
   * name, a path — so it has to be monospace, and it has to sit quietly inside
   * the sentence around it.
   *
   * This used to map the code element to a ReqoreTag with an explicit near-white
   * colour, which auto-contrasted to near-black text: on a dark form a description
   * full of option names read as a row of glaring labels rather than as prose with
   * identifiers in it. Keeping the reading colour and tinting the background
   * behind it says "literal" without shouting it.
   */
  code {
    font-family: ${MONO_FONT};
    font-size: 0.92em;
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    padding: 0.05em 0.35em;
    color: inherit;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  /* Block code owns the whole pre surface; it must not also be chipped. */
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  pre code {
    background: none;
    border: 0;
    padding: 0;
    font-size: 1em;
  }

  /*
   * Headings. These used to map to ReqoreH1…ReqoreH6, which render at page-title
   * scale — an option description opening with a level-two heading came out
   * larger than the dialog title above it. A description is never a page, so the
   * scale here is relative to the text it interrupts.
   */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: ${({ $compact }) => ($compact ? '10px 0 4px' : '16px 0 8px')};
    line-height: 1.3;
    font-weight: 600;
  }

  > h1:first-child,
  > h2:first-child,
  > h3:first-child,
  > h4:first-child,
  > h5:first-child,
  > h6:first-child {
    margin-top: 0;
  }

  h1 {
    font-size: ${({ $compact }) => ($compact ? '1.08em' : '1.5em')};
  }
  h2 {
    font-size: ${({ $compact }) => ($compact ? '1.04em' : '1.3em')};
  }
  h3 {
    font-size: ${({ $compact }) => ($compact ? '1em' : '1.15em')};
  }
  h4,
  h5,
  h6 {
    font-size: 1em;
    opacity: 0.85;
  }

  p:first-child {
    margin-top: 0;
  }
  p:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  li {
    margin: 2px 0;
  }
`;

export const MarkdownLink = (props: any) => {
  return (
    <ReqoreTextEffect
      as='a'
      effect={{ interactive: true, color: 'info', underline: true }}
      {...props}
    />
  );
};

export const Description = memo(
  ({
    shortDescription,
    longDescription,
    longDescriptionOnly,
    longDescriptionShownByDefault,
    maxShortDescriptionLength = 1000,
    margin = 'bottom',
    type: _type, // eslint-disable-line @typescript-eslint/no-unused-vars
    compact,
    ...rest
  }: IDescriptionProps) => {
    const [showLongDescription, setShowLongDescription] = useState<boolean>(
      longDescriptionOnly || (longDescriptionShownByDefault && longDescription ? true : false)
    );
    const markdownRenderer = useMarkdownRenderer();

    const actualShortDescription = shortDescription || longDescription;
    const isShortDescriptionTooLong = actualShortDescription?.length > maxShortDescriptionLength;

    const finalShownDescription = isShortDescriptionTooLong
      ? `${actualShortDescription.slice(0, maxShortDescriptionLength)}`
      : actualShortDescription;

    const finalLongDescription =
      longDescription || (isShortDescriptionTooLong ? actualShortDescription : shortDescription);

    const handleDescriptionClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowLongDescription((prev) => !prev);
    }, []);

    const effect = useMemo(() => ({ italic: true, opacity: 0.7 }), []);

    const components = useMemo(
      () => ({
        p: (options: any) => <ReqoreP {...options} effect={effect} size='small' />,
        span: (options: any) => <ReqoreSpan {...options} effect={effect} size='small' />,
        a: MarkdownLink,
        // `code` and `h1`…`h6` are deliberately NOT mapped — the surface above
        // styles them, so an identifier stays readable and a heading stays
        // smaller than the title it sits under.
      }),
      [effect]
    );

    const renderToggle = useCallback(() => {
      if (finalShownDescription === longDescription || longDescriptionOnly) {
        return null;
      }

      return (
        <>
          {showLongDescription && <ReqoreVerticalSpacer height={5} />}
          <ReqoreTextEffect
            className='description-more'
            effect={{
              interactive: true,
              brightness: 180,
              opacity: showLongDescription ? 0.4 : 0.6,
              color: 'white',
            }}
            style={{ cursor: 'pointer' }}
            onClick={handleDescriptionClick}
          >
            {showLongDescription ? '...less' : '...more'}
          </ReqoreTextEffect>
        </>
      );
    }, [showLongDescription]);

    if (!shortDescription && !longDescription) {
      return null;
    }

    return (
      <>
        {margin === 'both' || margin === 'top' ? <ReqoreVerticalSpacer height={10} /> : null}
        {showLongDescription ? (
          // Markdown is rendered outside `ReqoreP`: it emits block content —
          // its own paragraphs, lists, headings — and a `<p>` may not contain
          // any of them, so the browser closed the outer paragraph early and
          // the rest of the description escaped its own styling.
          <>
            {markdownRenderer ? (
              markdownRenderer({ value: finalLongDescription, compact })
            ) : (
              <StyledDescriptionMarkdown $compact={compact}>
                <ReactMarkdown components={components}>{finalLongDescription}</ReactMarkdown>
              </StyledDescriptionMarkdown>
            )}
            {renderToggle()}
          </>
        ) : (
          <ReqoreP {...rest}>
            <ReqoreSpan effect={effect}>
              {finalShownDescription} {finalLongDescription ? renderToggle() : null}
            </ReqoreSpan>
          </ReqoreP>
        )}
        {margin === 'both' || margin === 'bottom' ? <ReqoreVerticalSpacer height={10} /> : null}
      </>
    );
  }
);
