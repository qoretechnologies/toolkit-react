import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreIcon,
  ReqoreMessage,
  ReqoreP,
  ReqoreTag,
  ReqoreTagGroup,
} from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import {
  IQorusFormField,
  TQorusForm,
  TQorusFormFieldSchema,
} from '@qoretechnologies/ts-toolkit';
import flatten from 'lodash/flatten';
import size from 'lodash/size';
import React, { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { hasAllDependenciesFullfilled } from '../../../helpers/validations';
import { findTemplate, isValueTemplate } from '../../../helpers/templates';
import { richtextToSegments } from '../../../helpers/common';
import { DEFAULT_TEMPLATE_COLOR, TEMPLATE_COLORS } from '../../dpqlEditor/dpqlTags';
import { ReqoreCollapsibleContent } from '@qoretechnologies/reqore';
import { Description } from '../../Description';
import { FocusedEditing } from '../../FocusedEditing';
import { CompactRowContext } from './compactRowContext';
import {
  StyledActionSlot,
  StyledCardHeading,
  StyledCardLabel,
  StyledClusterNode,
  StyledColorSwatch,
  StyledColumn,
  StyledEditCard,
  StyledInfoPanel,
  StyledLabelBlock,
  StyledLabelDesc,
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

// Card editors that hold a SINGLE value through one text-bearing input — their
// built-in ReqoreInput clear duplicates the card's own "Clear value" action, so
// we suppress it (the card ✕ is the single source). Structural/multi-input
// editors (hash, list, schema…) and polymorphic ones (auto/any) are NOT listed:
// their per-sub-field clears are distinct affordances and must stay, while the
// card ✕ clears the whole value. (Operators force a card on a scalar value, so
// 'string' covers them — and `expr`, which is ui_type 'string'.)
const COMPACT_SINGLE_VALUE_TYPES = new Set([
  'string',
  'long-string',
  'markdown',
  'richtext',
  'byte-size',
  'method-name',
]);

// The $-token colour for a template value ($local:… → the 'local' hue), shared
// by the read-row template chip and the richtext inline tag chips.
const templateColor = (value: string): string => {
  const colonIdx = value.indexOf(':');
  const prefix = colonIdx > 1 ? value.slice(1, colonIdx).toLowerCase() : '';
  return (TEMPLATE_COLORS[prefix] || DEFAULT_TEMPLATE_COLOR).fg;
};

// One read-first row: label | value | action collapsed; the real editor (the
// classic renderOption) expanded. `hidden` = search-surfaced optional —
// activating the row adds the field first.
export const CompactRow = memo(
  ({
    optionName,
    optionField,
    hidden = false,
    clustered = false,
    clusterFirst = false,
    clusterLast = false,
  }: {
    optionName: string;
    optionField: IQorusFormField;
    hidden?: boolean;
    // Rendered inside a required-group cluster: leading status node + rail, and no
    // per-row "one of" chip (the cluster header carries it). first/last trim the
    // rail segment so it spans node-to-node, not past the end members.
    clustered?: boolean;
    clusterFirst?: boolean;
    clusterLast?: boolean;
  }) => {
    const readOnly = useContextSelector(CompactRowContext, (v) => v.readOnly);
    const commitMode = useContextSelector(CompactRowContext, (v) => v.commitMode);
    const options = useContextSelector(CompactRowContext, (v) => v.options);
    const operators = useContextSelector(CompactRowContext, (v) => v.operators);
    const focusedEditing = useContextSelector(CompactRowContext, (v) => v.focusedEditing);
    const showFieldTypes = useContextSelector(CompactRowContext, (v) => v.showFieldTypes);
    const showAllDescriptions = useContextSelector(
      CompactRowContext,
      (v) => v.showAllDescriptions
    );
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
    const confirmAction = useContextSelector(CompactRowContext, (v) => v.confirmAction);
    const renderOption = useContextSelector(CompactRowContext, (v) => v.renderOption);
    const theme = useContextSelector(CompactRowContext, (v) => v.theme);
    const cMuted = useContextSelector(CompactRowContext, (v) => v.cMuted);
    const templates = useContextSelector(CompactRowContext, (v) => v.templates);
    const cFaint = useContextSelector(CompactRowContext, (v) => v.cFaint);
    const cKey = useContextSelector(CompactRowContext, (v) => v.cKey);
    const cDivider = useContextSelector(CompactRowContext, (v) => v.cDivider);
    const cHover = useContextSelector(CompactRowContext, (v) => v.cHover);
    const cDanger = useContextSelector(CompactRowContext, (v) => v.cDanger);
    const cWarning = useContextSelector(CompactRowContext, (v) => v.cWarning);
    const cInfo = useContextSelector(CompactRowContext, (v) => v.cInfo);
    const cBg = useContextSelector(CompactRowContext, (v) => v.cBg);

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
          <span
            style={
              swatch ?
                {
                  ...wrapStyle,
                  // a slight wash of the chosen colour behind the swatch + hex
                  background: `color-mix(in srgb, ${swatch} 14%, transparent)`,
                  padding: '1px 8px',
                  borderRadius: 4,
                }
              : wrapStyle
            }
          >
            {swatch ? <StyledColorSwatch aria-hidden $color={swatch} $border={cDivider} /> : null}
            <span style={textStyle}>{formatted}</span>
          </span>
        );
      }

      if (valueType === 'file') {
        const fileSize = getFileSize(field?.value);
        // Match the File editor's chip: info-blue, FileLine icon, size as the
        // trailing key pill (the editor renders it as a ReqoreButton badge).
        return (
          <ReqoreTag
            size='small'
            minimal
            intent='info'
            icon='FileLine'
            label={formatted}
            labelKey={fileSize !== undefined ? formatBytes(fileSize) : undefined}
          />
        );
      }

      if (valueType === 'bool' || valueType === 'boolean') {
        const truthy = field?.value === true || field?.value === 'true';
        return (
          <ReqoreTag
            size='small'
            minimal
            intent={truthy ? 'success' : 'danger'}
            label={formatted}
          />
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

      // Template value ($local:…): render the template's DISPLAY NAME as a chip
      // (resolved from the templates list), with the raw value in the tooltip.
      // Falls back to the raw value when the template isn't in the list.
      if (
        typeof field?.value === 'string' &&
        !(field as { is_expression?: boolean }).is_expression &&
        isValueTemplate(field.value)
      ) {
        const tmpl = templates ? findTemplate(templates, field.value) : undefined;
        // Match the DpqlEditor's template tag: the $-dollar icon and the same
        // per-prefix colour (shared TEMPLATE_COLORS), so a `$local:…` reads the
        // same here as it does in the expression editor.
        return (
          <ReqoreTag
            size='small'
            icon='ExchangeDollarLine'
            color={templateColor(field.value) as `#${string}`}
            label={String(tmpl?.label ?? formatted)}
            tooltip={field.value}
          />
        );
      }

      // Richtext read-first summary: render embedded template tags as inline
      // $-chips (the same $-token as everywhere else) with the prose around
      // them, instead of flattening the whole document to text. Pure-text
      // richtext (no tags) falls through to the plain `formatted` string, which
      // keeps the single-line ellipsis.
      if (valueType === 'richtext' && Array.isArray(field?.value)) {
        const segments = richtextToSegments(field.value as never);
        if (segments.some((segment) => segment.kind === 'tag')) {
          return (
            <span style={{ ...wrapStyle, gap: 4, overflow: 'hidden' }}>
              {segments.map((segment, index) =>
                segment.kind === 'tag' ?
                  <ReqoreTag
                    key={index}
                    size='tiny'
                    icon='ExchangeDollarLine'
                    color={templateColor(segment.value || '') as `#${string}`}
                    label={segment.text || segment.value}
                    tooltip={segment.value}
                  />
                : <span key={index} style={{ whiteSpace: 'pre' }}>
                    {segment.text}
                  </span>
              )}
            </span>
          );
        }
      }

      return formatted;
    };

    const schema = options?.[optionName];
    const label = schema?.display_name || optionName;
    const required = !!(schema?.required || schema?.required_groups);
    const removable =
      !readOnly && !schema?.preselected && !schema?.required && !schema?.required_groups;
    const changed = !hidden && !readOnly && hasOptionChanged(optionField?.value, optionName);
    // "Has a value" = set to anything non-empty. Drives the edit-row Clear
    // button and the cluster node's filled state (see `memberSet`).
    const hasValue =
      optionField?.value !== undefined &&
      optionField?.value !== null &&
      optionField?.value !== '';
    // Required-group membership shows a PERSISTENT chip on every member: amber
    // "One of" while the group is unmet (tap → flash siblings), then a muted-green
    // resolution once satisfied — "Covers" on the field that satisfied it,
    // "Covered by <X>" on the rest. The resolution folds in what used to be a
    // separate value-slot note.
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
            size='tiny'
            minimal
            flat
            compact
            intent={groupResolved ? 'success' : 'warning'}
            icon={groupResolved ? 'CheckLine' : 'LinkM'}
            label={
              !groupResolved ? 'One of'
              : coveredByLabel ? `Covered by “${coveredByLabel}”`
              : 'Covers'
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
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleValueChange(
              optionName,
              originalValue.current?.[optionName]?.value,
              originalValue.current?.[optionName]?.type
            );
          }}
        />
      : null;
    // Clear-value: empties a set field (keeps the field; the value goes blank)
    // — distinct from the read-row "Remove field" (which deletes an optional
    // field entirely). Once cleared, `changed` flips on and `hasValue` off, so
    // this button gives way to `revertButton` in the same slot — the morph the
    // edit row's actions are designed around. Neutral (not danger): it's a
    // reversible step, undone by Revert or by re-typing.
    //
    // Only editors with NO built-in clear of their own get this button —
    // toggles and fixed-choice pickers. The text/number/date inputs already
    // render ReqoreInput's ✕ (which itself trips `changed`, so `revertButton`
    // takes over once emptied), so adding ours there would double the ✕.
    const editorLacksOwnClear =
      editType === 'bool' ||
      editType === 'boolean' ||
      // Non-creatable allowed_values render a radio/select (no input clear); a
      // CREATABLE one still renders the raw input (with its own ✕), so it keeps
      // its clear — matching the dispatch in AutoFormField/TemplateField.
      (!!size(schema?.allowed_values) && !schema?.allowed_values_creatable);
    const clearValueButton =
      hasValue && !readOnly && editorLacksOwnClear ?
        <ReqoreButton
          className='options-readfirst-clear'
          size='small'
          flat
          minimal
          icon='CloseLine'
          tooltip='Clear value'
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleValueChange(optionName, undefined);
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
          // The empty required field's value slot already reads "Required — not
          // set", so the plain required message would duplicate it.
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
    // The short_desc renders UNDER the field name (revealed by the ⓘ toggle); the
    // value-side panel carries only the messages (tier1/tier2).
    const labelShortDesc = schema?.short_desc;
    const panelHasContent = tier1.length > 0 || tier2.length > 0;
    const hasInfoPanelContent = infoActive && (panelHasContent || !!labelShortDesc);
    // Open-state precedence: a per-row ⓘ override is most specific; else the
    // global toggle when ENGAGED (show all / hide all — overriding the message
    // auto-open); else the default, where only critical (tier1) messages open.
    const defaultOpen =
      showAllDescriptions === undefined ? tier1.length > 0 : showAllDescriptions;
    const infoPanelOpen = hasInfoPanelContent && (infoPanelOverride ?? defaultOpen);

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
        <ReqoreButton
          className='options-readfirst-info-toggle'
          size='tiny'
          minimal
          flat
          compact
          fixed
          active={infoPanelOpen}
          intent={worstIntent as never}
          icon={infoPanelOpen ? 'InformationFill' : 'InformationLine'}
          tooltip={infoPanelOpen ? 'Hide field information' : 'Show field information'}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setInfoPanelOverrides((prev) => ({ ...prev, [optionName]: !infoPanelOpen }));
          }}
        />
      : null;

    const infoBlock =
      infoPanelOpen && panelHasContent ?
        <StyledInfoPanel className='options-readfirst-info-panel'>
          {[...tier1, ...tier2].map(renderInfoStrip)}
        </StyledInfoPanel>
      : null;

    // Cluster (required-group connection) — shared by the read row, its block
    // wrapper AND the inline editor, so the rail/node/highlight persist across
    // view↔edit. The node is opaque (it masks the rail behind it); hovering any
    // member lights up the whole group via the shared highlight state.
    const clusterGroup =
      clustered ? (schema?.required_groups as string[] | undefined)?.[0] : undefined;
    const clusterMembers = clusterGroup ? requiredGroupsInfo.members[clusterGroup] || [] : [];
    // The group is fulfilled once any member is set — the whole rail then reads
    // success (not just the satisfying node).
    const clusterSatisfied = !!(clusterGroup && requiredGroupsInfo.satisfiedBy[clusterGroup]);
    const clusterBlockClass =
      clustered ?
        `readfirst-cluster-rail${clusterFirst ? ' readfirst-cluster-first' : ''}${clusterLast ? ' readfirst-cluster-last' : ''}${clusterSatisfied ? ' readfirst-cluster-satisfied' : ''}`
      : '';
    const memberSet = clustered && !hidden && hasValue;
    const clusterNode =
      clustered ?
        <StyledClusterNode
          className='options-readfirst-node'
          $filled={!!memberSet}
          $color={
            memberSet ?
              (theme?.intents as Record<string, string> | undefined)?.success || cInfo
            : `${cWarning}99`
          }
          $bg={cBg}
        />
      : null;
    const clusterHoverProps =
      clustered && clusterMembers.length ?
        {
          onMouseEnter: () => setHighlightedOptions(clusterMembers),
          onMouseLeave: () => setHighlightedOptions([]),
        }
      : {};

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
            {...clusterHoverProps}
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
              {clearValueButton}
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
            {/* Cluster node is rendered LAST (it's absolutely positioned, so DOM
                order doesn't move it) — keeping it out of the leading cells lets
                the `> div:nth-child(1/2/3)` editing-row alignment nudges land on
                label / editor / actions instead of being shifted by the node. */}
            {clusterNode}
          </div>
        );
        // ALWAYS wrap the editing row in the same StyledColumn so its parent stays
        // stable (the editor must not remount and lose focus mid-type). The
        // message panel is NOT rendered here: the editor's own OptionFieldMessages
        // strip already shows the field's messages, so a panel would duplicate
        // them. The wrapper carries the cluster rail class so the connection
        // persists while a member is being edited.
        return (
          <StyledColumn
            key={optionName}
            data-field={optionName}
            className={clusterBlockClass || undefined}
          >
            {editingRow}
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
          className={
            COMPACT_SINGLE_VALUE_TYPES.has(editType) ?
              'options-readfirst-card options-readfirst-card-single'
            : 'options-readfirst-card'
          }
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
              {/* Clear-value sits between focus-edit and Done — the card analog of
                  the inline row's Clear. Empties the value (keeps the field). */}
              {hasValue && !readOnly ?
                <ReqoreButton
                  size='small'
                  icon='CloseLine'
                  minimal
                  flat
                  fixed
                  className='options-readfirst-clear'
                  tooltip='Clear value'
                  onClick={() => handleValueChange(optionName, undefined)}
                />
              : null}
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
    // Dependency lock, styled to match the required-group chip: a muted
    // "Depends on" dropdown whose items are the blocking fields (an "any of:"
    // divider for OR-groups), each clickable to flash/locate the blocker.
    const dependsOnChip =
      fieldDisabled && dependencyEntries.length ?
        <span
          style={{ display: 'inline-flex' }}
          role='presentation'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setHighlightedOptions(depHighlightNames)}
          onMouseLeave={() => setHighlightedOptions([])}
        >
          <ReqoreDropdown
            className='options-readfirst-lock-deps'
            size='tiny'
            minimal
            flat
            compact
            icon='LockLine'
            label='Depends on'
            items={[
              { divider: true, label: 'Unlocked by:', dividerAlign: 'left' } as IReqoreDropdownItem,
              ...dependencyEntries.flatMap((entry): IReqoreDropdownItem[] => [
                ...(Array.isArray(entry) ?
                  [{ divider: true, label: 'any of:', dividerAlign: 'left' } as IReqoreDropdownItem]
                : []),
                ...(Array.isArray(entry) ? entry : [entry]).flatMap(
                  (dep): IReqoreDropdownItem[] => {
                    const info = describeDependency(dep);
                    return info.exists ?
                        [
                          {
                            label: info.label,
                            icon: info.fulfilled ? 'CheckLine' : 'ArrowRightLine',
                            intent: info.fulfilled ? 'success' : undefined,
                            onClick: () => flashOption(info.name),
                          } as IReqoreDropdownItem,
                        ]
                      : [];
                  }
                ),
              ]),
            ]}
          />
        </span>
      : null;
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
    // Intent stripe on the block ROOT so it spans the field's whole territory:
    // the info/preview wrapper when one hangs below, else the bare row. It feeds
    // --readfirst-stripe, which StyledGroupBody paints as the value surface's left
    // border (the recessed surface starts at the value column).
    const stripeStyle =
      rowStripeColor ?
        ({ ['--readfirst-stripe']: rowStripeColor } as React.CSSProperties)
      : undefined;
    const blockWrapped = hashEntries.length > 0 || !!infoBlock;

    const row = (
      <div
        key={optionName}
        data-field={optionName}
        role='button'
        tabIndex={0}
        aria-label={`${label}${hidden ? ' (add field)' : ''}`}
        className={`readfirst-row options-readfirst-value${hidden ? ' readfirst-row-hidden' : ''}${fieldDisabled ? ' readfirst-row-disabled' : ''}${isHighlighted ? ' readfirst-row-group-highlight' : ''}${isFlashed ? ' readfirst-row-flash' : ''}${labelShortDesc && infoPanelOpen ? ' readfirst-row-info-open' : ''}${!blockWrapped && clusterBlockClass ? ' ' + clusterBlockClass : ''}`}
        aria-disabled={fieldDisabled || undefined}
        style={blockWrapped ? undefined : stripeStyle}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate(event);
          }
        }}
        {...clusterHoverProps}
      >
        {clusterNode}
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
          {labelShortDesc && infoPanelOpen ?
            <StyledLabelDesc
              className='options-readfirst-label-desc'
              size='small'
              effect={{ opacity: 0.55 }}
            >
              {labelShortDesc}
            </StyledLabelDesc>
          : null}
        </StyledLabelBlock>
        <StyledRowValue
          title={!empty && !hidden && typeof formatted === 'string' ? formatted : undefined}
          $color={empty || hidden ? cFaint : `${cMuted}cc`}
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
              rag INWARD; the lock/add and info slots are fixed-width and pinned at
              the right, so the ⓘ sits at the same x on every row. Revert is shown
              whenever a field has changed; delete reveals on hover. */}
          {/* No generic invalid/required chip: the intent stripe + the field's
              own message already flag invalidity, and an empty required field's
              value slot reads "Required — not set". Only the required-GROUP chip
              (One of / Covers) stays — it carries info nothing else does. */}
          {/* Railed (clustered) members: the rail conveys the grouping, so drop
              the "One of"/"Covers" chip — keep only "Covered by <X>", the one fact
              the rail can't show. Non-clustered members (split-across-panels or
              narrow mode, where there's no rail) keep the full chip as a fallback. */}
          {!hidden && !fieldDisabled && (!clustered || !!coveredByLabel) ? requiredGroupChip : null}
          {!hidden ? dependsOnChip : null}
          {draftChip}
          {changed ?
            <ReqoreButton
              className='options-readfirst-revert'
              size='small'
              flat
              minimal
              icon='HistoryLine'
              tooltip='Revert changes'
              onClick={(e: React.MouseEvent) => {
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
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                confirmAction({
                  title: 'Remove field',
                  onConfirm: () => removeSelectedOption(optionName),
                });
              }}
            />
          : null}
          {/* Lock/add slot BEFORE the info slot so the ⓘ keeps the same far-right
              x on every row — a disabled field's lock sits to the ⓘ's left rather
              than pushing it inward. ADD for a hidden field; a plain LOCK for a
              field disabled for a non-dependency reason. Dependency-locked fields
              show the "Depends on" chip in the chips area instead; the whole row is
              click-to-edit, so there's no hover edit pencil. */}
          {hidden || (fieldDisabled && !dependencyEntries.length) ?
            <StyledActionSlot className='options-readfirst-trailing-slot' $width={18}>
              {hidden ?
                <ReqoreIcon icon='AddLine' intent='info' size='14px' />
              : <span
                  title={fieldDisabledReason}
                  style={{ display: 'inline-flex', opacity: 0.45 }}
                >
                  <ReqoreIcon className='options-readfirst-locked' icon='LockLine' size='14px' />
                </span>
              }
            </StyledActionSlot>
          : null}
          {infoToggle ?
            <StyledActionSlot className='options-readfirst-info-slot' $width={26}>
              {infoToggle}
            </StyledActionSlot>
          : null}
        </StyledRowActions>
      </div>
    );

    if (hashEntries.length) {
      return (
        <StyledColumn
          key={optionName}
          data-field={optionName}
          className={`options-readfirst-hash-row${clusterBlockClass ? ' ' + clusterBlockClass : ''}`}
          style={stripeStyle}
        >
          {row}
          <StyledRowInset className='options-readfirst-inset'>
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
          className={`options-readfirst-info-row${clusterBlockClass ? ' ' + clusterBlockClass : ''}`}
          style={stripeStyle}
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
