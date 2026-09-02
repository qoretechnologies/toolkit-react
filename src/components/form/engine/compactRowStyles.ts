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
// Left offset for the group sub-labels / cluster header, kept equal to the row's
// own horizontal padding so the labels line up flush with the field labels below
// them (no extra gutter — the spine/rail that used a fluid indent are gone).
export const GROUP_INDENT = `${COMPACT_ROW_PAD_X}px`;

// Measured label column (GLOBAL). The label column sizes to the WIDEST field
// label across the whole form, clamped to [MIN, MAX]. FormEngine measures the
// labels once and writes the result to `LABEL_COL_VAR` on the compact scroll
// wrap; the grid column and the value-surface offsets below all read it (falling
// back to the fixed default until the measurement lands). Expressing the offsets
// FROM the column var preserves the "value surface starts at a constant x"
// invariant — the column may resize, but the surface stays glued to its edge.
export const LABEL_COL_MIN = 120;
export const LABEL_COL_MAX = COMPACT_LABEL_COL; // 220
/**
 * Room reserved beside a field's NAME for the chrome that trails it, summed from
 * the parts rather than guessed: the required asterisk (10px), the `?` that opens
 * the long description (12px), and the two 3px gaps of `StyledRowLabel`.
 *
 * Added to the measured column AFTER the min/max clamp. Inside it, a label long
 * enough to reach the ceiling spends the allowance on itself and the `?` wraps to
 * a line of its own.
 *
 * The 4px of slack is not padding for its own sake: the measurement rounds (an
 * off-DOM `offsetWidth` is an integer) while the rendered text width is
 * fractional, so a column sized to the exact sum still wraps. Measured on an auth
 * profile — "Authentication Schemes" renders 152px of text and needs
 * 152+3+10+3+12 = 180, was given exactly 180, and wrapped anyway.
 */
export const LABEL_AFFORDANCE_WIDTH = 10 + 12 + 3 * 2 + 4;
export const LABEL_COL_VAR = '--readfirst-label-col';
export const LABEL_COL = `var(${LABEL_COL_VAR}, ${COMPACT_LABEL_COL}px)`;
export const PANEL_LEFT_CSS = `calc(${LABEL_COL} + ${COMPACT_ROW_PAD_X + COMPACT_ROW_GAP - 10}px)`;

// Glass sticky header: override `.reqore-panel-title` (the surface ReqorePanel
// gives its sticky header) with a translucent theme tint + a moderate blur, the
// way the IDE's DashboardModule overrides its own header. `translateZ(0)`
// promotes the header to its own GPU layer, which stops the backdrop-filter
// repaint flicker on scroll. `$headerBg` is a pre-mixed translucent colour so
// content blurs softly through.
export const StyledCompactPanel = styled(ReqorePanel)<{
  $headerBg: string;
  $nested?: boolean;
  /** True when the toolbar renders no search row (hidden via `compactToolbar`,
   *  self-hidden on a single-option form, or no toolbar at all). */
  $tightHeader?: boolean;
}>`
  > .reqore-panel-title {
    /* The blur + translateZ exist only to make the STICKY top-level toolbar ghost
       content beneath it; a nested sub-form's header isn't sticky, so skip them
       (and the stacking context translateZ creates). */
    ${({ $nested }) =>
      $nested ? '' : (
        'backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transform: translateZ(0);'
      )}
    padding-top: ${GAP_FROM_SIZE[HEADER_GAP]}px;
    /* A header with a SEARCH ROW keeps the \`big\` gap below it — a tall
       interactive control earns separation from the content it filters. A
       header without one (search hidden via \`compactToolbar\`, self-hidden on
       a single-option form, or no toolbar at all) is a thin strip, and at
       \`big\` its padding stacked onto the panel content's own 8px into a 26px
       dead band between the completion meter and the first status box —
       rejected on build #140 as "unnecessarily big". \`normal\` lands it at
       the boxes' own 10px rhythm, and scoping the change here keeps every
       search-bearing form pixel-identical. */
    padding-bottom: ${({ $tightHeader }) =>
      $tightHeader ? GAP_FROM_SIZE.normal : GAP_FROM_SIZE[HEADER_GAP]}px;
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

  /* An injected option action declared \`show: 'hover'\` — the shape ReqorePanel
     honours on the classic path — is revealed only while its row or card is
     hovered or holds focus. The compact slots render plain buttons, so the gate
     has to be CSS here. Kept focus-visible too, so the action stays reachable by
     keyboard. Opacity rather than display keeps the slot's width stable, so rows
     don't reflow on hover. */
  .options-injected-action-hover {
    opacity: 0;
    /* Not hit-testable while invisible — an opacity:0 button still takes taps
       and clicks, which reads as a mystery control firing out of nowhere. */
    pointer-events: none;
    transition: opacity 0.15s ease;
  }
  .readfirst-row:hover .options-injected-action-hover,
  .readfirst-row:focus-within .options-injected-action-hover,
  .options-readfirst-card:hover .options-injected-action-hover,
  .options-readfirst-card:focus-within .options-injected-action-hover {
    opacity: 1;
    pointer-events: auto;
  }
  /* Touch and other hover-less pointers never fire :hover, so a hover-gated
     action would be permanently unreachable there. Show it unconditionally
     instead — losing the tidiness beats losing the functionality. */
  @media (hover: none), (pointer: coarse) {
    .options-injected-action-hover {
      opacity: 1;
      pointer-events: auto;
    }
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

// A status box (Needs attention / Set / Optional). Matches the "Focus" prototype:
// a barely-there accent border + a ~5%-opacity tint, NOT the loud intent border a
// stock ReqorePanel draws. `$accent` is the box's theme colour (warning/success/
// muted).
export const StyledStatusBox = styled(ReqorePanel)<{ $accent: string; $bg?: string }>`
  &&& {
    border: 1px solid ${({ $accent }) => `${$accent}33`};
    /* $bg lets the muted "Optional" box opt into a darker, recessed surface
       instead of the faint accent tint the coloured boxes use. */
    background: ${({ $accent, $bg }) => $bg || `${$accent}1f`};
    border-radius: 10px;
  }
