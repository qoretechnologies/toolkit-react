import {
  ReqoreColumn,
  ReqoreColumns,
  ReqoreMessage,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { IReqoreMessageProps } from '@qoretechnologies/reqore/dist/components/Message';
import { ComponentProps } from 'react';
import styled from 'styled-components';
import LongStringFormField, { ILongStringFormFieldProps } from '../long-string/LongString';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';
import { defaultMarkdownRenderer } from './MarkdownView';

export interface IMarkdownFormFieldProps extends ILongStringFormFieldProps {
  /**
   * Hide the live preview regardless of the available width.
   *
   * The preview is dropped on its own below tablet width; this forces it off
   * for a host that knows its container is narrow even on a wide viewport.
   */
  hidePreview?: boolean;
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

const StyledPreviewColumn = styled(ReqoreColumn)`
  width: 100%;
  min-width: 0;
`;

const StyledPreviewWrapper = styled(ReqoreMessage)<IReqoreMessageProps>`
  & div div {
    justify-content: start;
  }
`;

export const MarkdownFormField = ({ hidePreview, ...rest }: IMarkdownFormFieldProps) => {
  // The shared context is empty unless a host supplied a renderer. The row
  // inset deliberately draws nothing in that case; the field's live preview
  // cannot — a blank preview beside the editor is worse than reqraft's own
  // CommonMark — so it falls back to the built-in view.
  const renderMarkdown = useMarkdownRenderer() ?? defaultMarkdownRenderer;
  // Side-by-side needs room for both halves. `ReqoreColumns` would stack them
  // instead of dropping one, which on a phone means scrolling past a second
  // copy of the text you are still typing -- so below tablet width the editor
  // simply takes the whole field.
  const isMobileOrTablet = useReqoreProperty('isMobileOrTablet');
  const showPreview = !hidePreview && !isMobileOrTablet;

  const editor = (
    <StyledLongStringWrapper flexFlow='column'>
      <LongStringFormField {...rest} />
    </StyledLongStringWrapper>
  );

  if (!showPreview) {
    return editor;
  }

  return (
    <StyledWrapper columnsGap='10px'>
      {editor}
      <StyledPreviewColumn>
        <StyledPreviewWrapper size='small' aria-label='Preview' flat fluid>
          {renderMarkdown({ value: rest.value ?? '', compact: true })}
        </StyledPreviewWrapper>
      </StyledPreviewColumn>
    </StyledWrapper>
  );
};

export default MarkdownFormField;
