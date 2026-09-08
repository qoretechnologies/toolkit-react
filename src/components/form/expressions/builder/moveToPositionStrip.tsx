import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreInput,
  ReqoreMenuItem,
} from '@qoretechnologies/reqore';
import { memo, useState } from 'react';
import { ordinal } from '../../../../helpers/common';

/** Positions offered as one-click segments before the typed field takes over. */
export const QUICK_POSITIONS = 4;
/** Up to this many operands, a single position dropdown replaces the strip. */
export const PICKER_POSITIONS = 3;

export interface IExpressionMoveToPositionStripProps {
  index: number;
  count: number;
  onMoveTo: (to: number) => void;
}

const positionItems = (index: number, from: number, count: number) =>
  Array.from({ length: count - from }, (_, i) => {
    const to = from + i;

    return {
      label: ordinal(to + 1),
      className: `expression-arg-move-to-${to + 1}`,
      selected: to === index,
      disabled: to === index,
      value: to,
    };
  });

/**
 * The "Move to position" row of the ⋮ menu's "Move Argument" section: an
 * icon and label in the shape of the rows above it. Up to three operands the
 * position sits beside the label as a small dropdown; past that the strip
 * follows under the label — the first four positions as segments, a number
 * field with an arrow, and a "More" list of the rest.
 */
export const ExpressionMoveToPositionStrip = memo(
  ({ index, count, onMoveTo }: IExpressionMoveToPositionStripProps) => {
    const [draft, setDraft] = useState('');
    const target = Number(draft);
    const canGo =
      draft !== '' &&
      Number.isInteger(target) &&
      target >= 1 &&
      target <= count &&
      target - 1 !== index;
    const go = () => canGo && onMoveTo(target - 1);
    const quick = Math.min(QUICK_POSITIONS, count);
    // The label row: a menu item like its siblings, but not a control itself.
    const label = (
      <ReqoreMenuItem
        icon='ListOrdered'
        label='Move to position'
        readOnly
        fluid={false}
        style={{ cursor: 'default' }}
      />
    );

    if (count <= PICKER_POSITIONS) {
      return (
        <ReqoreControlGroup
          size='small'
          gapSize='small'
          verticalAlign='center'
          className='expression-arg-move-to'
        >
          {label}
          <ReqoreDropdown
            compact
            className='expression-arg-move-to-picker'
            label={ordinal(index + 1)}
            caretPosition='right'
            items={positionItems(index, 0, count).map((item) => ({
              ...item,
              onClick: () => onMoveTo(item.value),
            }))}
          />
        </ReqoreControlGroup>
      );
    }

    return (
      <ReqoreControlGroup vertical gapSize='small' className='expression-arg-move-to'>
        {label}
        <ReqoreControlGroup
          size='small'
          gapSize='small'
          fluid={false}
          verticalAlign='center'
          style={{ padding: '0 10px 6px 32px' }}
        >
          <ReqoreControlGroup stack size='small' fluid={false}>
            {Array.from({ length: quick }, (_, to) => (
              <ReqoreButton
                key={to}
                compact
                textAlign='center'
                className={`expression-arg-move-to-${to + 1}`}
                active={to === index}
                disabled={to === index}
                label={String(to + 1)}
                tooltip={to === index ? 'Current position' : `Move to ${ordinal(to + 1)}`}
                onClick={() => onMoveTo(to)}
              />
            ))}
          </ReqoreControlGroup>
          {count > QUICK_POSITIONS && (
            <>
              <ReqoreControlGroup stack size='small' fluid={false}>
                <ReqoreInput
                  type='number'
                  size='small'
                  className='expression-arg-move-to-input'
                  placeholder={`${QUICK_POSITIONS + 1}–${count}`}
                  value={draft}
                  min={1}
                  max={count}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setDraft(event.target.value)
                  }
                  onKeyDown={(event: React.KeyboardEvent) => event.key === 'Enter' && go()}
                  style={{ width: 64 }}
                />
                <ReqoreButton
                  compact
                  className='expression-arg-move-to-go'
                  icon='ArrowRightLine'
                  tooltip='Move to that position'
                  disabled={!canGo}
                  onClick={go}
                />
              </ReqoreControlGroup>
              <ReqoreDropdown
                compact
                className='expression-arg-move-to-more'
                label='More'
                caretPosition='right'
                filterable={count - QUICK_POSITIONS > 8}
                items={positionItems(index, QUICK_POSITIONS, count).map((item) => ({
                  ...item,
                  onClick: () => onMoveTo(item.value),
                }))}
              />
            </>
          )}
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);
