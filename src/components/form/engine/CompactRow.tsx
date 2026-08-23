import {
  ReqoreButton,
  ReqoreCollapsibleContent,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreIcon,
  ReqoreMessage,
  ReqoreP,
  ReqoreTag,
  ReqoreTagGroup,
} from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { resolveOptionActions } from './optionActions';
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
import {
  findTemplate,
  getTemplateTagStyle,
  isValueTemplate,
  TTemplateMeta,
} from '../../../helpers/templates';
import { richtextToSegments } from '../../../helpers/common';
import { ReadOnlyTemplateTag } from '../fields/template/ReadOnlyTemplateTag';
import { Description } from '../../Description';
import { useMarkdownRenderer } from '../../Description/markdownRendererContext';
import { FocusedEditing } from '../../FocusedEditing';
import { CompactRowContext } from './compactRowContext';
import {
  StyledActionSlot,
  StyledCardHeading,
  StyledCardLabel,
  StyledCodePreview,
  StyledColorSwatch,
  StyledColumn,
  StyledEditCard,
  StyledLabelBlock,
  StyledLabelDesc,
  StyledRowActions,
  StyledRowInset,
  StyledRowLabel,
  StyledRowValue,
  StyledStatusDot,
} from './compactRowStyles';
import { getOptionFieldMessages } from './OptionFieldMessages';
import {
  colorToCss,
  formatBytes,
  formatOptionValue,
  getAllowedValueImage,
  getFileSize,
  getHashEntries,
  getReadFirstStatus,
  getValueType,
  isFixedCompactAllowedValueOption,
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
// we suppress it (the card trash action is the single source). Structural/multi-input
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

// How many consumer-injected actions may sit inline in a row before the rest
// overflow into the row's menu. A row's action slot shares space with the
// value; an unbounded button strip would squeeze the value out, and the
// consumer controls how many actions it injects.
const MAX_INLINE_OPTION_ACTIONS = 2;


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
    const codePreviewRenderer = useContextSelector(
      CompactRowContext,
      (v) => v.codePreviewRenderer
    );
    const markdownRenderer = useMarkdownRenderer();
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
    const autoFocusNameRef = useContextSelector(CompactRowContext, (v) => v.autoFocusNameRef);
    const isHighlighted = useContextSelector(CompactRowContext, (v) =>
      v.highlightedOptions.includes(optionName)
    );
    const isFlashed = useContextSelector(CompactRowContext, (v) =>
      v.flashedOptions.includes(optionName)
    );
    const setHighlightedOptions = useContextSelector(
      CompactRowContext,
      (v) => v.setHighlightedOptions
    );
    const setFocusedEditing = useContextSelector(CompactRowContext, (v) => v.setFocusedEditing);
    const readRowHeights = useContextSelector(CompactRowContext, (v) => v.readRowHeights);
    const originalValue = useContextSelector(CompactRowContext, (v) => v.originalValue);
    const availableOptions = useContextSelector(CompactRowContext, (v) => v.availableOptions);
    const requiredGroupsInfo = useContextSelector(CompactRowContext, (v) => v.requiredGroupsInfo);
    const handleValueChange = useContextSelector(CompactRowContext, (v) => v.handleValueChange);
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
    const optionActions = useContextSelector(CompactRowContext, (v) => v.optionActions);
    const collapseOptionActions = useContextSelector(
      CompactRowContext,
      (v) => v.collapseOptionActions
    );
    const renderOption = useContextSelector(CompactRowContext, (v) => v.renderOption);
    const theme = useContextSelector(CompactRowContext, (v) => v.theme);
    const cMuted = useContextSelector(CompactRowContext, (v) => v.cMuted);
    const templates = useContextSelector(CompactRowContext, (v) => v.templates);
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

      // Code-editor read summary: replace the truncated string with a chip
      // showing line count + character count. The actual code renders below
      // the row as a monospace `<pre>` inside a `ReqoreCollapsibleContent` —
      // see `showCodePreview` below. Keeps the row height fixed while making
      // multi-line source readable without opening the full editor.
      if (valueType === 'code-editor' && typeof field?.value === 'string') {
        const lines = field.value.split('\n').length;
        const chars = field.value.length;
        return (
          <ReqoreTag
            size='small'
            minimal
            intent='info'
            icon='CodeLine'
            label={`${lines} ${lines === 1 ? 'line' : 'lines'}`}
            labelKey={`${chars} ${chars === 1 ? 'char' : 'chars'}`}
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

      // Template value ($local:…): the read-only template picker — the SAME chip
      // TemplateField renders when disabled, so a template reads identically here
      // and in the editor (qorus-ide intent scheme: info / qorus purple).
      if (
        typeof field?.value === 'string' &&
        !(field as { is_expression?: boolean }).is_expression &&
        isValueTemplate(field.value)
      ) {
        return <ReadOnlyTemplateTag value={field.value} templates={templates} size='small' />;
      }

      // Richtext read-first summary: inline $-chips for embedded template tags
      // with the prose around them (the IDE intent scheme via getTemplateTagStyle),
      // kept lightweight instead of mounting the full editor — that lives in the
      // expanded card. Pure-text richtext (no tags) falls through to the plain
      // `formatted` string and keeps the single-line ellipsis.
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
                    // The chip's label has to be the same size as the prose it is
                    // embedded in. The wrapper centres boxes, so two different text
                    // sizes centred against each other cannot share a baseline, and
                    // the chips visibly float above the words. Inheriting the row's
                    // size makes centring align the baselines too, at whatever font
                    // size the consuming app uses.
                    style={{ fontSize: 'inherit' }}
                    icon='ExchangeDollarLine'
                    label={segment.text || segment.value}
                    tooltip={segment.value}
                    {...getTemplateTagStyle(
                      (templates ? findTemplate(templates, segment.value || '') : undefined)
                        ?.metadata as TTemplateMeta | undefined
                    )}
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
    const injectedOptionActions = React.useMemo<IReqorePanelAction[]>(
      () =>
        schema ?
          resolveOptionActions(optionActions, {
            name: optionName,
            schema,
            value: availableOptions?.[optionName],
          }).filter((action) => action.show !== false)
        : [],
      [availableOptions?.[optionName], optionActions, optionName, schema]
    );
    // Which injected actions stay as inline buttons, and which move into the
    // overflow menu. Everything collapses on touch / narrow viewports — a
    // hover-gated button is unreachable without a hover — and anything past the
    // inline cap overflows regardless, so a consumer injecting ten actions can
    // never push the row's value out of view.
    const [inlineOptionActions, menuOptionActions] = React.useMemo<
      [IReqorePanelAction[], IReqorePanelAction[]]
    >(
      () =>
        collapseOptionActions ?
          [[], injectedOptionActions]
        : [
            injectedOptionActions.slice(0, MAX_INLINE_OPTION_ACTIONS),
            injectedOptionActions.slice(MAX_INLINE_OPTION_ACTIONS),
          ],
      [collapseOptionActions, injectedOptionActions]
    );
    const injectedOptionActionMenuItems = React.useMemo<IReqoreDropdownItem[]>(
      () =>
        menuOptionActions.map(
          (action, index) =>
            ({
              // A panel action labels itself with `label`, but an icon-only one
              // (the IDE's AI-assist button) carries its name in the tooltip —
              // a menu row has no hover affordance to fall back on.
              label: action.label ?? action.tooltip ?? `Action ${index + 1}`,
              icon: action.icon,
              intent: action.intent,
              disabled: action.disabled,
              onClick: () => action.onClick?.(),
            }) as IReqoreDropdownItem
        ),
      [menuOptionActions]
    );
    const renderInjectedOptionAction = (
      action: IReqorePanelAction,
      index: number,
      size: 'tiny' | 'small' = 'small'
    ) => {
      // `show` drives visibility here instead of reaching the DOM. The classic
      // path hands these to ReqorePanel, which honours `show: 'hover'` itself;
      // the compact slots render plain buttons, so 'hover' becomes a CSS gate on
      // the containing row/card (see compactRowStyles) — same config, same
      // behaviour in both modes.
      // `size` is destructured out and deliberately NOT honoured: the row owns
      // its action strip's rhythm, and a consumer-supplied size made the
      // injected button visibly smaller than the revert / more / confirm
      // buttons beside it. The contextual `size` argument is the row's own
      // (small when editing or in a card, tiny on a read row), so injected
      // actions always match their neighbours.
      const {
        label: actionLabel,
        onClick,
        show,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        size: _ignoredSize,
        className,
        ...actionProps
      } = action;

      return (
        <ReqoreButton
          key={`${optionName}-injected-action-${index}`}
          size={size}
          minimal
          flat
          fixed
          {...actionProps}
          className={`${className ? `${className} ` : ''}options-injected-action${
            show === 'hover' ? ' options-injected-action-hover' : ''
          }`}
          onClick={(event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            onClick?.();
          }}
        >
          {actionLabel}
        </ReqoreButton>
      );
    };
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
            effect={{ uppercase: true, spaced: 1 }}
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
    const fixedAllowedValueOption = isFixedCompactAllowedValueOption(schema);
    const editType =
      (fixedAllowedValueOption
        ? (schema?.type as string) || (schema?.ui_type as string)
        : (schema?.ui_type as string) || (schema?.type as string)) ?? '';
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

    // Auto-focus the editor's first input when a field is opened, so you can type
    // straight away (matches the prototype's tap-to-edit feel).
    const editorRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
      if (!isExpanded) return undefined;
      const id = window.setTimeout(() => {
        const el = editorRef.current?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea, [contenteditable="true"]'
        );
        // A user-driven expand scrolls the just-opened editor into view; the
        // programmatic `autoFocusFirstRequired` expand must NOT — otherwise an
        // off-screen / below-the-fold form scrolls itself into view on mount.
        el?.focus(autoFocusNameRef?.current === optionName ? { preventScroll: true } : undefined);
      }, 60);
      return () => window.clearTimeout(id);
    }, [isExpanded, optionName, autoFocusNameRef]);

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
    // edit row's actions are designed around. Clearing is destructive even
    // though it can be reverted before saving, so both the trigger and its
    // confirmation use danger intent.
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
    const confirmClearValue = (event?: React.MouseEvent) => {
      event?.stopPropagation();
      confirmAction({
        title: 'Clear value',
        description: `Clear the current value of "${label}"?`,
        confirmLabel: 'Clear value',
        confirmButtonIntent: 'danger',
        intent: 'danger',
        onConfirm: () => handleValueChange(optionName, undefined),
      });
    };
    const clearValueButton =
      hasValue && !readOnly && editorLacksOwnClear ?
        <ReqoreButton
          className='options-readfirst-clear'
          size='small'
          flat
          minimal
          icon='DeleteBinLine'
          intent='danger'
          aria-label='Clear value'
          tooltip='Clear value'
          onClick={confirmClearValue}
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
          size='tiny'
          minimal
          fixed
          flat
          compact
          effect={{ uppercase: true, spaced: 1 }}
        />
      : null;
    const isPassiveCloseAction = fixedAllowedValueOption || readOnly;
    const closeExpandedFieldButton = (
      <ReqoreButton
        className='options-readfirst-done'
        size='small'
        intent={!isPassiveCloseAction ? 'success' : undefined}
        flat={isPassiveCloseAction}
        minimal={isPassiveCloseAction}
        fixed
        icon={isPassiveCloseAction ? 'CloseLine' : 'CheckLine'}
        aria-label={isPassiveCloseAction ? 'Close field' : 'Done'}
        tooltip={isPassiveCloseAction ? 'Close field' : 'Done'}
        onClick={() => toggleExpandedOption(optionName)}
      />
    );

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
    // TWO display channels, matching the Focus prototype:
    //  • dedicated schema `messages` → prominent coloured PANELS below the row;
    //  • everything else (validation reasons, the unmet-dependency hint, the
    //    default-value note) → a compact INLINE reason strip — not a panel.
    const panelMessages = schemaMessages;
    const inlineMessages: TInfoMsg[] = [
      ...fieldMessages,
      ...(infoActive && schema?.default_value_desc ?
        [
          {
            content:
              `Default: ${schema.default_value_display_name || ''} — ${schema.default_value_desc}`.trim(),
          },
        ]
      : []),
    ];
    const allMsgs = [...panelMessages, ...inlineMessages];
    const worstIntent =
      allMsgs.some((m) => m.intent === 'danger') ? 'danger'
      : allMsgs.some((m) => m.intent === 'warning') ? 'warning'
      : undefined;
    const intentColor =
      worstIntent === 'danger' ? cDanger
      : worstIntent === 'warning' ? cWarning
      : undefined;
    const showStripe = infoActive && !!intentColor;
    const labelShortDesc = schema?.short_desc;
    // The per-row ⓘ is gone: short_desc shows under the name only when the global
    // "descriptions" toggle is engaged (and inside the editor when expanded).
    const showLabelDesc = !!labelShortDesc && showAllDescriptions === true;

    // The `?` that opens the long-form help dialog. Shared by the read row AND
    // the inline editor: opening a field used to drop it, leaving an editing row
    // with no route to the field's description at all. Stops propagation because
    // both labels are click targets themselves (the row expands / collapses).
    const helpIcon =
      schema?.desc ?
        <ReqoreIcon
          icon='QuestionLine'
          size='12px'
          effect={{ opacity: 0.55 }}
          margin='left'
          marginSize='tiny'
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
      : null;

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
    const reasonColor = (intent?: string) =>
      intent === 'danger' ? cDanger
      : intent === 'warning' ? cWarning
      : intent === 'success' ?
        (theme?.intents as Record<string, string> | undefined)?.success || cInfo
      : `${cMuted}cc`;

    const infoToggle = null;

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
    // The connection rail + status nodes are gone — the "One of the below is
    // required" box (and the Covers / Covered-by chips) carry the grouping now.
    const clusterNode = null;
    const clusterHoverProps =
      clustered && clusterMembers.length ?
        {
          onMouseEnter: () => setHighlightedOptions(clusterMembers),
          onMouseLeave: () => setHighlightedOptions([]),
        }
      : {};

    // Secondary edit actions tuck into a "More" (⋮) menu so the card header stays
    // calm: Fullscreen always, plus Remove field for a removable option. Rendered
    // just before the Done ✓ in both expanded layouts.
    const moreMenu = (
      <ReqoreDropdown
        className='options-readfirst-more'
        icon='More2Fill'
        flat
        minimal
        fixed
        size='small'
        tooltip='More actions'
        items={[
          {
            label: 'Edit fullscreen',
            icon: 'FullscreenLine',
            onClick: () => setFocusedEditing(optionName),
          } as IReqoreDropdownItem,
          ...(removable && !hidden ?
            [
              {
                label: 'Remove field',
                icon: 'DeleteBinLine',
                intent: 'danger',
                onClick: () =>
                  confirmAction({
                    title: 'Remove field',
                    onConfirm: () => removeSelectedOption(optionName),
                  }),
              } as IReqoreDropdownItem,
            ]
          : []),
          // Consumer-injected actions that did not fit inline (or collapsed
          // wholesale on touch) land here — this row already has a menu, so they
          // reuse it rather than adding a second one beside it.
          ...injectedOptionActionMenuItems,
        ]}
      />
    );

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
            <StyledLabelBlock>
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
                {helpIcon}
              </StyledRowLabel>
              {/* An OPEN field always shows its short_desc — that's where the hint
                  is needed and there's no per-row button to reveal it (the edit
                  card does the same). The global descriptions toggle governs READ
                  rows only, so collapsing the field is what hides it again. */}
              {labelShortDesc ?
                <StyledLabelDesc
                  className='options-readfirst-label-desc'
                  size='small'
                  effect={{ opacity: 0.55 }}
                >
                  {labelShortDesc}
                </StyledLabelDesc>
              : null}
            </StyledLabelBlock>
            <div
              ref={editorRef}
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
              {inlineOptionActions.map((action, index) =>
                renderInjectedOptionAction(action, index)
              )}
              {moreMenu}
              {closeExpandedFieldButton}
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
            {/* Focused editing for an INLINE row. The edit card wraps its editor
                in <FocusedEditing>, which renders the field in place AND in the
                modal; an inline row already renders its editor in the row grid,
                so it mounts the modal alone. Without this the More menu's "Edit
                fullscreen" set the state and nothing appeared — the modal simply
                had no mount point on this branch. */}
            {focusedEditing === optionName ?
              <FocusedEditing
                isFullscreen
                modalOnly
                onClose={() => setFocusedEditing(undefined)}
                description={(schema?.display_name as string) || optionName}
              >
                <Description
                  longDescription={schema?.desc}
                  shortDescription={schema?.short_desc}
                  longDescriptionShownByDefault
                />
                {renderOption(optionName, optionField)}
              </FocusedEditing>
            : null}
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
              <StyledCardLabel $color={cKey}>
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
              {inlineOptionActions.map((action, index) =>
                renderInjectedOptionAction(action, index)
              )}
              {/* Clear-value sits before the More menu — the card analog of the
                  inline row's Clear. Empties the value (keeps the field). */}
              {hasValue && !readOnly ?
                <ReqoreButton
                  size='small'
                  icon='DeleteBinLine'
                  minimal
                  flat
                  fixed
                  intent='danger'
                  className='options-readfirst-clear'
                  aria-label='Clear value'
                  tooltip='Clear value'
                  onClick={confirmClearValue}
                />
              : null}
              {moreMenu}
              {closeExpandedFieldButton}
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
    // Inline reasons shown on the value line: validation / dependency / one-of /
    // default-value hints, plus a read-only covered-by note (editable covered rows
    // carry that in their chip instead).
    const valueReasons: TInfoMsg[] = [
      ...inlineMessages,
      ...(empty && coveredByLabel ?
        [{ content: `Covered by “${coveredByLabel}”`, intent: 'success' }]
      : []),
    ];
    // A hash row reveals its sub-fields as read-only sub-rows under a "view
    // more" disclosure; the row itself still expands the real editor on click.
    const valueType = getValueType(optionField, schema);
    const hashEntries =
      !hidden &&
      (valueType === 'hash' || valueType === 'free-hash') &&
      (schema as { ui_type?: string } | undefined)?.ui_type !== 'schema-definition' ?
        getHashEntries(optionField, schema)
      : [];
    // A LIST OF HASHES/objects gets the same expandable structured preview a hash
    // does — the flat "N items" summary can't convey object contents (and must
    // never print "[object Object]"). StructuredDataView unwraps each item's
    // {type,value} envelope. Plain scalar lists keep just their joined summary.
    const isHashList =
      !hidden &&
      (valueType === 'list' || valueType === 'free-list' || valueType === 'array') &&
      Array.isArray(optionField?.value) &&
      optionField.value.length > 0 &&
      optionField.value.some((item) => {
        const inner =
          item && typeof item === 'object' && 'value' in (item as Record<string, unknown>) ?
            (item as Record<string, unknown>).value
          : item;
        return inner !== null && typeof inner === 'object';
      });
    const showStructuredPreview = hashEntries.length > 0 || isHashList;
    // Multi-line code preview: a `code-editor` field with a non-empty string
    // value gets a `<pre>`-based code block under the row, capped by a
    // `ReqoreCollapsibleContent` so the collapsed height stays row-sized and
    // "Show more" reveals the rest.  Sits in the same inset the hash/list
    // preview uses — mutually exclusive with `showStructuredPreview`.
    const showCodePreview =
      !hidden &&
      valueType === 'code-editor' &&
      typeof optionField?.value === 'string' &&
      optionField.value.length > 0;
    // Markdown reads the same way for the same reason: the row itself can only
    // show a line of text, and for markdown that line is the SOURCE — the reader
    // gets `## ` and `**` where the point of the value is what it looks like
    // rendered. The document renders in the same inset the code preview uses,
    // through the host's renderer, so the row shows the description the way the
    // page it describes will.
    const showMarkdownPreview =
      !hidden &&
      !!markdownRenderer &&
      // keyed on the schema's ui_type, not on getValueType(): a markdown value
      // IS a string and the value type says so, which is the whole distinction
      // between how a value is stored and which editor draws it
      (schema as { ui_type?: string } | undefined)?.ui_type === 'markdown' &&
      typeof optionField?.value === 'string' &&
      optionField.value.length > 0;
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
            tooltip='Disabled — depends on other fields. Click to locate them.'
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
      // Optional fields aren't "added" — every one is editable in place. Opening a
      // not-yet-set field just expands its editor (with an empty value); it joins
      // the form's output the moment a value is set (and moves to Set / Needs
      // attention), and drops back to Optional when cleared. No explicit add step.
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

    // "Focus" trailing status dot, derived from the SHARED status helper (the
    // same one FormEngine uses to bucket rows into the Needs-attention/Set/Optional
    // boxes — so the dot and the box can never disagree). Hidden (not-yet-added)
    // and dependency-locked rows show no dot (the add/lock affordance speaks for
    // them). worstIntent already folds in schema + validation messages.
    const cSuccess = (theme?.intents as Record<string, string> | undefined)?.success;
    const rowStatus = getReadFirstStatus({
      empty,
      required,
      covered: !!coveredByLabel || groupResolved,
      invalid: worstIntent === 'danger',
      warned: worstIntent === 'warning',
    });
    const dotStatus = hidden || fieldDisabled ? undefined : rowStatus;
    const dotColor =
      dotStatus === 'invalid' ? cDanger
      : dotStatus === 'todo' ? cWarning
      : dotStatus === 'set' ? cSuccess || cInfo
      : undefined;
    const row = (
      <div
        key={optionName}
        data-field={optionName}
        role='button'
        tabIndex={0}
        aria-label={label}
        className={`readfirst-row options-readfirst-value${hidden ? ' readfirst-row-hidden' : ''}${fieldDisabled ? ' readfirst-row-disabled' : ''}${isHighlighted ? ' readfirst-row-group-highlight' : ''}${isFlashed ? ' readfirst-row-flash' : ''}${showLabelDesc ? ' readfirst-row-info-open' : ''}${panelMessages.length || showStructuredPreview || showCodePreview ? ' readfirst-row-tall' : ''}${clusterBlockClass ? ' ' + clusterBlockClass : ''}`}
        aria-disabled={fieldDisabled || undefined}
        style={stripeStyle}
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
            {/* label + asterisk + help flow as ONE inline run, so the asterisk
                stays right after the last word even when the name wraps. */}
            <span className='options-readfirst-label-text' style={{ minWidth: 0 }}>
              {label}
              {required ?
                <ReqoreIcon icon='Asterisk' color='danger' size='10px' margin='left' marginSize='tiny' />
              : null}
              {helpIcon}
            </span>
            {typeLabel ?
              <ReqoreTag size='tiny' minimal label={typeLabel} labelEffect={{ opacity: 0.55 }} />
            : null}
          </StyledRowLabel>
          {showLabelDesc ?
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
          // A code field draws its whole value in the preview below, with
          // "Show more" for the rest, so a hover carrying the same text is
          // noise -- and a native tooltip holding a few hundred lines is
          // unreadable anyway. Every other value keeps its hover, which is the
          // only way to read one that the row had to truncate.
          title={
            !empty && !hidden && !showCodePreview && typeof formatted === 'string' ?
              formatted
            : undefined
          }
          // A SET value reads at full key brightness so it stands out as the
          // actual data — crucial when stacked under a (muted) description on
          // mobile, where a dim value blends into the prose. The bold name still
          // outranks it; the empty dash stays faint.
          $color={empty || hidden ? `${cMuted}66` : cKey}
          $empty={empty || hidden}
        >
          <span className='options-readfirst-valuetext'>
            {hidden || empty ? '—' : renderReadFirstValue(optionField, schema, formatted)}
          </span>
          {valueReasons.map((m, i) => (
            <span
              key={`${m.content}-${i}`}
              className='options-readfirst-reason'
              style={{ color: reasonColor(m.intent) }}
            >
              {m.content}
            </span>
          ))}
          {/* Dedicated schema message PANELS render right here, directly under the
              value (full width of the value column) — never pushed down by the
              label's short_desc. */}
          {panelMessages.length ?
            <div className='options-readfirst-info-panel'>{panelMessages.map(renderInfoStrip)}</div>
          : null}
          {/* The structured hash/list preview also lives in the value cell, so it
              starts directly under the value summary ("N fields"), not below the
              label's short_desc. */}
          {showStructuredPreview ?
            // The inset lives inside the row now, so a click on a value chip would
            // bubble to the row's onClick and fire activate() a SECOND time (the
            // chip's onItemClick already calls it) — toggling the editor shut again.
            // Stop the bubble here; the chip's own handler still opens the editor.
            <StyledRowInset
              className='options-readfirst-inset'
              onClick={(e) => e.stopPropagation()}
            >
              <ReqoreCollapsibleContent
                maxCollapsedHeight={96}
                buttonProps={{ className: 'options-readfirst-viewmore' }}
              >
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
          : null}
          {/* Code-editor preview: same inset placement as hash/list — a monospace
              `<pre>` block wrapped in `ReqoreCollapsibleContent` so the collapsed
              row stays row-height while multi-line source reveals via "Show more".
              Stopping propagation here (like the structured inset) — a click on
              the collapse button must not also open the field editor. */}
          {showCodePreview ?
            <StyledRowInset
              className='options-readfirst-inset options-readfirst-code-inset'
              onClick={(e) => e.stopPropagation()}
            >
              <ReqoreCollapsibleContent
                maxCollapsedHeight={96}
                buttonProps={{ className: 'options-readfirst-viewmore' }}
              >
                {codePreviewRenderer ?
                  codePreviewRenderer({
                    value: optionField.value as string,
                    name: optionName,
                    schema,
                    options,
                    values: availableOptions,
                  })
                : <StyledCodePreview
                    className='options-readfirst-code'
                    $bg={cHover}
                    $border={`${cDivider}88`}
                    $fg={cKey}
                  >
                    {optionField.value as string}
                  </StyledCodePreview>
                }
              </ReqoreCollapsibleContent>
            </StyledRowInset>
          : null}
          {/* Markdown preview: same inset, same collapse, drawn by the host's
              renderer so a description reads identically here and on the page it
              belongs to. Only rendered when a host supplied one — there is no
              built-in fallback, because drawing markdown in a dialect nobody
              chose is the problem this exists to avoid. */}
          {showMarkdownPreview ?
            <StyledRowInset
              className='options-readfirst-inset options-readfirst-markdown-inset'
              onClick={(e) => e.stopPropagation()}
            >
              <ReqoreCollapsibleContent
                maxCollapsedHeight={96}
                buttonProps={{ className: 'options-readfirst-viewmore' }}
              >
                <div className='options-readfirst-markdown'>
                  {markdownRenderer!({ value: optionField.value as string, compact: true })}
                </div>
              </ReqoreCollapsibleContent>
            </StyledRowInset>
          : null}
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
          {!hidden && !fieldDisabled && !clustered && !coveredByLabel ? requiredGroupChip : null}
          {!hidden ? dependsOnChip : null}
          {draftChip}
          {/* Remove-field lives in the expanded editor's "More" (⋮) menu now — no
              standalone delete button on the read row. */}
          {/* Lock slot BEFORE the info slot so the ⓘ keeps the same far-right x on
              every row — a disabled field's lock sits to the ⓘ's left rather than
              pushing it inward. (Not-yet-set optional fields show NO marker now —
              they're just editable in place, like every other row. Dependency-
              locked fields show the "Depends on" chip in the chips area instead.) */}
          {fieldDisabled && !dependencyEntries.length ?
            <StyledActionSlot className='options-readfirst-trailing-slot' $width={18}>
              <span
                title={fieldDisabledReason}
                style={{ display: 'inline-flex', opacity: 0.45 }}
              >
                <ReqoreIcon className='options-readfirst-locked' icon='LockLine' size='14px' />
              </span>
            </StyledActionSlot>
          : null}
          {infoToggle ?
            <StyledActionSlot className='options-readfirst-info-slot' $width={26}>
              {infoToggle}
            </StyledActionSlot>
          : null}
          {inlineOptionActions.map((action, index) =>
            renderInjectedOptionAction(action, index, 'tiny')
          )}
          {injectedOptionActionMenuItems.length ?
            <StyledActionSlot
              className='options-readfirst-actions-slot'
              $width={26}
              // The read row opens the editor when clicked. Without this the tap
              // that opens this menu also expands the row, which unmounts the
              // menu — on touch that made the collapsed actions unreachable,
              // the exact problem the collapse exists to solve.
              onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
            >
              <ReqoreDropdown
                className='options-injected-actions-menu'
                icon='MoreFill'
                flat
                minimal
                fixed
                size='tiny'
                tooltip='Field actions'
                items={injectedOptionActionMenuItems}
              />
            </StyledActionSlot>
          : null}
          {/* The revert affordance lives in the status-dot column (a changed field
              swaps its dot for the revert icon) so it sits at the same fixed x as
              the dot — out of the value's way instead of floating over it. */}
          <StyledActionSlot className='options-readfirst-statusdot-slot' $width={12}>
            {changed && !readOnly && !hidden ?
              <ReqoreButton
                className='options-readfirst-revert'
                size='tiny'
                flat
                minimal
                compact
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
            : dotColor ?
              <StyledStatusDot $color={dotColor} $ring={dotStatus !== 'set'} aria-hidden />
            : null}
          </StyledActionSlot>
        </StyledRowActions>
      </div>
    );

    return row;
  }
);

CompactRow.displayName = 'CompactRow';
