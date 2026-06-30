/**
 * VARIANT 3 — "Focus" (production-leaning)
 *
 * The original Focus structure — three expandable boxes (Needs attention / Set /
 * Optional) — with the engine's real functionality layered in:
 *  • REQUIRED (one-of) GROUPS highlighted as a "pick one" cluster in the box,
 *  • schema GROUPS as thin Minimal-style labels INSIDE the Set / Optional boxes,
 *  • a "Descriptions" toggle (short_desc under every field),
 *  • COMPLEX fields showing their nested value inline with Show-more,
 *  • real inline editing (AutoFormField) on click.
 *
 * Attention box and the rest are EXCLUSIVE: a field needing attention sits in the
 * box until resolved, then drops into Set (or Optional) below.
 */
import { ReqoreIcon, ReqoreP } from '@qoretechnologies/reqore';
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import React from 'react';
import styled from 'styled-components';
import { IVariantGroup, IVariantRow, TVariantStatus } from './variantModel';
import {
  ComplexPreview,
  InlineEdit,
  STATUS_COLOR,
  StatusDot,
  TVariantForm,
  ValueView,
  VariantToolbar,
  useVariantColors,
  useVariantForm,
} from './variantParts';

const Wrap = styled.div<{ $hover: string; $faint: string }>`
  display: flex;
  flex-flow: column;
  gap: 18px;
  font-size: 13px;

  .vf-row {
    display: grid;
    grid-template-columns: minmax(190px, 320px) minmax(0, 1fr) auto;
    column-gap: 16px;
    row-gap: 2px;
    align-items: center;
    /* Single-line rows: centre the content within the min-height. */
    align-content: center;
    min-height: 38px;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  /* Rows with a description / preview / editor below: pin the name+value to the
     top instead of centring the whole block. */
  .vf-row.vf-tall {
    align-content: start;
  }
  .vf-row:hover,
  .vf-row[aria-expanded='true'] {
    background: ${({ $hover }) => $hover};
  }
  .vf-section {
    border-radius: 12px;
    padding: 6px;
  }
  .vf-sechead {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
  }
  .vf-grouplabel {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 10px 0 2px 12px;
  }
  .vf-cluster {
    border-radius: 10px;
    padding: 4px 4px 6px;
    margin: 2px 0;
  }
  .vf-desc {
    grid-column: 1 / -1;
    padding: 0 0 2px;
    font-size: 12px;
    line-height: 1.45;
  }
  .vf-preview {
    grid-column: 2 / -1;
    padding: 2px 0 4px;
  }
  @media (max-width: 640px) {
    .vf-row {
      grid-template-columns: 1fr auto;
      grid-template-areas: 'label dot' 'value value';
      row-gap: 2px;
    }
    .vf-label {
      grid-area: label;
    }
    .vf-value {
      grid-area: value;
    }
    .vf-dot {
      grid-area: dot;
    }
    .vf-preview {
      grid-column: 1 / -1;
    }
  }
`;

