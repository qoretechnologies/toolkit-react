import { ReqoreButton, ReqoreControlGroup, ReqoreParagraph } from '@qoretechnologies/reqore';
import { IReqorePanelProps, ReqorePanel } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreParagraphProps } from '@qoretechnologies/reqore/dist/components/Paragraph';
import { useCallback, useMemo } from 'react';
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
  defaultMessages?: string[];

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
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      onMessage?.(event.data);
    },
    [onMessage]
  );

  const { messages, status, removeMessage } = useReqraftWebSocket(
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

  const _messages = useMemo(
    () => messages.map((message) => messageFormatter(message)),
    [messages, messageFormatter]
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
        : 'success'
      }
    >
      <ReqoreControlGroup vertical fluid size={size}>
        {_messages.map(({ message, ...paragraphProps }, index) => (
          <ReqoreControlGroup spaceBetween>
            <ReqoreParagraph
              size={size}
              key={index}
              onClick={onMessageClick ? () => handleMessageClick(message) : undefined}
              style={{ fontFamily: 'monospace' }}
              {...paragraphProps}
            >
              {message}
            </ReqoreParagraph>
            <ReqoreButton
              onClick={() => removeMessage(index)}
              icon='DeleteBinLine'
              fixed
              minimal
              size={size}
              flat
            />
          </ReqoreControlGroup>
        ))}
      </ReqoreControlGroup>
    </ReqorePanel>
  );
};
