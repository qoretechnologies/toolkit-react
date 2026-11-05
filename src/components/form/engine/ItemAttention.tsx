import { ReqoreSpan } from '@qoretechnologies/reqore';
import { TReqoreEffectColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import type { IFormAttention } from './FormEngine';
import { getCalmAttentionColours } from './formAppearance';

/**
 * What a nested sub-form still needs, said by the item it sits in.
 *
 * In the calm look a sub-form nested in a row draws no readiness line of its
 * own, so its item's header says it instead, in the readiness line's words and
 * colours ("1 need attention" in amber, "2 to fill in" in the quiet colour) —
 * and says nothing at all when nothing is left, so a collapsed item still tells
 * you it needs you and a finished one is quiet.
 */
export const ItemAttention = ({ count = 0, faults = 0 }: Partial<IFormAttention>) => {
  const theme = useReqoreTheme();

  if (!count) {
    return null;
  }

  const colours = getCalmAttentionColours(theme);

  return (
    <span
      className='array-auto-item-attention'
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
    >
      {faults ?
        <ReqoreSpan size='small' effect={{ color: colours.fault as TReqoreEffectColor }}>
          {faults} need attention
        </ReqoreSpan>
      : null}
      {count > faults ?
        <ReqoreSpan size='small' effect={{ color: colours.pending as TReqoreEffectColor }}>
          {faults ? '· ' : ''}
          {count - faults} to fill in
        </ReqoreSpan>
      : null}
    </span>
  );
};
