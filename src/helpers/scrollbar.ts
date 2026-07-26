import { css } from 'styled-components';

/*
 * The thin, unobtrusive scrollbar the Qorus surfaces use — a transparent track and a
 * translucent rounded thumb — in place of the platform default, which reads as heavy
 * chrome inside a dark panel. Drop it into any `styled` scroll container:
 *
 *   const Scroll = styled.div`
 *     overflow-y: auto;
 *     ${thinScrollbar}
 *   `;
 *
 * webkit-only on purpose: setting `scrollbar-width` as well lets Chromium override this
 * custom 6px with its own wider "thin", so the two disagree. Firefox keeps its native
 * bar, which is already slim.
 */
export const thinScrollbar = css`
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.28);
  }
`;
