import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreInput,
  ReqoreParagraph,
} from '@qoretechnologies/reqore';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { IReqorePanelProps, ReqorePanel } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreParagraphProps } from '@qoretechnologies/reqore/dist/components/Paragraph';
import count from 'lodash/size';
import { useCallback, useMemo, useState } from 'react';
import {
  IUseReqraftWebSocketOptions,
  useReqraftWebSocket,
} from '../../hooks/useWebSocket/useWebSocket';

export interface IReqraftLogMessage extends IReqoreParagraphProps {
  message: string;
}

export interface IReqraftLogProps extends IReqorePanelProps {
  url: string;
  autoScroll?: boolean;
  allowMessageDeletion?: boolean;
  showTimestamps?: boolean;
  defaultMessages?: string[];

  filterable?: boolean;
  filterProps?: IReqoreInputProps;

  onConnect?: () => void;
  onMessage?: (message: string[]) => void;
  onMessageClick?: (message: string) => void;
  onDisconnect?: () => void;
  onConnectionError?: (error: Event) => void;

  messageFormatter?: (message: string) => IReqraftLogMessage;

  socketOptions?: Omit<IUseReqraftWebSocketOptions, 'url'>;
}

export const ReqraftLog = ({
  url,
  defaultMessages,
  autoScroll,
  allowMessageDeletion,
  showTimestamps,
  filterable,
  filterProps,
  onConnect,
  onMessage,
  onMessageClick,
  onDisconnect,
  onConnectionError,
  messageFormatter = (message) => ({ message }),
  socketOptions,
  size = 'small',
  ...panelProps
}: IReqraftLogProps) => {
  const [query, setQuery] = useState<string>('');
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      onMessage?.(event.data);
    },
    [onMessage]
  );

  const { messages, status, clear, removeMessage, pause, resume } = useReqraftWebSocket(
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

  const handleMessageClick = (message: string) => {
    onMessageClick?.(message);
  };

  return (
    <ReqorePanel
      size={size}
      flat
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
          icon: status === 'PAUSED' ? 'PlayLine' : 'PauseFill',
          onClick: status === 'PAUSED' ? resume : pause,
          tooltip: status === 'PAUSED' ? 'Resume' : 'Pause',
          intent: status === 'PAUSED' ? 'warning' : 'success',
        },
        {
          icon: 'DeleteBinLine',
          onClick: clear,
          tooltip: 'Clear log',
        },
      ]}
    >
      <ReqoreControlGroup vertical fluid size={size}>
        {filterable && (
          <ReqoreInput
            size={size}
            icon='SearchLine'
            {...filterProps}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {count(filteredMessages) === 0 ?
          <ReqoreParagraph size={size} style={{ fontFamily: 'monospace' }}>
            No messages
          </ReqoreParagraph>
        : null}
        {filteredMessages.map(({ message, ...paragraphProps }, index) => (
          <ReqoreControlGroup spaceBetween key={index}>
            <ReqoreParagraph
              size={size}
              key={index}
              onClick={onMessageClick ? () => handleMessageClick(message) : undefined}
              style={{ fontFamily: 'monospace' }}
              {...paragraphProps}
            >
              {message}
            </ReqoreParagraph>
            {allowMessageDeletion && (
              <ReqoreButton
                onClick={() => removeMessage(index)}
                icon='DeleteBinLine'
                fixed
                minimal
                size={size}
                flat
              />
            )}
          </ReqoreControlGroup>
        ))}
      </ReqoreControlGroup>
    </ReqorePanel>
  );
};
