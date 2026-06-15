import styled from 'styled-components';

// Styled primitives for the compact (read-first) rows and their editor cards.
// Shared between FormEngine and the extracted CompactRow component.

export const StyledEditCard = styled.div<{ $bg: string; $border: string }>`
  padding: 12px;
  display: flex;
  flex-flow: column;
  gap: 8px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;
`;

// Recurring micro-layouts of the read-first rows and their popovers.
export const StyledLabelBlock = styled.div`
  display: flex;
  flex-flow: column;
  gap: 2px;
  min-width: 0;
`;

export const StyledRowLabel = styled.div<{ $color: string; $pointer?: boolean }>`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${({ $color }) => $color};
  font-weight: 600;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: ${({ $pointer }) => ($pointer ? 'pointer' : 'inherit')};
`;

export const StyledCardHeading = styled.div`
  display: flex;
  flex-flow: column;
  min-width: 0;
`;

export const StyledCardLabel = styled.div<{ $color: string }>`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* min-width: 0 lets the grid cell shrink below its content's intrinsic width
   so the ellipsis engages instead of overflowing. */
export const StyledRowValue = styled.div<{ $color: string; $empty?: boolean }>`
  min-width: 0;
  color: ${({ $color }) => $color};
  font-style: ${({ $empty }) => ($empty ? 'italic' : 'normal')};
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const StyledRowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const StyledActionSlot = styled.span<{ $width: number }>`
  display: inline-flex;
  justify-content: center;
  width: ${({ $width }) => $width}px;
  flex: 0 0 auto;
`;

export const StyledColumn = styled.div`
  display: flex;
  flex-flow: column;
`;

export const StyledInfoPanel = styled.div`
  display: flex;
  flex-flow: column;
  gap: 4px;
  padding: 0 10px 8px 24px;
`;

export const StyledRowInset = styled.div`
  padding: 0 10px 6px 24px;
`;

// A small inline colour swatch shown before an rgbcolor value's hex string.
export const StyledColorSwatch = styled.span<{ $color: string; $border: string }>`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex: 0 0 auto;
  background: ${({ $color }) => $color};
  border: 1px solid ${({ $border }) => $border};
`;
