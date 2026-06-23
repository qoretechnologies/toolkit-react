/**
 * Unit tests for src/components/form/fields/array/ArrayAutoField.tsx
 *
 * Tests the compact tag-based UI for non-hash/non-list element types
 * and the panel-based UI for hash/list types.
 *
 * ReQore components are mocked to avoid ESM import issues with nanoid.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock @qoretechnologies/reqore ────────────────────────────────────────────
vi.mock('@qoretechnologies/reqore', () => ({
  ReqoreButton: ({ children, onClick, disabled, className, icon, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} data-icon={icon} {...rest}>
      {children}
    </button>
  ),
  ReqoreControlGroup: ({ children, className, onKeyDown, ...rest }: any) => (
    <div className={className} onKeyDown={onKeyDown} {...rest}>
      {children}
    </div>
  ),
  ReqorePanel: ({ children, className, actions, label, badge }: any) => (
    <div className={className} data-label={label} data-badge={badge}>
      {children}
      {actions?.map((a: any, i: number) =>
        a.show !== false ? (
          <button key={i} className={a.className} onClick={a.onClick}>
            {a.tooltip}
          </button>
        ) : null
      )}
    </div>
  ),
  ReqoreTag: ({ label, className, actions, intent }: any) => (
    <span className={className} data-intent={intent}>
      {label}
      {actions?.map((a: any, i: number) => (
        <span
          key={i}
          className={a.className}
          onClick={a.onClick}
          role='button'
          data-tooltip={a.tooltip}
        />
      ))}
    </span>
  ),
  ReqoreTagGroup: ({ children }: any) => <div className='reqore-tag-group'>{children}</div>,
  ReqoreVerticalSpacer: () => <div />,
  useReqoreProperty: () => vi.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ArrayAutoField,
  IArrayAutoFieldProps,
} from '../src/components/form/fields/array/ArrayAutoField';

const stringRenderItem: IArrayAutoFieldProps['renderItem'] = ({ value, onChange }) => (
  <input
    data-testid='array-input'
    value={(value as string) ?? ''}
    onChange={(e) => onChange(e.target.value)}
  />
);

const renderField = (props: Partial<IArrayAutoFieldProps> = {}) => {
  const defaultProps: IArrayAutoFieldProps = {
    name: 'test',
    onChange: vi.fn(),
    renderItem: stringRenderItem,
    type: 'string',
    value: [],
    ...props,
  };

  return render(<ArrayAutoField {...defaultProps} />);
};

const q = (sel: string) => document.querySelector(sel);
const qa = (sel: string) => document.querySelectorAll(sel);

// ─── compact mode (non-hash, non-list) ────────────────────────────────────────

describe('ArrayAutoField compact mode', () => {
  it('renders compact UI for string type', () => {
    renderField({ type: 'string', value: ['a', 'b'] });

    expect(qa('.array-auto-compact-tag').length).toBe(2);
    expect(qa('.array-auto-item').length).toBe(0);
  });

  it('renders compact UI for int type', () => {
    renderField({ type: 'int', value: [1, 2, 3] });

    expect(qa('.array-auto-compact-tag').length).toBe(3);
  });

  it('renders tags with correct labels', () => {
    renderField({ type: 'string', value: ['hello', 'world'] });

    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('world')).toBeTruthy();
  });

  it('renders no tags when value is empty', () => {
    renderField({ type: 'string', value: [] });

    expect(qa('.array-auto-compact-tag').length).toBe(0);
  });

  it('renders input field for adding items', () => {
    renderField({ type: 'string', value: [] });

    expect(screen.getByTestId('array-input')).toBeTruthy();
  });

  it('renders confirm button that is disabled when input is empty', () => {
    renderField({ type: 'string', value: [] });

    const confirmBtn = q('.array-auto-compact-confirm') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.disabled).toBe(true);
  });

  it('adds a new item when confirm is clicked', async () => {
    const onChange = vi.fn();
    renderField({ type: 'string', value: ['existing'], onChange });

    const input = screen.getByTestId('array-input');
    fireEvent.change(input, { target: { value: 'new' } });

    const confirmBtn = q('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn.disabled).toBe(false));
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['existing', 'new']);
    });
  });

  it('adds a new item on Enter key', async () => {
    const onChange = vi.fn();
    renderField({ type: 'string', value: [], onChange });

    const input = screen.getByTestId('array-input');
    fireEvent.change(input, { target: { value: 'enter-item' } });

    const container = q('.array-auto-compact') as HTMLElement;
    fireEvent.keyDown(container, { key: 'Enter' });

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['enter-item']);
    });
  });

  it('populates input when edit action is clicked', async () => {
    renderField({ type: 'string', value: ['editable'] });

    const editBtn = q('.array-auto-compact-edit') as HTMLElement;
    fireEvent.click(editBtn);

    await waitFor(() => {
      const input = screen.getByTestId('array-input') as HTMLInputElement;
      expect(input.value).toBe('editable');
    });
  });

  it('updates item when editing and confirm is clicked', async () => {
    const onChange = vi.fn();
    renderField({ type: 'string', value: ['original', 'keep'], onChange });

    // Click edit on first tag
    const editBtns = qa('.array-auto-compact-edit');
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      const input = screen.getByTestId('array-input') as HTMLInputElement;
      expect(input.value).toBe('original');
    });

    // Change the value
    const input = screen.getByTestId('array-input');
    fireEvent.change(input, { target: { value: 'modified' } });

    // Confirm
    const confirmBtn = q('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn.disabled).toBe(false));
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['modified', 'keep']);
    });
  });

  it('removes item when remove action is clicked', async () => {
    const onChange = vi.fn();
    renderField({ type: 'string', value: ['a', 'b', 'c'], onChange });

    // Remove second tag
    const removeBtns = qa('.array-auto-compact-remove');
    fireEvent.click(removeBtns[1]);

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['a', 'c']);
    });
  });

  it('cancels editing on Escape key', async () => {
    renderField({ type: 'string', value: ['test'] });

    // Start editing
    const editBtn = q('.array-auto-compact-edit') as HTMLElement;
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(q('.array-auto-compact-cancel')).toBeTruthy();
    });

    // Press Escape
    const container = q('.array-auto-compact') as HTMLElement;
    fireEvent.keyDown(container, { key: 'Escape' });

    // Cancel button should disappear
    await waitFor(() => {
      expect(q('.array-auto-compact-cancel')).toBeNull();
    });
  });

  it('shows cancel button only during editing', () => {
    renderField({ type: 'string', value: ['test'] });

    // Not editing — no cancel button
    expect(q('.array-auto-compact-cancel')).toBeNull();

    // Start editing
    const editBtn = q('.array-auto-compact-edit') as HTMLElement;
    fireEvent.click(editBtn);

    // Cancel button should appear
    expect(q('.array-auto-compact-cancel')).toBeTruthy();
  });

  it('does not show edit/remove actions when disabled', () => {
    renderField({ type: 'string', value: ['locked'], disabled: true });

    expect(qa('.array-auto-compact-edit').length).toBe(0);
    expect(qa('.array-auto-compact-remove').length).toBe(0);
    expect(q('.array-auto-compact-confirm')).toBeNull();
  });

  it('does not show edit/remove actions when readOnly', () => {
    renderField({ type: 'string', value: ['locked'], readOnly: true });

    expect(qa('.array-auto-compact-edit').length).toBe(0);
    expect(qa('.array-auto-compact-remove').length).toBe(0);
    expect(q('.array-auto-compact-confirm')).toBeNull();
  });

  it('clears input after adding an item', async () => {
    renderField({ type: 'string', value: [] });

    const input = screen.getByTestId('array-input');
    fireEvent.change(input, { target: { value: 'temp' } });

    const confirmBtn = q('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn.disabled).toBe(false));
    fireEvent.click(confirmBtn);

    // Input should be cleared after confirm
    await waitFor(() => {
      const newInput = screen.getByTestId('array-input') as HTMLInputElement;
      expect(newInput.value).toBe('');
    });
  });

  it('adjusts editing index when removing item before edited item', async () => {
    const onChange = vi.fn();
    renderField({ type: 'string', value: ['a', 'b', 'c'], onChange });

    // Start editing the third item (index 2)
    const editBtns = qa('.array-auto-compact-edit');
    fireEvent.click(editBtns[2]);

    await waitFor(() => {
      const input = screen.getByTestId('array-input') as HTMLInputElement;
      expect(input.value).toBe('c');
    });

    // Remove the first item — editing index should shift from 2 to 1
    const removeBtns = qa('.array-auto-compact-remove');
    fireEvent.click(removeBtns[0]);

    // Change the value and confirm — should update the correct item
    const input = screen.getByTestId('array-input');
    fireEvent.change(input, { target: { value: 'c-edited' } });

    const confirmBtn = q('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn.disabled).toBe(false));
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['b', 'c-edited']);
    });
  });

  it('cancels editing when the edited item is removed', async () => {
    renderField({ type: 'string', value: ['only'] });

    // Start editing
    const editBtn = q('.array-auto-compact-edit') as HTMLElement;
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(q('.array-auto-compact-cancel')).toBeTruthy();
    });

    // Remove the item being edited
    const removeBtn = q('.array-auto-compact-remove') as HTMLElement;
    fireEvent.click(removeBtn);

    // Should exit editing mode
    await waitFor(() => {
      expect(q('.array-auto-compact-cancel')).toBeNull();
    });
  });
});

// ─── complex mode (hash/list) ─────────────────────────────────────────────────

describe('ArrayAutoField complex mode', () => {
  it('renders panel-based UI for hash type', () => {
    renderField({ type: 'hash', value: [{}] });

    expect(qa('.array-auto-item').length).toBe(1);
    expect(qa('.array-auto-compact-tag').length).toBe(0);
  });

  it('renders panel-based UI for list type', () => {
    renderField({ type: 'list', value: [[]] });

    expect(qa('.array-auto-item').length).toBe(1);
    expect(qa('.array-auto-compact-tag').length).toBe(0);
  });

  it('renders add button for complex mode', () => {
    renderField({ type: 'hash', value: [] });

    expect(screen.getByText(/Add new item/)).toBeTruthy();
  });
});
