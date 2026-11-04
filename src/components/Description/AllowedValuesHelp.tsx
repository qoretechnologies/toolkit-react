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
  $muted: string;
  $tint: string;
  $border: string;
  $compact?: boolean;
}>`
  margin-top: 8px;
  max-width: 100%;
  /* one size for all of it: the heading, the column names, the values and what is said of them */
  font-size: ${({ $compact }) => ($compact ? '12px' : '13px')};
  line-height: 1.45;
  color: ${({ $text }) => $text};

  .allowed-values-heading {
    font-weight: 700;
    margin-bottom: 4px;
  }

  /* as wide as what it says, up to the help's width: stretched across a wide dialog, its columns stood apart */
  table {
    width: auto;
    max-width: 100%;
    border-collapse: collapse;
    font-size: inherit;
  }

  th {
    text-align: left;
    font-weight: 600;
    color: ${({ $muted }) => $muted};
    padding: 2px 10px 4px 0;
    border-bottom: 1px solid ${({ $border }) => $border};
  }

  td {
    padding: 4px 10px 4px 0;
    vertical-align: top;
    border-bottom: 1px solid ${({ $border }) => $border};
    /* a long word wraps in its cell: the table never runs wider than the help it is in */
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  /* the exact value, as data: the code chip the markdown view draws code in, at the same size as the rest */
  .allowed-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 1em;
    background: ${({ $tint }) => $tint};
    border: 1px solid ${({ $border }) => $border};
    border-radius: 3px;
    padding: 0 0.35em;
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;

export interface IAllowedValuesHelpProps {
  /** The field's allowed values, however each entry is written (`allowedValueOf`). */
  values: unknown[];
  /** The values are suggestions: the field takes others too. */
  suggested?: boolean;
  compact?: boolean;
}

/** One allowed value as a row of the table: the exact value, its own name, and what is said of it. */
const rowOf = (entry: unknown) => {
  const value = allowedValueOf(entry as { value?: unknown; name?: unknown });
  const exact = typeof value === 'string' ? value : JSON.stringify(value);
  const name = allowedValueName(entry as never);
  const said = (entry as { short_desc?: unknown; desc?: unknown } | undefined) ?? {};
  return {
    exact,
    name: name && name !== exact ? name : '',
    description: markdownToProse(said.short_desc || said.desc),
  };
};

/**
 * The values a field takes, as help shows them (qorus#646, David's policy): a bold heading, then a small table, a
 * row a value - the exact value as data, its name where it has one of its own, and its description. A column no
 * value has anything in is left out. One font size throughout, and every cell wraps, so it fits a phone. It was a
 * bulleted list, whose descriptions ran on straight after their values in a larger font (David: "try a table for
 * this instead"). "Suggested values" heads the values of a field that takes others too.
 */
export const AllowedValuesHelp = ({ values, suggested, compact }: IAllowedValuesHelpProps) => {
  const theme = useReqoreTheme();
  const text = getReadableColor(theme);
  if (!values.length) {
    return null;
  }
  const rows = values.map(rowOf);
  const named = rows.some((row) => !!row.name);
  const described = rows.some((row) => !!row.description);
  return (
    <StyledAllowedValues
      className='allowed-values-help'
      $text={text}
      $muted={getReadableColor(theme, undefined, undefined, true)}
      $tint={`${text}14`}
      $border={`${text}24`}
      $compact={compact}
    >
      <div className='allowed-values-heading'>
        {suggested ? SUGGESTED_VALUES_HEADING : ALLOWED_VALUES_HEADING}
      </div>
      <table className='allowed-values-table'>
        <thead>
          <tr>
            <th scope='col'>Value</th>
            {named ?
              <th scope='col'>Name</th>
            : null}
            {described ?
              <th scope='col'>Description</th>
            : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.exact}-${index}`}>
              <td>
                <code className='allowed-value'>{row.exact}</code>
              </td>
              {named ?
                <td className='allowed-value-name'>{row.name}</td>
              : null}
              {described ?
                <td className='allowed-value-description'>{row.description}</td>
              : null}
            </tr>
          ))}
        </tbody>
      </table>
    </StyledAllowedValues>
  );
};
