import { ReqoreControlGroup, ReqoreSkeleton } from '@qoretechnologies/reqore';

export interface IFormFieldsSkeletonProps {
  /** How many field rows to stand in for. */
  rows?: number;
  /**
   * Fill the height of the slot instead of being as tall as its rows.
   *
   * For a wait that stands in for a WHOLE form. Sizing from the row count makes
   * the placeholder a different height from the thing that replaces it, so the
   * swap resizes the container and everything jumps — measured on the live IDE
   * at 396px of skeleton in an 835px slot. Filling the slot keeps the geometry
   * still across the swap.
   *
   * NOT the default: a wait that stands in for one field or a nested hash is
   * meant to be the size of that field, and stretching it to fill a panel would
   * be a bigger lie than the jump.
   */
  fill?: boolean;
  className?: string;
  /**
   * Which wait this placeholder stands for, surfaced as `data-wait`.
   *
   * A form has seven independent reasons to be waiting and they all draw the
   * same picture, so "the form is still a placeholder at 2039ms" says nothing
   * about what to fix — measured on the live alert rule, three sections cleared
   * in the same commit and neither of the two shared waits (`types`, 140ms;
   * `templates`, 1500ms) explained it. Naming the reason in the DOM turns that
   * from a guess into a reading.
   */
  reason?: string;
}

/**
 * A form that has not arrived yet, drawn as the form it is about to be.
 *
 * ONE shape for every wait inside a form, which is the whole point of it.
 * Reported twice as "a series of skeletons": a single page could show the
 * engine's own loading state (three bars over three big blocks), then a
 * spinner reading "Loading field data…" while a field resolved its schema,
 * then an 80px block for a nested hash, then the host's own field-row
 * skeleton — four different pictures for one wait, each replacing the last, so
 * a load that is actually quite quick reads as a stack of unrelated screens.
 *
 * A row is a label bar over an input bar because that is what a field is. The
 * count is the only thing a caller varies: a nested field standing in for
 * itself asks for one, a whole form for several.
 */
export const FormFieldsSkeleton = ({
  rows = 6,
  fill,
  className,
  reason,
}: IFormFieldsSkeletonProps) => (
  <ReqoreControlGroup
    className={className}
    data-wait={reason}
    vertical
    fluid
    gapSize='big'
    /* No `width: '100%'` here: `fluid` above IS that, and stating it twice
       means the next person has two places to change. */
    style={{
      padding: '12px 6px',
      ...(fill ? { flex: '1 1 auto', minHeight: 0 } : {}),
    }}
  >
    {Array.from({ length: rows }).map((_, index) => (
      <ReqoreControlGroup key={index} vertical fluid gapSize='tiny'>
        <ReqoreSkeleton size='small' width='140px' height='12px' />
        <ReqoreSkeleton size='normal' width='100%' height='34px' />
      </ReqoreControlGroup>
    ))}
  </ReqoreControlGroup>
);

export default FormFieldsSkeleton;
