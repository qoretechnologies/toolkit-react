import { ReqoreButton, useReqoreTheme } from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';

export interface IReqraftCollapsibleContentProps {
  /** The content to reveal. Always rendered; clipped behind the fade when taller than the threshold. */
  children: ReactNode;
  /**
   * Natural-height threshold (px). When the content is taller than this it is
   * clipped to this height and faded out with a "Show more" affordance; shorter
   * content is shown in full with no fade. Default 300.
   */
  maxCollapsedHeight?: number;
  /** Reveal-button label. Default 'Show more'. */
  showMoreLabel?: string;
  /** Collapse-button label. Default 'Show less'. */
  showLessLabel?: string;
  /**
   * Surface colour the gradient fades into — should match whatever the content
   * sits on so the fade is seamless. Defaults to the Reqore theme's `main`.
   */
  fadeColor?: string;
  /** Optional accent (`customTheme.main`) for the reveal / collapse buttons. */
  accentColor?: string;
  /** Extra props forwarded to the reveal / collapse buttons. */
  buttonProps?: Partial<IReqoreButtonProps>;
  /** Start expanded (skip the initial clip). Default false. */
  defaultExpanded?: boolean;
}

const StyledCollapsibleWrapper = styled.div<{ $collapsed: boolean; $maxHeight: number }>`
  position: relative;
  ${({ $collapsed, $maxHeight }) =>
    $collapsed &&
    css`
      max-height: ${$maxHeight}px;
      overflow: hidden;
    `}

  /* The reveal button is invisible until the content is hovered, so the fade
     reads as a quiet "there's more" cue that only sprouts a button on intent. */
  &:hover .reqraft-show-more {
    opacity: 1;
  }
`;

const StyledShowMoreOverlay = styled.div<{ $fade: string; $height: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1;
  height: ${({ $height }) => $height}px;
  background: linear-gradient(to bottom, transparent, ${({ $fade }) => $fade});
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  /* Let clicks fall through the gradient to the content, except on the button. */
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;

/**
 * Height-clipping "Show more" reveal: tall content clips behind a gradient fade
 * with a hover-surfaced reveal button. Extracted from the IDE's Qonsole
 * chat-bubble CollapsibleContent; the fade blends into the Reqore theme.
 */
export const ReqraftCollapsibleContent = memo(
  ({
    children,
    maxCollapsedHeight = 300,
    showMoreLabel = 'Show more',
    showLessLabel = 'Show less',
    fadeColor,
    accentColor,
    buttonProps,
    defaultExpanded = false,
  }: IReqraftCollapsibleContentProps) => {
    const theme = useReqoreTheme();
    const ref = useRef<HTMLDivElement>(null);
    const [isCollapsed, setIsCollapsed] = useState(!defaultExpanded);
    const [needsCollapse, setNeedsCollapse] = useState(false);
    const [hasMeasured, setHasMeasured] = useState(false);

    // Measure the content's natural height to decide whether the fade is needed.
    // `scrollHeight` reports the full content height even while the wrapper is
    // max-height-clipped, so no style juggling is needed. A one-shot measure is
    // not enough: ReQore children can lay out well after mount (animated mounts,
    // web fonts), so a ResizeObserver on the content keeps the verdict honest.
    useEffect(() => {
      const node = ref.current;
      if (!node || !isCollapsed) {
        return undefined;
      }

      function measure() {
        setNeedsCollapse(node.scrollHeight > maxCollapsedHeight);
        setHasMeasured(true);
        // The children may not have mounted yet when this effect ran (ReQore
        // renders some content a frame late, reliably so in the headless
        // test-runner) — (re-)observe whatever is there now. The wrapper alone
        // is not enough for late growth while clipped: its box size stays
        // constant, only the children's changes. observe() is idempotent.
        Array.from(node.children).forEach((child) => observer.observe(child));
      }

      const observer = new ResizeObserver(measure);
      observer.observe(node);
      const frame = requestAnimationFrame(measure);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
      };
    }, [children, isCollapsed, maxCollapsedHeight]);

    // Clip until we've measured (avoids a flash of full content), then only when
    // the content actually overflows.
    const showCollapsed = isCollapsed && (!hasMeasured || needsCollapse);
    const fade = fadeColor || (theme as { main?: string } | undefined)?.main || '#181818';
    // `customTheme.main` is a branded colour type in Reqore; cast the plain hex through.
    const customTheme = (accentColor ? { main: accentColor } : undefined) as unknown as
      | IReqoreButtonProps['customTheme']
      | undefined;
    // Keep the fade gradient proportional to the clip (≈⅔), as in the source.
    const overlayHeight = Math.max(40, Math.round(Math.min(maxCollapsedHeight, 200) * 0.66));

    return (
      // Flex column so the (stretched) "Show less" button spans the full width,
      // matching the source — `fluid` alone doesn't stretch a standalone button.
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StyledCollapsibleWrapper ref={ref} $collapsed={showCollapsed} $maxHeight={maxCollapsedHeight}>
          {children}
          {showCollapsed && (
            <StyledShowMoreOverlay $fade={fade} $height={overlayHeight}>
              <ReqoreButton
                size='small'
                icon='ArrowDownSLine'
                label={showMoreLabel}
                customTheme={customTheme}
                effect={{ opacity: 0 }}
                flat={false}
                minimal
                {...buttonProps}
                className={`reqraft-show-more${buttonProps?.className ? ` ${buttonProps.className}` : ''}`}
                onClick={(e: React.MouseEvent) => {
                  // A disclosure toggle shouldn't activate an interactive row it sits inside.
                  e.stopPropagation();
                  // This button only renders while the content is clipped, so the
                  // click itself proves the content overflows — record that, in
                  // case the click lands in the brief clip-until-measured window
                  // (expanding cancels the pending measure, and without this the
                  // "Show less" button would never appear).
                  setNeedsCollapse(true);
                  setIsCollapsed(false);
                }}
              />
            </StyledShowMoreOverlay>
          )}
        </StyledCollapsibleWrapper>
        {needsCollapse && !isCollapsed && (
          <ReqoreButton
            size='small'
            icon='ArrowUpSLine'
            label={showLessLabel}
            customTheme={customTheme}
            flat={false}
            minimal
            {...buttonProps}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setIsCollapsed(true);
            }}
          />
        )}
      </div>
    );
  }
);

ReqraftCollapsibleContent.displayName = 'ReqraftCollapsibleContent';
