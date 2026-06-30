/**
 * Shared rendering parts for the FormEngine compact VARIANTS playground.
 * Value rendering is shared so every variant shows identical data; the `tone`
 * prop lets a variant choose a calm (desaturated) or vivid chip treatment.
 */
import {
  ReqoreButton,
  ReqoreCollapsibleContent,
  ReqoreControlGroup,
  ReqoreIcon,
  ReqoreInput,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import React from 'react';
import { AutoFormField } from '../../fields/auto/AutoFormField';
import { StructuredDataView } from '../_structuredData/StructuredDataView';
import {
  buildVariantGroups,
  summarize,
  IVariantGroup,
  IVariantRow,
  IVariantValue,
  TVariantStatus,
} from './variantModel';

export function useVariantColors() {
  const theme = useReqoreTheme();
  const intents = (theme.intents || {}) as Record<string, string>;
  return {
    main: theme.main as string,
    text: (theme.text?.color as string) || '#e8e8e8',
    muted: `${(theme.text?.color as string) || '#e8e8e8'}99`,
    faint: `${(theme.text?.color as string) || '#e8e8e8'}55`,
    line: `${(theme.text?.color as string) || '#ffffff'}14`,
    hover: `${(theme.text?.color as string) || '#ffffff'}0c`,
    surface: `${(theme.text?.color as string) || '#ffffff'}08`,
    danger: intents.danger || '#a82a2a',
    warning: intents.warning || '#d17c29',
    success: intents.success || '#4a7110',
    info: intents.info || '#3b7bbf',
    custom1: intents.custom1 || '#762f7e',
  };
}

export const STATUS_COLOR = (
  status: TVariantStatus,
  c: ReturnType<typeof useVariantColors>
) =>
  status === 'invalid' ? c.danger
  : status === 'todo' ? c.warning
  : status === 'set' ? c.success
  : c.faint;

/** A single status mark — one dot, color = severity. Replaces stripe+box+icon. */
export const StatusDot = ({
  status,
  size = 7,
}: {
  status: TVariantStatus;
  size?: number;
}) => {
  const c = useVariantColors();
  if (status === 'unset') return null;
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: '0 0 auto',
        background: STATUS_COLOR(status, c),
        boxShadow: status !== 'set' ? `0 0 0 3px ${STATUS_COLOR(status, c)}22` : undefined,
      }}
    />
  );
};

/** The value summary. `tone='calm'` desaturates template/richtext chips. */
export const ValueView = ({
  value,
  tone = 'calm',
}: {
  value: IVariantValue;
  tone?: 'calm' | 'vivid';
}) => {
  const c = useVariantColors();
  const ellipsis: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  };

  switch (value.kind) {
    case 'empty':
      // A quiet dash reads as "no value" without shouting "Not set" on every row.
      return <span style={{ color: c.faint }}>—</span>;

    case 'color':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              flex: '0 0 auto',
              background: value.extra,
              border: `1px solid ${c.line}`,
            }}
          />
          <span style={ellipsis}>{value.display}</span>
        </span>
      );

    case 'file':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <ReqoreIcon icon='FileLine' size='13px' style={{ color: c.muted, flexShrink: 0 }} />
          <span style={ellipsis}>{value.display}</span>
          {value.extra ?
            <span style={{ color: c.faint, fontSize: 11, flexShrink: 0 }}>{value.extra}</span>
          : null}
        </span>
      );

    case 'bool':
      return <span>{value.display}</span>;

    case 'hash':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.muted }}>
          <ReqoreIcon icon='BracesLine' size='12px' style={{ color: c.faint }} />
          <span>{value.display}</span>
        </span>
      );

    case 'template':
      return tone === 'vivid' ?
          <ReqoreTag size='small' intent='info' icon='ExchangeDollarLine' label={value.display} />
        : <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '1px 7px',
              borderRadius: 4,
              background: c.surface,
              border: `1px solid ${c.line}`,
              color: c.text,
              fontSize: 12,
              maxWidth: '100%',
              ...ellipsis,
            }}
          >
            <ReqoreIcon icon='ExchangeDollarLine' size='11px' style={{ color: c.custom1, flexShrink: 0 }} />
            <span style={ellipsis}>{value.display}</span>
          </span>;

    case 'richtext':
      return <span style={ellipsis}>{value.display}</span>;

    default:
      return <span style={ellipsis}>{value.display}</span>;
  }
};

/** A reusable description disclosure used by every variant (tap-friendly).
 *  Unifies short_desc (inline) + long desc into ONE control. */
export const useDisclosure = () => {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  return {
    isOpen: (id: string) => !!open[id],
    toggle: (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] })),
  };
};

