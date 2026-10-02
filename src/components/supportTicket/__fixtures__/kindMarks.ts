import { defaultInterfaceIcon, TInterfaceKindIcon } from '../meta';

/* Stand-ins for a host's kind marks in stories. Inline, so they load offline. */

/** A green Qog-like mark: loads. */
export const STORY_QOG_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2e9d4f"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg>'
)}`;

/** A trigger app's logo: loads. */
export const STORY_APP_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="#229ed9"/></svg>'
)}`;

/** An image that can never load (malformed data URI). */
export const STORY_BROKEN_IMAGE = 'data:image/png;base64,not-an-image';

/** The IDE's resolver: a Qog is its green mark (font icon fallback); the rest, font icons. */
export const storyKindMark = (kind: string): TInterfaceKindIcon =>
  kind === 'fsm' || kind === 'qog' ?
    { icon: 'FlowChart', image: STORY_QOG_IMAGE }
  : defaultInterfaceIcon(kind);

/** The same, with a Qog image that fails to load. */
export const storyBrokenKindMark = (kind: string): TInterfaceKindIcon =>
  kind === 'fsm' || kind === 'qog' ?
    { icon: 'FlowChart', image: STORY_BROKEN_IMAGE }
  : defaultInterfaceIcon(kind);