const Row = ({ r, form, showDesc }: { r: IVariantRow; form: TVariantForm; showDesc: boolean }) => {
  const c = useVariantColors();
  const editing = form.editing === r.name;
  const isHash = r.value.kind === 'hash';
  // A row is "tall" (has something below the name/value line) when editing, when
  // it's a complex preview, or when descriptions are shown for it.
  const tall = editing || isHash || (showDesc && !!r.shortDesc);
  return (
    <div
      className={tall ? 'vf-row vf-tall' : 'vf-row'}
      role='button'
      tabIndex={0}
      aria-expanded={editing}
      onClick={() => !r.readOnly && form.startEdit(r.name)}
    >
      <span
        className='vf-label'
        style={{ fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
      >
        {r.label}
        {r.required ?
          <ReqoreIcon icon='Asterisk' size='9px' style={{ color: c.danger }} />
        : null}
      </span>
      <span className='vf-value' style={{ color: c.muted, minWidth: 0 }}>
        <ValueView value={r.value} />
        {r.reason && r.status !== 'set' ?
          <span style={{ color: STATUS_COLOR(r.status, c), fontSize: 12, marginLeft: 8 }}>
            {r.reason}
          </span>
        : null}
      </span>
      <span className='vf-dot' style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
        <StatusDot status={r.status} />
      </span>
      {showDesc && r.shortDesc && !editing ?
        <div className='vf-desc' style={{ color: c.faint }}>
          {r.shortDesc}
        </div>
      : null}
      {isHash && !editing ?
        <div className='vf-preview'>
          <ComplexPreview value={r.field?.value} onOpen={() => !r.readOnly && form.startEdit(r.name)} />
        </div>
      : null}
      {editing ?
        <>
          {r.shortDesc ? <div className='vf-desc' style={{ color: c.faint }}>{r.shortDesc}</div> : null}
          <InlineEdit row={r} onDone={form.stopEdit} />
        </>
      : null}
    </div>
  );
};

/** A one-of required group, highlighted: "pick one of these". */
const RequiredCluster = ({
  rows,
  form,
  showDesc,
}: {
  rows: IVariantRow[];
  form: TVariantForm;
  showDesc: boolean;
}) => {
  const c = useVariantColors();
  const tint = c.warning;
  return (
    <div className='vf-cluster' style={{ background: `${tint}10`, border: `1px solid ${tint}33` }}>
      {/* Matches the thin group-label style (.vf-grouplabel) for compactness. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 2px 12px' }}>
        <ReqoreIcon icon='LinkM' size='11px' style={{ color: tint }} />
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: tint }}>
          One of the below is required
        </span>
      </div>
      {rows.map((r) => <Row key={r.name} r={r} form={form} showDesc={showDesc} />)}
    </div>
  );
};

const Section = ({
  title,
  intent,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  intent: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  if (!count) return null;
  return (
    <div className='vf-section' style={{ background: `${intent}0e`, border: `1px solid ${intent}22` }}>
      <div className='vf-sechead' onClick={() => setOpen((o) => !o)}>
        <ReqoreIcon icon={open ? 'ArrowDownSLine' : 'ArrowRightSLine'} size='15px' />
        <ReqoreP effect={{ weight: 'bold' }}>{title}</ReqoreP>
        <span
          style={{
            background: `${intent}22`,
            color: intent,
            borderRadius: 20,
            padding: '1px 9px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      </div>
      {open ? <div>{children}</div> : null}
    </div>
  );
};

/** Rows of a given status, grouped by schema group with thin Minimal-style
 *  labels. Used inside the Set and Optional boxes. */
const GroupedRows = ({
  groups,
  status,
  skip,
  form,
  showDesc,
}: {
  groups: IVariantGroup[];
  status: TVariantStatus;
  skip: Set<string>;
  form: TVariantForm;
  showDesc: boolean;
}) => {
  const c = useVariantColors();
  const sections = groups
    .map((g) => ({ g, rows: g.rows.filter((r) => r.status === status && !skip.has(r.name)) }))
    .filter((s) => s.rows.length);
  return (
    <>
      {sections.map(({ g, rows }) => (
        <div key={g.name}>
          {/* only label when there's more than one group's worth, else it's noise */}
          {sections.length > 1 ?
            <div className='vf-grouplabel' style={{ color: c.faint }}>
              {g.label}
            </div>
          : null}
          {rows.map((r) => <Row key={r.name} r={r} form={form} showDesc={showDesc} />)}
        </div>
      ))}
    </>
  );
};

export const VariantFocus = ({
  options,
  values,
  config,
}: {
  options: IQorusFormSchema;
  values: Record<string, IQorusFormField>;
  config?: any;
}) => {
  const c = useVariantColors();
  const form = useVariantForm(options, values, config);
  const s = form.summary;
  const showDesc = form.showDescriptions;

  const allRows = form.visibleGroups.flatMap((g) => g.rows);
  const unmetGroups = Object.values(form.requiredGroups).filter((g) => !g.satisfied);
  const unmetMembers = new Set<string>();
  unmetGroups.forEach((g) => g.members.forEach((m) => unmetMembers.add(m)));

  // Attention = invalid + individually-required-todo (NOT one-of members, which
  // show as their cluster) + the unmet one-of clusters.
  const attentionRows = allRows.filter(
    (r) => (r.status === 'invalid' || r.status === 'todo') && !unmetMembers.has(r.name)
  );
  const attentionCount = attentionRows.length + unmetGroups.length;
  const skip = new Set<string>(attentionRows.map((r) => r.name));
  unmetMembers.forEach((n) => skip.add(n));

  const setCount = allRows.filter((r) => r.status === 'set' && !skip.has(r.name)).length;
  const optionalCount = allRows.filter((r) => r.status === 'unset' && !skip.has(r.name)).length;

  // Group the attention items by schema group (placing each one-of cluster under
  // its members' group) so the attention box reads like the Set / Optional boxes.
  const clusterGroupName = (members: string[]) =>
    form.visibleGroups.find((g) => g.rows.some((r) => r.name === members[0]))?.name;
  const attnGroups = form.visibleGroups
    .map((g) => ({
      g,
      rows: g.rows.filter(
        (r) => (r.status === 'invalid' || r.status === 'todo') && !unmetMembers.has(r.name)
      ),
      clusters: unmetGroups.filter((rg) => clusterGroupName(rg.members) === g.name),
    }))
    .filter((x) => x.rows.length || x.clusters.length);

  return (
    <Wrap $hover={c.hover} $faint={c.faint}>
      {/* Cards-style header */}
      <div style={{ display: 'flex', flexFlow: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <ReqoreP size='big' effect={{ weight: 'bold' }}>
            {s.pct}% complete
          </ReqoreP>
          <span style={{ color: c.muted, fontSize: 12 }}>
            {s.set}/{s.total} set
          </span>
          {s.attention ?
            <button
              type='button'
              onClick={form.toggleAttention}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: c.warning,
                fontSize: 12,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {form.filter === 'attention' ? '← show all' : `${s.attention} need attention →`}
            </button>
          : null}
        </div>
        <div style={{ height: 4, borderRadius: 2, background: c.line, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${(s.set / s.total) * 100}%`, background: c.success }} />
          <div style={{ width: `${(s.attention / s.total) * 100}%`, background: c.warning }} />
        </div>
      </div>
      <VariantToolbar form={form} />

      {/* The signature: Needs attention / Set / Optional expandable boxes —
          attention items grouped by schema group, like the other boxes. */}
      <Section title='Needs attention' intent={c.warning} count={attentionCount}>
        {attnGroups.map(({ g, rows, clusters }) => (
          <div key={g.name}>
            {attnGroups.length > 1 ?
              <div className='vf-grouplabel' style={{ color: c.faint }}>
                {g.label}
              </div>
            : null}
            {clusters.map((cl) => (
              <RequiredCluster
                key={cl.key}
                rows={allRows.filter((r) => cl.members.includes(r.name))}
                form={form}
                showDesc={showDesc}
              />
            ))}
            {rows.map((r) => <Row key={r.name} r={r} form={form} showDesc={showDesc} />)}
          </div>
        ))}
      </Section>

      <Section title='Set' intent={c.success} count={setCount}>
        <GroupedRows groups={form.visibleGroups} status='set' skip={skip} form={form} showDesc={showDesc} />
      </Section>

      <Section title='Optional — not set' intent={c.muted} count={optionalCount} defaultOpen={false}>
        <GroupedRows groups={form.visibleGroups} status='unset' skip={skip} form={form} showDesc={showDesc} />
      </Section>
    </Wrap>
  );
};
