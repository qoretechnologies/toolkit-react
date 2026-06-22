/**
 * Lightweight stand-in for qorus-ide's dismissible `Hint`. Renders an
 * inline info callout — the toolkit has no per-user "remembered hint"
 * persistence, so the `id` is accepted for API parity and ignored.
 */
import { ReqoreMessage } from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ReactNode } from 'react';

export interface IHintProps {
  /** Stable id — accepted for parity with the app's `Hint`; unused here. */
  id?: string;
  title?: string;
  icon?: IReqoreIconName;
  children?: ReactNode;
}

export const Hint = ({ title, icon, children }: IHintProps) => (
  <ReqoreMessage intent='info' icon={icon} flat minimal size='small' title={title}>
    {children}
  </ReqoreMessage>
);
