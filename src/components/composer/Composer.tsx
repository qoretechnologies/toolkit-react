// Copyright 2026 Qore Technologies, s.r.o.
// <Composer> — the shared Qorus message composer, a faithful lift of qorus-ide's
// Qonsole chat input: the same gradient-bordered `StyledEffect` bar, transparent
// editor, attachment preview strip, and control row (attach + toolbar on the left,
// actions + send on the right). Everything Qonsole-specific (slash completions,
// command history, design-mode, sendCommand) is replaced by slots + props, so the
// exact same input can back the Qonsole, the helpdesk reply box, and anything else.

import {
  ReqoreButton,
  ReqoreCallout,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreIcon,
  ReqoreRichTextEditor,
  ReqoreSpan,
  ReqoreTextarea,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { StyledEffect } from '@qoretechnologies/reqore/dist/components/Effect';
import type { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import type { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import {
  ChangeEvent as ReactChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  ComponentProps,
  forwardRef,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import {
  clipboardImages,
  EMPTY_RICH_VALUE,
  isPlainSubmitEnter,
  richValueFromString,
  richValueToString,
} from './helpers';

/** Reqore's intent / effect / theme unions, without guessing import paths. */
type TIntent = ComponentProps<typeof ReqoreButton>['intent'];
type TEffect = ComponentProps<typeof StyledEffect>['effect'];
type TCustomTheme = ComponentProps<typeof ReqoreButton>['customTheme'];
/** The exact `items` shape ReqoreDropdown accepts. */
type TDropdownItems = NonNullable<ComponentProps<typeof ReqoreDropdown>['items']>;

/** Which editor the composer renders. */
export type TComposerEditor = 'rich' | 'plain';

/** One send action. With more than one, the send button splits into a primary
 *  button (the first action) + a caret dropdown listing them all. `id` is echoed
 *  back to `onSend` so the caller knows which action fired. */
export interface IComposerSendAction {
  id?: string;
  /** button label; omit for an icon-only button (like the Qonsole send). */
  label?: string;
  icon?: IReqoreIconName;
  intent?: TIntent;
  /** per-button Reqore theme (e.g. `{ main: 'custom1' }` for the Qonsole accent). */
  customTheme?: TCustomTheme;
  /** render the button minimal (subtle, blends into the bar — the Qonsole style). */
  minimal?: boolean;
}

/** Imperative handle for consumers that drive the editor externally (e.g. the
 *  Qonsole input inserting a completion or navigating history). */
export interface IComposerHandle {
  focus: () => void;
  clear: () => void;
  setText: (text: string) => void;
  getText: () => string;
}

export interface IComposerProps {
  /** Editor flavour. `rich` = ReqoreRichTextEditor (default), `plain` = ReqoreTextarea. */
  editor?: TComposerEditor;
  /** Initial draft text (also seeds the editor for a restored draft / a story). */
  defaultText?: string;
  /** Initial staged files (a restored draft's attachments, or a demo). */
  defaultFiles?: File[];
  placeholder?: string;
  /**
   * Submit the composed message. `text` is the plain-string body; `files` are the
   * staged attachments (raw `File`s — the caller converts to its own upload shape);
   * `action` is the chosen send action's `id` (undefined for the default button).
   */
  onSend: (text: string, options: { files: File[]; action?: string }) => void | Promise<void>;
  /** Single-button label / icon / intent (ignored when `sendActions` is set). */
  sendLabel?: string;
  sendIcon?: IReqoreIconName;
  sendIntent?: TIntent;
  /** Default send button: minimal (subtle, Qonsole-style). Default `true`. */
  sendMinimal?: boolean;
  /** Default send button accent (Reqore `customTheme`). Default `{ main: 'custom1' }`
   *  — the Qorus accent, which each app's theme colours (gray in a bare reqore theme). */
  sendCustomTheme?: TCustomTheme;
  /** Multiple send actions → a split send button. The first is the primary. */
  sendActions?: IComposerSendAction[];
  /** className on the split-send caret dropdown (keeps consumer test hooks, e.g.
   *  the helpdesk `ticket-send-more`). */
  sendMenuClassName?: string;
  /** the send round-trip is in flight */
  sending?: boolean;
  /** disabled → renders a muted notice with `disabledReason` instead of the composer */
  disabled?: boolean;
  disabledReason?: string;
  /** submit on plain Enter (Shift/Ctrl/Alt/Meta+Enter insert a newline). Default true. */
  submitOnEnter?: boolean;
  /** clear the editor + staged files after a resolved send. Default true. */
  clearOnSend?: boolean;
  /** allow sending with empty text (e.g. attachments only). Default false. */
  allowEmptySend?: boolean;
  /** Extra attach-menu entries beyond "Upload files" (receives `addFiles`). With any
   *  entry the attach control becomes a dropdown; otherwise a plain button. */
  attachMenuItems?: (addFiles: (files: File[]) => void) => TDropdownItems;
  /** the attach control icon (Qonsole uses `AddLine`). */
  attachIcon?: IReqoreIconName;
  /** hide the attach control entirely. */
  hideAttach?: boolean;
  /** Slots: `toolbarStart` sits after attach on the left (e.g. the Qonsole slash
   *  dropdown), `footerActions` after it (e.g. a reference toggle), `rightActions`
   *  left of send (e.g. the Qonsole design button), `aboveInput` on top of the
   *  editor inside the bar (e.g. reference chips), and `belowInput` under the bar. */
  toolbarStart?: ReactNode;
  footerActions?: ReactNode;
  rightActions?: ReactNode;
  aboveInput?: ReactNode;
  belowInput?: ReactNode;
  /** Hooks for consumers layering behaviour on the editor (completions, history). */
  onChange?: (text: string) => void;
  onEditorKeyDown?: (e: ReactKeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** editor sizing */
  size?: ComponentProps<typeof ReqoreTextarea>['size'];
  /** drop the composer's outer margin (for tight embeds). */
  minimal?: boolean;
  /** override the bar's gradient / effect (qorus-ide passes its `custom1` accent to
   *  match the Qonsole floating bar exactly). */
  effect?: TEffect;
}

// The Qonsole input chrome, lifted verbatim from qorus-ide's StyledInputWrapper.
// The border is 1px *transparent* — it only reserves the border-box so the
// `effect` gradient can paint the edge (that's how the Qonsole bar's accent glow
// is drawn — a gradient border, not a border-color). All colour comes from
// `effect` (+ the ambient theme), so the bar takes on whatever accent the app /
// story supplies.
const StyledComposer = styled(StyledEffect)<{ $minimal?: boolean }>`
  margin: ${({ $minimal }) => ($minimal ? '0' : '2px')};
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 6px;
`;

// Layout-neutral ref holder: `display: contents` generates no box, so it gives the
// composer a wrapper element to target paste/drop against without perturbing flow.
const StyledContentsWrapper = styled.div`
  display: contents;
`;

const StyledAttachmentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  // 8px left inset (as in the IDE) so it lines up with the editor text; the 10px
  // bottom gives space before whatever follows (references / editor).
  padding: 8px 8px 10px;
`;

// Content shown on top of the editor (e.g. reference chips) gets the same 8px left
// inset as the attachment strip so both line up with the editor text, not the bar edge.
const StyledAboveInput = styled.div`
  padding-left: 8px;
`;

const StyledAttachment = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledAttachmentImage = styled.img`
  display: block;
  max-height: 80px;
  border-radius: 4px;
  border: 1px solid rgba(123, 104, 238, 0.3);
`;

const StyledAttachmentFile = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid rgba(123, 104, 238, 0.3);
  background: rgba(123, 104, 238, 0.08);
  max-width: 220px;
`;

const StyledAttachmentFilename = styled(ReqoreSpan)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledAttachmentRemoveWrapper = styled.div`
  position: absolute;
  top: -8px;
  right: -8px;
`;

/** The Qonsole bar effect — a `custom1` gradient border over a transparent fill,
 *  exactly like qorus-ide's QonsoleInput. `custom1` resolves per app theme (Qorus
 *  purple in qorus-ide / admin-portal, gray in a bare reqore theme). Override via
 *  the `effect` prop. */
const DEFAULT_EFFECT: TEffect = {
  gradient: { direction: 'to bottom right', colors: 'custom1:darken:1:0.9' },
};

export const Composer = forwardRef<IComposerHandle, IComposerProps>(function Composer(
  {
    editor = 'rich',
    defaultText,
    defaultFiles,
    placeholder = 'Write a message…',
    onSend,
    sendLabel = 'Send',
    sendIcon = 'SendPlane2Line',
    sendIntent,
    sendMinimal = true,
    sendCustomTheme = { main: 'custom1' },
    sendActions,
    sendMenuClassName,
    sending,
    disabled,
    disabledReason = '',
    submitOnEnter = true,
    clearOnSend = true,
    allowEmptySend = false,
    attachMenuItems,
    attachIcon = 'AddLine',
    hideAttach,
    toolbarStart,
    footerActions,
    rightActions,
    aboveInput,
    belowInput,
    onChange,
    onEditorKeyDown,
    onFocus,
    onBlur,
    size = 'small',
    minimal,
    effect = DEFAULT_EFFECT,
  },
  ref
) {
  const theme = useReqoreTheme();
  const [richValue, setRichValue] = useState<IReqoreRichTextEditorProps['value']>(() =>
    defaultText ? richValueFromString(defaultText) : EMPTY_RICH_VALUE
  );
  const [plainValue, setPlainValue] = useState(defaultText ?? '');
  const [files, setFiles] = useState<File[]>(() => defaultFiles ?? []);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Image thumbnails for the preview strip; object URLs revoked on change/unmount.
  useEffect(() => {
    const urls = files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : ''));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  const getText = (): string =>
    editor === 'rich' ? richValueToString(richValue) : plainValue;
  const setText = (text: string): void => {
    if (editor === 'rich') {
      setRichValue(richValueFromString(text));
    } else {
      setPlainValue(text);
    }
  };

  useImperativeHandle(
    ref,
    (): IComposerHandle => ({
      focus: () =>
        wrapperRef.current
          ?.querySelector<HTMLElement>('[contenteditable="true"], textarea')
          ?.focus(),
      clear: () => setText(''),
      setText,
      getText,
    }),
    [editor, richValue, plainValue]
  );

  // Every send action inherits the composer's send style (the Qonsole look by
  // default) so a split-send stays visually of a piece with the single button —
  // unless the action picks its own. The accent is only defaulted when the action
  // hasn't chosen an `intent`, since in Reqore an intent owns the colour and would
  // otherwise fight the `customTheme`.
  const withSendStyle = (action: IComposerSendAction): IComposerSendAction => ({
    minimal: sendMinimal,
    ...(action.intent ? undefined : { customTheme: sendCustomTheme }),
    ...action,
  });

  const actions: IComposerSendAction[] = sendActions?.length
    ? sendActions.map(withSendStyle)
    : [withSendStyle({ id: undefined, label: sendLabel, icon: sendIcon, intent: sendIntent })];
  const primary = actions[0];
  const isSplit = actions.length > 1;

  const addFiles = (incoming: File[]): void => {
    if (incoming.length) {
      setFiles((prev) => [...prev, ...incoming]);
    }
  };
  const removeFile = (index: number): void =>
    setFiles((prev) => prev.filter((_, j) => j !== index));

  const handlePaste = (event: ReactClipboardEvent): void => {
    const images = clipboardImages(event);
    if (images.length) {
      event.preventDefault();
      addFiles(images);
    }
  };

  const text = getText();
  const canSend = (allowEmptySend || !!text.trim() || files.length > 0) && !sending;

  const handleSend = async (actionId?: string): Promise<void> => {
    const body = getText();
    if (!canSend) {
      return;
    }
    await onSend(clearOnSend ? body.trim() : body, { files, action: actionId });
    if (clearOnSend) {
      setText('');
      setFiles([]);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent): void => {
    onEditorKeyDown?.(e);
    if (submitOnEnter && isPlainSubmitEnter(e)) {
      e.preventDefault();
      void handleSend(primary.id);
    }
  };

  if (disabled) {
    /* A callout, not a message. This stands in for the composer itself — it is
       the thing the reader meets where they expected somewhere to type — and a
       ReqoreMessage draws that as a notification bar, which reads as something
       having gone wrong rather than as "this conversation is closed". */
    return (
      <ReqoreCallout intent='muted' icon='LockLine' size='small' flat rounded={false}>
        {disabledReason}
      </ReqoreCallout>
    );
  }

  const extraAttachItems = attachMenuItems ? attachMenuItems(addFiles) : [];

  // Icon-only when `label` is omitted; `customTheme`/`minimal` let a caller match
  // the Qonsole accent send (minimal, custom1-themed) or any other look.
  const sendButton = (action: IComposerSendAction) => (
    <ReqoreButton
      icon={action.icon}
      intent={action.intent}
      customTheme={action.customTheme}
      minimal={action.minimal}
      size={size}
      disabled={!canSend}
      loading={sending}
      flat
      onClick={() => handleSend(action.id)}
      fixed={!isSplit}
    >
      {action.label}
    </ReqoreButton>
  );

  return (
    <StyledContentsWrapper ref={wrapperRef}>
      <StyledComposer
        as='div'
        theme={theme}
        $minimal={minimal}
        // transparent fill (like QonsoleInput) → the page shows through and only
        // the effect's gradient *border* glows; `minimal` opts into a solid fill.
        transparent={!minimal}
        effect={effect}
        onPaste={handlePaste}
      >
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
        {files.length > 0 && (
          <StyledAttachmentList>
            {files.map((file, index) => (
              <StyledAttachment key={`${file.name}-${index}`}>
                {previews[index] ? (
                  <StyledAttachmentImage src={previews[index]} alt={file.name} />
                ) : (
                  <StyledAttachmentFile title={file.name}>
                    <ReqoreIcon icon='FileLine' size='small' />
                    <StyledAttachmentFilename size='small'>{file.name}</StyledAttachmentFilename>
                  </StyledAttachmentFile>
                )}
                <StyledAttachmentRemoveWrapper>
                  <ReqoreButton
                    icon='CloseLine'
                    size='micro'
                    leftIconProps={{ size: 'tiny' }}
                    circle
                    onClick={() => removeFile(index)}
                    tooltip='Remove attachment'
                  />
                </StyledAttachmentRemoveWrapper>
              </StyledAttachment>
            ))}
          </StyledAttachmentList>
        )}
        <ReqoreControlGroup vertical fluid>
          {aboveInput && <StyledAboveInput>{aboveInput}</StyledAboveInput>}
          <ReqoreControlGroup fluid verticalAlign='center' size='small'>
            {editor === 'rich' ? (
              <ReqoreRichTextEditor
                value={richValue}
                panelProps={{ fluid: true }}
                onChange={(value) => {
                  setRichValue(value);
                  onChange?.(richValueToString(value));
                }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={sending}
                transparent
                flat
                fluid
                size={size}
                actions={{ styling: false, undo: false, redo: false }}
                onClearClick={text ? () => setText('') : undefined}
              />
            ) : (
              <ReqoreTextarea
                value={plainValue}
                scaleWithContent
                fluid
                transparent
                flat
                size={size}
                placeholder={placeholder}
                disabled={sending}
                onChange={(e: ReactChangeEvent<HTMLTextAreaElement>) => {
                  setPlainValue(e.target.value);
                  onChange?.(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            )}
          </ReqoreControlGroup>
          <ReqoreControlGroup fluid size='small' spaceBetween verticalAlign='center'>
            <ReqoreControlGroup stack fluid={false} size='small' verticalAlign='center'>
              {!hideAttach &&
                (extraAttachItems.length ? (
                  <ReqoreDropdown
                    icon={attachIcon}
                    flat
                    transparent
                    disabled={sending}
                    tooltip='Attach'
                    items={[
                      {
                        label: 'Upload files',
                        icon: 'Upload2Line',
                        onClick: () => fileInput.current?.click(),
                      },
                      ...extraAttachItems,
                    ]}
                  />
                ) : (
                  <ReqoreButton
                    icon={attachIcon}
                    flat
                    transparent
                    disabled={sending}
                    tooltip='Attach files'
                    onClick={() => fileInput.current?.click()}
                  />
                ))}
              {toolbarStart}
              {footerActions}
            </ReqoreControlGroup>
            <ReqoreControlGroup stack fluid={false} size='small'>
              {rightActions}
              {isSplit ? (
                <>
                  {sendButton(primary)}
                  <ReqoreDropdown
                    className={sendMenuClassName}
                    icon='ArrowDownSLine'
                    intent={primary.intent}
                    customTheme={primary.customTheme}
                    minimal={primary.minimal}
                    disabled={!canSend}
                    tooltip='More send options'
                    items={actions.map((action) => ({
                      label: action.label,
                      icon: action.icon,
                      intent: action.intent,
                      onClick: () => handleSend(action.id),
                    }))}
                  />
                </>
              ) : (
                sendButton(primary)
              )}
            </ReqoreControlGroup>
          </ReqoreControlGroup>
        </ReqoreControlGroup>
      </StyledComposer>
      {belowInput}
    </StyledContentsWrapper>
  );
});
