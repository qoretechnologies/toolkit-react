// Copyright 2026 Qore Technologies, s.r.o.

/** The words of support tickets: their thread, references, status and workspace access. */
export interface ITicketLabels {
  rename: string;
  clickToPreview: string;
  openXX: (interfacekind: unknown, interfacename: unknown) => string;
  removeXX: (interfacekind: unknown, interfacename: unknown) => string;
  referenceInterfaces: string;
  noXOnThisInstance: (value: unknown) => string;
  noXMatchXOtherTypes: (value: unknown, value2: unknown) => string;
  nothingMatchesX: (value: unknown) => string;
  couldnTLoadX: (value: unknown) => string;
  loading: string;
  removeX: (name: unknown) => string;
  xIsAlreadyReferenced: (name: unknown) => string;
  referenceX: (name: unknown) => string;
  searchTypesAndInterfaces: string;
  thisTicketIsClosedOpenA: string;
  writeAReply: string;
  addInternalNote: string;
  sendReply: string;
  byYou: string;
  byTheCustomer: string;
  bySupport: string;
  accessEndedX: (value: unknown) => string;
  endsX: (value: unknown) => string;
  grantedXX: (value: unknown, ends: unknown) => string;
  untilXX: (value: unknown, value2: unknown) => string;
  accessXX: (value: unknown, value2: unknown) => string;
  forX: (value: unknown) => string;
  qorusSupportAsksForAccessX: (duration: unknown, since: unknown) => string;
  requestedXAwaitingTheCustomerX: (duration: unknown, since: unknown) => string;
  offYourSettingIsNever: string;
  notAllowedTheAccountSSetting: string;
  none: string;
  orWhenTheTicketIsResolved: string;
  unknown: string;
  grantedAutomatically: string;
  readOnlyAccessForQorusSupport: string;
  askTheCustomer: string;
  supportAsksOnEachTicketThe: string;
  never: string;
  noWorkspaceAccessForQorusSupport: string;
  theDefaultNeverChosen: string;
  chosenAtSignUp: string;
  chosenWhenFirstAsked: string;
  chosenInTheAccountSettings: string;
  setByQorusStaff: string;
  theWorkspaceOwnerSStricterSetting: string;
  active: string;
  revoked: string;
  expired: string;
  endedByTheCustomer: string;
  endedBySupport: string;
  extendedIntoANewGrant: string;
  endedWhenTheTicketWasResolved: string;
  endedWhenTheTicketWasClosed: string;
  endedWhenTheAccountSSetting: string;
  endedWhenTheAccountWasErased: string;
  endedWhenTheWorkspaceWasDeleted: string;
  ranOut: string;
  endedByYou: string;
  endedByQorusSupport: string;
  t24Hours: string;
  t3Days: string;
  t7Days: string;
  untilTheTicketIsResolved: string;
  settingChanged: string;
  accessRequested: string;
  accessGranted: string;
  accessExtended: string;
  accessEnded: string;
  accessExpired: string;
  workspaceRead: string;
  readRefused: string;
  ideSessionStarted: string;
  ideSessionEnded: string;
  justNow: string;
  qorusSupport: string;
  xSReadOnlyAccessTo: (GRANTEE: unknown, value: unknown) => string;
  couldNotDownloadTheAttachment: string;
  couldNotLoadTheAttachment: string;
  couldNotReadX: (name: unknown) => string;
  new: string;
  open: string;
  awaitingCustomer: string;
  awaitingYourReply: string;
  resolved: string;
  closed: string;
  low: string;
  normal: string;
  high: string;
  urgent: string;
  bug: string;
  question: string;
  billing: string;
  featureRequest: string;
  other: string;
  replied: string;
  internalNote: string;
  assigned: string;
  updated: string;
  viewed: string;
  attachmentDownloaded: string;
  workspaceViewed: string;
  accessRevoked: string;
  ideSessionLaunched: string;
  activity: string;
  workspaceAccessRequested: string;
  workspaceAccessGranted: string;
  workspaceAccessExtended: string;
  workspaceOpenedBySupport: string;
  workspaceAccessRevoked: string;
  workspaceAccessExpired: string;
  system: string;
  workflows: string;
  services: string;
  jobs: string;
  qogs: string;
  connections: string;
  mappers: string;
  classes: string;
  valueMaps: string;
  aiCollections: string;
  aiEndpoints: string;
  aiGuardrails: string;
  archive: string;
  data: string;
  markdown: string;
  log: string;
  text: string;
  file: string;
  allTypes: string;
  linkedInterfaces: string;
  screenshots: string;
  documents: string;
  logs: string;
  archives: string;
  newestFirst: string;
  oldestFirst: string;
  moreActions: string;
  showInChat: string;
  filedOnTheTicketNotIn: string;
  loadingReferences: string;
  noReferencesOrFilesYet: string;
  interfaceReferencesAndAnyScreenshotsDocuments: string;
  searchFilesAndReferences: string;
  noMatchingReferencesOrFiles: string;
  nothingHereMatchesX: (value: unknown) => string;
  nothingMatchesTheCurrentFilter: string;
  clearFilters: string;
  download: string;
  files: string;
  downloadAll: string;
  addedByX: (uploader: unknown) => string;
  you: string;
  support: string;
  customer: string;
  loadingConversation: string;
  xDownload: (contenttype: unknown) => string;
  xClickToEnlarge: (filename: unknown) => string;
  noMessagesYet: string;
  couldNotDownloadAttachment: string;
  couldNotLoadAttachment: string;
  statusChanged: string;
}

