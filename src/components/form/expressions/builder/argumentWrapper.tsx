import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqorePanel,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { memo } from 'react';
import { ordinal } from '../../../../helpers/common';
import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
  TExpressionReorderSurface,
} from '../types';
import { ExpressionBuilderArgumentLabel } from './argumentLabel';

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
        size='small'
        className='expression-arg'
        {...dragProps}
        style={{ flexShrink: 1, ...dragProps.style }}
      >
        <ExpressionBuilderArgumentLabel
          arg={arg}
          schema={schema}
          label={label}
          expressions={expressions}
        />
        <ReqoreControlGroup verticalAlign='flex-start' wrap fluid>
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
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);
