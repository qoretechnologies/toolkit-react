import { ReqoreButton, useReqoreProperty, useReqoreTheme } from '@qoretechnologies/reqore';
import { memo } from 'react';

export interface IExpressionBuilderAddArgumentSlotProps {
  /**
   * What the catalogue calls the operand ("Value" for `concat` and `+`), so
   * the slot reads "Add value" rather than a generic verb.
   */
  argumentName?: string;
  /** The expression is incomplete, so another operand would only add to the problem. */
  disabled?: boolean;
  /** An operand is being dragged over the slot. */
  dragOver?: boolean;
  /** Accept a dragged operand: dropping here moves it to the end. */
  droppable?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDragOver?: () => void;
  onDrop?: () => void;
}

/**
 * The "add another operand" control of a varargs expression, rendered as the
 * operand it is about to become: a dashed, field-height slot after the last
 * operand. The button is where the new value will appear, so it needs no
 * tooltip to explain itself, it wraps with the operands (on a phone it is
 * simply the last row), and it costs no height while the row has room.
 *
 * On a phone the operands stack one per row, and the slot becomes a row of
 * its own: full width, label centred, so it reads as the next row rather
 * than a stray button under the last one.
 *
 * It keeps the `expression-add-arg` class the header icon carried before it,
 * so consumers' stories and tests that click it keep working.
 */
export const ExpressionBuilderAddArgumentSlot = memo(
  ({
    argumentName,
    disabled,
    dragOver,
    droppable,
    onClick,
    onDragOver,
    onDrop,
  }: IExpressionBuilderAddArgumentSlotProps) => {
    const theme = useReqoreTheme();
    const isMobile = useReqoreProperty('isMobile');
    const name = (argumentName || 'argument').toLowerCase();

    return (
      <ReqoreButton
        compact
        fixed={!isMobile}
        fluid={isMobile}
        textAlign={isMobile ? 'center' : undefined}
        iconsAlign={isMobile ? 'center' : undefined}
        minimal
        size='small'
        className='expression-add-arg'
        icon='AddLine'
        label={`Add ${name}`}
        tooltip={
          disabled ? 'Fill in the current values first' : `Add another ${name} after the last one`
        }
        disabled={disabled}
        onClick={onClick}
        // Drag events stop here for the same reason they stop on an operand:
        // a nested builder's slot must not light up the parent's.
        {...(droppable
          ? {
              onDragOver: (event: React.DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
                onDragOver?.();
              },
              onDrop: (event: React.DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
                onDrop?.();
              },
            }
          : {})}
        style={{
          // Sits on the field row: the operands carry a label above their
          // field, and the slot has no label to carry. The operand group
          // spaces its wrapped lines with a bottom margin on every child;
          // with that margin the slot already fills the line and cannot
          // reach its end, and as the last item it has nothing to space.
          alignSelf: isMobile ? 'stretch' : 'flex-end',
          marginBottom: 0,
          borderStyle: 'dashed',
          ...(dragOver
            ? { outline: `1px dashed ${theme.intents.info}`, outlineOffset: 4, borderRadius: 4 }
            : {}),
        }}
      />
    );
  }
);