`;

// "One of the below is required" cluster box — wraps the members of an unmet
// one-of required group (in the Needs-attention box) so the constraint reads as
// one unit. The connection rail + status nodes still render inside (they convey
// which member satisfies the group); this box adds the explicit heading.
export const StyledRequiredClusterBox = styled.div<{ $border: string; $tint: string }>`
  border: 1px solid ${({ $border }) => $border};
  border-radius: 8px;
  background: ${({ $tint }) => $tint};
  padding: 2px 6px 6px;
  margin: 4px 0;
  /* The members render directly here (not via the gapped group body), so give
     them the same modest gap the rest of the rows have. Pin the divider-centring
     var to that gap (it doesn't widen in narrow like the group body's does). */
  display: flex;
  flex-flow: column;
  --readfirst-row-gap: 4px;
  gap: 4px;
`;
export const StyledRequiredClusterHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px ${GROUP_INDENT};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
`;

// Thin schema-group sub-label inside a status box (CONNECTION / AUTHENTICATION /
// …). Quiet by design — the box header is the loud heading; this just keeps each
// field's group context as you scan. Indented to the rows' content line.
export const StyledStatusBoxGroupLabel = styled.div`
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  opacity: 0.5;
  padding: 8px 0 2px ${GROUP_INDENT};
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
     built-in ReqoreInput clear — ReqoreInput has no prop to hide it, and a
     separate input ✕ plus the row-level trash action
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

/* The card (expanded) label matches the read-row label exactly — same size /
   weight / case — so a field's name doesn't switch styles when you open it. */
export const StyledCardLabel = styled.div<{ $color: string }>`
  font-size: 13px;
  font-weight: 600;
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* min-width: 0 lets the grid cell shrink below its content's intrinsic width
   so the ellipsis engages instead of overflowing. */
