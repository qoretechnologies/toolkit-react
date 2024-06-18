import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { IReqorePanelProps, ReqorePanel } from '@qoretechnologies/reqore/dist/components/Panel';
import ReqoreTag, { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { useCallback, useMemo } from 'react';
import {
  IUseReqraftWebSocketOptions,
  useReqraftWebSocket,
} from '../../hooks/useWebSocket/useWebSocket';

export interface IReqraftLogMessage extends IReqoreTagProps {
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
  ...panelProps
}: IReqraftLogProps) => {
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      onMessage?.(event.data);
    },
    [onMessage]
  );

  const { messages, removeMessage } = useReqraftWebSocket(
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
    <ReqorePanel {...panelProps}>
      <ReqoreControlGroup vertical fluid size={panelProps.size}>
        {_messages.map(({ message, ...tagProps }, index) => (
          <ReqoreTag
            key={index}
            minimal
            label={message}
            wrap
            onClick={onMessageClick ? () => handleMessageClick(message) : undefined}
            {...tagProps}
            actions={[
              { icon: 'DeleteBin2Fill', show: 'hover', onClick: () => removeMessage(index) },
              ...(tagProps.actions || []),
            ]}
          />
        ))}
      </ReqoreControlGroup>
    </ReqorePanel>
  );
};
