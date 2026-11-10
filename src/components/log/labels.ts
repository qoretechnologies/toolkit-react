// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The words of the log and of the connection lines it shows. A host that translates its interface gives its own
 * (`setReqraftLabels`); the rest stay English. A log's own props (`copyMessageNotificationContent`, …) come first.
 */
export interface ILogLabels {
  /** The notification after a message is copied, and after it could not be. */
  copied: string;
  copyFailed: string;
  scrollToBottom: string;
  filterMessages: string;
  pause: string;
  resume: string;
  clear: string;
  noMessages: string;
  sendMessage: string;
  /** The lines a connection adds to the log as it opens, closes, fails and tries again (`attempt` counts from 1). */
  connectionOpened: string;
  connectionClosed: string;
  connectionError: string;
  reconnecting: (attempt: number) => string;
  reconnectFailed: string;
}

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_LOG_LABELS: ILogLabels = {
  copied: 'Log message copied to clipboard',
  copyFailed:
    'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.',
  scrollToBottom: 'Scroll to bottom',
  filterMessages: 'Filter messages',
  pause: 'Pause',
  resume: 'Resume',
  clear: 'Clear log',
  noMessages: 'No messages',
  sendMessage: 'Send a message',
  connectionOpened: 'Connection opened',
  connectionClosed: 'Connection closed',
  connectionError: 'Connection error',
  reconnecting: (attempt) => `Reconnecting... Attempt ${attempt}`,
  reconnectFailed: 'Reconnect failed',
};
