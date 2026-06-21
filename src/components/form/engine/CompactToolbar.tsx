import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreInput,
  ReqoreMessage,
  ReqoreProgress,
  ReqoreSpan,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { IReqoreControlGroupProps } from '@qoretechnologies/reqore/dist/components/ControlGroup';
import {
  IReqoreDropdownItem,
  TReqoreDropdownItems,
} from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import React, { memo } from 'react';
import { useContext } from 'use-context-selector';
import styled from 'styled-components';
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

// Custom flex, not ReqoreControlGroup: the meter needs the middle bar to absorb
// all width changes while the fixed-width labels never shrink/truncate — and a
// 12px gap that isn't on ReqoreControlGroup's gapSize scale (5 or 18). The
// `flex: 1; min-width: 0` makes only the bar yield as the row narrows.
const StyledCompletion = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 2px;
  & > .reqore-progress {
    flex: 1;
    min-width: 0;
  }
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
    optionalFields,
    canRevert,
    onAddOptionalField,
    onAddAll,
    onResetDefaults,
    onRevertAll,
  } = useContext(CompactToolbarContext);

  return (
    <ReqoreControlGroup {...reqoreProps} vertical fluid fixed={false} gapSize='big'>
      {completion.total ?
        <StyledCompletion className='options-readfirst-completion'>
          {!readOnly ?
            invalidCount ?
              <ReqoreTag
                className='options-readfirst-status'
                label='Draft'
                intent='warning'
                icon='EditLine'
                minimal
                size='tiny'
                compact
                fixed
                effect={{ uppercase: true, spaced: 1 }}
              />
            : <ReqoreTag
                className='options-readfirst-status'
                label='Ready'
                intent='success'
                icon='CheckLine'
                minimal
                size='small'
                fixed
              />

          : null}
          <ReqoreSpan size='small' effect={{ opacity: 0.7, noWrap: true }}>
            {completion.set} / {completion.total} fields set
          </ReqoreSpan>
          <ReqoreProgress
            className='options-readfirst-completion-bar'
            value={completion.pct}
            intent={completion.set === completion.total ? 'success' : 'info'}
            size='normal'
            flat
          />
          <ReqoreSpan size='small' effect={{ opacity: 0.7, noWrap: true }}>
            {completion.pct}%
          </ReqoreSpan>
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
              minimal
              filterable
              icon='Filter3Line'
              label='Fields'
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
                  ...(filteredCount ?
                    [
                      {
                        label: 'Add optional fields',
                        readOnly: true,
                        disabled: true,
                        icon: 'AddLine',
                      },
                    ]
                  : []),
                  ...optionalFields.map((field) => ({
                    label: field.display_name || field.value,
                    value: field.value,
                    description: field.short_desc,
                    disabled: field.disabled,
                  })),
                ] as TReqoreDropdownItems
              }
            />
          : null}
          <ReqoreButton
            fixed
            minimal
            icon={showAllDescriptions ? 'InformationFill' : 'InformationLine'}
            className='options-readfirst-descriptions'
            active={showAllDescriptions}
            intent={showAllDescriptions ? 'info' : undefined}
            tooltip={showAllDescriptions ? 'Hide all field information' : 'Show all field information'}
            onClick={onToggleAllDescriptions}
          />
        </ReqoreControlGroup>
      : null}
      {invalidCount && !readOnly ?
        <ReqoreMessage
          intent={showInvalidOnly ? 'info' : 'danger'}
          opaque={false}
          size='small'
          className='options-readfirst-invalid-banner'
          onClick={onToggleInvalidOnly}
        >
          {showInvalidOnly ?
            'Showing invalid fields only. Click here again to show all fields.'
          : `${invalidCount < 2 ? 'A field is not valid and requires' : `${invalidCount} fields are not valid and require`} attention. Click here to only show invalid fields.`}
        </ReqoreMessage>
          : null}
        </ReqoreControlGroup>
      : null}
    </ReqoreControlGroup>
  );
});
