/**
 * VARIANT 1 — "Calm Table"
 *
 * Direction: treat it like a clean data table. One status channel (segmented
 * meter), one mark per row (a status dot), whitespace instead of borders/boxes.
 * Errors are quiet inline text, not full-width red boxes. WHOLE-ROW hover.
 * ONE unified description control (tap to reveal short+long inline). Click a row
 * to edit it inline. Responsive: collapses to stacked label/value on phone.
 */
import { ReqoreIcon, ReqoreP } from '@qoretechnologies/reqore';
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import styled from 'styled-components';
import {
  InlineEdit,
  StatusDot,
  TVariantForm,
  ValueView,
  VariantToolbar,
  useDisclosure,
  useVariantColors,
  useVariantForm,
} from './variantParts';

const Wrap = styled.div<{ $line: string; $hover: string; $muted: string; $faint: string }>`
  display: flex;
  flex-flow: column;
  gap: 22px;
  font-size: 13px;

  .vct-row {
    display: grid;
    grid-template-columns: minmax(180px, 320px) minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  /* WHOLE-row hover (fixes: hover used to only tint the label cell) */
  .vct-row:hover,
  .vct-row:focus-within {
    background: ${({ $hover }) => $hover};
  }
  .vct-label {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .vct-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    opacity: 0.85;
  }
  .vct-desc {
    grid-column: 1 / -1;
    padding: 2px 2px 6px 0;
    color: ${({ $muted }) => $muted};
  }
  .vct-reason {
    font-size: 12px;
    margin-left: 8px;
  }
  .vct-info {
    background: none;
    border: none;
    color: ${({ $faint }) => $faint};
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    border-radius: 6px;
  }
  .vct-info:hover {
    color: ${({ $muted }) => $muted};
  }

  @media (max-width: 620px) {
    .vct-row {
      grid-template-columns: 1fr auto;
      grid-template-areas: 'label actions' 'value value';
      row-gap: 2px;
    }
    .vct-label {
      grid-area: label;
    }
    .vct-value {
      grid-area: value;
    }
    .vct-actions {
      grid-area: actions;
    }
  }
`;

const Meter = ({ form }: { form: TVariantForm }) => {
  const c = useVariantColors();
  const s = form.summary;
  const filtering = form.filter === 'attention';
  return (
    <div style={{ display: 'flex', flexFlow: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: c.muted }}>
        <ReqoreP
          size='small'
          effect={{
            uppercase: true,
            spaced: 1,
            weight: 'bold',
            color: (s.attention ? c.warning : c.success) as never,
          }}
        >
          {s.attention ? 'Draft' : 'Ready'}
        </ReqoreP>
        <span>
          {s.set} of {s.total} set
        </span>
        {s.attention ?
          <button
            type='button'
            onClick={form.toggleAttention}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: c.warning,
              fontSize: 12,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {filtering ? '← show all fields' : `${s.attention} need attention →`}
          </button>
        : <span style={{ color: c.success, marginLeft: 'auto' }}>All clear</span>}
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: c.line }}>
        <div style={{ width: `${(s.set / s.total) * 100}%`, background: c.success }} />
        <div style={{ width: `${(s.attention / s.total) * 100}%`, background: c.warning }} />
      </div>
    </div>
  );
};

export const VariantCalmTable = ({
  options,
  values,
}: {
  options: IQorusFormSchema;
  values: Record<string, IQorusFormField>;
}) => {
  const c = useVariantColors();
  const form = useVariantForm(options, values);
  const disc = useDisclosure();

  return (
    <Wrap $line={c.line} $hover={c.hover} $muted={c.muted} $faint={c.faint}>
      <Meter form={form} />
      <VariantToolbar form={form} />
      {form.visibleGroups.map((g) => (
        <div key={g.name} style={{ display: 'flex', flexFlow: 'column', gap: 2 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 10px 6px',
              borderBottom: `1px solid ${c.line}`,
              marginBottom: 4,
            }}
          >
            <ReqoreP effect={{ weight: 'bold' }}>{g.label}</ReqoreP>
            <span style={{ color: c.faint, fontSize: 12 }}>{g.rows.length}</span>
          </div>
          {g.rows.map((r) => {
            const hasDesc = !!(r.shortDesc || r.longDesc);
            const open = disc.isOpen(r.name);
            const editing = form.editing === r.name;
            return (
              <div
                key={r.name}
                className='vct-row'
                role='button'
                tabIndex={0}
                aria-label={r.label}
                onClick={() => !r.readOnly && form.startEdit(r.name)}
              >
                <span className='vct-label' style={{ color: c.text }}>
                  {r.label}
                  {r.required ?
                    <ReqoreIcon icon='Asterisk' size='9px' style={{ color: c.danger }} />
                  : null}
                </span>
                <span className='vct-value' style={{ minWidth: 0, color: c.muted }}>
                  <ValueView value={r.value} />
                  {r.status === 'invalid' || r.status === 'todo' ?
                    <span
                      className='vct-reason'
                      style={{ color: r.status === 'invalid' ? c.danger : c.warning }}
                    >
                      {r.reason}
                    </span>
                  : null}
                </span>
                <span className='vct-actions'>
                  <StatusDot status={r.status} />
                  {hasDesc ?
                    <button
                      type='button'
                      className='vct-info'
                      aria-label='Toggle description'
                      aria-expanded={open}
                      onClick={(e) => {
                        e.stopPropagation();
                        disc.toggle(r.name);
                      }}
                    >
                      <ReqoreIcon icon={open ? 'InformationFill' : 'InformationLine'} size='14px' />
                    </button>
                  : null}
                </span>
                {hasDesc && open ?
                  <div className='vct-desc'>
                    {r.shortDesc ? <div>{r.shortDesc}</div> : null}
                    {r.longDesc ?
                      <div style={{ opacity: 0.8, marginTop: r.shortDesc ? 4 : 0 }}>
                        {r.longDesc.replace(/[#`*]/g, '')}
                      </div>
                    : null}
                  </div>
                : null}
                {editing ? <InlineEdit row={r} onDone={form.stopEdit} /> : null}
              </div>
            );
          })}
        </div>
      ))}
    </Wrap>
  );
};
