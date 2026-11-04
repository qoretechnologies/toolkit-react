import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreFonts,
  ReqoreInput,
  ReqoreParagraph,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqorePanelProps, ReqorePanel } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreParagraphProps } from '@qoretechnologies/reqore/dist/components/Paragraph';
import { SIZE_TO_PX, TEXT_FROM_SIZE } from '@qoretechnologies/reqore/dist/constants/sizes';
import count from 'lodash/size';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useScroll } from 'react-use';
import styled from 'styled-components';
import { READABLE_ICON } from '../../helpers/readableColors';
import { copyText } from '../../helpers/secureContextApis';
import { useReadableIntentShade } from '../../hooks/useReadableIntentShade';
import { useReadableOpacity } from '../../hooks/useReadableOpacity';

/** How faded reqore draws a panel's title icon. */
const PANEL_TITLE_ICON_ALPHA = 0.7;

/**
 * The list of messages. A button is higher than a line, so the actions of the first and the last row reach past the
 * list: the first's were cut off, and the last's made the panel scroll by those few pixels, with a scrollbar and a
 * "Scroll to bottom" action in a log that has nothing to scroll to. The list keeps that much room at both of its ends
 * (`--reqraft-log-actions-overhang`). On a touch screen the actions are in their rows and reach past nothing.
 */
const StyledLogList = styled(ReqoreControlGroup)`
  padding-block: var(--reqraft-log-actions-overhang, 0);

  @media (hover: none), (pointer: coarse) {
    padding-block: 0;
  }
`;

/**
 * A message's row. Its copy and delete actions are buttons (32 px at the log's small size) beside a line of text
 * (14 px), so in the row's flow they made every row as high as a button, and a log whose messages could be copied
 * read with a blank line's worth of space between its lines. With a mouse the actions are drawn over the row's end
 * instead, out of its flow, and shown only while the pointer is on the row or a key has moved into it
 * (`:focus-within`, so they are still reached with Tab); the row keeps the width they take free
 * (`--reqraft-log-actions-width`, set on the list), so a long message wraps before them and never runs under them. A touch screen
 * has no hover: there the actions stay in the row, always shown, as big as a finger needs.
 *
 * The row's own control group, styled - not a wrapper inside it: a control group hands its size to its children.
 */
const StyledLogRow = styled(ReqoreControlGroup)`
  position: relative;

  > .reqraft-log-message-content {
    padding-right: var(--reqraft-log-actions-width, 0);
  }

  > .reqraft-log-message-actions {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    pointer-events: none;
  }

  &:hover > .reqraft-log-message-actions,
  &:focus-within > .reqraft-log-message-actions {
    opacity: 1;
    pointer-events: auto;
  }

  @media (hover: none), (pointer: coarse) {
    > .reqraft-log-message-content {
      padding-right: 0;
    }

    > .reqraft-log-message-actions {
      position: static;
      transform: none;
      opacity: 1;
      pointer-events: auto;
    }
  }
`;
import {
  IReqraftWebSocketMessage,
  IUseReqraftWebSocketOptions,
  useReqraftWebSocket,
} from '../../hooks/useWebSocket/useWebSocket';

export interface IReqraftLogMessage extends IReqoreParagraphProps {
  message: string;
  timestamp?: string;
}

export interface IReqraftLogProps extends IReqorePanelProps {
  url: string;
  autoScroll?: boolean;

  allowMessageDeletion?: boolean;
  allowMessageCopy?: boolean;
  /** Notification shown after a message was copied. @default 'Log message copied to clipboard' */
  copyMessageNotificationContent?: string;
  /**
   * Notification shown when a message could not be copied (the browser refused, or offers no way to copy, as on a
   * page served over plain http that does not allow the copy command): what failed and what to do instead. It stays
   * until it is closed.
   * @default 'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.'
   */
  copyMessageFailedNotificationContent?: string;

  showTimestamps?: boolean;

  defaultMessages?: IReqraftWebSocketMessage[];
  canSendMessages?: boolean;
  sendMessageProps?: IReqoreInputProps;
  sendButtonProps?: IReqoreButtonProps;

  filterable?: boolean;
  filterProps?: IReqoreInputProps;

  onConnect?: () => void;
  onMessage?: (message: string[]) => void;
  onMessageClick?: (message: string) => void;
  onDisconnect?: () => void;
  onConnectionError?: (error: Event) => void;

