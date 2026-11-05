// Copyright 2026 Qore Technologies, s.r.o.

/** The words of the smaller components: composer, log, image lightbox, menu, descriptions and simple fields. */
export interface IComponentLabels {
  allowedValues: string;
  suggestedValues: string;
  value: string;
  name: string;
  description: string;
  aboutX: (name: unknown) => string;
  focusedEditing: string;
  writeAMessage: string;
  send: string;
  removeAttachment: string;
  attach: string;
  uploadFiles: string;
  attachFiles: string;
  moreSendOptions: string;
  previous: string;
  next: string;
  rename: string;
  download: string;
  previewUnavailableUseDownload: string;
  loading: string;
  logMessageCopiedToClipboard: string;
  couldNotCopyTheLogMessage: string;
  scrollToBottom: string;
  filterMessages: string;
  resume: string;
  pause: string;
  clearLog: string;
  noMessages: string;
  sendAMessage: string;
  filterMenuX: (inputFocusShortcut: unknown) => string;
  base64EncodedBinaryValue: string;
  yes: string;
  no: string;
  preview: string;
  savedSuggestedValues: string;
  selectOne: string;
  connectionOpened: string;
  connectionClosed: string;
  connectionError: string;
  reconnectFailed: string;
  reconnecting: (attempt: unknown) => string;
  browseAllDocumentation: string;
  clipboardRefused: string;
  typeBool: string;
  typeDate: string;
  typeString: string;
  typeBinary: string;
  typeFloat: string;
  typeList: string;
  typeHash: string;
  typeInt: string;
  typeColor: string;
}

/** The English words. */
export const DEFAULT_COMPONENT_LABELS: IComponentLabels = {
  allowedValues: 'Allowed values',
  suggestedValues: 'Suggested values',
  value: 'Value',
  name: 'Name',
  description: 'Description',
  aboutX: (name) => `About ${name}`,
  focusedEditing: 'Focused Editing',
  writeAMessage: 'Write a message…',
  send: 'Send',
  removeAttachment: 'Remove attachment',
  attach: 'Attach',
  uploadFiles: 'Upload files',
  attachFiles: 'Attach files',
  moreSendOptions: 'More send options',
  previous: 'Previous',
  next: 'Next',
  rename: 'Rename',
  download: 'Download',
  previewUnavailableUseDownload: 'Preview unavailable — use Download.',
  loading: 'Loading…',
  logMessageCopiedToClipboard: 'Log message copied to clipboard',
  couldNotCopyTheLogMessage:
    'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.',
  scrollToBottom: 'Scroll to bottom',
  filterMessages: 'Filter messages',
  resume: 'Resume',
  pause: 'Pause',
  clearLog: 'Clear log',
  noMessages: 'No messages',
  sendAMessage: 'Send a message',
  filterMenuX: (inputFocusShortcut) => `Filter menu "${inputFocusShortcut}"`,
  base64EncodedBinaryValue: 'Base64-encoded binary value',
  yes: 'Yes',
  no: 'No',
  preview: 'Preview',
  savedSuggestedValues: 'Saved & Suggested Values',
  selectOne: 'Select one:',
  connectionOpened: 'Connection opened',
  connectionClosed: 'Connection closed',
  connectionError: 'Connection error',
  reconnectFailed: 'Reconnect failed',
  reconnecting: (attempt) => `Reconnecting... Attempt ${attempt}`,
  browseAllDocumentation: 'Every template and field this value can use, by group.',
  clipboardRefused: 'The browser did not allow copying to the clipboard.',
  typeBool: 'True or false',
  typeDate: 'Date',
  typeString: 'Text',
  typeBinary: 'Binary data',
  typeFloat: 'Number',
  typeList: 'List',
  typeHash: 'Key/Value {}',
  typeInt: 'Whole number',
  typeColor: 'RGB Color',
};