export const StyledRowValue = styled.div<{ $color: string; $empty?: boolean }>`
  min-width: 0;
  font-size: 13px;
  /* Value + inline reason(s) share the line, wrapping the reason below only when
     it doesn't fit (the Focus prototype's layout). */
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
  row-gap: 2px;
  /* The muted/translucent colour applies to the VALUE TEXT only — not the whole
     cell — so the message panels and the structured preview below render at full
     opacity instead of inheriting the dimmed value colour. */
  .options-readfirst-valuetext {
    min-width: 0;
    max-width: 100%;
    color: ${({ $color }) => $color};
    font-style: ${({ $empty }) => ($empty ? 'italic' : 'normal')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The code size chip kept above an OPEN editor. The read row puts the same chip
     at the top of the value cell with a 2px row-gap under it; matching that here is
     what stops the editor moving as the field opens. */
  .options-readfirst-editing-summary {
    margin-bottom: 2px;
  }
  .options-readfirst-reason {
    font-style: italic;
    font-size: 12px;
    line-height: 1.3;
  }
  /* Schema message panels: full width of the value column, on their own line
     directly beneath the value. */
  .options-readfirst-info-panel {
    flex-basis: 100%;
    width: 100%;
    display: flex;
    flex-flow: column;
    gap: 4px;
    margin-top: 4px;
  }
  /* Read-only companions of the value: what a chosen option means, on its own
     line under it; and a long text drawn in full in the inset. */
  .options-readfirst-choice-desc {
    flex-basis: 100%;
    width: 100%;
    min-width: 0;
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.6;
  }
  .options-readfirst-text {
    color: ${({ $color }) => $color};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
`;

export const StyledRowActions = styled.div`
  display: flex;
  align-items: center;
  /* No align-self override: the actions (incl. the status dot) follow the row's
     own vertical alignment — CENTRED on the common single-line row, TOP-aligned
     (first line) on the tall rows that opt into align-items:start (descriptions /
     message panels / hash previews). */
  gap: 6px;
`;

