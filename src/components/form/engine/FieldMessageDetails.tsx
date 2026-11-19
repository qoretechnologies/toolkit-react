import { ReqoreButton, ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { memo, useCallback, useState } from 'react';
import { useReqraftLabels } from '../../../helpers/reqraftLabels';
import { withCodeFont } from '../fields/codeFont';

export interface IFieldMessageDetailsProps {
  /** What the message keeps out of its sentence: a code, an error's raw text. */
  details: string;
}

/**
 * A field message's technical detail behind a reveal: the message says what is wrong and what to do in words, and the
 * code or the raw text that goes with it is a click away ("Technical details"), in the code font, never in the
 * sentence a reader has to read first.
 */
export const FieldMessageDetails = memo(({ details }: IFieldMessageDetailsProps) => {
  const words = useReqraftLabels().formEngine;
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);

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
        {open ? words.hideMessageDetails : words.messageDetails}
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
