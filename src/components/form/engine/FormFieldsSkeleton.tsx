import { ReqoreControlGroup, ReqoreSkeleton } from '@qoretechnologies/reqore';

export interface IFormFieldsSkeletonProps {
  /** How many field rows to stand in for. */
  rows?: number;
  className?: string;
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
export const FormFieldsSkeleton = ({ rows = 6, className }: IFormFieldsSkeletonProps) => (
  <ReqoreControlGroup
    className={className}
    vertical
    fluid
    gapSize='big'
    style={{ padding: '12px 6px', width: '100%' }}
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
