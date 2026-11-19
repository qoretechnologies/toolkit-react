// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreButton, ReqoreControlGroup, ReqoreSpan } from '@qoretechnologies/reqore';
import { memo } from 'react';
import { reqraftLabels } from '../../../helpers/reqraftLabels';

/** A field that holds its default, which nobody has set. */
export interface IDefaultField {
  /** The field's option name. */
  name: string;
  /** What the field is called. */
  label: string;
  /** Its value, as its row would say it ("Qore"). */
  value: string;
  /** Whether the field is a choice, whose value names itself ("Uses Qore"). */
  choice: boolean;
  /** What the schema says of its default (`default_value_desc`): "Falls back to 30 seconds when unset." */
  description?: string;
}

/** What is said of a field that holds its default: "Uses Qore", or "Uses 30 for Timeout — Falls back to …". */
export const defaultNoteText = ({ label, value, choice, description }: IDefaultField): string => {
  const uses = reqraftLabels().formEngine.usesDefault(value, choice ? undefined : label);

  return description ? `${uses} — ${description}` : uses;
};

export interface IDefaultsNoteProps {
  fields: IDefaultField[];
  /** The colour of the quiet words. */
  color?: string;
  /** Opens the field to change it; none on a form that is only read. */
  onChange?: (name: string) => void;
}

/**
 * The defaults a form uses, under its boxes: one quiet line each, "Uses Qore · Change", nothing when there are none.
 *
 * A field the person never touched whose value is its default is not something they set, so it is not listed as
 * "Set": on a new workflow the only thing "Set" was "Language: Qore", which a person who does not write code never
 * chose. "Change" opens the field, which is then an ordinary row.
 */
export const DefaultsNote = memo(({ fields, color, onChange }: IDefaultsNoteProps) => {
  if (!fields.length) {
    return null;
  }
  const words = reqraftLabels().formEngine;

  return (
    <div className='form-default-notes'>
      {fields.map((field) => (
        <ReqoreControlGroup
          key={field.name}
          className='form-default-note'
          data-field-default={field.name}
          gapSize='small'
          verticalAlign='center'
          wrap
        >
          <ReqoreSpan size='small' effect={color ? { color: color as never } : undefined}>
            {defaultNoteText(field)}
          </ReqoreSpan>
          {onChange ?
            <ReqoreButton
              size='small'
              minimal
              flat
              fixed
              className='form-default-change'
              aria-label={words.changeDefaultLabel(field.label)}
              onClick={() => onChange(field.name)}
            >
              {words.changeDefault}
            </ReqoreButton>
          : null}
        </ReqoreControlGroup>
      ))}
    </div>
  );
});
