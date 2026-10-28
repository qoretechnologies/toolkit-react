import { ReqoreSpan } from '@qoretechnologies/reqore';
import { memo, useContext } from 'react';
import { useIsCalmForm } from '../engine/formAppearance';
import { RowLabelledContext } from '../engine/rowLabelled';

/**
 * The heading over a small group of choices (the checkboxes a field with three
 * or fewer allowed values renders) — the field's own name, or "Select one:"
 * when it has none.
 *
 * Not drawn under a form row's label (`RowLabelledContext`), which already names the
 * field. One component so both choice editors head their groups the same way, in
 * either appearance: an upper-case micro label by default; in the calm look the
 * words as written, at the small text size, because nothing in a calm form is
 * forced into capitals.
 */
export const ChoiceGroupHeading = memo(({ children }: { children: React.ReactNode }) => {
  const calm = useIsCalmForm();
  // Under a form row's label the heading only repeats it ("Language" over "Language:").
  const underRowLabel = useContext(RowLabelledContext);

  if (underRowLabel) {
    return null;
  }

  return (
    <ReqoreSpan
      className='reqraft-choice-group-heading'
      effect={calm ? { opacity: 0.7, weight: 'bold' } : { opacity: 0.6, uppercase: true, weight: 'bold' }}
      size={calm ? 'small' : 'tiny'}
    >
      {children}
    </ReqoreSpan>
  );
});

/**
 * The intent a picked choice in those groups takes. Blue by default; none in
 * the calm look, where blue says only "a filter is on" and the checked mark
 * already says which choice is picked.
 */
export const useSelectedChoiceIntent = (): ((selected: boolean) => 'info' | undefined) => {
  const calm = useIsCalmForm();

  return (selected) => (selected && !calm ? 'info' : undefined);
};
