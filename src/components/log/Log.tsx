import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreInput,
  ReqoreParagraph,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqorePanelProps, ReqorePanel } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreParagraphProps } from '@qoretechnologies/reqore/dist/components/Paragraph';
import count from 'lodash/size';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScroll } from 'react-use';
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

  return (
    <ReqorePanel
      size={size}
      flat
      getContentRef={setContentRef}
      {...panelProps}
      icon='CheckboxBlankCircleFill'
      iconColor={
        status === 'CLOSED' ? 'danger'
        : status === 'CONNECTING' ?
          'pending'
        : status === 'PAUSED' ?
          'warning'
        : 'success'
      }
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
      <ReqoreControlGroup vertical fluid size={size}>
        {count(filteredMessages) === 0 ?
          <ReqoreParagraph size={size} style={{ fontFamily: 'monospace' }}>
            No messages
          </ReqoreParagraph>
        : null}
        {filteredMessages.map(({ message, timestamp, ...paragraphProps }, index) => (
          <ReqoreControlGroup spaceBetween key={index}>
            <ReqoreControlGroup>
              {showTimestamps && (
                <ReqoreParagraph
                  size={size}
                  style={{ fontFamily: 'monospace', flexShrink: 0 }}
                  customTheme={{ text: { color: 'main:lighten:8' } }}
                >
                  {timestamp}
                </ReqoreParagraph>
              )}
              <ReqoreParagraph
                size={size}
                key={index}
                onClick={onMessageClick ? () => handleMessageClick(message) : undefined}
                style={{ fontFamily: 'monospace' }}
                className='reqraft-log-message'
                {...paragraphProps}
              >
                {message}
              </ReqoreParagraph>
            </ReqoreControlGroup>
            <ReqoreControlGroup stack fixed>
              {allowMessageCopy && (
                <ReqoreButton
                  compact
                  onClick={() => {
                    navigator.clipboard.writeText(message);
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
          </ReqoreControlGroup>
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
      </ReqoreControlGroup>
    </ReqorePanel>
  );
};
