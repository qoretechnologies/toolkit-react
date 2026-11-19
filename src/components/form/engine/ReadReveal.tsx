// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreCollapsibleContent } from '@qoretechnologies/reqore';
import { IReqoreCollapsibleContentProps } from '@qoretechnologies/reqore/dist/components/CollapsibleContent';
import { createContext, memo, useContext, useMemo } from 'react';
import { useReqraftLabels } from '../../../helpers/reqraftLabels';

/**
 * Where a read value's reveal sits while the value is clipped: `'overlay'`, inside the fade over the last lines in
 * view (Reqore's default), or `'below'`, on its own line under the clipped value, so it never covers it. `'below'` is
 * Reqore's `buttonPlacement`, from Reqore 0.79.
 */
export type TReadRevealPlacement = 'overlay' | 'below';

/** What a read value's reveal shows the whole of: the source code, the value, or the text. */
export type TReadRevealHolds = 'source' | 'value' | 'text';

const ReadRevealPlacementContext = createContext<TReadRevealPlacement | undefined>(undefined);

/** The placement every read reveal below it takes (`FormEngine`'s `readRevealPlacement`). */
export const ReadRevealPlacementProvider = ReadRevealPlacementContext.Provider;

/** The placement in force here; `undefined` where nothing set one (Reqore's own default then). */
export const useReadRevealPlacement = (): TReadRevealPlacement | undefined =>
  useContext(ReadRevealPlacementContext);

export interface IReadRevealProps
  extends Omit<IReqoreCollapsibleContentProps, 'showMoreLabel' | 'showLessLabel'> {
  /** What the value is, which the reveal's words name ("Show the whole source"). */
  holds: TReadRevealHolds;
}

/**
 * A read value clipped to a few lines, and the reveal that shows the whole of it: the reveal says what it shows
 * ("Show the whole source", "Show the whole value", "Show the whole text"), never a bare "Show more", and sits where
 * the form says (`readRevealPlacement`). The placement is handed to Reqore only when the form sets one, so a host on
 * a Reqore before 0.79, which has no `buttonPlacement`, gets nothing it does not know.
 */
export const ReadReveal = memo(({ holds, children, ...props }: IReadRevealProps) => {
  const words = useReqraftLabels().formEngine;
  const placement = useReadRevealPlacement();
  const placementProps = useMemo(
    () => (placement ? ({ buttonPlacement: placement } as object) : undefined),
    [placement]
  );

  return (
    <ReqoreCollapsibleContent
      showMoreLabel={words.revealWhole[holds]}
      showLessLabel={words.revealLess[holds]}
      {...props}
      {...placementProps}
    >
      {children}
    </ReqoreCollapsibleContent>
  );
});