/** The English words. */
export const DEFAULT_TICKET_LABELS: ITicketLabels = {
  rename: 'Rename',
  clickToPreview: 'Click to preview',
  openXX: (interfacekind, interfacename) => `Open ${interfacekind} ${interfacename}`,
  removeXX: (interfacekind, interfacename) => `Remove ${interfacekind} ${interfacename}`,
  referenceInterfaces: 'Reference interfaces',
  noXOnThisInstance: (value) => `No ${value} on this instance`,
  noXMatchXOtherTypes: (value, value2) => `No ${value} match “${value2}” — other types do`,
  nothingMatchesX: (value) => `Nothing matches “${value}”`,
  couldnTLoadX: (value) => `Couldn't load ${value}`,
  loading: 'Loading',
  removeX: (name) => `Remove “${name}”`,
  xIsAlreadyReferenced: (name) => `“${name}” is already referenced`,
  referenceX: (name) => `Reference “${name}”`,
  searchTypesAndInterfaces: 'Search types and interfaces…',
  thisTicketIsClosedOpenA: 'This ticket is closed. Open a new ticket to continue the conversation.',
  writeAReply: 'Write a reply…',
  addInternalNote: 'Add internal note',
  sendReply: 'Send reply',
  byYou: 'by you',
  byTheCustomer: 'by the customer',
  bySupport: 'by support',
  accessEndedX: (value) => `Access ended ${value}`,
  endsX: (value) => ` · ends ${value}`,
  grantedXX: (value, ends) => `Granted ${value}${ends}`,
  untilXX: (value, value2) => `Until ${value}${value2}`,
  accessXX: (value, value2) => `Access ${value}${value2}`,
  forX: (value) => ` for ${value}`,
  qorusSupportAsksForAccessX: (duration, since) =>
    `Qorus Support asks for access${duration} · ${since}`,
  requestedXAwaitingTheCustomerX: (duration, since) =>
    `Requested${duration} · awaiting the customer · ${since}`,
  offYourSettingIsNever: 'Off: your setting is never',
  notAllowedTheAccountSSetting: "Not allowed: the account's setting is never",
  none: 'None',
  orWhenTheTicketIsResolved: ', or when the ticket is resolved',
  unknown: 'Unknown',
  grantedAutomatically: 'Granted automatically',
  readOnlyAccessForQorusSupport:
    'Read-only access for Qorus Support is granted automatically on every ticket filed.',
  askTheCustomer: 'Ask the customer',
  supportAsksOnEachTicketThe:
    'Support asks on each ticket; the customer decides whether to grant access.',
  never: 'Never',
  noWorkspaceAccessForQorusSupport:
    'No workspace access for Qorus Support. Support asks for information in the thread instead.',
  theDefaultNeverChosen: 'the default, never chosen',
  chosenAtSignUp: 'chosen at sign-up',
  chosenWhenFirstAsked: 'chosen when first asked',
  chosenInTheAccountSettings: 'chosen in the account settings',
  setByQorusStaff: 'set by Qorus staff',
  theWorkspaceOwnerSStricterSetting: "the workspace owner's stricter setting",
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired',
  endedByTheCustomer: 'ended by the customer',
  endedBySupport: 'ended by support',
  extendedIntoANewGrant: 'extended into a new grant',
  endedWhenTheTicketWasResolved: 'ended when the ticket was resolved',
  endedWhenTheTicketWasClosed: 'ended when the ticket was closed',
  endedWhenTheAccountSSetting: "ended when the account's setting changed",
  endedWhenTheAccountWasErased: 'ended when the account was erased',
  endedWhenTheWorkspaceWasDeleted: 'ended when the workspace was deleted',
  ranOut: 'ran out',
  endedByYou: 'ended by you',
  endedByQorusSupport: 'ended by Qorus Support',
  t24Hours: '24 hours',
  t3Days: '3 days',
  t7Days: '7 days',
  untilTheTicketIsResolved: 'until the ticket is resolved',
  settingChanged: 'Setting changed',
  accessRequested: 'Access requested',
  accessGranted: 'Access granted',
  accessExtended: 'Access extended',
  accessEnded: 'Access ended',
  accessExpired: 'Access expired',
  workspaceRead: 'Workspace read',
  readRefused: 'Read refused',
  ideSessionStarted: 'IDE session started',
  ideSessionEnded: 'IDE session ended',
  justNow: 'just now',
  qorusSupport: 'Qorus Support',
  xSReadOnlyAccessTo: (GRANTEE, value) =>
    `${GRANTEE}'s read-only access to this workspace ${value}.`,
  couldNotDownloadTheAttachment: 'Could not download the attachment',
  couldNotLoadTheAttachment: 'Could not load the attachment',
  couldNotReadX: (name) => `Could not read ${name}`,
  new: 'New',
  open: 'Open',
  awaitingCustomer: 'Awaiting customer',
  awaitingYourReply: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  bug: 'Bug',
  question: 'Question',
  billing: 'Billing',
  featureRequest: 'Feature request',
  other: 'Other',
  replied: 'Replied',
  internalNote: 'Internal note',
  assigned: 'Assigned',
  updated: 'Updated',
  viewed: 'Viewed',
  attachmentDownloaded: 'Attachment downloaded',
  workspaceViewed: 'Workspace viewed',
  accessRevoked: 'Access revoked',
  ideSessionLaunched: 'IDE session launched',
  activity: 'Activity',
  workspaceAccessRequested: 'Workspace access requested',
  workspaceAccessGranted: 'Workspace access granted',
  workspaceAccessExtended: 'Workspace access extended',
  workspaceOpenedBySupport: 'Workspace opened by support',
  workspaceAccessRevoked: 'Workspace access revoked',
  workspaceAccessExpired: 'Workspace access expired',
  system: 'System',
  workflows: 'Workflows',
  services: 'Services',
  jobs: 'Jobs',
  qogs: 'Qogs',
  connections: 'Connections',
  mappers: 'Mappers',
  classes: 'Classes',
  valueMaps: 'Value maps',
  aiCollections: 'AI collections',
  aiEndpoints: 'AI endpoints',
  aiGuardrails: 'AI guardrails',
  archive: 'Archive',
  data: 'Data',
  markdown: 'Markdown',
  log: 'Log',
  text: 'Text',
  file: 'File',
  allTypes: 'All types',
  linkedInterfaces: 'Linked interfaces',
  screenshots: 'Screenshots',
  documents: 'Documents',
  logs: 'Logs',
  archives: 'Archives',
  newestFirst: 'Newest first',
  oldestFirst: 'Oldest first',
  moreActions: 'More actions',
  showInChat: 'Show in chat',
  filedOnTheTicketNotIn: 'Filed on the ticket, not in a reply',
  loadingReferences: 'Loading references…',
  noReferencesOrFilesYet: 'No references or files yet',
  interfaceReferencesAndAnyScreenshotsDocuments:
    'Interface references and any screenshots, documents, or files attached to this ticket will appear here.',
  searchFilesAndReferences: 'Search files and references…',
  noMatchingReferencesOrFiles: 'No matching references or files',
  nothingHereMatchesX: (value) => `Nothing here matches “${value}”.`,
  nothingMatchesTheCurrentFilter: 'Nothing matches the current filter.',
  clearFilters: 'Clear filters',
  download: 'Download',
  files: 'Files',
  downloadAll: 'Download all',
  addedByX: (uploader) => `added by ${uploader}`,
  you: 'You',
  support: 'Support',
  customer: 'Customer',
  loadingConversation: 'Loading conversation',
  xDownload: (contenttype) => `${contenttype} · download`,
  xClickToEnlarge: (filename) => `${filename} — click to enlarge`,
  noMessagesYet: 'No messages yet',
  couldNotDownloadAttachment: 'Could not download the attachment',
  couldNotLoadAttachment: 'Could not load the attachment',
  statusChanged: 'Status changed',
};
