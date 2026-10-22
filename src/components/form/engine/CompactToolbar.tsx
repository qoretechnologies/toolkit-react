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
import styled, { css } from 'styled-components';
import { useContext } from 'use-context-selector';
import { CompactToolbarContext, TCompactSort } from './compactToolbarContext';
import { useIsCalmForm } from './formAppearance';

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
const StyledCompletion = styled.div<{ $calm?: boolean }>`
  display: flex;
  flex-flow: column;
  gap: 8px;
  padding: 0 2px;
  /* Calm: one line — the summary, then a short meter beside it — that wraps
     the meter under the words where there is no room for both. */
  ${({ $calm }) =>
    $calm ?
      css`
        flex-flow: row wrap;
        align-items: center;
        gap: 6px 14px;
      `
    : ''}
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
  /** Calm: a short meter beside the summary instead of a full-width bar. */
  $calm?: boolean;
}>`
  position: relative;
  height: 4px;
  border-radius: ${({ $calm }) => ($calm ? 2 : 3)}px;
  width: 100%;
  ${({ $calm }) =>
    $calm ?
      css`
        flex: 1 1 160px;
        max-width: 360px;
      `
    : ''}
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
// One shared text size for the whole summary line, so "Incomplete", "1/6 set" and
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
    parts,
    readOnly,
    invalidCount,
    attentionCount,
    attentionFaultCount,
    completion,
    showInvalidOnly,
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
  const calm = useIsCalmForm();
  const intents = (theme.intents || {}) as Record<string, string>;
  /* "N need attention →" / "N to fill in →" is a toggle (show only those fields), so it
     is one: a button a keyboard reaches, which says whether it is on. A host that turns
     it on for a person (a blocked submit) reads `aria-pressed` rather than guessing,
     since the toolbar draws a different link once something becomes a fault. */
  const attentionToggleProps = {
    className: 'options-readfirst-attention-link',
    role: 'button',
    tabIndex: 0,
    'aria-pressed': !!showInvalidOnly,
    onClick: onToggleInvalidOnly,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggleInvalidOnly?.();
      }
    },
  };
  const cSuccess = intents.success || '#4a7110';
  const cWarning = intents.warning || '#d17c29';
  const cText = (theme.text?.color as string) || '#e8e8e8';
  const cTrack = `${cText}1f`;
  // Calm: what is done is grey — finished work needs nobody — and only the
  // outstanding part (the amber run, the "need attention" link) is coloured.
  const cDone = calm ? `${cText}8c` : cSuccess;
  const cQuiet = `${cText}a6`;
  // The GREEN run is what is done, not merely what has a value: a field that is
  // set but flagged belongs to the amber run, and counting it twice pushed that
  // run off the end of the track.
  const setPct = completion.total ? (completion.done / completion.total) * 100 : 0;
  // The amber run is what is WRONG. On a new form the required fields are only still
  // to fill in, so the track shows them as not done yet, without amber.
  const attentionPct = completion.total ? (attentionFaultCount / completion.total) * 100 : 0;

  return (
    <ReqoreControlGroup
      {...reqoreProps}
      className='options-readfirst-toolbar'
      vertical
      fluid
      fixed={false}
      gapSize='big'
    >
      {/* No completion in a read-only form. The meter answers "how much is
          left to do", and a reader can do none of it: "4/6 set · 67%" over a
          form nobody can fill in is a progress report on somebody else's
          work. The read view lists what is set, and that is the whole
          answer. */}
      {parts.completion && completion.total && !readOnly ?
        <StyledCompletion className='options-readfirst-completion' $calm={calm}>
          <StyledCompletionLine>
            <StyledSummary
              className='options-readfirst-status'
              // Calm: the word in the text colour. "Ready" is not a healthy
              // figure to celebrate in green, and "Incomplete" is said in amber
              // by the link beside it — only the outstanding part is coloured.
              $color={
                calm ? cText
                : invalidCount || attentionFaultCount ? cWarning
                : attentionCount ? cText
                : cSuccess
              }
              style={{ fontWeight: 600 }}
            >
              {/* "Ready" is a claim about the whole form, so anything the form
                  is asking for withdraws it — a value that fails validation and
                  a field the host has flagged alike. Saying Ready beside
                  "1 need attention" made the word mean nothing.

                  The other state is "Incomplete", not "Draft": it is about
                  what the form still lacks, and a form nobody has touched can
                  lack things. "Draft" means unsaved changes and belongs to the
                  batched mode's per-row chip alone. */}
              {invalidCount || attentionCount ? 'Incomplete' : 'Ready'}
            </StyledSummary>
            <StyledSummary style={calm ? { color: cQuiet } : { opacity: 0.5 }}>
              · {completion.set}/{completion.total} set
              {attentionCount ? ' ·' : ''}
            </StyledSummary>
            {/* Amber only for what is a fault. A new form's required fields are still to
                fill in, which is the next step, not a warning: they are counted apart,
                in the quiet colour. */}
            {attentionFaultCount ?
              <StyledAttentionLink $color={cWarning} {...attentionToggleProps}>
                {attentionFaultCount} need attention →
              </StyledAttentionLink>
            : null}
            {attentionCount > attentionFaultCount ?
              attentionFaultCount ?
                <StyledSummary style={{ color: cQuiet }}>
                  · {attentionCount - attentionFaultCount} to fill in
                </StyledSummary>
              : <StyledAttentionLink $color={cQuiet} {...attentionToggleProps}>
                  {attentionCount} to fill in →
                </StyledAttentionLink>
            : null}
            {/* Calm: the percentage is one more quiet figure on the line, not
                a large bold number pinned to the far edge. */}
            {calm ?
              <StyledSummary className='options-readfirst-pct' style={{ color: cQuiet }}>
                · {completion.pct}%
              </StyledSummary>
            : <StyledPct className='options-readfirst-pct'>{completion.pct}%</StyledPct>}
          </StyledCompletionLine>
          <StyledMeter
            className='options-readfirst-completion-bar'
            $set={setPct}
            $attention={attentionPct}
            $track={cTrack}
            $set_c={cDone}
            $att_c={cWarning}
            $calm={calm}
          />
        </StyledCompletion>
      : null}

      {/* The wrapper renders exactly when its one child (the search row) does —
          a wider gate here used to render the group EMPTY when the search was
          hidden (or self-hidden on a single-option form) while invalid fields
          existed, and the empty group claimed a slot in the outer
          `gapSize='big'` stack: a phantom gap between the completion meter and
          the first status box. */}
      {parts.search && hasMultipleOptions ?
        <ReqoreControlGroup vertical fluid gapSize='normal'>
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
            {parts.fields && !readOnly ?
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
            {parts.help ?
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
            : null}
          </ReqoreControlGroup>
        </ReqoreControlGroup>
      : null}
    </ReqoreControlGroup>
  );
});
