// Copyright 2026 Qore Technologies, s.r.o.
// A compact form lights the members of a one-of group while a mouse rests on what belongs to it: its chip,
// or one of its rows. A finger's tap lit them too - a tap is followed by the mouse events a browser emulates,
// `mouseenter` among them - and they stayed lit until the next tap. Only a pointer that hovers lights them now.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/** Two alternatives, neither answered: drawn together in the group's "One of" box. */
const AUTH = {
  username: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Username',
    required_groups: ['auth'],
  },
  token: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Token',
    required_groups: ['auth'],
  },
} as never;

/** The same group, its members in two sections of the form: each is drawn as a row of its own, with the
 *  group's "One of" chip, rather than in the group's box. */
const AUTH_IN_TWO_SECTIONS = {
  username: { ...(AUTH as any).username, group: 'login' },
  token: { ...(AUTH as any).token, group: 'key' },
} as never;

const renderForm = (options: never = AUTH) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='iface' value={{} as never} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const lit = () => document.querySelectorAll('.readfirst-row-group-highlight').length;

/** What the group's chip listens on. */
const groupChip = () =>
  (document.querySelector('.options-readfirst-required-group') as HTMLElement).closest(
    'span[role="presentation"]'
  ) as HTMLElement;

/** A row of the group, which lights its siblings too. */
const groupRow = () => document.querySelector('.readfirst-cluster-rail') as HTMLElement;

describe("a one-of group's chip", () => {
  it('lights the group while a mouse rests on it, and no longer once it leaves', async () => {
    renderForm(AUTH_IN_TWO_SECTIONS);
    await waitFor(() =>
      expect(document.querySelector('.options-readfirst-required-group')).toBeTruthy()
    );

    fireEvent.pointerEnter(groupChip(), { pointerType: 'mouse' });
    expect(lit()).toBe(2);

    fireEvent.pointerLeave(groupChip(), { pointerType: 'mouse' });
    expect(lit()).toBe(0);
  });

  it("lights nothing at a finger's tap, nor at the mouse events emulated after it", async () => {
    renderForm(AUTH_IN_TWO_SECTIONS);
    await waitFor(() =>
      expect(document.querySelector('.options-readfirst-required-group')).toBeTruthy()
    );

    fireEvent.pointerEnter(groupChip(), { pointerType: 'touch' });
    fireEvent.mouseEnter(groupChip());

    expect(lit()).toBe(0);
  });
});

describe("a one-of group's row", () => {
  it('lights the group while a mouse rests on it', async () => {
    renderForm();
    await waitFor(() => expect(groupRow()).toBeTruthy());

    fireEvent.pointerEnter(groupRow(), { pointerType: 'mouse' });
    expect(lit()).toBe(2);
    fireEvent.pointerLeave(groupRow(), { pointerType: 'mouse' });
    expect(lit()).toBe(0);
  });

  it("lights nothing at a finger's tap", async () => {
    renderForm();
    await waitFor(() => expect(groupRow()).toBeTruthy());

    fireEvent.pointerEnter(groupRow(), { pointerType: 'touch' });
    fireEvent.mouseEnter(groupRow());

    expect(lit()).toBe(0);
  });
});
