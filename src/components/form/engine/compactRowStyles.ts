import { ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { GAP_FROM_SIZE, TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import styled from 'styled-components';

// Styled primitives for the compact (read-first) rows and their editor cards.
// Shared between FormEngine and the extracted CompactRow component.
export const HEADER_GAP: TSizes = 'big';

// Read-row geometry. The row is a 3-col grid [label | value | actions]; the
// recessed value surface + intent stripe begin at the VALUE column, leaving the
// label column on the bare form background. A fixed label column is what lets
// the surface (FormEngine's StyledGroupBody ::before) and the sub-panel indents
// land on the same x, so these constants are the single source for all three.
export const COMPACT_LABEL_COL = 220; // fixed label column width (was minmax max)
export const COMPACT_ROW_PAD_X = 10; // .readfirst-row horizontal padding
export const COMPACT_ROW_GAP = 14; // grid column gap
// Where the value column's content starts, measured from the block's left edge.
export const COMPACT_VALUE_LEFT = COMPACT_ROW_PAD_X + COMPACT_LABEL_COL + COMPACT_ROW_GAP;
// The surface starts a touch left of the value text, for inner left padding.
export const COMPACT_PANEL_LEFT = COMPACT_VALUE_LEFT - 10;
// Fluid indent applied to every field block under a group header. Shared so the
// group spine and the required-group rail land on the SAME vertical line (the
// rail sits at the block's left gutter, `-9px`, and the spine at `indent - 9px`
// in the group body's coordinate space — both resolve `3%` against the body).
export const GROUP_INDENT = 'clamp(8px, 3%, 32px)';

// Measured label column (GLOBAL). The label column sizes to the WIDEST field
// label across the whole form, clamped to [MIN, MAX]. FormEngine measures the
// labels once and writes the result to `LABEL_COL_VAR` on the compact scroll
// wrap; the grid column and the value-surface offsets below all read it (falling
// back to the fixed default until the measurement lands). Expressing the offsets
// FROM the column var preserves the "value surface starts at a constant x"
// invariant — the column may resize, but the surface stays glued to its edge.
export const LABEL_COL_MIN = 120;
export const LABEL_COL_MAX = COMPACT_LABEL_COL; // 220
export const LABEL_COL_VAR = '--readfirst-label-col';
export const LABEL_COL = `var(${LABEL_COL_VAR}, ${COMPACT_LABEL_COL}px)`;
export const VALUE_LEFT_CSS = `calc(${LABEL_COL} + ${COMPACT_ROW_PAD_X + COMPACT_ROW_GAP}px)`;
export const PANEL_LEFT_CSS = `calc(${LABEL_COL} + ${COMPACT_ROW_PAD_X + COMPACT_ROW_GAP - 10}px)`;

// Glass sticky header: override `.reqore-panel-title` (the surface ReqorePanel
// gives its sticky header) with a translucent theme tint + a moderate blur, the
// way the IDE's DashboardModule overrides its own header. `translateZ(0)`
// promotes the header to its own GPU layer, which stops the backdrop-filter
// repaint flicker on scroll. `$headerBg` is a pre-mixed translucent colour so
// content blurs softly through.
export const StyledCompactPanel = styled(ReqorePanel)<{
  $headerBg: string;
}>`
  > .reqore-panel-title {
    background: ${({ $headerBg }) => $headerBg};
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transform: translateZ(0);
    padding-top: ${GAP_FROM_SIZE[HEADER_GAP]}px;
    padding-bottom: ${GAP_FROM_SIZE[HEADER_GAP]}px;
  }

  /* Group framing. The HORIZONTAL rule is a real element in the header
     (StyledGroupHeaderLine) so it sits on the name's row, centred, and stretches
     from the name out to the status chip pinned at the far end — which needs the
     title's left group to fill the header width. The VERTICAL group spine is
     drawn by StyledGroupBody (so it shares the required-group rail's coordinate
     space and the two line up instead of doubling). */
  .options-readfirst-group {
    position: relative;
  }
  .options-readfirst-group > .reqore-panel-title > :first-child,
  .options-readfirst-group > .reqore-panel-title > :first-child > :first-child,
  .options-readfirst-group .reqore-panel-title-label-row {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

// Compact group header laid out as the panel's `label`: the group name, a
// hairline that fades toward the status chip, and the chip pinned at the end.
export const StyledGroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
`;
export const StyledGroupHeaderLine = styled.span<{ $color: string }>`
  flex: 1;
  height: 2px;
  min-width: 16px;
  background: linear-gradient(to right, ${({ $color }) => $color}, transparent);
`;

// Required-group "connection" rail: contiguous members are linked by a continuous
// vertical rail (StyledGroupBody draws it; the line bridges the row gaps and is
// trimmed to the first/last node). Each member carries a status node — absolutely
// positioned in the EXISTING left gutter, so labels keep their place — tied to the
// label by a short stub. Theme-derived: the node's hollow centre is painted the
// form background so it MASKS the rail behind it; filled when the member is set.
export const StyledClusterNode = styled.span<{ $color: string; $filled: boolean; $bg: string }>`
  position: absolute;
  left: -14px;
  top: 13px;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid ${({ $color }) => $color};
  background: ${({ $filled, $color, $bg }) => ($filled ? $color : $bg)};
  box-shadow: 0 0 5px ${({ $color }) => $color};
  z-index: 1;
  pointer-events: none;
  /* short stub toward the label — stops a few px short so it doesn't touch it */
  &::after {
    content: '';
    position: absolute;
    left: 100%;
    top: 50%;
    width: 6px;
    height: 2px;
    transform: translateY(-1px);
    background: ${({ $color }) => $color};
  }
`;

export const StyledEditCard = styled.div<{ $bg: string; $border: string }>`
  padding: 12px;
  display: flex;
  flex-flow: column;
  gap: 8px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;

  /* Single-value editors (operators, long-string, markdown, richtext, byte-size)
     carry the card's own "Clear value" action, so suppress the value input's
     built-in ReqoreInput clear — ReqoreInput has no prop to hide it, and two ✕
     read as a duplicate. Multi-input cards (hash/list/…) are not marked single,
     so their per-sub-field clears stay. */
  &.options-readfirst-card-single .reqore-clear-input-button {
    display: none;
  }
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

// A field's short_desc rendered under its name in the (narrow) label column,
// revealed by the row's ⓘ. Reuses ReqoreP for the muted-note styling (size +
// effect opacity); the only custom bit is the line-clamp that keeps it from
// pushing the row wide.
export const StyledLabelDesc = styled(ReqoreP)`
  margin-top: 2px;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
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

// Sub-panels (messages, and the hash preview) sit BELOW the value row, indented
// to the value column (StyledGroupBody) so they land on the recessed value
// surface instead of the bare label gutter.
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
