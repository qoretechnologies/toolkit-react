import { useState } from 'react';
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
  addMessage: (message: string) => void;
}

export enum ReqraftWebSocketStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CONNECTING = 'CONNECTING',
}

export const useReqraftWebSocket = (options: IUseReqraftWebSocketOptions): IUseReqraftWebSocket => {
  const [messages, setMessages] = useState<string[]>([]);
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

  const open = () => {
    const socket = new ReqraftWebSocket({
      ...options,
      onOpen: handleOpen,
      onMessage: (ev) => {
        if (options?.useState) {
          setMessages((prev) => [...prev, ev.data]);
        }

        options?.onMessage?.(ev);
      },
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

  return { messages, status, open, socket, close, send, clear, on, addMessage };
};
