import {
  ReqoreErrorBoundary,
  ReqoreH1,
  ReqoreH2,
  ReqoreH3,
  ReqoreH4,
  ReqoreH5,
  ReqoreH6,
  ReqoreSpan,
  ReqoreTag,
  ReqoreTextEffect,
  ReqoreVerticalSpacer,
} from '@qoretechnologies/reqore';
import { IReqoreParagraphProps, ReqoreP } from '@qoretechnologies/reqore/dist/components/Paragraph';
import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { memo, useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export interface IDescriptionProps extends IReqoreParagraphProps {
  shortDescription?: string;
  longDescription: string;
  longDescriptionOnly?: boolean;
  longDescriptionShownByDefault?: boolean;
  maxShortDescriptionLength?: number;
  margin?: 'top' | 'bottom' | 'both' | 'none';
  type?: TQorusType;
}

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
    type: _type,
    ...rest
  }: IDescriptionProps) => {
    const [showLongDescription, setShowLongDescription] = useState<boolean>(
      longDescriptionOnly || (longDescriptionShownByDefault && longDescription ? true : false)
    );

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
        <ReqoreP {...rest}>
          {showLongDescription ? (
            <>
              <ReactMarkdown
                components={{
                  p: (options) => <ReqoreP {...(options as any)} effect={effect} size='small' />,
                  span: (options) => (
                    <ReqoreSpan {...(options as any)} effect={effect} size='small' />
                  ),
                  h1: ReqoreH1 as any,
                  h2: ReqoreH2 as any,
                  h3: ReqoreH3 as any,
                  h4: ReqoreH4 as any,
                  h5: ReqoreH5 as any,
                  h6: ReqoreH6 as any,
                  a: MarkdownLink,
                  code: (options) => (
                    <ReqoreErrorBoundary>
                      <ReqoreTag
                        {...(options as any)}
                        label={options.children}
                        color='#d7d7d7'
                        size='tiny'
                        wrap
                      />
                    </ReqoreErrorBoundary>
                  ),
                }}
              >
                {finalLongDescription}
              </ReactMarkdown>
              {renderToggle()}
            </>
          ) : (
            <ReqoreSpan effect={effect}>
              {finalShownDescription} {finalLongDescription ? renderToggle() : null}
            </ReqoreSpan>
          )}
        </ReqoreP>
        {margin === 'both' || margin === 'bottom' ? <ReqoreVerticalSpacer height={10} /> : null}
      </>
    );
  }
);
