// Copyright 2026 Qore Technologies, s.r.o.
/* An internal note says what it is in its words ("Internal note") and its eye-off avatar, never in amber:
 * amber means "needs a look" (instruction-files decision 001), and a note needs none. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TicketThread } from '../src/components/ticketThread/TicketThread';

/** The colour of the first box in the message's card that draws an edge. */
const edgeOf = (messageId: string): string => {
  const card = document.getElementById(`ticket-message-${messageId}`)!;
  const edged = [card, ...Array.from(card.querySelectorAll<HTMLElement>('*'))].find(
    (element) => parseFloat(getComputedStyle(element).borderTopWidth) > 0
  )!;

  return getComputedStyle(edged).borderTopColor;
};

describe('an internal note', () => {
  it('sits on the same quiet edge as a reply, under its own words', () => {
    render(
      <ReqoreUIProvider>
        <TicketThread
          viewerRole='staff'
          messages={[
            {
              message_id: 'r',
              author_type: 'staff',
              author_id: 'nick',
              body: 'A reply.',
              created: '2026-10-19T10:00:00Z',
            },
            {
              message_id: 'n',
              author_type: 'staff',
              author_id: 'nick',
              internal: true,
              body: 'A note for us.',
              created: '2026-10-19T10:05:00Z',
            },
          ]}
        />
      </ReqoreUIProvider>
    );

    expect(screen.getByText('Internal note')).toBeTruthy();
    expect(edgeOf('n')).toBe(edgeOf('r'));
  });
});
