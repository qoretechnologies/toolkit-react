/**
 * VARIANT 4 — "Minimal" (Notion / Linear inspired)
 *
 * Direction: the lightest possible treatment. No surfaces, no boxes, no group
 * panels — just a quiet `label · value` list with a hairline status tick on the
 * left edge. TAP a row to reveal its description and edit it inline — NO hover
 * dependency, so it behaves identically on phone. Densest of the four.
 */
import { ReqoreIcon, ReqoreP } from '@qoretechnologies/reqore';
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import React from 'react';
import styled from 'styled-components';
import {
  InlineEdit,
  STATUS_COLOR,
  ValueView,
  VariantToolbar,
  useVariantColors,
  useVariantForm,
} from './variantParts';

const Wrap = styled.div<{ $hover: string; $line: string; $faint: string }>`
  display: flex;
  flex-flow: column;
  gap: 4px;
  font-size: 13px;

  .vm-group {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 16px 0 6px 14px;
  }
  .vm-row {
    display: grid;
    grid-template-columns: minmax(180px, 320px) minmax(0, 1fr);
    gap: 14px;
    align-items: baseline;
    padding: 7px 12px 7px 14px;
    border-left: 2px solid transparent;
    cursor: pointer;
    border-radius: 0 6px 6px 0;
  }
  .vm-row[aria-expanded='true'] {
    background: ${({ $hover }) => $hover};
  }
  @media (hover: hover) {
    .vm-row:hover {
      background: ${({ $hover }) => $hover};
    }
  }
  .vm-label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .vm-detail {
    grid-column: 1 / -1;
    color: ${({ $faint }) => $faint};
    padding: 4px 0 2px;
    font-size: 12px;
    line-height: 1.5;
  }
  @media (max-width: 620px) {
    .vm-row {
      grid-template-columns: 1fr;
      gap: 2px;
    }
  }
`;

export const VariantMinimal = ({
  options,
  values,
}: {
  options: IQorusFormSchema;
  values: Record<string, IQorusFormField>;
}) => {
  const c = useVariantColors();
  const form = useVariantForm(options, values);
  const s = form.summary;

  return (
    <Wrap $hover={c.hover} $line={c.line} $faint={c.faint}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px 10px',
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.attention ? c.warning : c.success }} />
        <ReqoreP effect={{ weight: 'bold' }}>{s.pct}%</ReqoreP>
        <span style={{ color: c.muted, fontSize: 12 }}>{s.set}/{s.total} set</span>
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
            {form.filter === 'attention' ? '← all' : `${s.attention} to resolve →`}
          </button>
        : null}
      </div>
      <VariantToolbar form={form} />

      {form.visibleGroups.map((g) => (
        <React.Fragment key={g.name}>
          <div className='vm-group' style={{ color: c.faint }}>
            {g.label}
          </div>
          {g.rows.map((r) => {
            const editing = form.editing === r.name;
            const hasDetail = !!(r.shortDesc || r.longDesc);
            return (
              <div
                key={r.name}
                className='vm-row'
                role='button'
                tabIndex={0}
                aria-expanded={editing}
                style={{ borderLeftColor: r.status === 'set' || r.status === 'unset' ? 'transparent' : STATUS_COLOR(r.status, c) }}
                onClick={() => !r.readOnly && form.startEdit(r.name)}
              >
                <span className='vm-label' style={{ color: c.text, fontWeight: 500 }}>
                  {r.label}
                  {r.required ?
                    <ReqoreIcon icon='Asterisk' size='8px' style={{ color: c.danger }} />
                  : null}
                </span>
                <span style={{ color: c.muted, minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                  <ValueView value={r.value} />
                  {r.status === 'invalid' || r.status === 'todo' ?
                    <span style={{ color: STATUS_COLOR(r.status, c), fontSize: 12 }}>· {r.reason}</span>
                  : null}
                </span>
                {editing ?
                  <>
                    {hasDetail ?
                      <div className='vm-detail'>
                        {r.shortDesc ? <div>{r.shortDesc}</div> : null}
                        {r.longDesc ?
                          <div style={{ marginTop: r.shortDesc ? 4 : 0 }}>
                            {r.longDesc.replace(/[#`*]/g, '')}
                          </div>
                        : null}
                      </div>
                    : null}
                    <InlineEdit row={r} onDone={form.stopEdit} />
                  </>
                : null}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </Wrap>
  );
};
