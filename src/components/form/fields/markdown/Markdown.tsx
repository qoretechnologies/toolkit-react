import { ReqoreColumn, ReqoreColumns, ReqoreMessage } from '@qoretechnologies/reqore';
import { IReqoreMessageProps } from '@qoretechnologies/reqore/dist/components/Message';
import { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import LongStringFormField, { ILongStringFormFieldProps } from '../long-string/LongString';

export interface IMarkdownFormFieldProps extends ILongStringFormFieldProps {
  markdownPreviewProps?: Partial<ComponentProps<typeof ReactMarkdown>>;
}

const StyledWrapper = styled(ReqoreColumns)<ComponentProps<typeof ReqoreColumns>>`
  width: 100%;
`;

const StyledLongStringWrapper = styled(ReqoreColumn)`
  .reqore-control-wrapper {
    display: flex;
    flex-direction: column;
  }
`;

const StyledMarkdown = styled(ReactMarkdown)<ComponentProps<typeof ReactMarkdown>>`
  p {
    font-size: 14px;

    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
  h1,
  h2,
  p,
  i,
  a {
    color: rgba(255, 255, 255, 0.84);
  }

  h1 {
    text-align: left;
  }

  h2 {
    font-weight: 700;
    padding: 0;
    text-align: left;
    line-height: 34.5px;
    letter-spacing: -0.45px;
  }

  p,
  i,
  a {
    letter-spacing: -0.03px;
    line-height: 1.58;
  }

  a {
    text-decoration: underline;
  }

  blockquote {
    font-style: italic;
    letter-spacing: -0.36px;
    line-height: 44.4px;
    overflow-wrap: break-word;
    color: rgba(255, 255, 255, 0.68);
    padding: 0 0 0 50px;
  }

  code {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    padding: 34px 6px;
  }
`;

const StyledPreviewColumn = styled(ReqoreColumn)`
  width: 100%;
`;

const StyledPreviewWrapper = styled(ReqoreMessage)<IReqoreMessageProps>`
  & div div {
    justify-content: start;
  }
`;

export const MarkdownFormField = ({ markdownPreviewProps, ...rest }: IMarkdownFormFieldProps) => {
  return (
    <StyledWrapper columnsGap='10px'>
      <StyledLongStringWrapper flexFlow='column'>
        <LongStringFormField {...rest} />
      </StyledLongStringWrapper>
      <StyledPreviewColumn>
        <StyledPreviewWrapper size='small' aria-label='Preview' flat fluid>
          <StyledMarkdown {...markdownPreviewProps}>{rest.value ?? ''}</StyledMarkdown>
        </StyledPreviewWrapper>
      </StyledPreviewColumn>
    </StyledWrapper>
  );
};

export default MarkdownFormField;
