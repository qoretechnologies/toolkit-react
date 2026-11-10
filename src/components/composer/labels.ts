// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The words of the message composer. A host that translates its interface gives its own (`setReqraftLabels`); the rest stay English.
 */
export interface IComposerLabels {
  /** The empty editor's placeholder, where the composer is not given one. */
  placeholder: string;
  /** The send button, where the composer is not given a label. */
  send: string;
  /** The tooltip of the button that takes a staged file off the message. */
  removeAttachment: string;
  /** The tooltip of the attach menu, when it offers more than uploading. */
  attach: string;
  /** The attach menu's entry that picks files to upload. */
  uploadFiles: string;
  /** The tooltip of the attach button, when uploading is all it does. */
  attachFiles: string;
  /** The tooltip of the caret beside a split send button. */
  moreSendOptions: string;
}

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_COMPOSER_LABELS: IComposerLabels = {
  placeholder: 'Write a message…',
  send: 'Send',
  removeAttachment: 'Remove attachment',
  attach: 'Attach',
  uploadFiles: 'Upload files',
  attachFiles: 'Attach files',
  moreSendOptions: 'More send options',
};
