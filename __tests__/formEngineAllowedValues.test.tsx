import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine } from '../src/components/form/engine/FormEngine';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

describe('FormEngine fixed allowed-value fields', () => {
  it('renders a selectable editor for fixed allowed values with a rich renderer hint', async () => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='delivery'
            value={{}}
            options={{
              guild: {
                type: 'string',
                ui_type: 'string',
                display_name: 'Server',
                required: true,
                allowed_values_creatable: false,
                supports_custom_values: false,
                supports_expressions: false,
                supports_templates: false,
                disallow_template: true,
                allowed_values: [
                  {
                    display_name: 'Qore Technologies',
                    desc: 'Discord guild used for alert notifications.',
                    value: { type: 'string', value: 'Qore Technologies' },
                  },
                  {
                    display_name: 'Developer Ecosystem',
                    value: { type: 'string', value: 'Developer Ecosystem' },
                  },
                  {
                    display_name: 'Portal 2: CE',
                    value: { type: 'string', value: 'Portal 2: CE' },
                  },
                  {
                    display_name: 'Invest in Bravery',
                    value: { type: 'string', value: 'Invest in Bravery' },
                  },
                ],
              },
            }}
            forceDropdown
            templateFieldProps={{ forceDropdown: true }}
            initialExpandedOptions={['guild']}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect((await screen.findAllByText('Please select')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('keeps compact booleans unset until chosen and auto-collapses either choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='settings'
            value={{}}
            options={{
              enabled: {
                type: 'bool',
                ui_type: 'bool',
                display_name: 'Enabled',
                required: true,
              },
            }}
            initialExpandedOptions={['enabled']}
            onChange={onChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    const switchElement = (await screen.findByText('Yes')).closest('[tabindex="0"]');
    expect(switchElement).toBeTruthy();
    expect(container.querySelector('[data-field="enabled"].readfirst-row-editing')).toBeTruthy();

    await user.click(switchElement as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({
        enabled: expect.objectContaining({ type: 'bool', value: true }),
      }),
      undefined
    );
    expect(container.querySelector('[data-field="enabled"].readfirst-row-editing')).toBeNull();
  });

  it('emits fixed allowed-value selections immediately without the row confirmation button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onDependableOptionChange = vi.fn();

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='delivery'
            value={{}}
            options={{
              guild: {
                type: 'string',
                ui_type: 'string',
                display_name: 'Server',
                required: true,
                has_dependents: true,
                allowed_values_creatable: false,
                supports_custom_values: false,
                supports_expressions: false,
                supports_templates: false,
                disallow_template: true,
                allowed_values: [
                  {
                    display_name: 'Qore Technologies',
                    desc: 'Discord guild "Qore Technologies"',
                    value: { type: 'string', value: 'Qore Technologies' },
                  },
                  {
                    display_name: 'Developer Ecosystem (devEco)',
                    desc: 'Discord guild "Developer Ecosystem (devEco)"',
                    value: { type: 'string', value: 'Developer Ecosystem (devEco)' },
                  },
                ],
              },
              channel: {
                type: 'string',
                ui_type: 'string',
                display_name: 'Channel',
                depends_on: ['guild'],
              },
            }}
            forceDropdown
            templateFieldProps={{ forceDropdown: true }}
            initialExpandedOptions={['guild']}
            onChange={onChange}
            onDependableOptionChange={onDependableOptionChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await user.click(await screen.findByText('Qore Technologies'));

    expect(screen.queryByRole('button', { name: /done|check/i })).toBeNull();
    expect(onDependableOptionChange).toHaveBeenCalledWith(
      'guild',
      'Qore Technologies',
      expect.objectContaining({
        guild: expect.objectContaining({
          type: 'string',
          value: 'Qore Technologies',
        }),
      }),
      expect.any(Object)
    );
    expect(onChange).toHaveBeenCalledWith(
      'delivery',
      expect.objectContaining({
        guild: expect.objectContaining({
          type: 'string',
          value: 'Qore Technologies',
        }),
      }),
      undefined
    );
  });

  it('allows fixed allowed-value editors to close without selecting or clearing a value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onDependableOptionChange = vi.fn();

    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='delivery'
            value={{}}
            options={{
              guild: {
                type: 'string',
                ui_type: 'string',
                display_name: 'Server',
                required: true,
                has_dependents: true,
                allowed_values_creatable: false,
                allowed_values: [
                  {
                    display_name: 'Qore Technologies',
                    desc: 'Discord guild "Qore Technologies"',
                    value: { type: 'string', value: 'Qore Technologies' },
                  },
                  {
                    display_name: 'Developer Ecosystem (devEco)',
                    desc: 'Discord guild "Developer Ecosystem (devEco)"',
                    value: { type: 'string', value: 'Developer Ecosystem (devEco)' },
                  },
                ],
              },
            }}
            forceDropdown
            templateFieldProps={{ forceDropdown: true }}
            initialExpandedOptions={['guild']}
            onChange={onChange}
            onDependableOptionChange={onDependableOptionChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    expect(await screen.findByText('Qore Technologies')).toBeTruthy();
    onChange.mockClear();
    onDependableOptionChange.mockClear();

    await user.click(screen.getByRole('button', { name: /close field/i }));

    expect(screen.queryByText('Qore Technologies')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onDependableOptionChange).not.toHaveBeenCalled();
  });
});