// ---------------------------------------------------------------------------
// Shared form state: filter (all / needs-attention), add-field, inline editing.
// Each variant calls useVariantForm and renders <VariantToolbar> + <InlineEdit>.
// ---------------------------------------------------------------------------
export type TVariantFilter = 'all' | 'attention';

export function useVariantForm(options: any, values: any, config?: any) {
  const [filter, setFilter] = React.useState<TVariantFilter>('all');
  const [query, setQuery] = React.useState('');
  const [showDescriptions, setShowDescriptions] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);

  const { groups, requiredGroups } = React.useMemo(
    () => buildVariantGroups(options, values, config),
    [options, values, config]
  );
  const summary = React.useMemo(() => summarize(groups), [groups]);

  // Filtered view: text query (label match) + 'attention' (todo/invalid only).
  const visibleGroups: IVariantGroup[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (r) =>
            (filter === 'all' || r.status === 'todo' || r.status === 'invalid') &&
            (!q || r.label.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.rows.length);
  }, [groups, filter, query]);

  return {
    groups,
    visibleGroups,
    requiredGroups,
    summary,
    filter,
    setFilter,
    toggleAttention: () => setFilter((f) => (f === 'attention' ? 'all' : 'attention')),
    query,
    setQuery,
    showDescriptions,
    toggleDescriptions: () => setShowDescriptions((v) => !v),
    editing,
    startEdit: (name: string) => setEditing((cur) => (cur === name ? null : name)),
    stopEdit: () => setEditing(null),
  };
}

export type TVariantForm = ReturnType<typeof useVariantForm>;

/** Compact toolbar: just a prominent filter field. The "needs attention" control
 *  lives in each variant's header (the count line is the link); all optional
 *  fields render inline in the Optional group, so there's no "add field" step. */
export const VariantToolbar = ({ form }: { form: TVariantForm }) => {
  const c = useVariantColors();
  const { summary, query, setQuery, showDescriptions, toggleDescriptions } = form;
  return (
    <ReqoreControlGroup verticalAlign='center' fluid>
      <ReqoreInput
        placeholder='Filter fields…'
        icon='Search2Line'
        iconColor='muted'
        pill
        fluid
        value={query}
        onChange={(e: any) => setQuery(e.currentTarget.value)}
        onClearClick={() => setQuery('')}
      />
      {/* Show short descriptions under every field — like the compact engine's
          "Show all descriptions" toggle. Icon-only; info-intent when active. */}
      <ReqoreButton
        fixed
        flat
        minimal
        intent={showDescriptions ? 'info' : undefined}
        active={showDescriptions}
        icon={showDescriptions ? 'InformationFill' : 'InformationLine'}
        tooltip={showDescriptions ? 'Hide field descriptions' : 'Show field descriptions'}
        onClick={toggleDescriptions}
      />
      <span style={{ color: c.faint, fontSize: 12, paddingLeft: 4, whiteSpace: 'nowrap' }}>
        {summary.set}/{summary.total} set
      </span>
    </ReqoreControlGroup>
  );
};

/** Complex value preview — the SAME nested tree + "Show more" fade the compact
 *  engine uses, so hash/list fields show their contents immediately. */
export const ComplexPreview = ({ value, onOpen }: { value: unknown; onOpen?: () => void }) => (
  <ReqoreCollapsibleContent maxCollapsedHeight={120}>
    <div onClick={(e) => e.stopPropagation()}>
      <StructuredDataView
        value={value}
        collapsibleRoot={false}
        defaultExpandDepth={2}
        onItemClick={onOpen}
      />
    </div>
  </ReqoreCollapsibleContent>
);

/** Inline editor: mounts the REAL field editor (AutoFormField) for the row's
 *  schema + value, so clicking a field edits it for real (string, number, bool,
 *  colour, file, richtext, list, date, …). Local state only — the prototype
 *  doesn't persist; in the engine this flows through handleValueChange. */
export const InlineEdit = ({ row, onDone }: { row: IVariantRow; onDone: () => void }) => {
  const [value, setValue] = React.useState(row.field?.value);
  return (
    <div
      style={{ gridColumn: '1 / -1', display: 'flex', flexFlow: 'column', gap: 8, padding: '10px 0 12px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <AutoFormField
        {...(row.schema || {})}
        name={row.name}
        value={value}
        default_value={row.schema?.default_value}
        onChange={(_n: string, v: any) => setValue(v)}
        fluid
        size='small'
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ReqoreButton size='small' intent='success' icon='CheckLine' fixed onClick={onDone}>
          Done
        </ReqoreButton>
      </div>
    </div>
  );
};
