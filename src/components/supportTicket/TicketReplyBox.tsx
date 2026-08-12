import { ReqoreDropdown } from '@qoretechnologies/reqore';
import { ComponentProps, ReactNode } from 'react';
import { Composer, IComposerSendAction, TComposerEditor } from '../composer/Composer';
import { fileToAttachment as defaultFileToAttachment } from './fileToAttachment';
import { IAttachmentUpload } from './meta';

/** The exact `items` shape ReqoreDropdown accepts — no import-path guessing. */
type TAttachMenuItems = NonNullable<ComponentProps<typeof ReqoreDropdown>['items']>;

export interface ITicketReplyBoxProps {
  /** Send the composed message. `internal` is only ever true when
   *  `allowInternalNote` is set (the staff surface). */
  onSend: (
    body: string,
    options: { internal: boolean; attachments?: IAttachmentUpload[] }
  ) => void | Promise<void>;
  /** File → base64 upload conversion; defaults to the shared `fileToAttachment`. */
  fileToAttachment?: (file: File) => Promise<IAttachmentUpload>;
  /** the send round-trip is in flight */
  sending?: boolean;
  /** the ticket can't be replied to (e.g. closed) — renders a notice instead */
  disabled?: boolean;
  disabledReason?: string;
  /** placeholder text. (A function is called with `false` — the mode is chosen at
   *  send time, so there is no live internal-note mode.) */
  placeholder?: string | ((internal: boolean) => string);
  /** send labels; a function is called with `false` for the primary "Send reply"
   *  and `true` for the "Add internal note" split-menu item. Defaults to
   *  "Send reply" / "Add internal note". */
  sendLabel?: string | ((internal: boolean) => string);
  /** Staff surface: split the send button so it also offers "Add internal note"
   *  (customer composers omit it and just send a reply). */
  allowInternalNote?: boolean;
  /** Extra attach-menu entries beyond "Upload files" — e.g. the IDE's screenshot /
   *  region capture. Receives the composer's `addFiles`. With any entry the attach
   *  control becomes a dropdown; otherwise it's a plain button. */
  attachMenuItems?: (addFiles: (files: File[]) => void) => TAttachMenuItems;
  /** Extra footer controls left of the send button — e.g. the IDE's
   *  reference-interfaces toggle. */
  footerActions?: ReactNode;
  /** Rendered on top of the editor, inside the bar — e.g. reference chips. */
  aboveInput?: ReactNode;
  /** Rendered below the editor — e.g. the IDE's interface-reference picker. */
  belowInput?: ReactNode;
  /** Editor flavour. Helpdesk uses the rich, Qonsole-style editor by default; pass
   *  `plain` for a simple textarea (e.g. deterministic play tests). */
  editor?: TComposerEditor;
  /** Initial draft text to seed the editor with (e.g. a restored draft). */
  defaultText?: string;
  /** Initial staged files (e.g. a restored draft's attachments, or a demo). */
  defaultFiles?: File[];
}

/**
 * The shared ticket reply composer — now a thin adapter over the universal
 * `<Composer>` (the input extracted from qorus-ide's Qonsole chat). It maps the
 * ticket vocabulary onto the composer: the staff `allowInternalNote` becomes a
 * split send (primary "Send reply" + a caret "Add internal note", mode chosen at
 * send time), and staged files convert to `IAttachmentUpload[]` via
 * `fileToAttachment` before `onSend`. App-specific affordances still arrive
 * through slots (`attachMenuItems`, `footerActions`, `belowInput`), so the
 * IDE-only bits (screenshot capture, the reference picker) stay in qorus-ide. A
 * closed ticket renders a muted notice.
 */
export const TicketReplyBox = ({
  onSend,
  fileToAttachment = defaultFileToAttachment,
  sending,
  disabled,
  disabledReason = 'This ticket is closed. Open a new ticket to continue the conversation.',
  placeholder = 'Write a reply…',
  sendLabel,
  allowInternalNote,
  attachMenuItems,
  footerActions,
  aboveInput,
  belowInput,
  editor = 'rich',
  defaultText,
  defaultFiles,
}: ITicketReplyBoxProps) => {
  const resolvedPlaceholder =
    typeof placeholder === 'function' ? placeholder(false) : placeholder;
  // Label for a given send mode: `false` = public reply, `true` = internal note.
  const labelFor = (note: boolean): string =>
    sendLabel !== undefined
      ? typeof sendLabel === 'function'
        ? sendLabel(note)
        : sendLabel
      : note
        ? 'Add internal note'
        : 'Send reply';

  // Staff surface splits the send button; customer surface is a single "Send reply".
  // Both use the Qonsole-style minimal `custom1` accent (the Composer default); the
  // internal note stays amber (`warning`) so it can't be mistaken for a public reply.
  const sendActions: IComposerSendAction[] | undefined = allowInternalNote
    ? [
        {
          id: 'reply',
          label: labelFor(false),
          icon: 'SendPlane2Line',
          minimal: true,
          customTheme: { main: 'custom1' },
        },
        {
          id: 'internal',
          label: labelFor(true),
          icon: 'StickyNoteLine',
          minimal: true,
          intent: 'warning',
        },
      ]
    : undefined;

  const handleSend = async (
    body: string,
    { files, action }: { files: File[]; action?: string }
  ): Promise<void> => {
    const internal = action === 'internal';
    const attachments = files.length
      ? await Promise.all(files.map(fileToAttachment))
      : undefined;
    await onSend(body, { internal, attachments });
  };

  return (
    <Composer
      editor={editor}
      defaultText={defaultText}
      defaultFiles={defaultFiles}
      placeholder={resolvedPlaceholder}
      sending={sending}
      disabled={disabled}
      disabledReason={disabledReason}
      onSend={handleSend}
      sendLabel={labelFor(false)}
      sendActions={sendActions}
      sendMenuClassName='ticket-send-more'
      attachMenuItems={attachMenuItems}
      footerActions={footerActions}
      aboveInput={aboveInput}
      belowInput={belowInput}
    />
  );
};
