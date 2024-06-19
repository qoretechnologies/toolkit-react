import { useCallback, useEffect, useState } from 'react';
import { useEffectOnce, useUnmount } from 'react-use';
import { IReqraftWebSocketConfig, ReqraftWebSocket } from '../../utils/websocket';

export interface IUseReqraftWebSocketOptions extends IReqraftWebSocketConfig {
  onMessage?: (ev: MessageEvent) => void;
  useState?: boolean;
  includeSentMessagesInState?: boolean;
  includeLogMessagesInState?: boolean;
  openOnMount?: boolean;
  closeOnUnmount?: boolean;
}

export interface IUseReqraftWebSocket {
  messages: string[];
  status: keyof typeof ReqraftWebSocketStatus;
  open: () => void;
  close: () => void;
  socket: ReqraftWebSocket;
  send: (data: string) => void;
  clear: () => void;
  on: (type: keyof WebSocketEventMap, handler: (ev: Event) => void) => void;
  pause: () => void;
  resume: () => void;
  addMessage: (message: string) => void;
  removeMessage: (index: number) => void;
}

export enum ReqraftWebSocketStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CONNECTING = 'CONNECTING',
  PAUSED = 'PAUSED',
}

export const useReqraftWebSocket = (
  options: IUseReqraftWebSocketOptions,
  defaultMessages: string[] = []
): IUseReqraftWebSocket => {
  const [messages, setMessages] = useState<string[]>(defaultMessages);
  const [status, setStatus] = useState<keyof typeof ReqraftWebSocketStatus>('CLOSED');
  const [socket, setSocket] = useState<ReqraftWebSocket>(undefined);

  const updateStates = (status: keyof typeof ReqraftWebSocketStatus, log?: string) => {
    setStatus(status);

    if (log && options?.includeLogMessagesInState && options?.useState) {
      setMessages((prev) => [...prev, log]);
    }
  };

  const handleOpen = (ev?: Event) => {
    updateStates(ReqraftWebSocketStatus.OPEN, 'Connection opened');

    options?.onOpen?.(ev);
  };

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      if (ev.data === 'pong') {
        return;
      }

      if (options?.useState && status === ReqraftWebSocketStatus.OPEN) {
        setMessages((prev) => [...prev, ev.data]);
      }

      options?.onMessage?.(ev);
    },
    [options?.useState, options?.onMessage, status]
  );

  // Add the message event handler inside the useEffect
  // because we need to be able to access the up to data state
  // of the messages array
  useEffect(() => {
    const id = socket?.addHandler('message', handleMessage as any);

    console.log(id);

    return () => {
      socket?.removeHandler(id);
    };
  }, [socket, handleMessage]);

  const open = () => {
    const socket = new ReqraftWebSocket({
      ...options,
      onOpen: handleOpen,
      onClose: (...args) => {
        updateStates(ReqraftWebSocketStatus.CLOSED, 'Connection closed');

        options?.onClose?.(...args);
      },
      onError: (...args) => {
        updateStates(ReqraftWebSocketStatus.CLOSED, 'Connection error');

        options?.onError?.(...args);
      },
      onReconnecting: (reconnectNumber) => {
        updateStates(
          ReqraftWebSocketStatus.CONNECTING,
          `Reconnecting... Attempt ${reconnectNumber}`
        );

        options?.onReconnecting?.(reconnectNumber);
      },
      onReconnectFailed: () => {
        updateStates(ReqraftWebSocketStatus.CLOSED, 'Reconnect failed');

        options?.onReconnectFailed?.();
      },
    });

    setSocket(socket);
  };

  const close = () => {
    socket?.remove();
    setSocket(undefined);
    setStatus(ReqraftWebSocketStatus.CLOSED);
  };

  const send = (data: string) => {
    if (status !== ReqraftWebSocketStatus.OPEN) {
      return;
    }

    socket?.send(data);

    if (options?.includeSentMessagesInState) {
      setMessages((prev) => [...prev, data]);
    }
  };

  const on = (type: keyof WebSocketEventMap, handler: (ev: Event) => void) => {
    // Special case for message event
    // We want to handle it differently
    // We want to filter out the ping messages
    if (type === 'message') {
      socket?.addHandler('message', (ev) => {
        if ((<MessageEvent>ev).data === 'pong') {
          return;
        }

        handler(ev);
      });

      return;
    }

    socket?.addHandler(type, handler);
  };

  const clear = () => {
    setMessages([]);
  };

  const addMessage = (message: string) => {
    if (options?.useState) {
      setMessages((prev) => [...prev, message]);
    }
  };

  const removeMessage = (index: number) => {
    if (options?.useState) {
      setMessages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const pause = () => {
    setStatus(ReqraftWebSocketStatus.PAUSED);
  };

  const resume = () => {
    if (socket?.socket.OPEN) {
      setStatus(ReqraftWebSocketStatus.OPEN);
    } else if (socket?.socket.CONNECTING) {
      setStatus(ReqraftWebSocketStatus.CONNECTING);
    } else {
      setStatus(ReqraftWebSocketStatus.CLOSED);
    }
  };

  useEffectOnce(() => {
    if (options?.openOnMount) {
      open();
    }
  });

  useUnmount(() => {
    if (options?.closeOnUnmount) {
      close();
    }
  });

  return {
    messages,
    status,
    open,
    socket,
    close,
    send,
    clear,
    on,
    addMessage,
    removeMessage,
    pause,
    resume,
  };
};
