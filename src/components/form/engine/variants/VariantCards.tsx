/**
 * VARIANT 2 — "Cards / Stack"
 *
 * Direction: breathing room over density. Each field is a subtle card with a
 * generous tap target (phone-friendly). Status is shown with a single left
 * accent — but ONLY for genuinely invalid (touched) fields; to-dos get a calm
 * amber label dot, unset fields stay neutral. The description control sits on
 * the LEFT under the label (where the text appears). Click a card to edit inline.
 */
import { ReqoreIcon, ReqoreP } from '@qoretechnologies/reqore';
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import styled from 'styled-components';
import {
  InlineEdit,
  STATUS_COLOR,
  ValueView,
  VariantToolbar,
  useDisclosure,
  useVariantColors,
  useVariantForm,
} from './variantParts';

const Wrap = styled.div<{ $surface: string; $line: string; $hover: string }>`
  display: flex;
  flex-flow: column;
  gap: 26px;
  font-size: 13px;

  .vc-card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(200px, 0.7fr) minmax(0, 1.3fr);
    gap: 18px;
    padding: 14px 16px;
    border-radius: 10px;
    background: ${({ $surface }) => $surface};
    cursor: pointer;
    transition: background 0.12s ease;
    overflow: hidden;
  }
  .vc-card:hover,
  .vc-card:focus-within {
    background: ${({ $hover }) => $hover};
  }
  .vc-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
  }
  .vc-name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .vc-descbtn {
    background: none;
    border: none;
    padding: 0;
    margin-top: 6px;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
  }
  .vc-value {
    align-self: center;
    min-width: 0;
  }

  @media (max-width: 620px) {
    .vc-card {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 14px;
    }
  }
`;

export const VariantCards = ({
  options,
  values,
}: {
  options: IQorusFormSchema;
  values: Record<string, IQorusFormField>;
}) => {
  const c = useVariantColors();
  const form = useVariantForm(options, values);
  const s = form.summary;
  const disc = useDisclosure();

  return (
    <Wrap $surface={c.surface} $line={c.line} $hover={c.hover}>
      <div style={{ display: 'flex', flexFlow: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
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
        <div style={{ height: 4, borderRadius: 2, background: c.line, overflow: 'hidden' }}>
          <div style={{ width: `${s.pct}%`, height: '100%', background: c.success }} />
        </div>
      </div>
      <VariantToolbar form={form} />

      {form.visibleGroups.map((g) => (
        <div key={g.name} style={{ display: 'flex', flexFlow: 'column', gap: 10 }}>
          <ReqoreP effect={{ weight: 'bold', uppercase: true, spaced: 1 }} size='small'>
            {g.label}
          </ReqoreP>
          <div style={{ display: 'flex', flexFlow: 'column', gap: 8 }}>
            {g.rows.map((r) => {
              const hasDesc = !!(r.shortDesc || r.longDesc);
              const open = disc.isOpen(r.name);
              const editing = form.editing === r.name;
              return (
                <div
                  key={r.name}
                  className='vc-card'
                  role='button'
                  tabIndex={0}
                  onClick={() => !r.readOnly && form.startEdit(r.name)}
                >
                  {r.status === 'invalid' ?
                    <span className='vc-accent' style={{ background: c.danger }} />
                  : null}
                  <div>
                    <span className='vc-name' style={{ color: c.text }}>
                      {r.status === 'todo' || r.status === 'invalid' ?
                        <span
                          aria-hidden
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: STATUS_COLOR(r.status, c),
                          }}
                        />
                      : null}
                      {r.label}
                      {r.required ?
                        <ReqoreIcon icon='Asterisk' size='9px' style={{ color: c.danger }} />
                      : null}
                    </span>
                    {hasDesc ?
                      <button
                        type='button'
                        className='vc-descbtn'
                        style={{ color: c.faint }}
                        aria-expanded={open}
                        onClick={(e) => {
                          e.stopPropagation();
                          disc.toggle(r.name);
                        }}
                      >
                        <ReqoreIcon icon={open ? 'ArrowUpSLine' : 'QuestionLine'} size='12px' />
                        {open ? 'Hide info' : 'Info'}
                      </button>
                    : null}
                    {open ?
                      <div style={{ color: c.muted, marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                        {r.shortDesc ? <div>{r.shortDesc}</div> : null}
                        {r.longDesc ?
                          <div style={{ opacity: 0.85, marginTop: r.shortDesc ? 4 : 0 }}>
                            {r.longDesc.replace(/[#`*]/g, '')}
                          </div>
                        : null}
                      </div>
                    : null}
                  </div>
                  <div className='vc-value' style={{ color: c.muted }}>
                    <ValueView value={r.value} />
                    {r.status === 'invalid' ?
                      <div style={{ color: c.danger, fontSize: 12, marginTop: 4 }}>{r.reason}</div>
                    : r.status === 'todo' ?
                      <div style={{ color: c.warning, fontSize: 12, marginTop: 4 }}>{r.reason}</div>
                    : null}
                  </div>
                  {editing ? <InlineEdit row={r} onDone={form.stopEdit} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Wrap>
  );
};
