// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreMessage } from '@qoretechnologies/reqore';
import { memo } from 'react';

/** A field the form does not show while it does not apply, that still holds a value. */
export interface IHiddenFieldWithValue {
  /** The field's option name. */
  name: string;
  /** What the field is called. */
  label: string;
  /** When it applies, as `describeDependencies` says it: `"Kind" must be "workflow"`. */
  conditions: string;
  /** Why its value is not valid, where it is not. */
  invalidReason?: string;
}

/**
 * What is said of a field hidden while it does not apply, that holds a value (qorus#646, David): it is not dropped
 * silently. The value is kept - the form does not clear it - but it is not used while the field is hidden, and a
 * value that is not valid says so, since there is no field to show it in.
 */
export const hiddenFieldNoteText = ({
  label,
  conditions,
  invalidReason,
}: IHiddenFieldWithValue): string =>
  `"${label}" is hidden until it applies (${conditions}). Its value is kept${
    invalidReason ?
      `, but it is not valid: ${invalidReason.replace(/\.$/, '')}`
    : ', and not used until then'
  }.`;

export interface IHiddenFieldsNoteProps {
  fields: IHiddenFieldWithValue[];
}

/**
 * The note a form shows for its hidden fields that hold a value, one line each; nothing when there are none. A
 * field whose `depends_on` does not hold is not shown at all - it appears once its dependency holds - so this is
 * where a value it holds meanwhile is accounted for.
 */
export const HiddenFieldsNote = memo(({ fields }: IHiddenFieldsNoteProps) => {
  if (!fields.length) {
    return null;
  }
  return (
    <ReqoreMessage
      className='form-hidden-field-notes'
      size='small'
      flat
      opaque={false}
      intent={fields.some((field) => field.invalidReason) ? 'warning' : 'info'}
      margin='bottom'
    >
      {fields.map((field) => (
        <div key={field.name} className='form-hidden-field-note' data-field-hidden={field.name}>
          {hiddenFieldNoteText(field)}
        </div>
      ))}
    </ReqoreMessage>
  );
});
