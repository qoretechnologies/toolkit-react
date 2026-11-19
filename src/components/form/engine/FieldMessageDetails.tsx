import { ReqoreButton, ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { memo, useCallback, useState } from 'react';
import { useReqraftLabels } from '../../../helpers/reqraftLabels';
import { withCodeFont } from '../fields/codeFont';

export interface IFieldMessageDetailsProps {
  /** What the message keeps out of its sentence: a code, an error's raw text. */
  details: string;
  /**
   * What the detail is, which names the reveal: "the event record" reads "Show the event record" and "Hide the event
   * record". Unset, it is the error details (`formEngine.errorDetails`).
   */
  name?: string;
}

/**
 * A field message's technical detail behind a reveal: the message says what is wrong and what to do in words, and the
 * code or the raw text that goes with it is a click away, in the code font, never in the sentence a reader has to
 * read first. The reveal says what it shows ("Show the error details"), never "Technical details".
 */
export const FieldMessageDetails = memo(({ details, name }: IFieldMessageDetailsProps) => {
  const words = useReqraftLabels().formEngine;
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const what = name || words.errorDetails;

  return (
    <ReqoreControlGroup vertical className='options-message-details'>
      <ReqoreButton
        size='tiny'
        minimal
        flat
        fixed
        icon={open ? 'ArrowUpSLine' : 'CodeLine'}
        aria-expanded={open}
        className='options-message-details-toggle'
        onClick={toggle}
      >
        {open ? words.hideMessageDetails(what) : words.showMessageDetails(what)}
      </ReqoreButton>
      {open ?
        <ReqoreP
          size='small'
          className='options-message-details-text'
          effect={withCodeFont({ opacity: 0.8 })}
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {details}
        </ReqoreP>
      : null}
    </ReqoreControlGroup>
  );
});
