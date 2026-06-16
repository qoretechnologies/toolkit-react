import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreIcon,
  ReqoreMessage,
  ReqoreP,
  ReqoreSpan,
  ReqoreTag,
  ReqoreTagGroup,
} from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import {
  IQorusFormField,
  TQorusForm,
  TQorusFormFieldSchema,
  TQorusType,
} from '@qoretechnologies/ts-toolkit';
import flatten from 'lodash/flatten';
import size from 'lodash/size';
import React, { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { hasAllDependenciesFullfilled } from '../../../helpers/validations';
import { ReqoreCollapsibleContent } from '@qoretechnologies/reqore';
import { Description } from '../../Description';
import { FocusedEditing } from '../../FocusedEditing';
import { CompactRowContext } from './compactRowContext';
import {
  StyledActionSlot,
  StyledCardHeading,
  StyledCardLabel,
  StyledColorSwatch,
  StyledColumn,
  StyledEditCard,
  StyledInfoPanel,
  StyledLabelBlock,
  StyledRowActions,
  StyledRowInset,
  StyledRowLabel,
  StyledRowValue,
} from './compactRowStyles';
import { getOptionFieldMessages } from './OptionFieldMessages';
import {
  colorToCss,
  formatBytes,
  formatOptionValue,
  getAllowedValueImage,
  getFileSize,
  getHashEntries,
  getValueType,
  isOptionValueEmpty,
  optionHasImages,
} from './readFirst';
import { StructuredDataView } from './_structuredData/StructuredDataView';

// Types whose editors are too tall/nested to edit in-row — these keep the edit
// card; `arg_schema` and operator fields are excluded separately.
const COMPACT_COMPLEX_TYPES = new Set([
  'hash',
  'free-hash',
  'list',
  'free-list',
  'array',
  'array-auto',
  'file',
  'file-string',
  'richtext',
  'long-string',
  'any',
  'auto',
  'schema',
  'schema-definition',
  'data-provider',
  'processor-mappings',
  'options',
  'system-options',
  'byte-size',
  'markdown',
  'method-name',
  'class-connectors',
  'class-array',
  'yaml',
]);

// One read-first row: label | value | action collapsed; the real editor (the
// classic renderOption) expanded. `hidden` = search-surfaced optional —
// activating the row adds the field first.
export const CompactRow = memo(
  ({
    optionName,
    optionField,
    hidden = false,
  }: {
    optionName: string;
    optionField: IQorusFormField;
    hidden?: boolean;
  }) => {
    const readOnly = useContextSelector(CompactRowContext, (v) => v.readOnly);
    const commitMode = useContextSelector(CompactRowContext, (v) => v.commitMode);
    const options = useContextSelector(CompactRowContext, (v) => v.options);
    const operators = useContextSelector(CompactRowContext, (v) => v.operators);
    const focusedEditing = useContextSelector(CompactRowContext, (v) => v.focusedEditing);
    const showFieldTypes = useContextSelector(CompactRowContext, (v) => v.showFieldTypes);
    const isExpanded = useContextSelector(CompactRowContext, (v) =>
      v.expandedOptions.includes(optionName)
    );
    const isHighlighted = useContextSelector(CompactRowContext, (v) =>
      v.highlightedOptions.includes(optionName)
    );
    const isFlashed = useContextSelector(CompactRowContext, (v) =>
      v.flashedOptions.includes(optionName)
    );
    const infoPanelOverride = useContextSelector(
      CompactRowContext,
      (v) => v.infoPanelOverrides[optionName]
    );
    const setHighlightedOptions = useContextSelector(
      CompactRowContext,
      (v) => v.setHighlightedOptions
    );
    const setInfoPanelOverrides = useContextSelector(
      CompactRowContext,
      (v) => v.setInfoPanelOverrides
    );
    const setFocusedEditing = useContextSelector(CompactRowContext, (v) => v.setFocusedEditing);
    const readRowHeights = useContextSelector(CompactRowContext, (v) => v.readRowHeights);
    const originalValue = useContextSelector(CompactRowContext, (v) => v.originalValue);
    const availableOptions = useContextSelector(CompactRowContext, (v) => v.availableOptions);
    const requiredGroupsInfo = useContextSelector(CompactRowContext, (v) => v.requiredGroupsInfo);
    const handleValueChange = useContextSelector(CompactRowContext, (v) => v.handleValueChange);
    const handleAddOptionalFieldChange = useContextSelector(
      CompactRowContext,
      (v) => v.handleAddOptionalFieldChange
    );
    const toggleExpandedOption = useContextSelector(
      CompactRowContext,
      (v) => v.toggleExpandedOption
    );
    const flashOption = useContextSelector(CompactRowContext, (v) => v.flashOption);
    const hasOptionChanged = useContextSelector(CompactRowContext, (v) => v.hasOptionChanged);
    const handleOptionLabelClick = useContextSelector(
      CompactRowContext,
      (v) => v.handleOptionLabelClick
    );
    const removeSelectedOption = useContextSelector(
      CompactRowContext,
      (v) => v.removeSelectedOption
    );
    const getTypeForOption = useContextSelector(CompactRowContext, (v) => v.getTypeForOption);
    const isOptionValid = useContextSelector(CompactRowContext, (v) => v.isOptionValid);
    const confirmAction = useContextSelector(CompactRowContext, (v) => v.confirmAction);
    const renderOption = useContextSelector(CompactRowContext, (v) => v.renderOption);
    const theme = useContextSelector(CompactRowContext, (v) => v.theme);
    const cText = useContextSelector(CompactRowContext, (v) => v.cText);
    const cMuted = useContextSelector(CompactRowContext, (v) => v.cMuted);
    const cFaint = useContextSelector(CompactRowContext, (v) => v.cFaint);
    const cKey = useContextSelector(CompactRowContext, (v) => v.cKey);
    const cDivider = useContextSelector(CompactRowContext, (v) => v.cDivider);
    const cHover = useContextSelector(CompactRowContext, (v) => v.cHover);
    const cDanger = useContextSelector(CompactRowContext, (v) => v.cDanger);
    const cWarning = useContextSelector(CompactRowContext, (v) => v.cWarning);
    const cInfo = useContextSelector(CompactRowContext, (v) => v.cInfo);

    // Value-cell content: colour adds a swatch, file an icon + size; hash keeps
    // its "N fields" summary (sub-fields reveal beneath the row).
    const renderReadFirstValue = (
      field: IQorusFormField,
      schema: TQorusFormFieldSchema | undefined,
      formatted: string
    ): React.ReactNode => {
      const valueType = getValueType(field, schema);
      const wrapStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        maxWidth: '100%',
      };
      const textStyle: React.CSSProperties = {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      };

      if (valueType === 'rgbcolor') {
        const swatch = colorToCss(field?.value);
        return (
          <span style={wrapStyle}>
            {swatch ? <StyledColorSwatch aria-hidden $color={swatch} $border={cDivider} /> : null}
            <span style={textStyle}>{formatted}</span>
          </span>
        );
      }

      if (valueType === 'file') {
        const fileSize = getFileSize(field?.value);
        return (
          <span style={wrapStyle}>
            <ReqoreIcon icon='File2Line' size='13px' style={{ opacity: 0.7, flexShrink: 0 }} />
            <span style={textStyle}>{formatted}</span>
            {fileSize !== undefined ?
              <span style={{ color: cFaint, fontSize: 11, flexShrink: 0 }}>{formatBytes(fileSize)}</span>
            : null}
          </span>
        );
      }

      // Selected allowed-value / enum item with a logo (e.g. language images):
      // render it beside the value, where it belongs — not as the field's icon.
      const allowedImage = getAllowedValueImage(field?.value, schema);
      if (allowedImage) {
        return (
          <span style={wrapStyle}>
            <ReqoreIcon image={allowedImage} size='16px' style={{ flexShrink: 0 }} />
            <span style={textStyle}>{formatted}</span>
          </span>
        );
      }

      return formatted;
    };

    const schema = options?.[optionName];
    const label = schema?.display_name || optionName;
    const required = !!(schema?.required || schema?.required_groups);
    const valid = isOptionValid(
      optionName,
      (schema?.ui_type as TQorusType) || (schema?.type as TQorusType),
      optionField?.value
    );
    const removable =
      !readOnly && !schema?.preselected && !schema?.required && !schema?.required_groups;
    const changed = !hidden && !readOnly && hasOptionChanged(optionField?.value, optionName);
    // Required-group membership shows a PERSISTENT chip on every member: amber
    // "One of: <group>" while the group is unmet (tap → flash siblings), then a
    // muted-green resolution once satisfied — "Covers: <group>" on the field that
    // satisfied it, "Covered by <X>" on the rest. The resolution folds in what
    // used to be a separate value-slot note. `required` fields belong to no group
    // and carry the plain Required tag instead.
    const memberGroups: string[] = (schema?.required_groups as string[]) || [];
    const unmetGroups = memberGroups.filter(
      (groupName) => !requiredGroupsInfo.satisfiedBy[groupName]
    );
    const coveredByGroup = memberGroups.find(
      (groupName) =>
        requiredGroupsInfo.satisfiedBy[groupName] &&
        requiredGroupsInfo.satisfiedBy[groupName] !== optionName
    );
    const coveredByLabel =
      coveredByGroup && !schema?.required ?
        (options?.[requiredGroupsInfo.satisfiedBy[coveredByGroup] as string]
          ?.display_name as string) || requiredGroupsInfo.satisfiedBy[coveredByGroup]
      : undefined;
    // Unmet → drive the chip off the unmet groups; resolved → keep listing the
    // members so the "covers / covered by" chip stays a locate-the-siblings
    // dropdown rather than going inert.
    const chipGroups = unmetGroups.length ? unmetGroups : memberGroups;
    const groupResolved = !!memberGroups.length && !unmetGroups.length;
    const requiredGroupChip =
      !hidden && !readOnly && memberGroups.length && !schema?.required ?
        <span
          style={{ display: 'inline-flex' }}
          role='presentation'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setHighlightedOptions(requiredGroupsInfo.members[chipGroups[0]] || [])}
          onMouseLeave={() => setHighlightedOptions([])}
        >
          <ReqoreDropdown
            className='options-readfirst-required-group'
            size='small'
            minimal
            flat
            compact
            intent={groupResolved ? 'success' : 'warning'}
            icon={groupResolved ? 'CheckLine' : 'LinkM'}
            label={
              !groupResolved ? `One of: ${chipGroups[0]}`
              : coveredByLabel ? `Covered by “${coveredByLabel}”`
              : `Covers: ${chipGroups[0]}`
            }
            filterable={
              chipGroups.reduce((n, g) => n + requiredGroupsInfo.members[g].length, 0) > 6
            }
            items={chipGroups.flatMap((groupName): IReqoreDropdownItem[] => [
              ...(chipGroups.length > 1 ?
                [{ divider: true, label: groupName, dividerAlign: 'left' } as IReqoreDropdownItem]
              : []),
              ...requiredGroupsInfo.members[groupName].map(
                (member): IReqoreDropdownItem => ({
                  label: (options?.[member]?.display_name as string) || member,
                  icon: member === optionName ? 'MapPinLine' : 'ArrowRightLine',
                  selected: member === optionName,
                  disabled: member === optionName,
                  onClick: member === optionName ? undefined : () => flashOption(member),
                })
              ),
            ])}
          />
        </span>
      : null;
    const editType = ((schema?.ui_type as string) || (schema?.type as string)) ?? '';
    // Scalars edit in place inside the row; complex fields (tall or nested
    // editors) still open the expanded card below.
    const inlineEditable =
      !readOnly &&
      !schema?.arg_schema &&
      !(operators && size(operators)) &&
      // Expression fields open the builder/DPQL editor — too tall for inline.
      !(optionField as { is_expression?: boolean }).is_expression &&
      // A choice with per-option logos (e.g. language) reads better collapsed.
      !optionHasImages(schema) &&
      !COMPACT_COMPLEX_TYPES.has(editType);
    const revertButton =
      changed ?
        <ReqoreButton
          className='options-readfirst-revert'
          size='small'
          flat
          minimal
          icon='HistoryLine'
          tooltip='Revert changes'
          onClick={(e: any) => {
            e.stopPropagation();
            handleValueChange(
              optionName,
              originalValue.current?.[optionName]?.value,
              originalValue.current?.[optionName]?.type
            );
          }}
        />
      : null;
    // Batched commit: a changed row is a draft until Save — mark it with the
    // product's Draft chip (always visible, unlike the hover-revealed revert).
    const draftChip =
      commitMode === 'batched' && changed ?
        <ReqoreTag
          className='options-readfirst-draft'
          label='Draft'
          intent='warning'
          icon='EditLine'
          size='small'
          minimal
          fixed
        />
      : null;

    // Info tiers: Tier 1 (danger/warning + dependency hints) must be visible
    // without interaction; Tier 2 (info/success, default notes) sits behind ⓘ.
    const infoActive = !hidden;
    type TInfoMsg = { intent?: string; title?: string; content: string };
    const schemaMessages: TInfoMsg[] =
      infoActive ?
        ((((schema as any)?.messages || []) as any[]).map((m) => ({
          intent: m.intent,
          title: m.title,
          content: m.content,
        })) as TInfoMsg[])
      : [];
    const fieldMessages: TInfoMsg[] =
      infoActive ?
        getOptionFieldMessages({
          schema: options || {},
          option: optionField || ({} as IQorusFormField),
          name: optionName,
          allOptions: availableOptions,
          getType: getTypeForOption,
        })
          // The row already shows the Required tag — the plain required
          // message would duplicate it.
          .filter((m) => m.label !== 'This field is required')
          .map((m) => ({ intent: m.intent as string, content: String(m.label) }))
      : [];
    const isCriticalMsg = (m: TInfoMsg) => m.intent === 'danger' || m.intent === 'warning';
    const tier1 = [...schemaMessages, ...fieldMessages].filter(isCriticalMsg);
    const tier2: TInfoMsg[] = [
      ...[...schemaMessages, ...fieldMessages].filter((m) => !isCriticalMsg(m)),
      ...(infoActive && schema?.default_value_desc ?
        [
          {
            content:
              `Default: ${schema.default_value_display_name || ''} — ${schema.default_value_desc}`.trim(),
          },
        ]
      : []),
    ];
    const worstIntent =
      tier1.some((m) => m.intent === 'danger') ? 'danger'
      : tier1.length ? 'warning'
      : undefined;
    const intentColor =
      worstIntent === 'danger' ? cDanger
      : worstIntent === 'warning' ? cWarning
      : undefined;
    const showStripe = infoActive && !!intentColor;
    const hasInfoPanelContent =
      infoActive && (tier1.length > 0 || tier2.length > 0 || !!schema?.short_desc);
    const infoPanelOpen =
      hasInfoPanelContent && (infoPanelOverride ?? tier1.length > 0);

    const renderInfoStrip = (m: TInfoMsg, index: number) => (
      <ReqoreMessage
        key={`${m.content}-${index}`}
        size='small'
        opaque={false}
        flat
        intent={m.intent as never}
        title={m.title}
      >
        {m.content}
      </ReqoreMessage>
    );

    const infoToggle =
      hasInfoPanelContent ?
        <span
          style={{ display: 'inline-flex', cursor: 'pointer' }}
          role='button'
          tabIndex={0}
          aria-label={`${infoPanelOpen ? 'Hide' : 'Show'} field information`}
          onClick={(e) => {
            e.stopPropagation();
            setInfoPanelOverrides((prev) => ({ ...prev, [optionName]: !infoPanelOpen }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setInfoPanelOverrides((prev) => ({ ...prev, [optionName]: !infoPanelOpen }));
            }
          }}
        >
          <ReqoreIcon
            icon={infoPanelOpen ? 'InformationFill' : 'InformationLine'}
            size='14px'
            intent={worstIntent as never}
            style={{ opacity: infoPanelOpen ? 0.9 : 0.55 }}
          />
        </span>
      : null;

    const infoBlock =
      infoPanelOpen ?
        <StyledInfoPanel className='options-readfirst-info-panel'>
          {schema?.short_desc ?
            <ReqoreP size='small' effect={{ opacity: 0.6 }}>
              {schema.short_desc}
            </ReqoreP>
          : null}
          {[...tier1, ...tier2].map(renderInfoStrip)}
        </StyledInfoPanel>
      : null;


    if (isExpanded) {
      if (inlineEditable) {
        const collapse = () => toggleExpandedOption(optionName);
        const editingRow = (
          <div
            key={optionName}
            data-field={optionName}
            className='readfirst-row readfirst-row-editing options-readfirst-inline options-readfirst-value'
            style={
              readRowHeights.current[optionName] ?
                { minHeight: readRowHeights.current[optionName] }
              : undefined
            }
          >
            <StyledRowLabel
              role='button'
              tabIndex={0}
              aria-label={`Collapse ${label}`}
              title={schema?.short_desc || undefined}
              $color={cKey}
              $pointer
              onClick={collapse}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  collapse();
                }
              }}
            >
              {label}
              {required ? <ReqoreIcon icon='Asterisk' color='danger' size='10px' /> : null}
            </StyledRowLabel>
            <div
              style={{ minWidth: 0 }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  collapse();
                }
              }}
            >
              {renderOption(optionName, optionField, 'small', true)}
            </div>
            <StyledRowActions>
              {draftChip}
              {/* No Required tag here: while editing, the editor's own
                  OptionFieldMessages strip below already says it — showing
                  both was redundant. The tag stays on READ rows, where no
                  message strip is visible. */}
              {revertButton}
              <ReqoreButton
                className='options-readfirst-done'
                size='small'
                flat
                minimal
                intent='success'
                icon='CheckLine'
                tooltip='Done'
                onClick={collapse}
              />
            </StyledRowActions>
          </div>
        );
        // ALWAYS wrap the editing row in the same StyledColumn so its parent stays
        // stable when infoBlock toggles. A field going valid mid-type clears its
        // required message → infoBlock flips to null; a conditional wrapper would
        // reparent `editingRow`, and React can't preserve a subtree across a parent
        // change — the editor would remount and steal focus on that first
        // keystroke. Toggling the className (not the element) keeps the editor, and
        // its focus, mounted across the transition. The panel still sits below the
        // row — messages neither vanish nor balloon the editor.
        return (
          <StyledColumn
            key={optionName}
            data-field={optionName}
            className={infoBlock ? 'options-readfirst-info-row' : undefined}
          >
            {editingRow}
            {infoBlock}
          </StyledColumn>
        );
      }
      // Card chrome: badge / actions / tags render here — the row only fits
      // icon/image + the intent stripe.
      const schemaBadge = (schema as { badge?: unknown } | undefined)?.badge;
      const cardBadges =
        schemaBadge !== undefined && schemaBadge !== null ?
          ((Array.isArray(schemaBadge) ? schemaBadge : [schemaBadge]) as unknown[])
        : [];
      const cardActions =
        (schema as { actions?: unknown[] } | undefined)?.actions?.filter(
          (action) => !!action && typeof action === 'object'
        ) || [];
      const cardTags = ((schema as { tags?: unknown[] } | undefined)?.tags || []) as object[];
      const schemaIntentColor =
        schema?.intent ?
          (theme?.intents as Record<string, string> | undefined)?.[schema.intent as string]
        : undefined;
      return (
        <StyledEditCard
          key={optionName}
          data-field={optionName}
          className='options-readfirst-card'
          $bg={cHover}
          $border={schemaIntentColor ? `${schemaIntentColor}66` : `${cInfo}66`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <StyledCardHeading>
              <StyledCardLabel $color={cMuted}>
                {(schema as { icon?: string } | undefined)?.icon || (schema as { image?: string } | undefined)?.image ?
                  <ReqoreIcon
                    icon={(schema as { icon?: string } | undefined)?.icon as never}
                    image={(schema as { image?: string } | undefined)?.image}
                    size='14px'
                  />
                : null}
                <span>
                  {label}
                  {required ? <ReqoreIcon icon='Asterisk' color='danger' size='10px' /> : null}
                </span>
                {cardBadges.map((badge, index) =>
                  typeof badge === 'object' ?
                    <ReqoreTag
                      size='small'
                      minimal
                      key={index}
                      className='options-readfirst-card-badge'
                      {...(badge as object)}
                    />
                  : <ReqoreTag
                      size='small'
                      minimal
                      key={index}
                      className='options-readfirst-card-badge'
                      label={badge as string | number}
                    />
                )}
              </StyledCardLabel>
              {schema?.short_desc ?
                <ReqoreP size='small' effect={{ opacity: 0.6 }} style={{ marginTop: 2 }}>
                  {schema.short_desc}
                </ReqoreP>
              : null}
              {cardTags.length ?
                <ReqoreTagGroup size='small' className='options-readfirst-card-tags'>
                  {cardTags.map((tag, index) => (
                    <ReqoreTag size='small' minimal key={index} {...(tag as object)} />
                  ))}
                </ReqoreTagGroup>
              : null}
            </StyledCardHeading>
            <ReqoreControlGroup fixed verticalAlign='center'>
              {cardActions.map((action, index) => {
                const { label: actionLabel, ...actionProps } = action as {
                  label?: string;
                } & Record<string, unknown>;
                return (
                  <ReqoreButton
                    size='small'
                    minimal
                    flat
                    fixed
                    key={index}
                    className='options-readfirst-card-action'
                    {...(actionProps as object)}
                  >
                    {actionLabel}
                  </ReqoreButton>
                );
              })}
              <ReqoreButton
                size='small'
                icon='FullscreenLine'
                minimal
                flat
                fixed
                className='options-readfirst-fullscreen'
                tooltip='Edit fullscreen'
                onClick={() => setFocusedEditing(optionName)}
              />
              <ReqoreButton
                size='small'
                icon='CheckLine'
                intent='success'
                fixed
                className='options-readfirst-done'
                onClick={() => toggleExpandedOption(optionName)}
              >
                {readOnly ? 'Close' : 'Done'}
              </ReqoreButton>
            </ReqoreControlGroup>
          </div>
          {/* Same fullscreen focused-editing affordance as the classic cards —
              the modal mounts when this option is focused. */}
          <FocusedEditing
            isFullscreen={focusedEditing === optionName}
            onClose={() => setFocusedEditing(undefined)}
            description={(schema?.display_name as string) || optionName}
          >
            {focusedEditing === optionName ?
              <Description
                longDescription={schema?.desc}
                shortDescription={schema?.short_desc}
                longDescriptionShownByDefault
              />
            : null}
            {renderOption(optionName, optionField)}
          </FocusedEditing>
        </StyledEditCard>
      );
    }

    const formatted = formatOptionValue(optionField, schema);
    const empty = formatted === '';
    // A hash row reveals its sub-fields as read-only sub-rows under a "view
    // more" disclosure; the row itself still expands the real editor on click.
    const valueType = getValueType(optionField, schema);
    const hashEntries =
      !hidden &&
      (valueType === 'hash' || valueType === 'free-hash') &&
      (schema as { ui_type?: string } | undefined)?.ui_type !== 'schema-definition' ?
        getHashEntries(optionField, schema)
      : [];
    const typeLabel =
      showFieldTypes ?
        `<${(schema?.ui_type as string) || (schema?.type as string) || 'auto'}${(schema as { ui_element_type?: string } | undefined)?.ui_element_type ? `[${(schema as { ui_element_type?: string }).ui_element_type}]` : ''}>`
      : null;
    // Disabled rows (schema flag or unmet deps) can't open — a lock + reason
    // renders instead. Form-level readOnly still opens in view mode (Close).
    const fieldDisabled =
      !hidden &&
      !readOnly &&
      (!!schema?.disabled ||
        !hasAllDependenciesFullfilled(schema?.depends_on, availableOptions, options || {}));
    const fieldDisabledReason =
      schema?.disabled ? 'This field is disabled' : 'Disabled — dependencies are not fulfilled';
    // Dependency contract: top-level entries must ALL hold; a nested array
    // means ANY of its entries; `name=value` requires that exact value.
    const dependencyEntries =
      fieldDisabled && !schema?.disabled ?
        ((schema?.depends_on || []) as (string | string[])[])
      : [];
    const describeDependency = (dep: string) => {
      const eqIndex = dep.indexOf('=');
      const depName = eqIndex === -1 ? dep : dep.slice(0, eqIndex);
      const expected = eqIndex === -1 ? undefined : dep.slice(eqIndex + 1);
      const depLabel = (options?.[depName]?.display_name as string) || depName;
      const depValue = (availableOptions as TQorusForm)?.[depName]?.value;
      return {
        name: depName,
        exists: !!options?.[depName],
        label: expected === undefined ? depLabel : `${depLabel} = ${expected}`,
        fulfilled:
          expected === undefined ?
            !isOptionValueEmpty(depValue)
          : depValue != null && String(depValue) === expected,
      };
    };
    const depHighlightNames = (flatten(dependencyEntries as never[]) as string[])
      .map((dep) => describeDependency(dep).name)
      .filter((depName) => !!options?.[depName]);
    const renderDependencyTag = (dep: string) => {
      const info = describeDependency(dep);
      if (!info.exists) {
        return null;
      }
      return (
        <ReqoreTag
          key={dep}
          className='options-readfirst-dep'
          size='small'
          minimal
          intent={info.fulfilled ? 'success' : 'info'}
          icon={info.fulfilled ? 'CheckLine' : 'ArrowRightLine'}
          label={info.label}
          onClick={() => flashOption(info.name)}
        />
      );
    };
    const activate = (event?: { currentTarget?: Element | null }) => {
      if (fieldDisabled) {
        return;
      }
      const target = event?.currentTarget as HTMLElement | undefined;
      if (target?.classList?.contains('readfirst-row')) {
        readRowHeights.current[optionName] = Math.round(target.getBoundingClientRect().height);
      }
      if (hidden) {
        handleAddOptionalFieldChange('options', optionName);
      }
      toggleExpandedOption(optionName);
    };

    // Row chrome: icon/image before the label; schema `intent` as the edge
    // stripe (message-severity stripes win when both apply).
    const rowChromeIcon =
      (schema as { icon?: string } | undefined)?.icon || (schema as { image?: string } | undefined)?.image ?
        <ReqoreIcon
          icon={(schema as { icon?: string } | undefined)?.icon as never}
          image={(schema as { image?: string } | undefined)?.image}
          size='14px'
          className='options-readfirst-row-icon'
        />
      : null;
    const rowSchemaIntentColor =
      schema?.intent ?
        (theme?.intents as Record<string, string> | undefined)?.[schema.intent as string]
      : undefined;
    const rowStripeColor = (showStripe ? intentColor : undefined) || rowSchemaIntentColor;

    const row = (
      <div
        key={optionName}
        data-field={optionName}
        role='button'
        tabIndex={0}
        aria-label={`${label}${hidden ? ' (add field)' : ''}`}
        className={`readfirst-row options-readfirst-value${hidden ? ' readfirst-row-hidden' : ''}${fieldDisabled ? ' readfirst-row-disabled' : ''}${isHighlighted ? ' readfirst-row-group-highlight' : ''}${isFlashed ? ' readfirst-row-flash' : ''}`}
        aria-disabled={fieldDisabled || undefined}
        style={rowStripeColor ? { boxShadow: `inset 3px 0 0 ${rowStripeColor}` } : undefined}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate(event);
          }
        }}
      >
        <StyledLabelBlock>
          <StyledRowLabel title={schema?.short_desc || undefined} $color={cKey}>
            {rowChromeIcon}
            {label}
            {required ? <ReqoreIcon icon='Asterisk' color='danger' size='10px' /> : null}
            {typeLabel ?
              <ReqoreTag size='tiny' minimal label={typeLabel} labelEffect={{ opacity: 0.55 }} />
            : null}
            {schema?.desc ?
              <ReqoreIcon
                icon='QuestionLine'
                size='12px'
                effect={{ opacity: 0.55 }}
                margin='left'
                marginSize={5}
                role='button'
                tabIndex={-1}
                aria-label='Help'
                className='options-readfirst-help'
                style={{ cursor: 'help' }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOptionLabelClick(optionName);
                }}
              />
            : null}
          </StyledRowLabel>
        </StyledLabelBlock>
        <StyledRowValue
          title={!empty && !hidden && typeof formatted === 'string' ? formatted : undefined}
          $color={empty || hidden ? cFaint : cText}
          $empty={empty || hidden}
        >
          {hidden ?
            'Not in form — add'
          : empty ?
            coveredByLabel ?
              // Editable rows carry the "covered by" explanation in the group
              // chip; read-only rows have no chip, so keep it inline here.
              readOnly ?
                `Not set — covered by “${coveredByLabel}”`
              : 'Not set'
            : required ?
              'Required — not set'
            : 'Not set'
          : renderReadFirstValue(optionField, schema, formatted)}
        </StyledRowValue>
        <StyledRowActions>
          {/* Column discipline (table treatment): variable-width chips lead and
              rag INWARD; the info badge and the trailing edit/lock icon live in
              fixed-width slots pinned at the right, so the same affordance sits
              at the same x on every row. Hover utilities (revert/delete) sit
              between the chips and the fixed slots. */}
          {!hidden && !fieldDisabled ?
            requiredGroupChip ??
              (!valid ?
                <ReqoreTag label='Required' intent='danger' size='small' minimal />
              : null)
          : null}
          {draftChip}
          {changed ?
            <ReqoreButton
              className='readfirst-action options-readfirst-revert'
              size='small'
              flat
              minimal
              icon='HistoryLine'
              tooltip='Revert changes'
              onClick={(e: any) => {
                e.stopPropagation();
                handleValueChange(
                  optionName,
                  originalValue.current?.[optionName]?.value,
                  originalValue.current?.[optionName]?.type
                );
              }}
            />
          : null}
          {removable && !hidden ?
            <ReqoreButton
              className='readfirst-action'
              size='small'
              flat
              minimal
              intent='danger'
              icon='DeleteBinLine'
              tooltip='Remove field'
              onClick={(e: any) => {
                e.stopPropagation();
                confirmAction({
                  title: 'Remove field',
                  onConfirm: () => removeSelectedOption(optionName),
                });
              }}
            />
          : null}
          {infoToggle ?
            <StyledActionSlot className='options-readfirst-info-slot' $width={26}>
              {infoToggle}
            </StyledActionSlot>
          : null}
          <StyledActionSlot
            className={`options-readfirst-trailing-slot${!hidden && !fieldDisabled ? ' options-readfirst-trailing-hover-only' : ''}`}
            $width={18}
          >
            {hidden ?
              <ReqoreIcon icon='AddLine' intent='info' size='14px' />
            : fieldDisabled ?
              dependencyEntries.length ?
                <span
                  role='presentation'
                  style={{ display: 'inline-flex' }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onMouseEnter={() => setHighlightedOptions(depHighlightNames)}
                  onMouseLeave={() => setHighlightedOptions([])}
                >
                  <ReqoreIcon
                    className='options-readfirst-locked options-readfirst-lock-deps'
                    icon='LockLine'
                    size='14px'
                    style={{ opacity: 0.45, cursor: 'pointer' }}
                    tooltip={{
                      handler: 'click',
                      flat: true,
                      maxWidth: '260px',
                      content: (
                        <ReqoreControlGroup vertical gapSize='tiny' fluid>
                          <ReqoreSpan size='small' effect={{ opacity: 0.6 }}>Unlocked by:</ReqoreSpan>
                          <ReqoreControlGroup gapSize='tiny' wrap>
                            {dependencyEntries.map((entry, index) =>
                              Array.isArray(entry) ?
                                <ReqoreControlGroup key={index} gapSize='tiny' wrap>
                                  <ReqoreSpan size='tiny' effect={{ opacity: 0.55 }}>any of:</ReqoreSpan>
                                  {entry.map(renderDependencyTag)}
                                </ReqoreControlGroup>
                              : renderDependencyTag(entry)
                            )}
                          </ReqoreControlGroup>
                        </ReqoreControlGroup>
                      ),
                    }}
                  />
                </span>
              : <span
                  title={fieldDisabledReason}
                  style={{ display: 'inline-flex', opacity: 0.45 }}
                >
                  <ReqoreIcon className='options-readfirst-locked' icon='LockLine' size='14px' />
                </span>
            : <ReqoreIcon
                className='readfirst-action'
                icon={readOnly ? 'EyeLine' : 'EditLine'}
                size='14px'
              />
            }
          </StyledActionSlot>
        </StyledRowActions>
      </div>
    );

    if (hashEntries.length) {
      return (
        <StyledColumn
          key={optionName}
          data-field={optionName}
          className='options-readfirst-hash-row'
        >
          {row}
          <StyledRowInset>
            <ReqoreCollapsibleContent
              maxCollapsedHeight={96}
              buttonProps={{ className: 'options-readfirst-viewmore' }}
            >
              {/* The IDE workflow-orders renderer (ReqoreDataView): a nested,
                  type-coloured tree. Section summaries own their
                  expand/collapse clicks, but clicking a VALUE chip opens the
                  hash's editor. The Fields-menu "Show field types" toggle also
                  drives the per-scalar type chips here. Depth 2 = root + first
                  level open; deeper nests start collapsed so the preview stays
                  short before the fade's "Show more". */}
              <div className='options-readfirst-structured'>
                <StructuredDataView
                  value={optionField?.value}
                  collapsibleRoot={false}
                  showTypes={showFieldTypes}
                  defaultExpandDepth={2}
                  onItemClick={() => activate()}
                />
              </div>
            </ReqoreCollapsibleContent>
          </StyledRowInset>
          {infoBlock}
        </StyledColumn>
      );
    }

    if (infoBlock) {
      return (
        <StyledColumn
          key={optionName}
          data-field={optionName}
          className='options-readfirst-info-row'
        >
          {row}
          {infoBlock}
        </StyledColumn>
      );
    }

    return row;
  }
);

CompactRow.displayName = 'CompactRow';
