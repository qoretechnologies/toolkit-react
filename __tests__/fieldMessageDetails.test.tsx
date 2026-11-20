import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldMessageDetails } from '../src/components/form/engine/FieldMessageDetails';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A field message says what is wrong and what to do in words; a code or an error's raw text that goes with it is
 * its `details`, behind a reveal that says what it shows ("Show the error details", or what the message names them).
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
    expect(toggle().textContent).toContain('Show the error details');
    fireEvent.click(toggle());
    expect(screen.getByText(CODE)).toBeTruthy();
    expect(toggle().textContent).toContain('Hide the error details');
    fireEvent.click(toggle());
    expect(screen.queryByText(CODE)).toBeNull();
  });

  it('is named after what it holds, where the message says', () => {
    render(
      <ReqoreUIProvider>
        <FieldMessageDetails details='{"event": "job.failed"}' name='the event record' />
      </ReqoreUIProvider>
    );

    expect(toggle().textContent).toContain('Show the event record');
    fireEvent.click(toggle());
    expect(toggle().textContent).toContain('Hide the event record');
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
                      detailsName: 'what the database reported',
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
    expect(toggle().textContent).toContain('Show what the database reported');
    fireEvent.click(toggle());
    expect(screen.getByText(CODE)).toBeTruthy();
  });
});
