import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqorePanel,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { createContext, memo, useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
  TExpressionReorderSurface,
} from '../types';
import {
  ExpressionBuilderArgumentLabel,
  ExpressionBuilderArgumentRuntimeNote,
  useArgumentKnownWhenItRuns,
} from './argumentLabel';
import { useDestructiveButtonProps } from '../../../../hooks/useDestructiveButtonProps';

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

/**
 * How an argument tells the argument it is nested in that a note "depends on the incoming data" is shown below it.
 * The note is said once, on the innermost value it is about: an expression wrapping one that already says it (a Size
 * of a data path, an Addition of that Size) depends on the same data, and repeating the sentence at every level
 * says nothing new.
 */
const RuntimeNoteBelowContext = createContext<((change: 1 | -1) => void) | undefined>(undefined);

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
    const words = useReqraftLabels().expressions;
    // a destructive control's look, the same wherever reqraft draws one (`useDestructiveButtonProps`)
    const destructive = useDestructiveButtonProps();
    const type = arg?.type || schema?.ui_type || 'context';
    // an expression whose type only shows when it runs: the note under its value says so, unless an argument nested
    // in it already does
    const knownWhenItRuns = useArgumentKnownWhenItRuns(arg);
    const [notesBelow, setNotesBelow] = useState(0);
    const reportNoteBelow = useCallback(
      (change: 1 | -1) => setNotesBelow((count) => count + change),
      []
    );
    const reportToParent = useContext(RuntimeNoteBelowContext);
    const showsRuntimeNote = knownWhenItRuns && notesBelow === 0;
    const hasRuntimeNote = knownWhenItRuns || notesBelow > 0;
    useEffect(() => {
      if (!hasRuntimeNote || !reportToParent) {
        return undefined;
      }
      reportToParent(1);
      return () => reportToParent(-1);
    }, [hasRuntimeNote, reportToParent]);
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
            tooltip={words.dragToReorder}
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
            label={words.ordinal(argIndex + 1)}
            tooltip={words.positionTooltip}
            items={Array.from({ length: argCount }, (_, target) => ({
              label: words.ordinal(target + 1),
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
        // The provider wraps the whole argument, never a child of a control group: a group lays out its direct
        // children one by one, and one more wrapper among them moved every operand's field and button (qlip #473).
        <RuntimeNoteBelowContext.Provider value={reportNoteBelow}>
          {/* the value comes first; a note on it (that it depends on the incoming data) is under it */}
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
                readOnly={readOnly}
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
            {showsRuntimeNote ?
              <ExpressionBuilderArgumentRuntimeNote />
            : null}
          </ReqoreControlGroup>
        </RuntimeNoteBelowContext.Provider>
      );
    }

    return (
      <RuntimeNoteBelowContext.Provider value={reportNoteBelow}>
        <ReqoreControlGroup
          vertical
          wrap
          fluid={fluid}
          size='small'
          className='expression-arg'
          // the builder gives a value just added the focus here when it has no text field (see `focusNewArgIn`)
          tabIndex={-1}
          {...dragProps}
          // at most the width of the expression it is in: a narrow column shrinks its field instead
          style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%', ...dragProps.style }}
        >
          <ExpressionBuilderArgumentLabel
            arg={arg}
            schema={schema}
            label={label}
            expressions={expressions}
            readOnly={readOnly}
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
                minimal
                fixed
                className='expression-remove-arg'
                icon='DeleteBinLine'
                flat
                transparent
                {...destructive}
                tooltip={words.removeArgument}
                onClick={onRemoveArgClick}
                disabled={readOnly}
              />
            )}
          </StyledOperandFieldRow>
        </ReqoreControlGroup>
      </RuntimeNoteBelowContext.Provider>
    );
  }
);
