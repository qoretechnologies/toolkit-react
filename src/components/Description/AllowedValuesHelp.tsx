// Copyright 2026 Qore Technologies, s.r.o.
import { useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import styled from 'styled-components';
import { allowedValueName, allowedValueOf } from '../../helpers/allowedValues';
import { markdownToProse } from '../../helpers/markdownText';

/** What help says to head the values a field holds one of. */
export const ALLOWED_VALUES_HEADING = 'Allowed values';
/** What help says to head the values a field offers, where it takes others too. */
export const SUGGESTED_VALUES_HEADING = 'Suggested values';

const StyledAllowedValues = styled.div<{
  $text: string;
  $tint: string;
  $border: string;
  $compact?: boolean;
}>`
  margin-top: 6px;
  font-size: ${({ $compact }) => ($compact ? '12px' : '13px')};
  color: ${({ $text }) => $text};

  .allowed-values-heading {
    font-weight: 700;
  }

  ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }

  li {
    margin: 2px 0;
  }

  /* the exact value, as data: the same chip the markdown view draws code in */
  .allowed-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: ${({ $tint }) => $tint};
    border: 1px solid ${({ $border }) => $border};
    border-radius: 3px;
    padding: 0.05em 0.35em;
    word-break: break-word;
  }
`;

export interface IAllowedValuesHelpProps {
  /** The field's allowed values, however each entry is written (`allowedValueOf`). */
  values: unknown[];
  /** The values are suggestions: the field takes others too. */
  suggested?: boolean;
  compact?: boolean;
}

/**
 * The values a field takes, as help shows them (qorus#646, David: "use a bulleted list with an "Allowed values"
 * header in bold and data styling for each value to make it clear for the user that exact allowed values are being
 * presented"): a bold heading, then one bullet a value - the exact value as data, then its name where it has one of
 * its own, and its description. "Suggested values" heads the values of a field that takes others too.
 */
export const AllowedValuesHelp = ({ values, suggested, compact }: IAllowedValuesHelpProps) => {
  const theme = useReqoreTheme();
  const text = getReadableColor(theme);
  if (!values.length) {
    return null;
  }
  return (
    <StyledAllowedValues
      className='allowed-values-help'
      $text={text}
      $tint={`${text}14`}
      $border={`${text}24`}
      $compact={compact}
    >
      <div className='allowed-values-heading'>
        {suggested ? SUGGESTED_VALUES_HEADING : ALLOWED_VALUES_HEADING}
      </div>
      <ul>
        {values.map((entry, index) => {
          const value = allowedValueOf(entry as { value?: unknown; name?: unknown });
          const exact = typeof value === 'string' ? value : JSON.stringify(value);
          const name = allowedValueName(entry as never);
          const said = (entry as { short_desc?: unknown; desc?: unknown } | undefined) ?? {};
          const description = markdownToProse(said.short_desc || said.desc);
          return (
            <li key={`${exact}-${index}`}>
              <code className='allowed-value'>{exact}</code>
              {name && name !== exact ?
                <span className='allowed-value-name'> {name}</span>
              : null}
              {description ?
                <span className='allowed-value-description'>
                  {name && name !== exact ? ': ' : ' '}
                  {description}
                </span>
              : null}
            </li>
          );
        })}
      </ul>
    </StyledAllowedValues>
  );
};
