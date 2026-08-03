import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreInput,
} from '@qoretechnologies/reqore';
import { IReqoreControlGroupProps } from '@qoretechnologies/reqore/dist/components/ControlGroup';
import {
  IReqoreDropdownItem,
  TReqoreDropdownItems,
} from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import React, { memo } from 'react';
import styled from 'styled-components';
import { useContext } from 'use-context-selector';
import { CompactToolbarContext, TCompactSort } from './compactToolbarContext';

// Field sort modes, listed in the Fields menu's "Sort by" submenu. 'schema' is
// the default (the schema's declared order); the rest reorder within each group.
const SORT_MODES: { value: TCompactSort; label: string; tooltip: string }[] = [
  { value: 'schema', label: 'Default order', tooltip: 'The schema’s declared field order' },
  { value: 'alpha', label: 'Name A→Z', tooltip: 'Sort fields by name, ascending' },
  { value: 'alpha-desc', label: 'Name Z→A', tooltip: 'Sort fields by name, descending' },
  { value: 'unset', label: 'Unset first', tooltip: 'Fields without a value first' },
  { value: 'invalid', label: 'Invalid first', tooltip: 'Fields needing attention first' },
];

// "Focus" header: a summary line ({pct}% complete · {set}/{total} set ·
// {attention} need attention →) above a SEGMENTED meter — a green run (set) then
// an amber run (needs attention) then the empty remainder.
const StyledCompletion = styled.div`
  display: flex;
  flex-flow: column;
  gap: 8px;
  padding: 0 2px;
`;
const StyledCompletionLine = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
`;
const StyledMeter = styled.div<{
  $set: number;
  $attention: number;
  $track: string;
  $set_c: string;
  $att_c: string;
}>`
  position: relative;
  height: 4px;
  border-radius: 3px;
  width: 100%;
  overflow: hidden;
  background: ${({ $track }) => $track};
  /* No per-segment radius — the container's overflow:hidden + radius rounds only
     the OUTER corners, so the green/amber runs meet flush (no notch). */
  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
  }
  /* green run: 0 → set% */
  &::before {
    left: 0;
    width: ${({ $set }) => $set}%;
    background: ${({ $set_c }) => $set_c};
  }
  /* amber run: set% → set%+attention% */
  &::after {
    left: ${({ $set }) => $set}%;
    width: ${({ $attention }) => $attention}%;
    background: ${({ $att_c }) => $att_c};
  }
`;
// One shared text size for the whole summary line, so "Draft", "1/6 set" and
// "N need attention" all read at the same scale (no chips, no size jumps).
const StyledSummary = styled.span<{ $color?: string }>`
  font-size: 13px;
  white-space: nowrap;
  color: ${({ $color }) => $color || 'inherit'};
`;
const StyledAttentionLink = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
`;
// The percentage, pushed to the far right of the summary line.
const StyledPct = styled.span`
  margin-left: auto;
  font-weight: 700;
  font-size: 17px;
  white-space: nowrap;
`;

/**
 * The compact form's sticky toolbar (completion meter + field filter + "Fields"
 * menu). Rendered as the `as` component of the header panel's actions, so Reqore
 * instantiates it and may inject layout props (`fixed`, `customTheme`, …) — those
 * are spread onto the root control group, with `fluid`/`fixed={false}` forcing
 * the toolbar to fill the (label-less) header. All form state/handlers arrive via
 * `CompactToolbarContext`.
 */
