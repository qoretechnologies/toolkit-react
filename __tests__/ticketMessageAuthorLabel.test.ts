// Copyright 2026 Qore Technologies, s.r.o.
/*
 * Who a message in a ticket's thread is from, as staff read it: a customer by name, else by email, else a plain word -
 * never by an id. A customer's `author_id` and the ticket's `created_by` are the subscription code (a UUID on a real
 * server), and the admin portal found it shown as the author. A message Qorus wrote is Qorus's, not the customer's.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ticketMessageAuthorLabel } from '../src/components/ticketThread';
import { reqraftLabels, setReqraftLabels } from '../src/helpers/reqraftLabels';

afterEach(() => {
  setReqraftLabels();
});

const CODE = '6f1c2e8a-3b4d-4e5f-9a0b-1c2d3e4f5a6b';
const customerMessage = (author_name?: string) => ({
  author_type: 'customer' as const,
  author_id: CODE,
  author_name,
});
const label = (
  message: Parameters<typeof ticketMessageAuthorLabel>[0],
  customer?: { customer_name?: string; customer_email?: string }
) => ticketMessageAuthorLabel(message, 'staff', reqraftLabels().supportTicket, customer);

describe('a customer message in the staff thread', () => {
  it('is named by the name the message carries', () => {
    expect(label(customerMessage('Jane Doe'), { customer_name: 'Someone else' })).toBe(
      'Customer · Jane Doe'
    );
  });

  it('is named by the ticket’s customer where the message carries no name', () => {
    expect(label(customerMessage(), { customer_name: 'Jane Doe', customer_email: 'jane@acme.example' })).toBe(
      'Customer · Jane Doe'
    );
    expect(label(customerMessage(), { customer_email: 'jane@acme.example' })).toBe(
      'Customer · jane@acme.example'
    );
  });

  it('is never named by an id', () => {
    // the id handed back where the name would be, or any UUID
    expect(label(customerMessage(CODE), { customer_name: 'Jane Doe' })).toBe('Customer · Jane Doe');
    expect(label(customerMessage())).toBe('Customer');
    expect(label(customerMessage(CODE))).toBe('Customer');
  });

  it('is said in the host’s words', () => {
    setReqraftLabels({ supportTicket: { customerAuthorUnnamed: 'Kunde' } });
    expect(label(customerMessage())).toBe('Kunde');
  });
});

describe('a message Qorus wrote', () => {
  it('is Qorus’s in either view, never the customer’s', () => {
    const system = { author_type: 'system' as const, author_id: 'system' };
    expect(label(system, { customer_name: 'Jane Doe' })).toBe('Qorus');
    expect(ticketMessageAuthorLabel(system, 'customer', reqraftLabels().supportTicket)).toBe('Qorus');
    setReqraftLabels({ supportTicket: { systemAuthor: 'System' } });
    expect(label(system)).toBe('System');
  });
});
