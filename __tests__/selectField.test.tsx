import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';

vi.mock('@qoretechnologies/reqore', () => ({
  ReqoreButton: ({ children, label, onClick, description, ...rest }: any) => (
    <button
      type='button'
      onClick={onClick}
      data-testid='reqore-button'
      data-description={description}
      {...rest}
    >
      {children ?? label}
    </button>
  ),
  ReqoreCollection: ({ items }: any) => (
    <div data-testid='select-collection'>
      {items.map((item: any) => (
        <button type='button' key={item.label} onClick={item.onClick}>
          {item.label}
          {item.content}
        </button>
      ))}
    </div>
  ),
  ReqoreControlGroup: ({ children }: any) => <div>{children}</div>,
  ReqoreDropdown: ({ children, items }: any) => (
    <div data-testid='select-dropdown' data-items={items.length}>
      {children}
    </div>
  ),
  ReqoreMenu: ({ children }: any) => <div>{children}</div>,
  ReqoreMenuItem: ({ label, onClick }: any) => (
    <button type='button' onClick={onClick}>
      {label}
    </button>
  ),
  ReqoreMessage: ({ children }: any) => <div>{children}</div>,
  ReqoreModal: ({ children, isOpen }: any) =>
    isOpen ? <div data-testid='select-modal'>{children}</div> : null,
  ReqoreP: ({ children }: any) => <p>{children}</p>,
  ReqoreTag: ({ label }: any) => <span>{label}</span>,
}));

vi.mock('../src/components/Description', () => ({
  Description: ({ longDescription, shortDescription }: any) => (
    <p>{longDescription || shortDescription}</p>
  ),
}));

import { SelectFormField } from '../src/components/form/fields/select/Select';

describe('SelectFormField', () => {
  const describedItem = {
    display_name: 'Qore Technologies',
    value: 'qore-technologies',
    desc: 'Discord guild "Qore Technologies"',
  };

  it('uses the inline dropdown for described values by default', () => {
    render(<SelectFormField items={[describedItem]} />);

    expect(screen.getByTestId('select-dropdown')).toBeTruthy();
    expect(screen.queryByTestId('select-modal')).toBeNull();
  });

  it('opens the collection modal only when forceDropdown is explicitly disabled', () => {
    render(<SelectFormField items={[describedItem]} forceDropdown={false} />);

    fireEvent.click(screen.getByTestId('reqore-button'));

    expect(screen.getByTestId('select-modal')).toBeTruthy();
  });

  it('auto-selects a sole value after render without updating its parent during render', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const ControlledSelect = () => {
      const [value, setValue] = useState<unknown>();

      return (
        <SelectFormField
          autoSelect
          items={[{ display_name: 'Only choice', value: 'only' }]}
          value={value}
          onChange={setValue}
        />
      );
    };

    render(<ControlledSelect />);

    await waitFor(() =>
      expect(screen.getByTestId('reqore-button').textContent).toBe('Only choice')
    );
    const loggedErrors = consoleError.mock.calls.flat().join('\n');
    expect(loggedErrors).not.toContain('Cannot update a component');
    expect(loggedErrors).not.toContain('Too many re-renders');

    consoleError.mockRestore();
  });
});
