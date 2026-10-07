import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqorePanel,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { memo } from 'react';
import styled from 'styled-components';
import { ordinal } from '../../../../helpers/common';
import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
  TExpressionReorderSurface,
} from '../types';
import { ExpressionBuilderArgumentLabel } from './argumentLabel';

/**
 * An operand's field row: the field (a value or a field reference, its clear button, its ⋮ menu) shrinks
 * with a narrow row. A control group that is not fluid does not shrink, and a field is several of them
 * nested, so in a narrow column - not only on a phone, where operands are fluid - the field kept its
 * natural width and its ⋮ was cut off at the expression's edge or hung past it. The value gives way, down
 * to its own least width, and the controls beside it stay in the row.
 *
 * The row's own control group, styled - not a wrapper inside it: a control group hands its size to its
 * children, and a wrapper between them drew the field at the normal size instead of the row's small one.
 */
const StyledOperandFieldRow = styled(ReqoreControlGroup)`
  min-width: 0;
  max-width: 100%;

  .reqore-control-group {
    flex-shrink: 1;
    min-width: 0;
    max-width: 100%;
  }
`;

export interface IExpressionBuilderArgumentWrapperProps {
  children: React.ReactNode;
  schema?: IExpressionSchemaArg;
  arg?: IExpression;
  onTypeChange?: (type: string | 'context') => void;
  onRemoveArgClick?: () => void;
  hasMultipleArgs?: boolean;
  expressions: IExpressionSchema[];
  label?: string;
  readOnly?: boolean;
  /** Span the operand row — a phone shows one operand per row, full width. */
  fluid?: boolean;
  /** Reorder surfaces to render; undefined = this operand cannot be moved. */
  reorder?: TExpressionReorderSurface[];
  argIndex?: number;
  argCount?: number;
  /** Another operand is being dragged over this one. */
  dragOver?: boolean;
  onMoveArg?: (from: number, to: number) => void;
  onArgDragStart?: (index: number) => void;
  onArgDragOver?: (index: number) => void;
  onArgDrop?: (index: number) => void;
  onArgDragEnd?: () => void;
}

export const ExpressionBuilderArgumentWrapper = memo(
  ({
    children,
    schema,
    arg,
    onRemoveArgClick,
    hasMultipleArgs,
    expressions,
    label,
    readOnly,
    fluid,
    reorder,
    argIndex = 0,
    argCount = 0,
    dragOver,
    onMoveArg,
    onArgDragStart,
    onArgDragOver,
    onArgDrop,
    onArgDragEnd,
  }: IExpressionBuilderArgumentWrapperProps) => {
    const theme = useReqoreTheme();
    const type = arg?.type || schema?.ui_type || 'context';
    const draggable = !!reorder?.includes('dragHandle');

    // Only the grip is `draggable`, so a drag never starts from inside the
    // field and text selection there is untouched; the drag image is the
    // whole operand. Drag events stop here: an operand of a nested builder
    // must not light up (or drop into) the parent builder's slots.
    const dragProps: React.HTMLAttributes<HTMLDivElement> = draggable
      ? {
          onDragOver: (event) => {
            event.preventDefault();
            event.stopPropagation();
            onArgDragOver?.(argIndex);
          },
          onDrop: (event) => {
            event.preventDefault();
            event.stopPropagation();
            onArgDrop?.(argIndex);
          },
          onDragEnd: (event) => {
            event.stopPropagation();
            onArgDragEnd?.();
          },
          style: dragOver
            ? { outline: `1px dashed ${theme.intents.info}`, outlineOffset: 4, borderRadius: 4 }
            : undefined,
        }
      : {};

    // A literal fragment, so the control group still clones its size onto
    // the grip and the dropdown.
    const renderReorderControls = () => (
      <>
        {draggable && (
          <ReqoreButton
            compact
            fixed
            minimal
            flat
            transparent
            className='expression-arg-drag-handle'
            icon='Draggable'
            tooltip='Drag to reorder'
            // As tight as the field's `⋮` button next to it.
            style={{ cursor: 'grab', paddingLeft: 0, paddingRight: 0, minWidth: '10px' }}
            draggable
            onDragStart={(event) => {
              event.stopPropagation();
              // Synthetic drag events (play tests) carry no dataTransfer.
              const operand = event.currentTarget.closest('.expression-arg');
              if (event.dataTransfer && operand) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setDragImage(operand, 0, 0);
              }
              onArgDragStart?.(argIndex);
            }}
          />
        )}
        {reorder?.includes('positionPicker') && (
          <ReqoreDropdown
            compact
            fixed
            minimal
            flat
            className='expression-arg-position'
            label={ordinal(argIndex + 1)}
            tooltip='Position — pick a new one to move this argument'
            items={Array.from({ length: argCount }, (_, target) => ({
              label: ordinal(target + 1),
              selected: target === argIndex,
              disabled: target === argIndex,
              onClick: () => onMoveArg?.(argIndex, target),
            }))}
          />
        )}
      </>
    );

    if (arg?.is_expression) {
      return (
        <ReqoreControlGroup
          vertical
          fluid
          gapSize='small'
          className='expression-arg'
          {...dragProps}
        >
          <ReqoreControlGroup verticalAlign='center' gapSize='small'>
            <ExpressionBuilderArgumentLabel
              arg={arg}
              schema={schema}
              label={label || ''}
              expressions={expressions}
              type={type}
            />
            {reorder && renderReorderControls()}
          </ReqoreControlGroup>
          <ReqorePanel
            minimal
            fluid
            wrapperPadding='top'
            responsiveTitle={false}
            responsiveActions={false}
            size='small'
            flat
            padded={false}
            transparent
          >
            {children}
          </ReqorePanel>
        </ReqoreControlGroup>
      );
    }

    return (
      <ReqoreControlGroup
        vertical
        wrap
        fluid={fluid}
        size='small'
        className='expression-arg'
        {...dragProps}
        // at most the width of the expression it is in: a narrow column shrinks its field instead
        style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%', ...dragProps.style }}
      >
        <ExpressionBuilderArgumentLabel
          arg={arg}
          schema={schema}
          label={label}
          expressions={expressions}
        />
        {/* A fluid operand is a phone row: grip, field and `⋮` share it, and
            the field takes what is left; wrapping would put the grip on a
            line of its own above a full-width field. */}
        <StyledOperandFieldRow verticalAlign='flex-start' wrap={!fluid} fluid className='expression-arg-field'>
          {reorder && renderReorderControls()}
          {children}
          {hasMultipleArgs && (
            <ReqoreButton
              compact
              intent='danger'
              minimal
              fixed
              className='expression-remove-arg'
              icon='DeleteBinLine'
              flat
              transparent
              tooltip='Remove argument'
              onClick={onRemoveArgClick}
              disabled={readOnly}
            />
          )}
        </StyledOperandFieldRow>
      </ReqoreControlGroup>
    );
  }
);
