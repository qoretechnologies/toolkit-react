import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldMessageDetails } from '../src/components/form/engine/FieldMessageDetails';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A field message says what is wrong and what to do in words; a code or an error's raw text that goes with it is
 * its `details`, behind a reveal ("Technical details").
 */
const CODE = 'ECONNREFUSED 10.0.0.5:5432';
/** The reveal's button (a button draws its words twice, for its marquee). */
const toggle = () => document.querySelector<HTMLElement>('.options-message-details-toggle')!;

describe('a message detail', () => {
  it('is behind a reveal, and shown and hidden again by it', () => {
    render(
      <ReqoreUIProvider>
        <FieldMessageDetails details={CODE} />
      </ReqoreUIProvider>
    );

    expect(screen.queryByText(CODE)).toBeNull();
    expect(toggle().textContent).toContain('Technical details');
    fireEvent.click(toggle());
    expect(screen.getByText(CODE)).toBeTruthy();
    expect(toggle().textContent).toContain('Hide technical details');
    fireEvent.click(toggle());
    expect(screen.queryByText(CODE)).toBeNull();
  });

  it("is drawn under a field's message in a form", async () => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            name='db'
            value={{}}
            options={
              {
                address: {
                  type: 'string',
                  display_name: 'Database address',
                  required: true,
                  preselected: true,
                  messages: [
                    {
                      intent: 'danger',
                      content: 'Check the address, then try again.',
                      details: CODE,
                    },
                  ],
                },
              } as unknown as IOptionsSchema
            }
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(screen.getByText('Check the address, then try again.')).toBeTruthy());
    expect(screen.queryByText(CODE)).toBeNull();
    fireEvent.click(toggle());
    expect(screen.getByText(CODE)).toBeTruthy();
  });
});