// A single status mark pinned at the row's trailing edge: one dot, colour =
// severity (danger/warning/success). This is the "Focus" read-first signal that
// replaces the recessed value surface's intent stripe — attention dots carry a
// faint ring, a plain "set" dot does not. `unset` rows render no dot.
export const StyledStatusDot = styled.span<{ $color: string; $ring?: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: ${({ $color }) => $color};
  box-shadow: ${({ $color, $ring }) => ($ring ? `0 0 0 3px ${$color}22` : 'none')};
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

// The structured hash/list preview, rendered inside the value cell directly
// under the value summary. Full-width of the value column (it's a flex child of
// the wrapping value cell) so it lines up with the value, not the label gutter.
export const StyledRowInset = styled.div`
  flex-basis: 100%;
  width: 100%;
  margin-top: 4px;
`;

/**
 * The stack literal text renders in: source, ids, tokens, data strings.
 *
 * Defined HERE rather than taken from reqore's `ReqoreFonts.mono`, which is the
 * same stack. Reqore is a peer dependency at `>=0.71.16` and that export arrived
 * later, so reading it would crash every consumer inside the declared range —
 * the whole form preview lost over a font choice. One local constant costs
 * nothing and keeps the code preview and the schema view's data values
 * identical, which is the only reason to share it in the first place.
 */
export const MONO_FONT_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// A collapsed code-block preview shown under the value summary for a
// `code-editor` field.  Multi-line, monospace, subtle background — matches
// the aesthetic of the classic code-view surface but small enough to sit
// inside a read-row.  Height is capped by the wrapping `ReqoreCollapsibleContent`
// so the "Show more" affordance stays useful.
export const StyledCodePreview = styled.pre<{ $bg: string; $border: string; $fg: string }>`
  margin: 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $border }) => $border};
  color: ${({ $fg }) => $fg};
  font-family: ${MONO_FONT_STACK};
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
  max-width: 100%;
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
  /** Edge colour for the "N more fields" row. Its own value because the row
      HAS to be seen — the divider tint that separates two fields is ~8% of the
      text colour, which disappears entirely as a 1px dashed border. */
  $moreBorder: string;
}>`
  display: flex;
  flex-flow: column;
  position: relative;
  /* Exposed as a var so the inter-field divider can centre itself in the gap
     (the gap differs wide vs narrow). */
  --readfirst-row-gap: 4px;
  gap: var(--readfirst-row-gap);

  /* Indent each field block under the group header by a FLUID step. The %
     resolves against this container's width (not the screen), so it tracks the
     (Field blocks no longer get a left gutter — the spine/rail that needed it are
     gone, so rows sit flush against the box, like the Focus prototype.) */
  > * {
    margin-left: 0;
  }

  /* No group spine: the "Focus" look keeps the rows flat against the box. (The
     required-group rail is a separate descendant ::after and still renders.) */

  .readfirst-row {
    display: grid;
    /* Fixed label column: the recessed value surface (::before below) starts at a
       constant x, so the label width can't flex or the stripe would drift off the
       value edge. The value column is minmax(0, 1fr) — a bare 1fr keeps its
       min-content width, so a long unbroken value (e.g. a URL) would force the
       grid wider than its container and produce a horizontal scrollbar. The 0
       minimum lets it shrink and the value cell's ellipsis take over instead. */
    grid-template-columns: ${LABEL_COL} minmax(0, 1fr) auto;
    /* CENTRE the cells vertically: on the common single-line read row the label,
       value and status dot all sit on one centred line. Tall rows (a shown
       description, message panels or a hash preview) opt back into top-alignment
       (.readfirst-row-info-open / .readfirst-row-tall below) so the label + dot
       stay on the value's FIRST line instead of floating to the middle. */
    align-items: center;
    gap: 14px;
    /* Generous, SYMMETRIC vertical padding so a single-line row isn't cramped
       (content sits with even breathing room top + bottom); a min-height floor
       keeps the rare shorter row a comfortable tap target. */
    min-height: 40px;
    padding: 9px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  /* A dim hairline in the gap below each field so its start/end reads clearly.
     Absolutely positioned (not a border) so it stays straight + full-width and
     the row's rounded hover highlight is unaffected; sits in the inter-row gap. */
  .readfirst-row::after {
    content: '';
    position: absolute;
    /* Inset to the row's horizontal padding so the line spans the content, not
       the full box edge-to-edge. */
    left: ${COMPACT_ROW_PAD_X}px;
    right: ${COMPACT_ROW_PAD_X}px;
    /* Centred in the inter-field gap (which differs wide vs narrow) so the space
       above and below each line is equal. */
    bottom: calc(var(--readfirst-row-gap, 4px) / -2);
    height: 1px;
    background: ${({ $divider }) => $divider};
    opacity: 0.5;
    pointer-events: none;
    z-index: 0;
  }
  .readfirst-row:last-child::after {
    display: none;
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
  /* The "N more fields" control IS a field row — same grid, same padding, same
     hover — so it lines up with the rows above instead of floating as a scrap
     of text in the box's corner. A dashed edge and a lower-contrast label are
     what say it is not itself a field: nothing here can be set.

     It spans both content columns because it has no label/value split, and it
     drops the inter-row hairline (the ::after rule) since it always sits last. */
  .readfirst-more-row {
    grid-template-columns: 1fr auto;
    border: 1px dashed ${({ $moreBorder }) => $moreBorder};
    background: transparent;
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    /* The dashed edge replaces the hairline; two lines would read as a divider
       AND a border stacked. */
    margin-top: 2px;
  }
  .readfirst-more-row::after {
    display: none;
  }
  .readfirst-more-row:hover {
    background: ${({ $hover }) => $hover};
    border-style: solid;
  }
  .readfirst-more-row:focus-visible {
    outline: 2px solid ${({ $focus }) => $focus};
    outline-offset: -2px;
  }
  /* The chevron points the way the click goes: down to reveal, up to fold. */
  .readfirst-more-row .readfirst-more-chevron {
    transition: transform 0.15s ease;
  }
  .readfirst-more-row[aria-expanded='true'] .readfirst-more-chevron {
    transform: rotate(180deg);
  }
  /* A disabled field (schema disabled flag or unmet dependencies) is not a
     click target — no hover invite, not-allowed cursor; a lock replaces the
     pencil. */
  /* A disabled field reads dimmed (its name + value at 0.6) — clearly inactive. */
  .readfirst-row-disabled {
    cursor: not-allowed;
    opacity: 0.6;
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
    /* No top padding (the per-cell nudges below anchor the editor to the first
       line), but a real BOTTOM padding so the editor never sits flush against
       the row's bottom edge — a tall input used to look clipped/unfinished. */
    padding-top: 0;
    padding-bottom: 9px;
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
  /* A read-only row is not a control. No pointer and no hover tint, because a
     click does nothing; and its value wraps in full — the row is the only
     rendering the value gets, so a line cut with an ellipsis would be the
     reader's whole answer. */
  .readfirst-row-read {
    cursor: default;
  }
  .readfirst-row-read:hover {
    background: transparent;
  }
  .readfirst-row-read .options-readfirst-valuetext {
    white-space: pre-wrap;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
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
  /* Generous breathing room BETWEEN fields when stacked — far easier to scan and
     less overwhelming on a phone. */
  &.readfirst-narrow {
    --readfirst-row-gap: 18px;
  }
  &.readfirst-narrow .readfirst-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 14px;
    position: relative;
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
  /* Read (non-editing) rows: float the trailing actions (status dot + the
     hover-revealed delete/revert) out of the grid flow so a delete button can't
     inflate the first row and push the value down. They're pinned to a band the
     height of the LABEL line and vertically centred in it — so the dot always
     sits at the same place (centred on the field name), never the bare corner. */
  &.readfirst-narrow .readfirst-row:not(.readfirst-row-editing) > :nth-child(3) {
    position: absolute;
    top: 2px;
    right: 10px;
    height: 22px;
  }
  &.readfirst-narrow .readfirst-row:not(.readfirst-row-editing) > :nth-child(1) {
    padding-right: 46px;
  }

  /* Focus calm rows: NO recessed value surface and NO intent stripe. Row status
     is carried by the trailing status dot; message/preview panels keep their own
     intent backgrounds. The (now invisible) pseudo is retained only to preserve
     the block's positioning/stacking context that the required-group rail and its
     cluster nodes resolve against — removing it would unmoor them. */
  > *:not(.options-readfirst-card) {
    position: relative;
  }
  > *:not(.options-readfirst-card)::before {
    content: '';
    position: absolute;
    inset: 0;
    left: ${PANEL_LEFT_CSS};
    background: transparent;
    pointer-events: none;
    z-index: 0;
  }
  /* Content rides above the surface layer — except the cluster node, which is
     absolutely positioned in the gutter and must keep its own positioning. */
  > *:not(.options-readfirst-card) > *:not(.options-readfirst-node) {
    position: relative;
    z-index: 1;
  }

  /* (The required-group connection rail was removed — the "One of the below is
     required" box now carries the grouping.) */

  /* Tall rows top-anchor (overriding the row's centred default) so the label and
     dot stay on the value's FIRST line rather than floating to the vertical
     middle: .readfirst-row-info-open = a shown short_desc grows the LABEL;
     .readfirst-row-tall = message panels / a hash preview grow the VALUE cell. */
  .readfirst-row-info-open,
  .readfirst-row-tall {
    align-items: start;
  }
  /* Narrow stacks label-over-value: the value aligns flush UNDER the label (no
     indent), like the Focus prototype. */
  &.readfirst-narrow .readfirst-row > :nth-child(2) {
    padding-left: 0;
  }
  &.readfirst-narrow > *:not(.options-readfirst-card)::before {
    left: 0;
  }
  /* Touch layouts have no hover: a slot reserved for the hover-revealed edit
     pencil is permanent dead space that insets every chip from the edge —
     drop it (rows are tap-to-edit; the lock/add slots stay, they're static). */
  &.readfirst-narrow .options-readfirst-trailing-hover-only {
    /* !important: the slot carries an inline display for the desktop layout. */
    display: none !important;
  }
  /* Stacked rows: keep them tight (match the Focus prototype). The min-height is
     dropped so a 2-line label+value row sizes to its content instead of being
     padded out to 38px. The in-place editor keeps zero padding (below). */
  &.readfirst-narrow .readfirst-row {
    padding-top: 2px;
    padding-bottom: 2px;
    min-height: 0;
  }
  &.readfirst-narrow .readfirst-row-editing {
    padding-top: 0;
    padding-bottom: 0;
  }
`;

// One absorbed sibling, rendered inside its host row's container rather than
// on a row of its own (see `absorb_fields`). The pair this exists for is a code
// editor and its language: reading them as two unrelated rows one above the
// other said they were separate decisions, and they are not.
//
// Laid out as label-then-control on one line so it reads as a property of the
// element it now sits in, and separated from the editor below it by a hairline
// rather than a gap — the two share one container, so the seam has to look like
// a division inside it and not like two stacked things.
export const StyledAbsorbedField = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid ${({ theme }) => `${theme.main}22`};
`;

export const StyledAbsorbedLabel = styled(ReqoreP)`
  flex: 0 0 auto;
  margin: 0;
`;
