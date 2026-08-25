import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqorePanel,
  ReqoreTag,
  ReqoreTagGroup,
  ReqoreVerticalSpacer,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { map, size } from 'lodash';
import { recordIdentity } from '../../engine/readFirst';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { validateFieldWithResult } from '../../../../helpers/validations';

export interface IArrayAutoFieldProps {
  name: string;
  value?: unknown[];
  display_name?: string;
  type?: string;
  arg_schema?: IQorusFormSchema;
  disabled?: boolean;
  readOnly?: boolean;
  size?: string;
  allowed_values?: unknown[];
  allowed_values_creatable?: boolean;
  onChange: (name: string, value: unknown[] | undefined) => void;
  /** Render function for each item — avoids circular FormField → ArrayAutoField → FormField */
  renderItem: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    index: number;
    type?: string;
    arg_schema?: IQorusFormSchema;
    allowed_values?: unknown[];
    allowed_values_creatable?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    size?: string;
  }) => React.ReactNode;
}

const defaultValueByType: Record<string, unknown> = {
  string: undefined,
  int: undefined,
  float: undefined,
  date: undefined,
  hash: {},
  list: [],
};

const formatTagLabel = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  return String(val);
};

export const ArrayAutoField = memo(
  ({
    name,
    onChange,
    value = [],
    display_name,
    type,
    arg_schema,
    allowed_values,
    allowed_values_creatable,
    disabled,
    readOnly,
    size: fieldSize,
    renderItem,
  }: IArrayAutoFieldProps) => {
    const confirmAction = useReqoreProperty('confirmAction');
    const [localValue, setLocalValue] = useState(value);
    // Compact mode state: staging value for the input field and optional editing index
    const [inputValue, setInputValue] = useState<unknown>(undefined);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const inputKeyRef = useRef(0);

    useEffect(() => {
      setLocalValue(value);
    }, [JSON.stringify(value)]);

    useDebounce(
      () => {
        onChange(name, localValue);
      },
      300,
      [JSON.stringify(localValue)]
    );

    const addItem = useCallback(() => {
      setLocalValue((prev) => [...(prev || []), defaultValueByType[type] ?? undefined]);
    }, [type]);

    const removeItem = useCallback((idx: number) => {
      setLocalValue((prev) => (prev || []).filter((_, i) => i !== idx));
    }, []);

    const handleItemChange = useCallback((idx: number, itemValue: unknown) => {
      setLocalValue((prev) => {
        const next = [...(prev || [])];
        next[idx] = itemValue;
        return next;
      });
    }, []);

    const renderValidationMessage = (val: unknown) => {
      if (!type) return null;
      const result = validateFieldWithResult(type, val);
      if (!result.isValid) {
        return (
          <ReqoreControlGroup vertical>
            <ReqoreVerticalSpacer height={5} />
            <ReqoreTag
              intent='danger'
              size='tiny'
              minimal
              icon='ErrorWarningLine'
              label={result.reason}
            />
          </ReqoreControlGroup>
        );
      }
      return null;
    };

    // ── Compact mode handlers ──────────────────────────────────────────────

    const resetInput = useCallback(() => {
      setInputValue(undefined);
      setEditingIndex(null);
      inputKeyRef.current += 1;
    }, []);

    const confirmInput = useCallback(() => {
      if (inputValue === undefined || inputValue === '') return;

      if (editingIndex !== null) {
        // Update existing item
        setLocalValue((prev) => {
          const next = [...(prev || [])];
          next[editingIndex] = inputValue;
          return next;
        });
      } else {
        // Add new item
        setLocalValue((prev) => [...(prev || []), inputValue]);
      }

      resetInput();
    }, [inputValue, editingIndex, resetInput]);

    const handleEditTag = useCallback(
      (idx: number) => {
        setInputValue(localValue[idx]);
        setEditingIndex(idx);
        inputKeyRef.current += 1;
      },
      [localValue]
    );

    const handleRemoveTag = useCallback(
      (idx: number) => {
        // If we're editing this item, cancel the edit
        if (editingIndex === idx) {
          resetInput();
        } else if (editingIndex !== null && idx < editingIndex) {
          // Adjust editing index if removing an item before it
          setEditingIndex((prev) => (prev !== null ? prev - 1 : null));
        }
        removeItem(idx);
      },
      [editingIndex, removeItem, resetInput]
    );

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmInput();
        } else if (e.key === 'Escape' && editingIndex !== null) {
          e.preventDefault();
          resetInput();
        }
      },
      [confirmInput, editingIndex, resetInput]
    );

    // ── Compact mode: non-hash, non-list element types ─────────────────────

    if (type !== 'hash' && type !== 'list' && type !== 'rgbcolor') {
      const isEditing = editingIndex !== null;
      const hasInput = inputValue !== undefined && inputValue !== '';

      return (
        <ReqoreControlGroup
          vertical
          fluid
          className='array-auto-compact'
          onKeyDown={handleInputKeyDown as any}
        >
          {size(localValue) > 0 && (
            <ReqoreTagGroup>
              {map(localValue, (val, idx) => (
                <ReqoreTag
                  key={`${idx}-${formatTagLabel(val)}`}
                  label={formatTagLabel(val)}
                  className='array-auto-compact-tag'
                  size={fieldSize as any}
                  intent={editingIndex === idx ? 'info' : undefined}
                  actions={
                    disabled || readOnly ? undefined : (
                      [
                        {
                          icon: 'EditLine',
                          tooltip: 'Edit',
                          className: 'array-auto-compact-edit',
                          onClick: () => handleEditTag(idx),
                        },
                        {
                          icon: 'DeleteBinLine',
                          intent: 'danger',
                          tooltip: 'Remove',
                          className: 'array-auto-compact-remove',
                          onClick: () => handleRemoveTag(idx),
                        },
                      ]
                    )
                  }
                />
              ))}
            </ReqoreTagGroup>
          )}

          <ReqoreControlGroup fluid>
            <div style={{ flex: 1 }}>
              {renderItem({
                value: inputValue,
                onChange: (v) => setInputValue(v),
                index: -1,
                type,
                arg_schema,
                allowed_values,
                allowed_values_creatable,
                disabled,
                readOnly,
                size: fieldSize,
                key: inputKeyRef.current,
              } as any)}
            </div>
            {!disabled && !readOnly && (
              <>
                <ReqoreButton
                  icon={isEditing ? 'CheckLine' : 'AddLine'}
                  intent={isEditing ? 'info' : undefined}
                  className='array-auto-compact-confirm'
                  tooltip={isEditing ? 'Save changes' : 'Add item'}
                  disabled={!hasInput}
                  onClick={confirmInput}
                  fixed
                />
                {isEditing && (
                  <ReqoreButton
                    icon='CloseLine'
                    className='array-auto-compact-cancel'
                    tooltip='Cancel editing'
                    onClick={resetInput}
                    fixed
                  />
                )}
              </>
            )}
          </ReqoreControlGroup>
        </ReqoreControlGroup>
      );
    }

    // ── Complex mode: hash/list element types ──────────────────────────────

    return (
      <ReqoreControlGroup vertical fluid>
        {map(localValue, (val, idx) => {
          // The same field the collapsed preview promotes, resolved by the same
          // definition — see `recordIdentity`. Both editable list renderers head
          // their records with it, so an item cannot be called `init` in one
          // place and `#1` in another.
          const identity =
            val && typeof val === 'object' && !Array.isArray(val)
              ? recordIdentity(val as Record<string, unknown>, arg_schema)
              : undefined;

          return (
          <ReqorePanel
            key={idx}
            // `#N` stays as the fallback: a record whose identifying field is
            // still empty has nothing to be called yet, and a blank heading
            // would be worse than a number.
            label={identity?.text || `#${idx + 1}`}
            tooltip={identity?.label}
            // The position moves to the badge once the name owns the heading,
            // so "which of these is third" stays answerable.
            badge={identity ? `#${idx + 1}` : display_name || name}
            collapsible
            unMountContentOnCollapse={false}
            responsiveActions={false}
            responsiveTitle={false}
            className='array-auto-item'
            collapseButtonProps={{
              transparent: true,
              style: { paddingLeft: 0, paddingRight: 0, minWidth: '10px' },
            }}
            size='small'
            minimal
            actions={[
              {
                show: size(localValue) !== 1 && !disabled && !readOnly,
                icon: 'DeleteBinLine',
                intent: 'danger',
                className: 'array-auto-item-remove',
                tooltip: 'Remove item',
                onClick: () => confirmAction({ onConfirm: () => removeItem(idx) }),
                minimal: true,
              },
            ]}
          >
            {renderItem({
              value: val,
              onChange: (v) => handleItemChange(idx, v),
              index: idx,
              type,
              arg_schema,
              allowed_values,
              allowed_values_creatable,
              disabled,
              readOnly,
              size: fieldSize,
            })}
            {renderValidationMessage(val)}
          </ReqorePanel>
          );
        })}

        <ReqoreButton
          onClick={addItem}
          icon='AddLine'
          rightIcon='AddLine'
          textAlign='center'
          customTheme={{ main: '#22273b' }}
          size={fieldSize as any}
          disabled={disabled || readOnly}
        >
          Add new item {display_name || name ? `for "${display_name || name}"` : null}
        </ReqoreButton>
      </ReqoreControlGroup>
    );
  }
);