  messageFormatter?: (message: IReqraftWebSocketMessage) => IReqraftLogMessage;

  socketOptions?: Omit<IUseReqraftWebSocketOptions, 'url'>;
}

export const ReqraftLog = ({
  url,
  defaultMessages,
  autoScroll,
  allowMessageDeletion,
  allowMessageCopy,
  copyMessageNotificationContent = 'Log message copied to clipboard',
  copyMessageFailedNotificationContent = 'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.',
  filterable,
  filterProps,
  showTimestamps,
  canSendMessages,
  sendMessageProps,
  sendButtonProps,
  onConnect,
  onMessage,
  onMessageClick,
  onDisconnect,
  onConnectionError,
  messageFormatter = (message) => message,
  socketOptions,
  size = 'small',
  ...panelProps
}: IReqraftLogProps) => {
  // a message's time, softer than the message: as soft as it still reads (main:lighten:8 was 2.6:1; qorus#646)
  const timestampOpacity = useReadableOpacity(0.35);
  const [query, setQuery] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [contentRef, setContentRef] = useState<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState<boolean>(autoScroll);

  useScroll;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      onMessage?.(event.data);
    },
    [onMessage]
  );

  const { messages, status, clear, removeMessage, pause, resume, send } = useReqraftWebSocket(
    {
      url,
      onOpen: onConnect,
      onMessage: handleMessage,
      onClose: onDisconnect,
      onError: onConnectionError,
      useState: true,
      includeLogMessagesInState: true,
      includeSentMessagesInState: true,
      ...socketOptions,
    },
    defaultMessages
  );
  /* the connection's state, as a dot in the title: its intent in a shade that stands out where reqore draws a
     panel's title icon, at 70% (the success green was 2.1:1) */
  const statusColor = useReadableIntentShade(
    status === 'CLOSED' ? 'danger'
    : status === 'CONNECTING' ? 'pending'
    : status === 'PAUSED' ? 'warning'
    : 'success',
    READABLE_ICON,
    PANEL_TITLE_ICON_ALPHA
  );

  const filteredMessages = useMemo(
    () =>
      messages
        .map((message) => messageFormatter(message))
        .filter(({ message }) =>
          query ? message.toLowerCase().includes(query.toLowerCase()) : true
        ),
    [messages, messageFormatter, query]
  );

  const handleManualScroll = () => {
    if (contentRef) {
      setShouldAutoScroll(
        contentRef.scrollHeight - contentRef.scrollTop === contentRef.clientHeight
      );
    }
  };

  useEffect(() => {
    if (contentRef) {
      contentRef.addEventListener('scroll', handleManualScroll);
    }

    return () => {
      if (contentRef) {
        contentRef.removeEventListener('scroll', handleManualScroll);
      }
    };
  }, [contentRef]);

  useEffect(() => {
    if (shouldAutoScroll && contentRef) {
      contentRef.scrollTop = contentRef.scrollHeight;
    }
  }, [messages, contentRef, shouldAutoScroll]);

  const handleMessageClick = (message: string) => {
    onMessageClick?.(message);
  };

  const addNotification = useReqoreProperty('addNotification');
  // the actions a message's row has: the width the row keeps free for them
  const actionCount = (allowMessageCopy ? 1 : 0) + (allowMessageDeletion ? 1 : 0);
  const listStyle = useMemo(
    () =>
      actionCount ?
        ({
          '--reqraft-log-actions-width': `${actionCount * SIZE_TO_PX[size]}px`,
          // half of what a button is higher than a line, which is at least as high as its font
          '--reqraft-log-actions-overhang': `${Math.ceil((SIZE_TO_PX[size] - TEXT_FROM_SIZE[size]) / 2)}px`,
        } as CSSProperties)
      : undefined,
    [actionCount, size]
  );

  // Copying can be refused (permissions, a page served over plain http): the
  // failure is shown, and says what to do, instead of an unhandled rejection.
  const handleCopyClick = useCallback(
    async (text: string) => {
      try {
        await copyText(text);
      } catch {
        addNotification({
          content: copyMessageFailedNotificationContent,
          intent: 'danger',
        });
        return;
      }
      addNotification({
        content: copyMessageNotificationContent,
        intent: 'success',
        duration: 3000,
      });
    },
    [addNotification, copyMessageNotificationContent, copyMessageFailedNotificationContent]
  );

  return (
    <ReqorePanel
      size={size}
      flat
      getContentRef={setContentRef}
      /* The filter, Pause and Clear stay in the title bar at every width. Responsive, the bar folded
         whatever did not fit into a menu: on a phone that was the filter, which no one would look for
         behind a menu button. Unfolded, the title is what gives way. */
      responsiveActions={false}
      {...panelProps}
      icon='CheckboxBlankCircleFill'
      iconColor={statusColor}
      actions={[
        {
          icon: 'ArrowDownLine',
          onClick: () => {
            if (contentRef) {
              contentRef.scrollTop = contentRef.scrollHeight;
            }
          },
          show:
            contentRef &&
            contentRef.scrollHeight - contentRef.scrollTop !== contentRef.clientHeight,
          tooltip: 'Scroll to bottom',
          className: 'reqraft-log-scroll-to-bottom',
        },
        {
          as: ReqoreInput,
          show: !!filterable,
          props: {
            icon: 'SearchLine',
            placeholder: 'Filter messages',
            ...filterProps,
            value: query,
            onChange: (e) => setQuery(e.target.value),
            onClearClick: () => setQuery(''),
            intent: query ? 'info' : undefined,
          },
        },
        {
          icon: status === 'PAUSED' ? 'PlayLine' : 'PauseFill',
          onClick: status === 'PAUSED' ? resume : pause,
          tooltip: status === 'PAUSED' ? 'Resume' : 'Pause',
          intent: status === 'PAUSED' ? 'warning' : 'success',
          className: 'reqraft-log-pause-resume',
        },
        {
          icon: 'DeleteBinLine',
          onClick: clear,
          tooltip: 'Clear log',
          className: 'reqraft-log-clear',
        },
      ]}
    >
      <StyledLogList vertical fluid size={size} style={listStyle}>
        {count(filteredMessages) === 0 ?
          <ReqoreParagraph size={size} style={{ fontFamily: ReqoreFonts.mono }}>
            No messages
          </ReqoreParagraph>
        : null}
        {filteredMessages.map(({ message, timestamp, ...paragraphProps }, index) => (
          <StyledLogRow spaceBetween key={index} className='reqraft-log-row'>
            <ReqoreControlGroup className='reqraft-log-message-content'>
              {showTimestamps && (
                <ReqoreParagraph
                  size={size}
                  style={{ fontFamily: ReqoreFonts.mono, flexShrink: 0 }}
                  effect={{ opacity: timestampOpacity }}
                >
                  {timestamp}
                </ReqoreParagraph>
              )}
              <ReqoreParagraph
                size={size}
                key={index}
                onClick={onMessageClick ? () => handleMessageClick(message) : undefined}
                style={{ fontFamily: ReqoreFonts.mono }}
                className='reqraft-log-message'
                {...paragraphProps}
              >
                {message}
              </ReqoreParagraph>
            </ReqoreControlGroup>
            {actionCount ?
              <ReqoreControlGroup stack fixed className='reqraft-log-message-actions'>
                {allowMessageCopy && (
                  <ReqoreButton
                    compact
                    onClick={() => {
                      handleCopyClick(message);
                    }}
                    icon='FileCopyLine'
                    className='reqraft-log-copy-message'
                    fixed
                    minimal
                    size={size}
                    flat
                  />
                )}
                {allowMessageDeletion && (
                  <ReqoreButton
                    compact
                    onClick={() => removeMessage(index)}
                    icon='DeleteBinLine'
                    className='reqraft-log-delete-message'
                    fixed
                    minimal
                    size={size}
                    flat
                  />
                )}
              </ReqoreControlGroup>
            : null}
          </StyledLogRow>
        ))}
        {canSendMessages && status === 'OPEN' ?
          <ReqoreControlGroup>
            <ReqoreInput
              size={size}
              placeholder='Send a message'
              icon='SendPlaneLine'
              {...sendMessageProps}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <ReqoreButton
              fixed
              disabled={!message}
              onClick={() => {
                send(message);
                setMessage('');
              }}
              icon='SendPlaneLine'
              intent='success'
              {...sendButtonProps}
            />
          </ReqoreControlGroup>
        : null}
      </StyledLogList>
    </ReqorePanel>
  );
};
