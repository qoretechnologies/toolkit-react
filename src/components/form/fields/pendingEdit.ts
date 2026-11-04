// Copyright 2026 Qore Technologies, s.r.o.
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

/** One field's edit that waits for the field's pause before it is reported (see `usePendingEdit`). */
interface IPendingEditMember {
  flush: () => void;
  discard: () => void;
}

/**
 * The edits the fields of one editor still hold back, for whoever closes the editor: a read-first row's Done
 * sends them before the row closes, its Cancel and Escape drop them.
 */
export interface IPendingEdits {
  /** Sends every edit the fields in this scope still hold back, now. */
  flush: () => void;
  /** Drops every edit the fields in this scope still hold back: the edit is being thrown away. */
  discard: () => void;
  /** A field takes part for as long as it is mounted; what this returns ends that. */
  join: (member: IPendingEditMember) => () => void;
}

export const createPendingEdits = (): IPendingEdits => {
  const members = new Set<IPendingEditMember>();
  return {
    flush: () => members.forEach((member) => member.flush()),
    discard: () => members.forEach((member) => member.discard()),
    join: (member) => {
      members.add(member);
      return () => {
        members.delete(member);
      };
    },
  };
};

/** The scope the fields below report their held-back edits to: a read-first row's own editor. */
export const PendingEditsContext = createContext<IPendingEdits | undefined>(undefined);

/** One `IPendingEdits` scope for the life of the component that closes the editor. */
export const usePendingEdits = (): IPendingEdits => {
  const ref = useRef<IPendingEdits>();
  if (!ref.current) {
    ref.current = createPendingEdits();
  }
  return ref.current;
};

/** What a debounced field says about the edit it has not reported yet. */
export interface IPendingEdit<T> {
  /** `value` is typed and waits for the pause: it is what a flush sends. */
  hold: (value: T) => void;
  /** Nothing waits any more: the pause reported it, it was reported at once, or a value came from outside. */
  release: () => void;
}

/**
 * The edit a debounced field holds back until its pause, which is never lost.
 *
 * A field that keeps a local copy of what is typed reports it after a short pause (react-use `useDebounce`).
 * The pause's timer dies with the field, and a field goes away the moment its editor closes: a read-first
 * row's Done closes the row, so a value typed and Done pressed inside the pause never reached the form - the
 * row read as it had before, a required field still said "This field is required", and the host never heard
 * of the edit (qorus#646).
 *
 * So the field says what it holds (`hold`) and when nothing is held any more (`release`), and the edit is
 * sent with `send` (the latest one given):
 * - when the editor's Done asks for it, before the row closes (`IPendingEdits.flush`);
 * - when the field goes away any other way - another row opened in its place, a value tab switched - since
 *   every way out of an editor but Cancel keeps what was typed.
 * Cancel and Escape drop it (`IPendingEdits.discard`): sent on the way out, the edit they are there to throw
 * away would be committed by them.
 *
 * `send` is called only for a value held; it decides itself whether that is still a change.
 */
export const usePendingEdit = <T>(send: (value: T) => void): IPendingEdit<T> => {
  const scope = useContext(PendingEditsContext);
  const sendRef = useRef(send);
  sendRef.current = send;
  const held = useRef<{ value: T } | undefined>(undefined);

  const edit = useMemo(
    () => ({
      hold: (value: T) => {
        held.current = { value };
      },
      release: () => {
        held.current = undefined;
      },
      flush: () => {
        const pending = held.current;
        if (pending) {
          held.current = undefined;
          sendRef.current(pending.value);
        }
      },
      discard: () => {
        held.current = undefined;
      },
    }),
    []
  );

  useEffect(() => scope?.join(edit), [scope, edit]);
  // Any other way out keeps what was typed.
  useEffect(() => () => edit.flush(), [edit]);

  return useMemo(() => ({ hold: edit.hold, release: edit.release }), [edit]);
};