export const CompactToolbar = memo((reqoreProps: Partial<IReqoreControlGroupProps>) => {
  const {
    readOnly,
    invalidCount,
    attentionCount,
    completion,
    onToggleInvalidOnly,
    hasMultipleOptions,
    compactQuery,
    setCompactQuery,
    requiredOnly,
    setRequiredOnly,
    compactSort,
    setCompactSort,
    showFieldTypes,
    onToggleFieldTypes,
    showAllDescriptions,
    onToggleAllDescriptions,
    filteredCount,
    canRevert,
    onAddOptionalField,
    onAddAll,
    onResetDefaults,
    onRevertAll,
  } = useContext(CompactToolbarContext);

  const theme = useReqoreTheme();
  const intents = (theme.intents || {}) as Record<string, string>;
  const cSuccess = intents.success || '#4a7110';
  const cWarning = intents.warning || '#d17c29';
  const cText = (theme.text?.color as string) || '#e8e8e8';
  const cTrack = `${cText}1f`;
  const setPct = completion.total ? (completion.set / completion.total) * 100 : 0;
  const attentionPct = completion.total ? (attentionCount / completion.total) * 100 : 0;

  return (
    <ReqoreControlGroup {...reqoreProps} vertical fluid fixed={false} gapSize='big'>
      {completion.total ?
        <StyledCompletion className='options-readfirst-completion'>
          <StyledCompletionLine>
            {!readOnly ?
              <StyledSummary
                className='options-readfirst-status'
                $color={invalidCount ? cWarning : cSuccess}
                style={{ fontWeight: 600 }}
              >
                {invalidCount ? 'Draft' : 'Ready'}
              </StyledSummary>
            : null}
            <StyledSummary style={{ opacity: 0.5 }}>
              {!readOnly ? '· ' : ''}
              {completion.set}/{completion.total} set
              {!readOnly && attentionCount ? ' ·' : ''}
            </StyledSummary>
            {!readOnly && attentionCount ?
              <StyledAttentionLink
                $color={cWarning}
                className='options-readfirst-attention-link'
                onClick={onToggleInvalidOnly}
              >
                {attentionCount} need attention →
              </StyledAttentionLink>
            : null}
            <StyledPct>{completion.pct}%</StyledPct>
          </StyledCompletionLine>
          <StyledMeter
            className='options-readfirst-completion-bar'
            $set={setPct}
            $attention={attentionPct}
            $track={cTrack}
            $set_c={cSuccess}
            $att_c={cWarning}
          />
        </StyledCompletion>
      : null}

      {hasMultipleOptions || (invalidCount && !readOnly) ?
        <ReqoreControlGroup vertical fluid gapSize='normal'>
          {hasMultipleOptions ?
            <ReqoreControlGroup fluid verticalAlign='center'>
              <ReqoreInput
                fluid
                pill
                icon='Search2Line'
                iconColor='muted'
                placeholder='Filter fields...'
                value={compactQuery}
                intent={compactQuery ? 'info' : undefined}
                className='options-readfirst-search'
                onChange={(event: React.FormEvent<HTMLInputElement>) =>
                  setCompactQuery(event.currentTarget.value)
                }
                onClearClick={() => setCompactQuery('')}
              />
              {!readOnly ?
                <ReqoreDropdown
                  fixed
                  flat
                  filterable
                  icon='Filter3Line'
                  tooltip='Fields'
                  className='options-readfirst-fields'
                  intent={requiredOnly ? 'info' : undefined}
                  badge={requiredOnly ? 'Required only' : undefined}
                  onItemSelect={(item: IReqoreDropdownItem) =>
                    item.value && onAddOptionalField(item.value)
                  }
                  items={
                    [
                      {
                        label: 'Required only',
                        selected: requiredOnly,
                        icon: requiredOnly ? 'CheckboxCircleLine' : 'CheckboxBlankCircleLine',
                        tooltip: 'Show only required fields',
                        onClick: () => setRequiredOnly((value) => !value),
                      },
                      {
                        label: 'Show field types',
                        selected: showFieldTypes,
                        icon: showFieldTypes ? 'CheckboxCircleLine' : 'CheckboxBlankCircleLine',
                        tooltip: 'Annotate each field with its type',
                        onClick: onToggleFieldTypes,
                      },
                      // Sort by — a submenu (collapsed by default) so the five modes
                      // don't crowd the Fields menu. Reorders fields WITHIN each group
                      // (groups + required-group rails preserved); the active non-
                      // default mode shows as a badge on the parent.
                      {
                        label: 'Sort by',
                        icon: 'ArrowUpDownLine',
                        intent: compactSort !== 'schema' ? 'info' : undefined,
                        badge:
                          compactSort !== 'schema' ?
                            SORT_MODES.find((mode) => mode.value === compactSort)?.label
                          : undefined,
                        items: SORT_MODES.map((mode) => ({
                          label: mode.label,
                          tooltip: mode.tooltip,
                          selected: compactSort === mode.value,
                          icon:
                            compactSort === mode.value ?
                              'CheckboxCircleLine'
                            : 'CheckboxBlankCircleLine',
                          onClick: () => setCompactSort(mode.value),
                        })),
                      },
                      {
                        label: 'Select all',
                        icon: 'MenuAddLine',
                        tooltip: 'Add every optional field',
                        disabled: filteredCount === 0,
                        onClick: onAddAll,
                      },
                      {
                        label: 'Default fields',
                        icon: 'RestartLine',
                        tooltip: 'Reset to the default set of fields',
                        onClick: onResetDefaults,
                      },
                      {
                        label: 'Revert all changes',
                        icon: 'HistoryLine',
                        tooltip: 'Undo all edits back to the loaded values',
                        disabled: !canRevert,
                        onClick: onRevertAll,
                      },
                      // The individual not-yet-added fields are no longer listed here —
                      // they render as addable rows in the Optional box instead. The
                      // menu keeps only the bulk actions above (Select all / Default
                      // fields / filters).
                    ] as TReqoreDropdownItems
                  }
                />
              : null}
              <ReqoreButton
                fixed
                flat
                minimal={showAllDescriptions === true}
                icon={showAllDescriptions ? 'InformationFill' : 'InformationLine'}
                className='options-readfirst-descriptions'
                intent={showAllDescriptions ? 'info' : undefined}
                tooltip={
                  showAllDescriptions ? 'Hide all field information' : 'Show all field information'
                }
                onClick={onToggleAllDescriptions}
              />
            </ReqoreControlGroup>
          : null}
        </ReqoreControlGroup>
      : null}
    </ReqoreControlGroup>
  );
});
