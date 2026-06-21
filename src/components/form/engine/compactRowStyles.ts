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
  white-space: normal;
  overflow-wrap: anywhere;
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

export const StyledGroupBody = styled.div<{
  $divider: string;
  $hover: string;
  $focus: string;
  $success: string;
  $rowBg: string;
  $lineColor: string;
}>`
  display: flex;
  flex-flow: column;
  position: relative;
  gap: 8px;

  /* Indent each field block under the group header by a FLUID step. The %
     resolves against this container's width (not the screen), so it tracks the
     form even inside a narrow drawer; the clamp keeps it from vanishing on a
     slim form or ballooning into a big gutter on a wide one. */
  > * {
    margin-left: ${GROUP_INDENT};
  }

  /* The group spine: a faint vertical line down the block gutter. Drawn here (not
     on the panel) so it lives in the SAME coordinate space as the required-group
     rail and lands on the exact same x — GROUP_INDENT minus 9px matches the rail's
     left: -9px on each (indented) block. The rail is a descendant ::after, so it
     paints over this spine and wins where a required cluster overlaps it. */
  &::before {
    content: '';
    position: absolute;
    left: calc(${GROUP_INDENT} - 9px);
    top: 0;
    bottom: 8px;
    width: 2px;
    background: linear-gradient(to bottom, ${({ $lineColor }) => $lineColor}, transparent);
    pointer-events: none;
    z-index: 0;
  }

  .readfirst-row {
    display: grid;
    /* Fixed label column: the recessed value surface (::before below) starts at a
       constant x, so the label width can't flex or the stripe would drift off the
       value edge. The value column is minmax(0, 1fr) — a bare 1fr keeps its
       min-content width, so a long unbroken value (e.g. a URL) would force the
       grid wider than its container and produce a horizontal scrollbar. The 0
       minimum lets it shrink and the value cell's ellipsis take over instead. */
    grid-template-columns: ${LABEL_COL} minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    min-height: 38px;
    /* 3px vertical: the hover-revealed action buttons (revert/delete) are
       ~32px tall and occupy layout even at opacity 0 — with 8px padding they
       inflated removable rows to ~48px while plain rows sat at the 38px
       min-height. 32 + 6 = 38 keeps every one-line row the same height; the
       min-height keeps the click target for rows with shorter content. */
    padding: 3px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .readfirst-row:hover {
    background: ${({ $hover }) => $hover};
  }
  .readfirst-row:focus-visible {
    outline: 2px solid ${({ $focus }) => $focus};
    outline-offset: -2px;
    background: ${({ $hover }) => $hover};
  }
  /* A hidden (not-yet-added) field surfaced by the search is dimmed. */
  .readfirst-row-hidden {
    opacity: 0.65;
  }
  /* A disabled field (schema disabled flag or unmet dependencies) is not a
     click target — no hover invite, not-allowed cursor; a lock replaces the
     pencil. */
  .readfirst-row-disabled {
    cursor: not-allowed;
  }
  .readfirst-row-disabled:hover {
    background: transparent;
  }
  /* Required-group linkage: hovering a member highlights every sibling row —
     just a background tint, no left stripe (that reads as an intent edge). */
  .readfirst-row-group-highlight {
    background: ${({ $focus }) => `${$focus}1f`};
  }
  .readfirst-row-flash {
    animation: readfirstRowFlash 1.4s ease;
  }
  @keyframes readfirstRowFlash {
    0% {
      background: ${({ $focus }) => `${$focus}59`};
    }
    100% {
      background: transparent;
    }
  }
  .readfirst-action {
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .readfirst-row:hover .readfirst-action,
  .readfirst-row:focus-visible .readfirst-action {
    opacity: 0.85;
  }

  /* A scalar row being edited in place: the real editor replaces the value
     cell. The row stops being a click target (the editor owns the clicks) and
     keeps a constant active background. Vertical padding is tightened so the
     editor fits inside the same ~38px the read row occupies — switching into
     (and out of) inline editing must not shift the rows around it. */
  .readfirst-row-editing {
    cursor: default;
    /* Top-anchor the cells: with multi-line editors (e.g. allowed-values =
       input + picker), per-cell centring gives every control a different
       anchor. Instead everything aligns to the FIRST editor line — label and
       the ✓/↺ cluster get small offsets to sit optically centred on it. */
    align-items: start;
    background: ${({ $hover }) => $hover};
    /* Zero vertical padding: the pinned min-height (captured from the read
       row at activation) owns the height; the editor centres within it. */
    padding-top: 0;
    padding-bottom: 0;
    /* Tighter column gap: the editor's trailing template ⋮ and our ✓ should
       read as one control cluster, not two separated groups. */
    column-gap: 6px;
  }
  /* Centre each cell's content on the row's ~38px first-line band. The label
     text (+10) and the ✓/↺ cluster (+3) were already nudged, but the editor
     cell was not — so a single-line input sat ~3px above the buttons. A 32px
     control needs +3 to centre in 38px, so the editor gets the same offset and
     lines up with the buttons. (A multi-line editor's first line lands on the
     band too; its extra rows grow downward.) */
  .readfirst-row-editing > div:nth-child(1) {
    padding-top: 10px;
  }
  .readfirst-row-editing > div:nth-child(2) {
    padding-top: 3px;
  }
  .readfirst-row-editing > div:nth-child(3) {
    padding-top: 3px;
  }
  .readfirst-row-editing:hover {
    background: ${({ $hover }) => $hover};
  }

  /* Narrow FORMS (phone / slim drawer): stack each row — label + actions share
     the first line, the value cell (or the inline editor) takes the full width
     beneath. The class is set from a measured wrap width (react-use useMeasure)
     rather than a viewport media query, so a slim desktop drawer stacks too.
     The 3 row children are placed explicitly:
     label (1,1) · actions (1,2) · value (2, span both). */
  &.readfirst-narrow .readfirst-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 14px;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(3) {
    grid-column: 2;
    grid-row: 1;
  }
  &.readfirst-narrow .readfirst-row > :nth-child(2) {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  /* The surface backs every field BLOCK (direct children of the body). */
  > *:not(.options-readfirst-card) {
    position: relative;
  }
  > *:not(.options-readfirst-card)::before {
    content: '';
    position: absolute;
    inset: 0;
    left: ${PANEL_LEFT_CSS};
    background: ${({ $rowBg }) => $rowBg};
    border-radius: 6px;
    border-left: 3px solid var(--readfirst-stripe, transparent);
    pointer-events: none;
    z-index: 0;
  }
  /* Content rides above the surface layer — except the cluster node, which is
     absolutely positioned in the gutter and must keep its own positioning. */
  > *:not(.options-readfirst-card) > *:not(.options-readfirst-node) {
    position: relative;
    z-index: 1;
  }

  /* Required-group connection rail. Drawn on the member's BLOCK ROOT (so it spans
     the whole member, including a message panel below the row), the rail is one
     continuous line: each segment BRIDGES the 8px gap into the next member
     (bottom: -8px) and the end members trim to their node centre, so it reads as a
     single unbroken rail node-to-node. It sits in the existing left gutter (node
     centre ~10px left of the row), so labels keep their place. The node (drawn by
     the row) is opaque and overlaps the rail, masking it — no line through the
     ring. The node centre sits ~19px below the block top (13px node top + 6px). */
  .readfirst-cluster-rail::after {
    content: '';
    position: absolute;
    left: -9px;
    top: 0;
    bottom: -8px;
    width: 2px;
    /* muted info — the connection is a quiet structural hint, not a loud accent */
    background: ${({ $focus }) => `${$focus}99`};
    box-shadow: 0 0 4px ${({ $focus }) => `${$focus}99`};
    pointer-events: none;
    z-index: 0;
  }
  .readfirst-cluster-rail.readfirst-cluster-first::after {
    top: 19px;
  }
  .readfirst-cluster-rail.readfirst-cluster-last::after {
    bottom: calc(100% - 19px);
  }
  /* Group fulfilled (any member set): the whole rail reads success, not just the
     satisfying node. */
  .readfirst-cluster-rail.readfirst-cluster-satisfied::after {
    background: ${({ $success }) => `${$success}99`};
    box-shadow: 0 0 4px ${({ $success }) => `${$success}99`};
  }
  /* Sub-panels (messages, hash preview) indent to the value column so they sit on
     the surface, not in the bare label gutter. */
  .options-readfirst-info-panel,
  .options-readfirst-inset {
    padding-left: ${VALUE_LEFT_CSS};
  }
  /* A field's short_desc renders under its NAME (revealed by the ⓘ toggle),
     growing the label block to multiple lines. Top-anchor those open rows so the
     value lines up with the name rather than the middle of the taller label;
     closed (single-line) rows keep the centred read-row rhythm. */
  .readfirst-row-info-open {
    align-items: start;
  }
  /* Narrow stacks label-over-value, so the value-column offset is meaningless —
     the surface spans the full block and the sub-panels drop to the 12px rail. */
  &.readfirst-narrow .readfirst-row > :nth-child(2) {
    padding-left: 12px;
  }
  &.readfirst-narrow > *:not(.options-readfirst-card)::before {
    left: 0;
  }
  &.readfirst-narrow .options-readfirst-info-panel,
  &.readfirst-narrow .options-readfirst-inset {
    padding-left: 12px;
  }
  /* Touch layouts have no hover: a slot reserved for the hover-revealed edit
     pencil is permanent dead space that insets every chip from the edge —
     drop it (rows are tap-to-edit; the lock/add slots stay, they're static). */
  &.readfirst-narrow .options-readfirst-trailing-hover-only {
    /* !important: the slot carries an inline display for the desktop layout. */
    display: none !important;
  }
  /* Phone air: stacked blocks get slightly taller inner padding. The in-place
     editor keeps zero padding so its pinned height still matches. */
  &.readfirst-narrow .readfirst-row {
    padding-top: 6px;
    padding-bottom: 6px;
  }
  &.readfirst-narrow .readfirst-row-editing {
    padding-top: 0;
    padding-bottom: 0;
  }

  /* A hash block = its parent row + the revealed sub-rows. Highlight the whole
     block as one unit on hover (rather than only the parent row), and neutralise
     the parent row's own hover so the two don't stack into a darker band. The
     parent row's hover actions still surface whenever the block is hovered. */
  .options-readfirst-hash-row {
    border-radius: 6px;
    transition: background 0.12s ease;
  }
  .options-readfirst-hash-row:hover {
    background: ${({ $hover }) => $hover};
  }
  .options-readfirst-hash-row:hover .readfirst-row {
    background: transparent;
  }
  .options-readfirst-hash-row:hover .readfirst-action {
    opacity: 0.85;
  }
`;
