import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreMessage,
  ReqoreTextarea,
} from '@qoretechnologies/reqore';
import { ComponentProps, ReactNode, useRef, useState } from 'react';
import { AttachmentChips } from './AttachmentChips';
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
  /** placeholder text. (A function is called with `false` — there is no live
   *  internal-note mode any more; the mode is chosen at send time.) */
  placeholder?: string | ((internal: boolean) => string);
  /** send labels; a function is called with `false` for the primary "Send reply"
   *  and `true` for the "Add internal note" split-menu item. Defaults to
   *  "Send reply" / "Add internal note". */
  sendLabel?: string | ((internal: boolean) => string);
  /** Staff surface: split the send button so it also offers "Add internal note"
   *  (customer composers omit it and just send a reply). */
  allowInternalNote?: boolean;
  /** Extra attach-menu entries beyond "Upload files" — e.g. the IDE's screenshot /
   *  region capture, which need IDE-only capabilities. Receives the composer's
   *  `addFiles` so an item can stage the file(s) it produces. With any entry the
   *  attach control becomes a dropdown; otherwise it's a plain button. */
  attachMenuItems?: (addFiles: (files: File[]) => void) => TAttachMenuItems;
  /** Extra footer controls left of the send button — e.g. the IDE's
   *  reference-interfaces toggle. */
  footerActions?: ReactNode;
  /** Rendered below the textarea — e.g. the IDE's interface-reference picker. */
  belowInput?: ReactNode;
}

/** Image files pasted from the clipboard (a screenshot, a copied image) — the
 *  generic bits, so pasting to attach works on every composer without an IDE dep. */
const clipboardImages = (event: React.ClipboardEvent): File[] => {
  const images: File[] = [];
  for (const item of Array.from(event.clipboardData?.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        images.push(file);
      }
    }
  }
  return images;
};

/**
 * The shared ticket reply composer core: a markdown textarea, staged file chips
 * (with image thumbnails), an attach control, and a send button — presentational,
 * with the parent owning the send round-trip and busy/disabled state. On the staff
 * surface (`allowInternalNote`) the send button splits: the primary posts a public
 * reply and a caret offers "Add internal note", so the mode is chosen at send time
 * instead of held in a toggle that's easy to misread. A closed ticket renders a
 * muted notice.
 *
 * App-specific affordances are injected through slots rather than baked in, so
 * the IDE-only bits (screenshot / region capture, clipboard paste, the
 * interface-reference picker — all of which need IDE helpers or the customer's
 * instance) stay in qorus-ide: `attachMenuItems` adds to the attach menu,
 * `belowInput` hosts the reference picker, `footerActions` adds footer buttons,
 * and `onPaste` handles clipboard images.
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
  belowInput,
}: ITicketReplyBoxProps) => {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  if (disabled) {
    return (
      <ReqoreMessage intent='muted' icon='LockLine' size='small' flat>
        {disabledReason}
      </ReqoreMessage>
    );
  }

  const canSend = !!body.trim() && !sending;
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

  const addFiles = (incoming: File[]) => {
    if (incoming.length) {
      setFiles((prev) => [...prev, ...incoming]);
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const images = clipboardImages(event);
    if (images.length) {
      event.preventDefault();
      addFiles(images);
    }
  };

  const extraAttachItems = attachMenuItems ? attachMenuItems(addFiles) : [];

  const handleSend = async (internal: boolean) => {
    if (!body.trim()) {
      return;
    }
    const attachments = files.length
      ? await Promise.all(files.map(fileToAttachment))
      : undefined;
    await onSend(body.trim(), { internal, attachments });
    // only reached when onSend resolves — a thrown error keeps the draft + files
    setBody('');
    setFiles([]);
  };

  return (
    <ReqoreControlGroup vertical fluid gapSize='small' onPaste={handlePaste}>
      {/* Input + controls on one line: the textarea grows to fill, the controls
          sit at its right and stay bottom-aligned as it scales with content. */}
      <ReqoreControlGroup fluid verticalAlign='flex-end' gapSize='small'>
        <ReqoreTextarea
          value={body}
          scaleWithContent
          fluid
          placeholder={resolvedPlaceholder}
          disabled={sending}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
        />
        {extraAttachItems.length ? (
          <ReqoreDropdown
            icon='AttachmentLine'
            minimal
            flat
            disabled={sending}
            tooltip='Attach'
            items={[
              { label: 'Upload files', icon: 'Upload2Line', onClick: () => fileInput.current?.click() },
              ...extraAttachItems,
            ]}
          />
        ) : (
          <ReqoreButton
            icon='AttachmentLine'
            minimal
            flat
            disabled={sending}
            tooltip='Attach files'
            onClick={() => fileInput.current?.click()}
          />
        )}
        {footerActions}
        {allowInternalNote ? (
          <ReqoreControlGroup stack fixed>
            <ReqoreButton
              icon='SendPlane2Line'
              intent='info'
              disabled={!canSend}
              loading={sending}
              onClick={() => handleSend(false)}
            >
              {labelFor(false)}
            </ReqoreButton>
            <ReqoreDropdown
              className='ticket-send-more'
              icon='ArrowDownSLine'
              intent='info'
              disabled={!canSend}
              tooltip='More send options'
              items={[
                {
                  label: labelFor(false),
                  icon: 'SendPlane2Line',
                  onClick: () => handleSend(false),
                },
                {
                  label: labelFor(true),
                  icon: 'StickyNoteLine',
                  intent: 'warning',
                  onClick: () => handleSend(true),
                },
              ]}
            />
          </ReqoreControlGroup>
        ) : (
          <ReqoreButton
            icon='SendPlane2Line'
            intent='info'
            disabled={!canSend}
            loading={sending}
            onClick={() => handleSend(false)}
            fixed
          >
            {labelFor(false)}
          </ReqoreButton>
        )}
      </ReqoreControlGroup>
      <AttachmentChips
        files={files}
        onRemove={(index) => setFiles((prev) => prev.filter((_, j) => j !== index))}
        disabled={sending}
      />
      {belowInput}
      <input
        ref={fileInput}
        type='file'
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
      />
    </ReqoreControlGroup>
  );
};
